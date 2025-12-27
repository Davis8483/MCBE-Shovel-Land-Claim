import { world, system, Player, Vector3, ItemStack, EntityQueryOptions, EntityRidingComponent, BlockComponentTypes, EntityComponentTypes, EntityInventoryComponent, MolangVariableMap, EntityHealthComponent, Dimension, EntityLeashableComponent, Block, BlockVolume, InvalidContainerSlotError, VectorXZ, PlayerPermissionLevel, InvalidEntityError, EntityDamageCause, RGB, PlatformType, Entity, WorldLoadAfterEvent } from '@minecraft/server';
import { database, PlayerData, Claim, PermissionTypes, settings, ShovelBehavior, ClaimBlocksBehavior, ShovelMobileMode, NameDisplayBehavior } from './database.js';
import { playSound, AddonSounds } from './sounds.js';
import { NotificationManagerStack } from './notifications.js';
import { ShovelUI } from './shovel_ui.js';
import { runInAllClaims, getClosestPlayer, SHOVEL_ID, updateShovelBehavior, getDistance, waitForEntityLoad } from './utils.js'
import { EntityLoaderManager } from './entity_protection.js';

world.afterEvents.playerJoin.subscribe((data) => {

    var playerData= PlayerData.fromId(data.playerId);

    // player is not saved in db
    if (!playerData) {
        const newPlayer = new PlayerData(data.playerId, data.playerName);

        // create new player in db
        database.push(newPlayer);

        playerData = newPlayer;
    }

    // update player name in db to current; in case they changed it
    playerData.setName(data.playerName);

    // set other values to default
    playerData.setViewingClaim(false);
    playerData.setResizingClaimName("");

    // if player is not in a claim this flag will automatically be set back to false
    playerData.setPendingEntranceDisallow(true);

    // Wait for the player to be fully loaded and defined within the world
    let intervalId = system.runInterval(() => {
        const player = world.getAllPlayers().find(p => p.id === data.playerId);
        if (player) {
            system.clearRun(intervalId);

            // updates how the shovel is stored/given to the player; ex: locking to inventory
            updateShovelBehavior(player, settings.claimShovelItemBehavior)

            // if player is not on mobile, indicate this by setting mobile mode to null
            if (player.clientSystemInfo.platformType != PlatformType.Mobile) {
                playerData.setMobileMode(null);
            }
            // otherwise default it back to opening the menu
            else {
                playerData.setMobileMode(ShovelMobileMode.MENU);
            }
        }
    }, 10);
});

world.afterEvents.playerLeave.subscribe((data) => {

    var playerData = PlayerData.fromId(data.playerId);

    // remove claim view ticking area if player left while viewing a claim
    if (playerData.viewingClaim) {
        world.getDimension("overworld").runCommand("tickingarea remove claimView");
    }
});

world.afterEvents.playerSpawn.subscribe((data) => {

    // updates how the shovel is stored/given to the player; ex: locking to inventory
    updateShovelBehavior(data.player, settings.claimShovelItemBehavior)

    // set flag to false since all camera positions will be reset upon rejoining
    PlayerData.fromId(data.player.id).setViewingClaim(false);
});

// open menu when claim shovel is used
world.afterEvents.itemUse.subscribe((data) => {
    const playerData = PlayerData.fromId(data.source.id)
    const notifManager = NotificationManagerStack.getById(data.source.id);

    // if player is on mobile make sure that the shovel is in menu opening mode
    if ((data.itemStack.typeId == SHOVEL_ID) && ((playerData.mobileMode == null) || (playerData.mobileMode == ShovelMobileMode.MENU))) {

        // if player is an admin, show the setup ui if not seen yet
        if ((data.source.playerPermissionLevel == PlayerPermissionLevel.Operator) && !playerData.shownSetupScreen) {
            new ShovelUI(data.source, notifManager).opAddonSetup();
        }
        // if the player hasn't seen the changelog yet
        else if (!playerData.shownChangeLog) {
            new ShovelUI(data.source, notifManager).viewChangeLog();
        }
        // otherwise just show the main menu
        else {
            new ShovelUI(data.source, notifManager).main();
        }
    };
});

// if player switches off of the claim shovel, reset first point and resizing claim name
world.afterEvents.playerHotbarSelectedSlotChange.subscribe((data) => {
    const playerData = PlayerData.fromId(data.player.id);
    const notifManager = NotificationManagerStack.getById(data.player.id);

    const inventory = data.player.getComponent(EntityComponentTypes.Inventory).container;

    try {
        // if new item is not a claim shovel and the previous item was a claim shovel, reset first point and resizing claim name
        if ((!data.itemStack || data.itemStack.typeId != SHOVEL_ID) && (inventory.getSlot(data.previousSlotSelected).typeId == SHOVEL_ID)) {
            if (playerData.resizingClaimName.length > 0) {
                // send notif that claim creation has been canceled
                notifManager.send(data.player, AddonSounds.Global.WARN_EVENT, undefined, "chat.claim:claim_resize_canceled");
            }
            else if (playerData.firstPoint != null) {
                playerData.setFirstPoint(null);

                // send notif that resizing has been canceled
                notifManager.send(data.player, AddonSounds.Global.WARN_EVENT, undefined, "chat.claim:claim_creation_canceled");
            }

            // if player is on mobile, switch back to menu opening mode
            if (data.player.clientSystemInfo.platformType == PlatformType.Mobile) {
                playerData.setMobileMode(ShovelMobileMode.MENU);
            }
        }
    } catch (error) {
        if (error instanceof InvalidContainerSlotError) {
            // this error is expected if the player switches from an empty slot
        } else {
            throw error;
        }
    }
});

// Set/adjust claim points if player is sneaking
world.beforeEvents.playerBreakBlock.subscribe((data) => {

    const playerData = PlayerData.fromId(data.player.id);
    const notifManager = NotificationManagerStack.getById(data.player.id);

    if (data.itemStack?.typeId == SHOVEL_ID) {
        // stop the shovel from breaking the block
        data.cancel = true;

        // if player is on mobile, make sure the shovel is in claim creation mode
        if (!((playerData.mobileMode == null) || (playerData.mobileMode == ShovelMobileMode.CLAIM))) {
            return;
        }

        // player is not in the overworld, warn them that they are not allowed to create a claim here
        if (!(data.dimension == world.getDimension("overworld"))) {
            notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.shovel:dimension_warning");

            return;
        }

        // only allow if cooldown is over
        if (data.player.getItemCooldown("land_shovel_use") == 0) {

            // start shovel cooldown of 1 sec
            system.run(() => {
                data.player.startItemCooldown("land_shovel_use", 20);
            });

            var isResize = false;

            if (!data.player.isSneaking) {
                playerData.setResizingClaimName("");
                playerData.setFirstPoint(data.block.location);

                runInAllClaims((claim) => {

                    // user defined start and end points of the claim
                    var s = claim.start;
                    var e = claim.end;

                    // all 4 points of the claim
                    var points = [
                        [[s.x, s.z], [s.x, e.z]],
                        [[e.x, s.z], [e.x, e.z]]
                    ];

                    var aIndex = null;
                    var bIndex = null;

                    // find the index of the broken block
                    for (var a = 0; a < points.length; a++) {
                        for (var b = 0; b < points[a].length; b++) {
                            if (points[a][b][0] == data.block.x && points[a][b][1] == data.block.z) {
                                aIndex = a;
                                bIndex = b;
                            }
                        }
                    }

                    // if broken block is on a claim corner
                    if (aIndex != null) {
                        isResize = true;
                        if (claim.getOwnerData().id == data.player.id) {
                            playerData.setOppositeCorner({ "x": points[aIndex ^ 1][bIndex ^ 1][0], "y": data.block.y, "z": points[aIndex ^ 1][bIndex ^ 1][1] });
                            playerData.setResizingClaimName(claim.name);

                            notifManager.send(data.player, AddonSounds.Shovel.RESIZE, undefined, "chat.point.resize:selected", data.block.x.toString(), data.block.y.toString(), data.block.z.toString());

                        } else {
                            notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.point.resize:disallowed");
                        }
                    }
                });

                if (!isResize) {
                    notifManager.send(data.player, AddonSounds.Shovel.SELECT, undefined, "chat.point.new:selected", data.block.x.toString(), data.block.y.toString(), data.block.z.toString());
                }
            }
            // if player is crouching
            else {
                var secondPoint = { ...data.block.location }; // Ensure a new object is created
                var claimIntersectingClaim = false;
                var playerIntersectingClaim = false;

                // if player has not set the first point yet
                if (playerData.firstPoint == null) {
                    // notify and don't continue with claim creation
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:point_not_set");
                }
                // if claim is resized
                else if (playerData.resizingClaimName.length > 0) {

                    // get the claim object that is being resized
                    var resizingClaim = playerData.getClaim(playerData.resizingClaimName);

                    const oldClaimWidth = Math.abs(resizingClaim.start.x - resizingClaim.end.x) + 1;
                    const oldClaimLength = Math.abs(resizingClaim.start.z - resizingClaim.end.z) + 1;

                    const newClaimWidth = Math.abs(playerData.oppositeCorner.x - secondPoint.x) + 1;
                    const newClaimLength = Math.abs(playerData.oppositeCorner.z - secondPoint.z) + 1;

                    const blockDifference = (newClaimLength * newClaimWidth) - (oldClaimLength * oldClaimWidth);

                    // make sure new claim isn't intersecting others not counting itself
                    runInAllClaims((claim) => {
                        if (claim.isOverlap(playerData.oppositeCorner, secondPoint) && ((claim.getOwnerData().id != data.player.id) || (claim.name != playerData.resizingClaimName))) {
                            claimIntersectingClaim = true;
                        }
                    });

                    // make sure another player isn't in the area
                    for (var p of world.getAllPlayers()) {
                        // we are creating a claim object just to use the isOverlap utility, this is not saved to the database
                        if (new Claim("", playerData.oppositeCorner, secondPoint, "").isOverlap(p.location) && (p.id != data.player.id)) {
                            playerIntersectingClaim = true;
                        }
                    }

                    // intersecting claim warning message, cancel resize
                    if (claimIntersectingClaim) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:claim_intersecting");
                    }
                    // player is in the way warning message, cancel resize
                    else if (playerIntersectingClaim) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:player_intersecting");
                    }
                    // claim isn't wide enough warning message, cancel resize
                    else if (newClaimWidth < settings.claimMinimumWidth || newClaimLength < settings.claimMinimumWidth) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:width", settings.claimMinimumWidth.toString());
                    }
                    // not enough claim blocks warning message, cancel resize
                    else if ((playerData.claimBlocks.behavior != ClaimBlocksBehavior.UNLIMITED) && (playerData.claimBlocks.amount < blockDifference)) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:blocks_resize", ((blockDifference) - playerData.claimBlocks.amount).toString());
                    }
                    // all requirements met, open the claim resizing ui
                    else {
                        system.run(() => {
                            playSound(data.player, AddonSounds.Shovel.SELECT);
                            new ShovelUI(data.player, notifManager).resizeClaim(resizingClaim, playerData.oppositeCorner, secondPoint);
                        });
                    }
                }
                // not resizing, create a new claim
                else {

                    const claimWidth = Math.abs(playerData.firstPoint.x - secondPoint.x) + 1;
                    const claimLength = Math.abs(playerData.firstPoint.z - secondPoint.z) + 1;

                    runInAllClaims((claim) => {
                        // make sure new claim isn't intersecting others
                        if (claim.isOverlap(playerData.firstPoint, secondPoint)) {
                            claimIntersectingClaim = true;
                        }
                    });

                    // make sure another player isn't in the area
                    for (var p of world.getAllPlayers()) {
                        // we are creating a claim object just to use the isOverlap utility, this is not saved to the database
                        if (new Claim("", playerData.firstPoint, secondPoint, "").isOverlap(p.location) && (p.id != data.player.id)) {
                            playerIntersectingClaim = true;
                        }
                    }

                    // intersecting claim warning message, cancel creation
                    if (claimIntersectingClaim) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:claim_intersecting");
                    }
                    // player is in the way warning message, cancel creation
                    else if (playerIntersectingClaim) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:player_intersecting");
                    }
                    // claim is not wide enough warning message, cancel creation
                    else if (claimWidth < settings.claimMinimumWidth || claimLength < settings.claimMinimumWidth) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:width", settings.claimMinimumWidth.toString());
                    }
                    // not enough claim blocks warning message, cancel creation
                    else if ((playerData.claimBlocks.behavior != ClaimBlocksBehavior.UNLIMITED) && (playerData.claimBlocks.amount < (claimWidth * claimLength))) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:blocks_new", ((claimWidth * claimLength) - playerData.claimBlocks.amount).toString());
                    }
                    // check if this new claim doesn't exceed the players max number of claims
                    else if ((settings.maxClaimAmount > 0) && (playerData.claims.length >= settings.maxClaimAmount)) {
                        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:max_claims", playerData.claims.length.toString());
                    }
                    // all requirements are met, open the claim creation ui
                    else {
                        system.run(() => {
                            playSound(data.player, AddonSounds.Shovel.SELECT);
                            new ShovelUI(data.player, notifManager).newClaim(playerData.firstPoint, secondPoint);
                        });
                    }
                }

            }
        }

    }
    else {
        if (playerData.viewingClaim) {
            data.cancel = true;
        }
        else if (data.dimension == world.getDimension("overworld")) {
            runInAllClaims((claim) => {
                // check if a block is broken by a player without permissions within the claim
                if (claim.isOverlap(data.block) && !claim.hasPermission(PermissionTypes.BREAK_BLOCKS, data.player)) {
                    data.cancel = true;

                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:break_blocks");

                }
            });
        }
    }
});

world.beforeEvents.explosion.subscribe((data) => {

    if (data.dimension == world.getDimension("overworld")) {

        var impactedBlocks = data.getImpactedBlocks();

        // find player closest to the explosion, we'll assume this is the player that placed the tnt
        const closestPlayer: Player = getClosestPlayer(data.source.location);
        const notifManager = NotificationManagerStack.getById(closestPlayer.id);

        // flag to send notification
        var sendDisallowedNotification = false;

        // check if tnt blast effects a claim
        runInAllClaims((claim) => {

            // if entity is a mob or player that doesn't have permissions
            if ((data.source.typeId != "minecraft:tnt") || !claim.hasPermission(PermissionTypes.USE_TNT)) {
                // remove all impacted blocks that lie within the claim
                for (var i = 0; i < impactedBlocks.length; i++) {
                    var block = impactedBlocks[i]

                    if (claim.isOverlap(block)) {
                        // remove the block
                        impactedBlocks.splice(impactedBlocks.indexOf(block), 1);

                        // set notification flag
                        sendDisallowedNotification = true;

                        // account for deletion
                        i--;
                    }
                }
            }
        });

        // update impacted blocks
        data.setImpactedBlocks(impactedBlocks);

        // if tnt effected a claim notify player
        if ((data.source.typeId == "minecraft:tnt") && sendDisallowedNotification) {
            notifManager.send(closestPlayer, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:use_tnt");
        }

    }
});

// stop pistons from interacting with claims on the outside
world.afterEvents.pistonActivate.subscribe((data) => {

    if (data.dimension == world.getDimension("overworld") && (data.piston.getAttachedBlocks().length > 0)) {

        var b = data.piston.getAttachedBlocks()[0]
        if (data.isExpanding) {
            var directionOffset = {
                "x": Math.max(Math.min(b.x - data.block.x, 1), -1),
                "y": Math.max(Math.min(b.y - data.block.y, 1), -1),
                "z": Math.max(Math.min(b.z - data.block.z, 1), -1)
            };
        }
        else {
            var directionOffset = {
                "x": Math.max(Math.min(data.block.x - b.x, 1), -1),
                "y": Math.max(Math.min(data.block.y - b.y, 1), -1),
                "z": Math.max(Math.min(data.block.z - b.z, 1), -1)
            };
        }

        // flag to determine if piston use is allowed
        var allowed = true;

        // check if any of the blocks are in a claim
        for (var block of data.piston.getAttachedBlocks()) {

            if (data.isExpanding) {
                var b = block.offset(directionOffset);
            }

            runInAllClaims((claim) => {

                // if block is in claim but not piston
                if (claim.isOverlap(b.location) && !claim.isOverlap(data.piston.block.location)) {
                    allowed = false;
                }
            });
        }

        // if attached block is in a claim but pistion is not, disallow the action
        if (!allowed) {
            for (var block of data.piston.getAttachedBlocks().reverse()) {
                data.dimension.runCommand(`clone ${block.x + directionOffset.x} ${block.y + directionOffset.y} ${block.z + directionOffset.z} ${block.x + directionOffset.x} ${block.y + directionOffset.y} ${block.z + directionOffset.z} ${block.x} ${block.y} ${block.z} replace move`)
            }

            // remove the offending piston
            data.dimension.runCommand(`setblock ${data.piston.block.location.x} ${data.piston.block.location.y} ${data.piston.block.location.z} air`)

            // drop the piston item
            const pistonDrop = new ItemStack(data.piston.typeId)
            data.dimension.spawnItem(pistonDrop, data.block.location);

            // get closest player to piston, we will assume they activated it
            const closestPlayer: Player = getClosestPlayer(data.piston.block.location)
            const notifManager = NotificationManagerStack.getById(closestPlayer.id);

            // notify player
            notifManager.send(closestPlayer, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:piston");
        }
    }

});

world.beforeEvents.itemUse.subscribe((data) => {

    // disallow player from using items while viewing claim
    if (PlayerData.fromId(data.source.id).viewingClaim) {
        data.cancel = true;
    }
});

world.beforeEvents.playerInteractWithEntity.subscribe((data) => {

    const notifManager = NotificationManagerStack.getById(data.player.id);

    if (data.target.dimension == world.getDimension("overworld")) {
        runInAllClaims((claim) => {

            const margin = 0.5;
            var start = { x: data.target.location.x - margin, y: data.target.location.y - margin, z: data.target.location.z - margin };
            var end = { x: data.target.location.x + margin, y: data.target.location.y + margin, z: data.target.location.z + margin };

            // if player has interacted with an entity in a claim
            if (claim.isOverlap(start, end)){
                // disallow player from interacting with rideable entities if they are not allowed to enter the claim
                if (!claim.hasPermission(PermissionTypes.ENTER_CLAIM, data.player) && data.target.getComponent(EntityComponentTypes.Rideable)) {
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:enter_claim");
                }

                // disallow player from interacting with item displays (armor stands) based on permissions
                if (!claim.hasPermission(PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS, data.player) && data.target.typeId == "minecraft:armor_stand") {
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:interact_with_item_displays");
                }
                // disallow player from interacting with entities based on permissions
                else if(!claim.hasPermission(PermissionTypes.INTERACT_WITH_ENTITIES, data.player)) {

                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:interact_with_entities");
                }
            }
        });
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe((data) => {

    const notifManager = NotificationManagerStack.getById(data.player.id);

    // blocks that are disabled by admin; can't be placed
    if (data.itemStack && settings.disallowedBlocks.includes(data.itemStack.typeId)) {
        // notify player
        notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.world:disabled_item");

        data.cancel = true;
    }

    // we can't detect where a block is placed so we must figure that out based on the face of the used on block
    const faces = {
        "North": data.block.north(1),
        "East": data.block.east(1),
        "South": data.block.south(1),
        "West": data.block.west(1),
        "Up": data.block.above(1),
        "Down": data.block.below(1)
    };
    const placedBlock = faces[data.blockFace] as Vector3;

    // disable input when viewing a claim
    if (PlayerData.fromId(data.player.id).viewingClaim) {
        data.cancel = true;
    }

    if (data.block.dimension == world.getDimension("overworld")){
        runInAllClaims((claim) => {
                
            // door interaction permissions
            if (claim.isOverlap(data.block.location) && (data.block.typeId.includes("door") || data.block.typeId.includes("fence_gate")) && !(data.player.isSneaking && data.itemStack)) {
                if (!claim.hasPermission(PermissionTypes.USE_DOORS, data.player)){
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:use_doors");

                }
            }
            // lever/button interaction permissions
            else if (claim.isOverlap(data.block.location) && (data.block.matches("minecraft:lever") || data.block.typeId.includes("button")) && !(data.player.isSneaking && data.itemStack)) {
                if (!claim.hasPermission(PermissionTypes.USE_SWITCHES, data.player)){
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:use_switches");
                }
            }
            // bed interaction permissions
            else if (claim.isOverlap(data.block.location) && data.block.matches("minecraft:bed") && !(data.player.isSneaking && data.itemStack)) {
                if (!claim.hasPermission(PermissionTypes.USE_BEDS, data.player)){
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:use_beds");

                }
            }
            // opening chests/container permissions
            else if (claim.isOverlap(data.block.location) && data.block.getComponent(BlockComponentTypes.Inventory) && !(data.player.isSneaking && data.itemStack)) {
                if (!claim.hasPermission(PermissionTypes.OPEN_CONTAINERS, data.player)){
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:open_containers");
                }
            }
            // editing signs permissions
            else if (claim.isOverlap(data.block.location) && data.block.getComponent(BlockComponentTypes.Sign) && !(data.player.isSneaking && data.itemStack) && !data.itemStack?.matches("minecraft:honeycomb")) {
                if (!claim.hasPermission(PermissionTypes.EDIT_SIGNS, data.player)){
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:edit_signs");
                }
            }
            // item display interaction permissions
            else if (claim.isOverlap(data.block.location) && (data.block.typeId.includes("_shelf") || data.block.matches("minecraft:chiseled_bookshelf")) && !(data.player.isSneaking && data.itemStack)) {
                if (!claim.hasPermission(PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS, data.player)){
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:interact_with_item_displays");
                }
            }
            // block placing/using items on blocks permissions
            else if ((claim.isOverlap(data.block) || claim.isOverlap(placedBlock)) && data.itemStack && (data.itemStack.typeId !== SHOVEL_ID)) {
                if (!claim.hasPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, data.player)){
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    notifManager.send(data.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:use_item_on_block");

                }
            }
        });
    }
});

world.afterEvents.worldLoad.subscribe(() => {
    // remove claim view ticking area if it exists
    world.getDimension("overworld").runCommand("tickingarea remove claimView")
});

/**
 * Create an entity save after its loaded into the world, in case the entity is killed by a disallowed player.
 */
world.afterEvents.entityLoad.subscribe(async (data) => {
    const entityLoaded = await waitForEntityLoad(data.entity, 40); // wait up to 2 seconds for entity to be fully initialized
    const disallowedEntityDeathLocation = world.getDynamicProperty("disallowedEntityDeathLocation") as Vector3; // the location of the last killed entity
    const killedByDisallowedPlayer = disallowedEntityDeathLocation && (getDistance(data.entity.location, disallowedEntityDeathLocation) < 1.5); // if entity was killed by a disallowed player; we don't want to save it again

    /**
     * Note:
     * We don't want to re-save a loaded/revived entity due to the following edge case;
     * 
     * If the entity is in a crowded mob farm, it may be killed and reloaded frequently,
     * leading to possibly accidentally saving two entities within the same structure.
     * 
     * Saving two in the same structure should be handled by the entityLoaderManager,
     * although some can still slip through. So its better to be safe than sorry.
     */
    
    // only save the entity if in the overworld, wasn't killed by a disallowed player, and is fully initialized
    if ((data.entity.dimension == world.getDimension("overworld")) && !killedByDisallowedPlayer && entityLoaded) {
        entityLoaderManager.createSave(data.entity);
    }

    /**
     * Note:
     * We're not worried about removing the disallowedEntityDeathLocation property here
     * because the xp cleanup should handle it anyways.
    */
});

/**
 * Create an entity save after its spawned, in case the entity is killed by a disallowed player.
 * Also removes xp orbs and items spawned by disallowed killed entities.
 * Also also (lol) prevents wither spawning in the overworld.
 */
world.afterEvents.entitySpawn.subscribe(async (data) => {
    try {
        if (data.entity.dimension == world.getDimension("overworld")) {
            
            // items spawn before the hurtEntity event is fired,
            // so we need to wait a couple ticks to ensure the disallowedEntityDeathLocation is set
            if (data.entity.typeId == "minecraft:item") {
                await system.waitTicks(2);
            }

            const disallowedEntityDeathLocation = world.getDynamicProperty("disallowedEntityDeathLocation") as Vector3; // the location of the last killed entity
            const killedByDisallowedPlayer = disallowedEntityDeathLocation && (getDistance(data.entity.location, disallowedEntityDeathLocation) < 1.5);
            const shouldRemoveXP = (data.entity.typeId == "minecraft:xp_orb") && disallowedEntityDeathLocation && (getDistance(data.entity.location, disallowedEntityDeathLocation) < 10);
            const shouldRemoveItem = (data.entity.typeId == "minecraft:item") && disallowedEntityDeathLocation && (getDistance(data.entity.location, disallowedEntityDeathLocation) < 5);

            if (shouldRemoveXP || shouldRemoveItem) {
                data.entity.remove(); // bye bye... xp and or item? :)
            }
            // disallow the wither from spawning in the overworld, as when damaged it will remove blocks and cause griefing
            else if (data.entity.typeId == "minecraft:wither") {

                // get the closest player to the wither spawn location, we will assume they spawned it
                const closestPlayer: Player = getClosestPlayer(data.entity.location);
                const notifManager = NotificationManagerStack.getById(closestPlayer.id);

                // notify player
                notifManager.send(closestPlayer, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.world:wither");

                // return the items to the player
                world.getDimension("overworld").spawnItem(new ItemStack("minecraft:wither_skeleton_skull", 3), data.entity.location);
                world.getDimension("overworld").spawnItem(new ItemStack("minecraft:soul_sand", 4), data.entity.location);

                // remove the wither
                data.entity.remove();
            }
            // if entity was killed by a disallowed player; we don't want to save it again
            else if (!killedByDisallowedPlayer) {

                const entityLoaded = await waitForEntityLoad(data.entity, 40); // wait up to 2 seconds for entity to be fully initialized

                if (entityLoaded) {
                    entityLoaderManager.createSave(data.entity); // save the entity
                }
            }

            // remove the disallowedEntityDeathLocation property if necessary
            if (killedByDisallowedPlayer || shouldRemoveXP) {
                // unless already changed, remove the property after 2 seconds
                // the delay is to ensure all calls of this (entitySpawn) event are processed before the property removal
                const disallowedEntityDeathLocationOld = world.getDynamicProperty("disallowedEntityDeathLocation"); // save old value
                    system.runTimeout(() => {
                        if (disallowedEntityDeathLocationOld === world.getDynamicProperty("disallowedEntityDeathLocation")) {
                        world.setDynamicProperty("disallowedEntityDeathLocation", undefined);
                    }
                }, 2000);
            }
        }
    }
    catch (error) {
        if (error instanceof InvalidEntityError) {
            // this error is expected to occour from time to time
        } else {
            throw error;
        }
    }
});

/**
 * Create an entity save after a player has interacted with it or leashed it to a knot.
 */
world.afterEvents.playerInteractWithEntity.subscribe((data) => {
    try {
        const dimension: Dimension = world.getDimension("overworld");

        if (data.target.dimension == dimension) {
            // if the target is a leash knot, save all entities that could be leashed to it
            if (data.target.typeId == "minecraft:leash_knot") {
                var queryOptions: EntityQueryOptions = {};
                queryOptions.location = data.target.location;
                queryOptions.maxDistance = 15;
                dimension.getEntities(queryOptions).forEach((entity) => {
                    entityLoaderManager.createSave(entity);
                })
            }
            // othewise just save the entity
            else {
                entityLoaderManager.createSave(data.target);
            }
        }
    }
    catch (error) {
        if (error instanceof InvalidEntityError) {
            // this error is expected to occour from time to time
        } else {
            throw error;
        }
    }
});

/**
 * Detect if a player is leashing a mob to a fence and then save the entity.
 */
world.afterEvents.playerInteractWithBlock.subscribe((data) => {
    const dimension: Dimension = world.getDimension("overworld");

    if (data.player.dimension == dimension) {
        var queryOptions: EntityQueryOptions = {};
        queryOptions.maxDistance = 1;
        queryOptions.type = "minecraft:leash_knot";
        queryOptions.location = data.block.location;

        var leashKnot = dimension.getEntities(queryOptions)[0];

        // if a leashKnot exists at the block location, save all entities within a radius of 15 blocks
        if (leashKnot) {
            queryOptions.maxDistance = 15;
            queryOptions.type = undefined;
            dimension.getEntities(queryOptions).forEach((entity) => {
                entityLoaderManager.createSave(entity);
            })
        }
    }
});

const entityLoaderManager = new EntityLoaderManager();

/**
 * If an entity is hurt by a disallowed player/mob reset its health, or (if killed) load its last save.
 */
world.afterEvents.entityHurt.subscribe((data) => {
    const dimension: Dimension = world.getDimension("overworld");
    const healthComponent: EntityHealthComponent = data.hurtEntity.getComponent(EntityComponentTypes.Health);
    var damagePlayerSource: Player; // leaving as undefined will force hasPermission() to check the claims public permissions

    var damageAllowed = true; // flag to indicate if the damage is allowed; used for entity save cleanup upon death

    // if the damaging entity is a player check their permissions to hurt it, otherwise if its a mob or unkown damage source use the claims public permissions
    if (data.damageSource.damagingEntity && (data.damageSource.damagingEntity instanceof Player)) {
        damagePlayerSource = data.damageSource.damagingEntity as Player;
    }

    if (data.hurtEntity.dimension == dimension) {
        runInAllClaims(async (claimData: Claim) => {
            if (claimData.isOverlap(data.hurtEntity.location)) {

                // Check if the action is allowed based on entity type and permissions
                const isMonster = data.hurtEntity.getComponent(EntityComponentTypes.TypeFamily).hasTypeFamily("monster");
                const isPlayer = data.hurtEntity.typeId === "minecraft:player";
                
                const hasMonsterPermission = claimData.hasPermission(PermissionTypes.HURT_MONSTERS, damagePlayerSource);
                const hasPlayerPermission = claimData.hasPermission(PermissionTypes.HURT_PLAYERS, damagePlayerSource);
                const hasMobPermission = claimData.hasPermission(PermissionTypes.HURT_MOBS, damagePlayerSource);

                // If permission exists for the specific entity type, allow the action
                if ((isMonster && hasMonsterPermission) || 
                    (isPlayer && (hasPlayerPermission || !damagePlayerSource)) || // mobs can always hurt players, but players need permission
                    (!isMonster && !isPlayer && hasMobPermission)) {
                    return; // player/mob is allowed to hurt this entity
                }

                damageAllowed = false; // checks have been passed, set flag

                // if it was a player that hurt the entity
                if (damagePlayerSource) {

                    const notifManager = NotificationManagerStack.getById(damagePlayerSource.id);

                    // send the player a notification
                    notifManager.send(damagePlayerSource, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:hurt_entities");
                }

                // check if the game engine will count the entity as dead
                if (healthComponent.currentValue > 0) {
                    // if the entity is still considered alive we'll adjust its health to its previous value
                    healthComponent.setCurrentValue(healthComponent.currentValue + data.damage);

                    entityLoaderManager.createSave(data.hurtEntity); // re-save the entity in case it doesn't have a save on file yet
                }
                // the engine considers the entity as dead so we'll go ahead and load its last save
                else {

                    // skip player entities as they cannot be loaded
                    if (data.hurtEntity.typeId === "minecraft:player") {
                        return;
                    }

                    // save the entity location so we can clean up xp, items, and prevent the loaded entity from being re-saved
                    world.setDynamicProperty("disallowedEntityDeathLocation", data.hurtEntity.location);

                    // save vars so they can be used even after the entity is fully removed from the world
                    const entityID = data.hurtEntity.id;
                    const location: Vector3 = data.hurtEntity.location;
                    const entityTypeID: string = data.hurtEntity.typeId;
                    const leashKnotLocation = data.hurtEntity.getDynamicProperty("leashKnotLocation") as Vector3;

                    // wait until the dead entity is fully removed
                    while (data.hurtEntity.isValid) {
                        await system.waitTicks(20);
                    }

                    // load the entity save
                    entityLoaderManager.loadSave(entityID, location, entityTypeID);

                    // get the new loaded entity
                    var newEntity: Entity = null;
                    var queryOptions: EntityQueryOptions = {};
                    queryOptions.maxDistance = 1;
                    queryOptions.type = entityTypeID;
                    queryOptions.location = location;
                    dimension.getEntities(queryOptions).forEach((e) => {
                        newEntity = e;
                    });

                    const isEntityLoaded = await waitForEntityLoad(newEntity, 20); // wait 1 second for the entity to fully load

                    // if loaded entity was not retrieve successfully do not continue
                    if (!newEntity || !isEntityLoaded) {
                        return;
                    }

                    // if the entity was leashed to a knot, reattach it to the knot
                    if (leashKnotLocation) {
                        var queryOptions: EntityQueryOptions = {};
                        queryOptions.maxDistance = 1;
                        queryOptions.type = "minecraft:leash_knot";
                        queryOptions.location = leashKnotLocation;
                        var leashKnot = dimension.getEntities(queryOptions)[0];

                        // the leash knot doesn't exist spawn a new one
                        if (!leashKnot) {
                            // use an in game command to summon a leash knot, for some reason the dimension.spawnEntity method won't
                            dimension.runCommand(`summon minecraft:leash_knot ${leashKnotLocation.x} ${leashKnotLocation.y} ${leashKnotLocation.z}`)
                            // leashKnot = dimension.spawnEntity("minecraft:leash_knot", leashKnotLocation);

                            leashKnot = dimension.getEntities(queryOptions)[0];
                        }

                        // reattach the leash
                        const leashComponent: EntityLeashableComponent = newEntity.getComponent(EntityComponentTypes.Leashable);
                        leashComponent.leashTo(leashKnot);
                    }

                    // transfer the entity save to the new id
                    entityLoaderManager.transferSave(data.hurtEntity.id, newEntity.id);
                }
            }
        });

        // if the allowed damage killed the entity, remove its save; memory cleanup :thumbs_up:
        if (damageAllowed && (healthComponent.currentValue <= 0)) {
            entityLoaderManager.deleteSave(data.hurtEntity.id);
        }
    }
});

// extinguish fire generated by a fireball being shot from a dispenser in claims
world.afterEvents.projectileHitBlock.subscribe((data) => {
    const block: Block = data.getBlockHit().block;
    
    if (data.projectile.typeId == "minecraft:small_fireball" && block.dimension == world.getDimension("overworld")) {

        // check if the fireball hit a claim
        runInAllClaims((claim) => {
            if (claim.isOverlap(block.location)) {

                // check within a 3 block radius
                const detectionRadius = 3;
                const blockVolume = new BlockVolume(
                    { "x": block.x - detectionRadius, "y": block.y - detectionRadius, "z": block.z - detectionRadius },
                    { "x": block.x + detectionRadius, "y": block.y + detectionRadius, "z": block.z + detectionRadius }
                );

                // remove the fire block
                world.getDimension("overworld").fillBlocks(blockVolume, "minecraft:air", {"blockFilter": {"includeTypes": ["minecraft:fire"]}});

                // get the closest player to the fireball, we will assume they set up the dispenser to shoot it
                const closestPlayer: Player = getClosestPlayer(block.location);
                const notifManager = NotificationManagerStack.getById(closestPlayer.id);

                // notify player
                notifManager.send(closestPlayer, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.fireballs");
            }
        });
    }
});

// core player management in claims, runs every 10 ticks; 500 ms
system.runInterval(() => {
    const playerTeleportThreshold = 10; // max distance a player can move every 10 ticks before they are considered to have teleported

    for (var p of world.getAllPlayers()) {

        const playerData = PlayerData.fromId(p.id);
        const notifManager = NotificationManagerStack.getById(p.id);

        // only run if player is in overworld
        if (p.dimension == world.getDimension("overworld")) {

            // capture the state of player attribute "in-claim" before it is updated
            var inClaimOld: boolean = playerData.inClaim;

            // set flag to false before for loop updates it
            playerData.setInClaim(false);

            runInAllClaims((claim) => {

                // apply an offset to the player location to be more accurate with claim bounds
                const location: Vector3 = { "x": p.location.x - 0.5, "y": p.location.y - 0.5, "z": p.location.z - 0.5 };

                // if player is in the claim
                if (claim.isOverlap(location)) {

                    const distanceMoved = playerData.distanceToPrevLocation();

                    playerData.setInClaim(true);
                    playerData.setInClaimName(claim.name);
                    playerData.setInClaimOwnerName(claim.getOwnerData().name);

                    if ((settings.claimNameDisplayBehavior == NameDisplayBehavior.ACTION_BAR) && !playerData.viewingClaim) {
                        // show claim name and owner onscreen
                        p.onScreenDisplay.setActionBar(
                            {
                                "rawtext": [
                                    { "translate": "actionbar.claim:name_color" },
                                    { "text": `${claim.name}§r - ${claim.getOwnerData().name}` },
                                ]
                            });
                    }

                    // if player is not allowed in claim, apply knockback to remove them
                    if (!claim.hasPermission(PermissionTypes.ENTER_CLAIM, p) && !playerData.pendingEntranceDisallow) {
                        // player has entered claim
                        if (!inClaimOld && playerData.inClaim) {

                            // save entrance velocity
                            playerData.setEntranceVelocity(p.getVelocity());

                            // don't send the notif if a player teleports into a claim, tp disallow notifs are handled later
                            if (!(distanceMoved && (distanceMoved > playerTeleportThreshold))) {
                                // player did not teleport, send a normal notif
                                notifManager.send(p, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:enter_claim");
                            }
                        }

                        const velocity: Vector3 = playerData.entranceVelocity;

                        // detect if player teleported into claim
                        if (distanceMoved && (distanceMoved > playerTeleportThreshold)) {

                            // check to make sure prev location is outside of claim
                            if (!claim.isOverlap(playerData.previousLocation)) {

                                // teleport player back to last known location before teleport
                                p.teleport(playerData.previousLocation);

                                // wait a second before sending the notification, so the sound is played after the tp at the right location
                                system.runTimeout(() => {
                                    notifManager.send(p, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim.permission:teleport_enter_claim");
                                }, 10);
                            }
                        }
                        // player did not teleport, bounce them out of the claim and apply wither
                        else {
                            const knockback: VectorXZ = {"x": (-velocity.x + (Math.sign(-velocity.x) * 0.05)) * 10, "z": (-velocity.z + (Math.sign(-velocity.z) * 0.05)) * 10}
                            
                            // if riding an entity then apply the knockback to that
                            if (p.hasComponent(EntityRidingComponent.componentId)) {
                                const entity = (p.getComponent(EntityRidingComponent.componentId) as EntityRidingComponent).entityRidingOn;

                                entity.applyKnockback(knockback, 0.5);
                            }
                            // otherwise apply it to the player directly
                            else {
                                p.applyKnockback(knockback, 0.5);
                            }
                            p.addEffect("wither", 40)
                        }
                    }
                }

                // if player is within 5 blocks of a claim they're not allowed to enter
                if (claim.isOverlap(location, location, 5) && !claim.hasPermission(PermissionTypes.ENTER_CLAIM, p)) {
                    // notify player, can only be sent every minute/1200 ticks
                    notifManager.send(p, AddonSounds.Global.WARN_EVENT, 1200, "chat.claim.permission:enter_claim_warning", claim.name, claim.getOwnerData().name);
                }
            });

            // player has entered claim
            if (!inClaimOld && playerData.inClaim) {
                if ((settings.claimNameDisplayBehavior == NameDisplayBehavior.CHAT_ON_ENTER)
                    || (settings.claimNameDisplayBehavior == NameDisplayBehavior.CHAT_ON_ENTER_AND_EXIT)) {
                    // show claim name and owner in chat
                    notifManager.send(p, AddonSounds.Claim.ENTER, undefined, "chat.claim:entered", playerData.inClaimName, playerData.inClaimOwnerName);
                }
                else {
                    // just play entrance sound
                    playSound(p, AddonSounds.Claim.ENTER)
                }
            }
            // player has exited the claim
            else if (inClaimOld && !playerData.inClaim) {
                if (settings.claimNameDisplayBehavior == NameDisplayBehavior.CHAT_ON_ENTER_AND_EXIT) {
                    // show claim name and owner in chat
                    notifManager.send(p, AddonSounds.Claim.LEAVE, undefined, "chat.claim:exited", playerData.inClaimName, playerData.inClaimOwnerName);
                }
                else {
                    // just play exit sound
                    playSound(p, AddonSounds.Claim.LEAVE)
                }
            }

            // the flag should always be false if player is not in a claim
            if (!playerData.inClaim){
                // set pending entrance disallow flag to false; after this point the player will not be able to enter the claim again
                playerData.setPendingEntranceDisallow(false);
            }

            // save player location for later use
            playerData.setPreviousLocation(p.location);
        }
        // player is not in overworld
        else {
            playerData.setInClaim(false);
        }
    }
}, 10);

// renders claim particles every 1 second
system.runInterval(() => {
    const dimension = world.getDimension("overworld");

    for (var p of world.getAllPlayers()) {
        const playerData = PlayerData.fromId(p.id);

        if (p.dimension == dimension) {

            // if player has selected the first point to create a claim, render the particles
            if ((playerData.firstPoint != null) && (playerData.resizingClaimName.length == 0)) {
                // render particles at the first point
                const fP = playerData.firstPoint;
                dimension.spawnParticle("slc:first_point_dust", { x: fP.x + 0.5, y: fP.y + 0.8, z: fP.z + 0.5 });

            }

            runInAllClaims((claim) => {

                // user defined start and end points of the claim
                var s = claim.start;
                var e = claim.end;

                // all 4 points of the claim
                var points = [
                    [[s.x, s.z], [s.x, e.z]],
                    [[e.x, s.z], [e.x, e.z]]
                ]

                var claimWidth = Math.abs(s.x - e.x) + 1;
                var claimLength = Math.abs(s.z - e.z) + 1;

                var numSegments = 3 // the number of border particle segments to generate above and below the particleSpawnY
                var segmentHeight = 10
                var particleSpawnY = Math.round(p.location.y / segmentHeight) * segmentHeight; // the y level to spawn particles at; rounded to the nearest segmentHeight integer
                var averageOffset = (segmentHeight * numSegments)

                var claimShovelOut = false;

                if ((p.id == claim.getOwnerData().id) && (p.getComponent(EntityComponentTypes.Inventory).container.getItem(p.selectedSlotIndex)?.typeId === SHOVEL_ID)) {
                    // set flag
                    claimShovelOut = true;
                }

                const canEnter = claim.hasPermission(PermissionTypes.ENTER_CLAIM, p);

                // only render if particles are enabled, player is not allowed to enter, or owner has claim shovel out
                if (claim.particlesEnabled || !canEnter || claimShovelOut) {
                    // loop through all claim points to determine particle type
                    for (var a = 0; a < points.length; a++) {
                        for (var b = 0; b < points[a].length; b++) {

                            // only render if claim point is in render distance
                            const isLoaded = dimension.getBlock({ "x": points[a][b][0], "y": particleSpawnY, "z": points[a][b][1] }) != undefined

                            // if player is resizing corner, only show the opposite corners particles
                            const isResizingOppositeCorner = (points[a][b][0] == playerData.oppositeCorner.x) || (points[a][b][1] == playerData.oppositeCorner.z);

                            if (isLoaded && (claimShovelOut && (playerData.resizingClaimName == claim.name)) ? isResizingOppositeCorner : true) {

                                // creates sets of verticle claim particles 20 blocks below and above the claim
                                for (var i = particleSpawnY - averageOffset; i <= particleSpawnY + averageOffset; i += segmentHeight) {

                                    const xParticleOptions = new MolangVariableMap();
                                    const zParticleOptions = new MolangVariableMap();
                                    const yParticleOptions = new MolangVariableMap();

                                    // set kill distance to half of claim width/length with a little bit of overlap
                                    xParticleOptions.setFloat("kill_distance", claimWidth / 1.75);
                                    zParticleOptions.setFloat("kill_distance", claimLength / 1.75);

                                    // set direction of particles
                                    xParticleOptions.setSpeedAndDirection("motion", 1, {"x": points[a][b][0] > points[a ^ 1][b][0] ? -1 : 1, "y": 0, "z": 0});
                                    zParticleOptions.setSpeedAndDirection("motion", 1, {"x": 0, "y": 0, "z": points[a][b][1] > points[a][b ^ 1][1] ? -1 : 1});

                                    const white: RGB = {"red": 1, "green": 1, "blue": 1};
                                    const red: RGB = {"red": 1, "green": 0.6, "blue": 0.6};

                                    // if player has permission to enter claim, spawn normal particles
                                    if (canEnter) {
                                        xParticleOptions.setColorRGB("color", white);
                                        zParticleOptions.setColorRGB("color", white);
                                        yParticleOptions.setColorRGB("color", white);
                                    }
                                    // otherwise spawn red ones
                                    else {
                                        xParticleOptions.setColorRGB("color", red);
                                        zParticleOptions.setColorRGB("color", red);
                                        yParticleOptions.setColorRGB("color", red);                 
                                    }

                                    var particlePoint: Vector3 = { "x": points[a][b][0] + 0.5, "y": i + 0.5, "z": points[a][b][1] + 0.5 };

                                    try {
                                        const xzParticleType = claimShovelOut ? "slc:glowing_xz_claim_dust" : "slc:xz_claim_dust"
                                        const yParticleType = claimShovelOut ? "slc:glowing_y_claim_dust" : "slc:y_claim_dust"

                                        p.spawnParticle(xzParticleType, particlePoint, xParticleOptions);
                                        p.spawnParticle(xzParticleType, particlePoint, zParticleOptions);

                                        yParticleOptions.setSpeedAndDirection("motion", 1, {"x": 0, "y": 1, "z": 0});
                                        p.spawnParticle(yParticleType, particlePoint, yParticleOptions);

                                        yParticleOptions.setSpeedAndDirection("motion", 1, {"x": 0, "y": -1, "z": 0});
                                        p.spawnParticle(yParticleType, particlePoint, yParticleOptions);
                                    }
                                    catch {
                                        // do nothing
                                    }

                                }
                            }
                        }
                    }
                }
            });
        }
    }
}, 20);

// every minute decrement each online players time remaining until they recieve more claim blocks
system.runInterval(() => {
    for (var p of world.getAllPlayers()) {

        const playerData = PlayerData.fromId(p.id);
        const notifManager = NotificationManagerStack.getById(p.id);

        // the hourly payment is only included in the default behavior
        if (playerData.claimBlocks.behavior == ClaimBlocksBehavior.DEFAULT) {

            // decrement timer by 1
            playerData.claimBlocks.decrementPaymentTime();

            // if time is up reward blocks and reset timer
            if (playerData.claimBlocks.paymentTimeRemaining <= 0) {
                playerData.claimBlocks.incrementAmount(settings.claimBlockHourlyPayment);

                notifManager.send(p, AddonSounds.Global.POSITIVE_EVENT, undefined, "chat.blocks:payment", settings.claimBlockHourlyPayment.toString());

                var inventory = p.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;
                
                var hasShovel = false;
                for (var i = 0; i < inventory.inventorySize; i++) {
                    var item = inventory.container.getItem(i);

                    if (item && (item.typeId === SHOVEL_ID)) {
                        hasShovel = true;
                    }
                }

                // if the player doesn't have a claim shovel and its item behavior is set to must be crafted
                if (!hasShovel && (settings.claimShovelItemBehavior == ShovelBehavior.MUST_BE_CRAFTED)) {
                    // 2 second delay since last notif
                    system.runTimeout(() => {
                        // notify the player of how they can craft a claim shovel
                        notifManager.send(p, AddonSounds.Global.NEUTRAL_EVENT, undefined, "chat.shovel:how_to_craft")
                    }, 40)
                }

                playerData.claimBlocks.resetPaymentTime();
            }
        }
    }
}, 1200)
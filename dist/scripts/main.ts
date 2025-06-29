import { world, system, Player, Vector3, ItemStack, EntityRidingComponent, EntityRideableComponent, RawMessage, BlockComponentTypes, EntityComponentTypes, EntityInventoryComponent, EntityProjectileComponent, MolangVariableMap, DimensionType, DimensionTypes, ItemLockMode, } from '@minecraft/server';
import { database, PlayerData, Claim, PlayerPermissions, PermissionTypes, settings, ShovelBehavior, ClaimBlocksBehavior } from './database.js';
import { playSound, AddonSounds } from './sounds.js';
import { sendNotification } from './notifications.js';
import { ShovelUI } from './shovel_ui.js';
import { giveClaimShovel, unlockClaimShovel, runInAllClaims, getClosestPlayer, SHOVEL_ID, updateShovelBehavior } from './utils.js'

world.afterEvents.playerJoin.subscribe((data) => {

    // verify player data is on file
    var playerFound = false;

    for (var pD of database) {
        if (pD.id == data.playerId) {

            // update player name in db to current; in case they changed it
            pD.setName(data.playerName);

            // set other values to default
            pD.setViewingClaim(false);
            pD.setResizingClaimName("");

            // if player is not in a claim this flag will automatically be set back to false
            pD.setPendingEntranceDisallow(true);

            playerFound = true;
            break;
        }
    }

    // player is not saved in db
    if (!playerFound) {
        // create new player in db
        database.push(new PlayerData(data.playerId, data.playerName));
    }

    // get player object
    for (var p of world.getAllPlayers()){
        if (p.id == data.playerId){

            // updates how the shovel is stored/given to the player; ex: locking to inventory
            updateShovelBehavior(p, settings.claimShovelItemBehavior)
        }
    }
});

world.afterEvents.playerLeave.subscribe((data) => {

    var playerData = PlayerData.fromId(data.playerId);

    // remove claim view ticking area if player left while viewing a claim
    if (playerData.viewingClaim) {
        world.getDimension("overworld").runCommandAsync("tickingarea remove claimView");
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
    if (data.itemStack.typeId == SHOVEL_ID) {
        new ShovelUI(data.source).main();
    };
});

// Set/adjust claim points if player is sneaking
world.beforeEvents.playerBreakBlock.subscribe((data) => {

    var playerData = PlayerData.fromId(data.player.id);

    // handle creating claims by setting first and second point
    if ((data.itemStack != undefined) && (data.itemStack.typeId == SHOVEL_ID)) {
        // stop the shovel from breaking the block
        data.cancel = true

        if (data.dimension == world.getDimension("overworld")) {

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

                    runInAllClaims((playerID, playerName, claim) => {

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
                            if (playerID == data.player.id) {
                                playerData.setOppositeCorner({ "x": points[aIndex ^ 1][bIndex ^ 1][0], "y": data.block.y, "z": points[aIndex ^ 1][bIndex ^ 1][1] });
                                playerData.setResizingClaimName(claim.name);

                                sendNotification(data.player, AddonSounds.Shovel.RESIZE, "chat.point.resize:selected", data.block.x.toString(), data.block.y.toString(), data.block.z.toString());

                            } else {
                                sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.point.resize:disallowed");
                            }
                        }
                    });

                    if (!isResize) {
                        sendNotification(data.player, AddonSounds.Shovel.SELECT, "chat.point.new:selected", data.block.x.toString(), data.block.y.toString(), data.block.z.toString());
                    }
                }
                // if player is crouching
                else {
                    var secondPoint = { ...data.block.location }; // Ensure a new object is created
                    var claimIntersectingClaim = false;
                    var playerIntersectingClaim = false;

                    // if claim is resized
                    if (playerData.resizingClaimName.length > 0) {

                        // get the claim object that is being resized
                        var resizingClaim = playerData.getClaim(playerData.resizingClaimName);

                        const oldClaimWidth = Math.abs(resizingClaim.start.x - resizingClaim.end.x) + 1;
                        const oldClaimLength = Math.abs(resizingClaim.start.z - resizingClaim.end.z) + 1;

                        const newClaimWidth = Math.abs(playerData.oppositeCorner.x - secondPoint.x) + 1;
                        const newClaimLength = Math.abs(playerData.oppositeCorner.z - secondPoint.z) + 1;

                        const blockDifference = (newClaimLength * newClaimWidth) - (oldClaimLength * oldClaimWidth);

                        // make sure new claim isn't intersecting others not counting itself
                        runInAllClaims((playerID, playerName, claim) => {
                            if (claim.isOverlap(playerData.oppositeCorner, secondPoint) && ((playerID != data.player.id) || (claim.name != playerData.resizingClaimName))) {
                                claimIntersectingClaim = true;
                            }
                        });

                        // make sure another player isn't in the area
                        for (var p of world.getAllPlayers()) {
                            // we are creating a claim object just to use the isOverlap utility, this is not saved to the database
                            if (new Claim("", playerData.oppositeCorner, secondPoint, "").isOverlap(p.location, p.location) && (p.id != data.player.id)) {
                                playerIntersectingClaim = true;
                            }
                        }

                        // intersecting claim warning message, cancel resize
                        if (claimIntersectingClaim) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:claim_intersecting");
                        }
                        // player is in the way warning message, cancel resize
                        else if (playerIntersectingClaim) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:player_intersecting");
                        }
                        // claim isn't wide enough warning message, cancel resize
                        else if (newClaimWidth < settings.claimMinimumWidth || newClaimLength < settings.claimMinimumWidth) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:width", settings.claimMinimumWidth.toString());
                        }
                        // not enough claim blocks warning message, cancel resize
                        else if ((playerData.claimBlocks.behavior != ClaimBlocksBehavior.UNLIMITED) && (playerData.claimBlocks.amount < blockDifference)) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:blocks_resize", ((blockDifference) - playerData.claimBlocks.amount).toString());
                        }
                        // all requirements met, open the claim resizing ui
                        else {
                            system.run(() => {
                                playSound(data.player, AddonSounds.Shovel.SELECT);
                                new ShovelUI(data.player).resizeClaim(resizingClaim, playerData.oppositeCorner, secondPoint);
                            });
                        }
                    }
                    // not resizing, create a new claim
                    else {

                        const claimWidth = Math.abs(playerData.firstPoint.x - secondPoint.x) + 1;
                        const claimLength = Math.abs(playerData.firstPoint.z - secondPoint.z) + 1;

                        runInAllClaims((playerID, playerName, claim) => {
                            // make sure new claim isn't intersecting others
                            if (claim.isOverlap(playerData.firstPoint, secondPoint)) {
                                claimIntersectingClaim = true;
                            }
                        });

                        // make sure another player isn't in the area
                        for (var p of world.getAllPlayers()) {
                            // we are creating a claim object just to use the isOverlap utility, this is not saved to the database
                            if (new Claim("", playerData.firstPoint, secondPoint, "").isOverlap(p.location, p.location) && (p.id != data.player.id)) {
                                playerIntersectingClaim = true;
                            }
                        }

                        // intersecting claim warning message, cancel creation
                        if (claimIntersectingClaim) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:claim_intersecting");
                        }
                        // player is in the way warning message, cancel creation
                        else if (playerIntersectingClaim) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:player_intersecting");
                        }
                        // claim is not wide enough warning message, cancel creation
                        else if (claimWidth < settings.claimMinimumWidth || claimLength < settings.claimMinimumWidth) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:width", settings.claimMinimumWidth.toString());
                        }
                        // not enough claim blocks warning message, cancel creation
                        else if ((playerData.claimBlocks.behavior != ClaimBlocksBehavior.UNLIMITED) && (playerData.claimBlocks.amount < (claimWidth * claimLength))) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:blocks_new", ((claimWidth * claimLength) - playerData.claimBlocks.amount).toString());
                        }
                        // check if this new claim doesn't exceed the players max number of claims
                        else if ((settings.maxClaimAmount > 0) && (playerData.claims.length >= settings.maxClaimAmount)) {
                            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:max_claims", playerData.claims.length.toString());
                        }
                        // all requirements are met, open the claim creation ui
                        else {
                            system.run(() => {
                                playSound(data.player, AddonSounds.Shovel.SELECT);
                                new ShovelUI(data.player).newClaim(playerData.firstPoint, secondPoint);
                            });
                        }
                    }

                }
            }

        }
        // player is not in the overworld, warn them that they are not allowed to create a claim here
        else {
            sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.shovel:dimension_warning");
        }

    }
    else {
        if (playerData.viewingClaim) {
            data.cancel = true;
        }
        else if (data.dimension == world.getDimension("overworld")) {
            runInAllClaims((playerID, playerName, claim) => {
                // check if a block is broken by a player without permissions within the claim
                if (claim.isOverlap(data.block, data.block) && (playerID != data.player.id) && !claim.hasPermission(PermissionTypes.BREAK_BLOCKS, data.player)) {
                    data.cancel = true;

                    sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:break_blocks");

                }
            });
        }
    }
});

world.beforeEvents.explosion.subscribe((data) => {

    if (data.dimension == world.getDimension("overworld")) {

        var impactedBlocks = data.getImpactedBlocks();

        // find player closest to the explosion, we'll assume this is the player that placed the tnt
        var closestPlayer: Player = getClosestPlayer(data.source.location);

        // flag to send notification
        var sendDisallowedNotification = false;

        // check if tnt blast effects a claim
        runInAllClaims((playerID, playerName, claim) => {

            // if entity is a mob or player that doesn't have permissions
            if ((data.source.typeId != "minecraft:tnt") || !claim.hasPermission(PermissionTypes.USE_TNT)) {
                // remove all impacted blocks that lie within the claim
                for (var i = 0; i < impactedBlocks.length; i++) {
                    var block = impactedBlocks[i]

                    if (claim.isOverlap(block, block)) {
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
            sendNotification(closestPlayer, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:use_tnt");
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

            runInAllClaims((playerID, claimName, claim) => {

                // if block is in claim but not piston
                if (claim.isOverlap(b.location, b.location) && !claim.isOverlap(data.piston.block.location, data.piston.block.location)) {
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
            var pistonDrop = new ItemStack(data.piston.typeId)
            data.dimension.spawnItem(pistonDrop, data.block.location);

            // get closest player to piston, we will assume they activated it
            var closestPlayer: Player = getClosestPlayer(data.piston.block.location)

            // notify player
            sendNotification(closestPlayer, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:piston");
        }
    }

});

world.beforeEvents.itemUse.subscribe((data) => {

    PlayerData.fromId(data.source.id).setItemCharged(true);

    // disallow player from using items while viewing claim
    if (PlayerData.fromId(data.source.id).viewingClaim) {
        data.cancel = true;
    }

    // disallowed items that could cause harm to an entity
    var disallowedItems = ["minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:bow", "minecraft:crossbow"]

    if (disallowedItems.includes(data.itemStack.typeId) && (data.source.dimension == world.getDimension("overworld"))) {
        runInAllClaims((playerID, playerName, claim) => {

            // if player has used the disallowed item in a claim
            if (claim.isOverlap(data.source.location, data.source.location) && (playerID != data.source.id) && !claim.hasPermission(PermissionTypes.HURT_ENTITIES, data.source)) {

                // cancel the action
                data.cancel = true;

                // notify player they don't have permissions
                sendNotification(data.source, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:hurt_entities");
                 
            }
        });
    }
});

world.afterEvents.itemReleaseUse.subscribe((data) => {
    PlayerData.fromId(data.source.id).setItemCharged(false);
});

world.beforeEvents.playerInteractWithEntity.subscribe((data) => {
    
    if (data.target.dimension == world.getDimension("overworld")) {
        runInAllClaims((playerID, playerName, claim) => {

            const margin = 0.5;
            var start = { x: data.target.location.x - margin, y: data.target.location.y - margin, z: data.target.location.z - margin };
            var end = { x: data.target.location.x + margin, y: data.target.location.y + margin, z: data.target.location.z + margin };

            // if player has interacted with an entity in a claim
            if (claim.isOverlap(start, end) && (playerID != data.player.id)){
                // disallow player from interacting with rideable entities if they are not allowed to enter the claim
                if (!claim.hasPermission(PermissionTypes.ENTER_CLAIM, data.player) && data.target.getComponent(EntityComponentTypes.Rideable)) {
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:enter_claim");
                }

                // disallow player from interacting with entities based on permissions
                if(!claim.hasPermission(PermissionTypes.INTERACT_WITH_ENTITIES, data.player)) {

                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:interact_with_entities");
                }
            }
        });
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe((data) => {
    
    // blocks that are disabled by admin; can't be placed
    if (data.itemStack && settings.disallowedBlocks.includes(data.itemStack.typeId)) {
        // notify player
        sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.world:disabled_item");

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
        runInAllClaims((playerID, playerName, claim) => {
        
            // only check for permissions if player is not the owner
            if (playerID != data.player.id){
                
                // door interaction permissions
                if (claim.isOverlap(data.block.location, data.block.location) && (data.block.typeId.includes("door") || data.block.typeId.includes("fence_gate")) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_DOORS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:use_doors");
                    
                    }
                }
                // lever/button interaction permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && (data.block.matches("minecraft:lever") || data.block.typeId.includes("button")) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_SWITCHES, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT,"chat.claim.permission:use_switches");
                    }
                }
                // bed interaction permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.matches("minecraft:bed") && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_BEDS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:use_beds");
                         
                    }
                }
                // opening chests/container permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.getComponent(BlockComponentTypes.Inventory) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.OPEN_CONTAINERS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:open_containers");
                    }
                }
                // editing signs permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.getComponent(BlockComponentTypes.Sign) && !data.player.isSneaking && !data.itemStack?.matches("minecraft:honeycomb")) {
                    if (!claim.hasPermission(PermissionTypes.EDIT_SIGNS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:edit_signs");
                    }
                }
                // block placing/using items on blocks permissions
                else if ((claim.isOverlap(data.block, data.block) || claim.isOverlap(placedBlock, placedBlock)) && data.itemStack && !data.itemStack.matches(SHOVEL_ID)) {
                    if (!claim.hasPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        sendNotification(data.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:use_item_on_block");
                          
                    }
                }
            }
        });
    }
});

world.afterEvents.worldInitialize.subscribe(() => {
    // disable showing locked item text; the claim shovel is locked in the inventory
    world.gameRules.showTags = false;

    // disable fire spreads
    world.gameRules.doFireTick = false;

    // remove claim view ticking area if it exists
    world.getDimension("overworld").runCommandAsync("tickingarea remove claimView")
});

// player/entity management in claims
system.runInterval(() => {

    for (var e of world.getDimension("overworld").getEntities()) {

        // save the state of the entity's "in-claim" attribute before it is updated
        e.setDynamicProperty("inClaimOld", e.getDynamicProperty("inClaim") as boolean | false);

        e.setDynamicProperty("inClaim", false);

        runInAllClaims((playerID, playerName, claim) => {
            if (e.isValid() && claim.isOverlap(e.location, e.location)) {
                // update flag
                e.setDynamicProperty("inClaim", true);

                // make sure fire charges and withers can't fly into claim
                if (e.typeId == "minecraft:small_fireball" || e.typeId == "minecraft:wither") {
                    e.remove();
                }

                if (e.hasComponent(EntityComponentTypes.Projectile)) {
                    const projectile = e.getComponent(EntityComponentTypes.Projectile) as EntityProjectileComponent;

                    // disallow projectile from entering claim if it was not fired by a player
                    if ((e.getDynamicProperty("inClaimOld") == false) && !projectile.owner) {
                        e.remove();
                        world.sendMessage("removed")
                    }
                    else {
                        world.getPlayers().filter(p => p.id == projectile.owner?.id).forEach(p => {
                            if ((playerID != p.id) && !claim.hasPermission(PermissionTypes.HURT_ENTITIES, p)) {
                                e.remove();

                                // notify player
                                sendNotification(p, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:hurt_entities");
                            }
                        });
                    }     

                }

                // set entrance velocity for entities
                if (e.getDynamicProperty("inClaimOld") == false) {
                    e.setDynamicProperty("entranceVelocity", e.getVelocity());
                }

                // disallow creepers from entering claims
                if (e.getDynamicPropertyIds().includes("entranceVelocity") && e.typeId == "minecraft:creeper") {
                    var xVelocity = (e.getDynamicProperty("entranceVelocity") as Vector3).x;
                    var zVelocity = (e.getDynamicProperty("entranceVelocity") as Vector3).z;

                    // eject from claim
                    e.applyKnockback(-xVelocity, -zVelocity, 3, 0.5);

                }
            }
        });
    }

    for (var p of world.getAllPlayers()) {

        var playerData = PlayerData.fromId(p.id);

        // only run if player is in overworld
        if (p.dimension == world.getDimension("overworld")) {

            // capture the state of player attribute "in-claim" before it is updated
            var inClaimOld: boolean = playerData.inClaim;

            // set flag to false before for loop updates it
            playerData.setInClaim(false);

            // if player is crouching set viewing claim flag to false to cancel it and return to first person
            if (p.isSneaking && playerData.viewingClaim) {
                ShovelUI.exitClaimView(p);
            }

            // if player is no longer holding the claim shovel, set the resizing claim name to empty
            if (!p.getComponent(EntityComponentTypes.Inventory).container.getItem(p.selectedSlotIndex)?.matches(SHOVEL_ID)) {
                playerData.setResizingClaimName("");
            }

            runInAllClaims((playerID, playerName, claim) => {

                // apply an offset to the player location to be more accurate with claim bounds
                const location: Vector3 = { "x": p.location.x - 0.5, "y": p.location.y - 0.5, "z": p.location.z - 0.5 };

                // if player is in the claim
                if (claim.isOverlap(location, location)) {

                    playerData.setInClaim(true);

                    // make sure player can't hurt entities if they don't have permission
                    if ((playerID != p.id) && !claim.hasPermission(PermissionTypes.HURT_ENTITIES, p)) {
                        p.addEffect("weakness", 40, { "amplifier": 255, "showParticles": false });
                    }

                    if (!playerData.viewingClaim) {
                        // show claim name and owner onscreen
                        p.onScreenDisplay.setActionBar(
                            {
                                "rawtext": [
                                    { "translate": "actionbar.claim:name_color" },
                                    { "text": `${claim.name}§r - ${playerName}` },
                                ]
                            });
                    }

                    // if player is not allowed in claim, apply knockback to remove them
                    if ((playerID != p.id) && !claim.hasPermission(PermissionTypes.ENTER_CLAIM, p) && !playerData.pendingEntranceDisallow) {
                        // player has entered claim
                        if (!inClaimOld && playerData.inClaim) {

                            // save entrance velocity
                            playerData.setEntranceVelocity(p.getVelocity());

                            // detect if player teleported into claim; entrance velocity is 0
                            if (playerData.entranceVelocity.x == 0 || playerData.entranceVelocity.z == 0){

                                // wait a second before playing sound so it is played at the teleported to location
                                system.runTimeout(() => {
                                    sendNotification(p, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:teleport_enter_claim");
                                }, 10);
                            }
                            // player did not teleport, send a normal notif
                            else {
                                sendNotification(p, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim.permission:enter_claim");
                            }
                        }

                        const velocity: Vector3 = playerData.entranceVelocity;

                        // if player is riding an entity eject them
                        if (p.hasComponent(EntityRidingComponent.componentId)) {
                            const entity = (p.getComponent(EntityRidingComponent.componentId) as EntityRidingComponent).entityRidingOn;
                            const riddenComponent = entity.getComponent(EntityRideableComponent.componentId) as EntityRideableComponent;

                            riddenComponent.ejectRider(p);

                            // teleport the ridden entity to the player 1 second after they are ejected
                            system.runTimeout(() => {
                                entity.teleport(p.location);
                                
                                // remount the player after a 0.5 second delay
                                system.runTimeout(() => {
                                    // const riddenComponent = entity.getComponent(EntityRideableComponent.componentId) as EntityRideableComponent;
                                    riddenComponent.addRider(p);
                                }, 10);
                            }, 20);
                        }

                        // detect if player teleported into claim; entrance velocity is 0
                        if (playerData.entranceVelocity.x == 0 || playerData.entranceVelocity.z == 0) {

                            // check to make sure tp location is outside of claim
                            if (!claim.isOverlap(playerData.previousLocation, playerData.previousLocation)) {

                                // teleport player back to last known location before teleport
                                p.teleport(playerData.previousLocation);
                            }
                        }
                        // player did not teleport, bounce them out of the claim
                        else {
                            // apply knockback to the player and wither them
                            p.applyKnockback(-velocity.x, -velocity.z, 3, 0.5);
                            p.addEffect("wither", 40)
                        }
                    }

                    // don't allow the player to enter claim with a charged item
                    if (!inClaimOld && playerData.itemCharged && !claim.hasPermission(PermissionTypes.HURT_ENTITIES, p) && (playerID != p.id)) {
                        var inventory = p.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;

                        // copy the item we want to swap
                        var swapItem = inventory.container.getItem((p.selectedSlotIndex + 1) % 9);

                        inventory.container.moveItem(p.selectedSlotIndex, (p.selectedSlotIndex + 1) % 9, inventory.container);
                        inventory.container.setItem(p.selectedSlotIndex, swapItem);

                        playerData.setItemCharged(false);
                    }
                }

                // var s = claim.start;
                // var e = claim.end;

                // // all 4 points of the claim
                // var points = [
                //     [[s.x, s.z], [s.x, e.z]],
                //     [[e.x, s.z], [e.x, e.z]]
                // ]

                // var dimension = world.getDimension("overworld");

                // // loop through all sides of the claim to remove flowing water/lava
                // for (var a = 0; a < points.length; a++) {
                //     for (var b = 0; b < points[a].length; b++) {

                //         var sideStart = { "x": points[a][b][0] + 1, "y": dimension.heightRange.min, "z": points[a][b][1] + 1 };
                //         var sideEnd = { "x": points[a ^ 1][b][0] - 1, "y": dimension.heightRange.max, "z": points[a ^ 1][b][1] - 1 };

                //         var side = new BlockVolume(sideStart, sideEnd);

                //         var flowingBlocks = dimension.getBlocks(side, {"includeTypes": ["minecraft:water", "minecraft:flowing_lava", "minecraft:stone"]}, true).getBlockLocationIterator()

                //         for (var block of flowingBlocks) {

                //             // remove the block
                //             dimension.fillBlocks(new BlockVolume(block, block), "minecraft:air");
                //         }
                //     }
                // }
            });



            // player has entered claim
            if (!inClaimOld && playerData.inClaim) {
                // play entrance sound
                playSound(p, AddonSounds.Claim.ENTER)
            }
            // player has exited the claim
            else if (inClaimOld && !playerData.inClaim) {
                // play exit sound
                playSound(p, AddonSounds.Claim.LEAVE)
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
            runInAllClaims((playerID, playerName, claim) => {

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

                if (p.id == playerID && p.getComponent(EntityComponentTypes.Inventory).container.getItem(p.selectedSlotIndex)?.matches(SHOVEL_ID)) {
                    // set flag
                    claimShovelOut = true;
                }

                // only render if particles are enabled or owner has claim shovel out
                if (claim.particlesEnabled || claimShovelOut) {
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

                                    // set kill distance to half of claim width/length with a little bit of overlap
                                    xParticleOptions.setFloat("kill_distance", claimWidth / 1.75);
                                    zParticleOptions.setFloat("kill_distance", claimLength / 1.75);

                                    // set direction of particles
                                    xParticleOptions.setSpeedAndDirection("motion", 1, {"x": points[a][b][0] > points[a ^ 1][b][0] ? -1 : 1, "y": 0, "z": 0});
                                    zParticleOptions.setSpeedAndDirection("motion", 1, {"x": 0, "y": 0, "z": points[a][b][1] > points[a][b ^ 1][1] ? -1 : 1});

                                    var particlePoint: Vector3 = { "x": points[a][b][0] + 0.5, "y": i + 0.5, "z": points[a][b][1] + 0.5 };

                                    try {
                                        const xzParticleType = claimShovelOut ? "slc:glowing_xz_claim_dust" : "slc:xz_claim_dust"
                                        const yParticleType = claimShovelOut ? "slc:glowing_y_claim_dust" : "slc:y_claim_dust"

                                        p.spawnParticle(xzParticleType, particlePoint, xParticleOptions);
                                        p.spawnParticle(xzParticleType, particlePoint, zParticleOptions);

                                        var yParticleOptions = new MolangVariableMap();
                                        yParticleOptions.setSpeedAndDirection("motion", 1, {"x": 0, "y": 1, "z": 0});
                                        p.spawnParticle(yParticleType, particlePoint, yParticleOptions);

                                        yParticleOptions = new MolangVariableMap();
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

        var playerData = PlayerData.fromId(p.id);

        // the hourly payment is only included in the default behavior
        if (playerData.claimBlocks.behavior == ClaimBlocksBehavior.DEFAULT) {

            // decrement timer by 1
            playerData.claimBlocks.decrementPaymentTime();

            // if time is up reward blocks and reset timer
            if (playerData.claimBlocks.paymentTimeRemaining <= 0) {
                playerData.claimBlocks.incrementAmount(settings.claimBlockHourlyPayment);
                
                sendNotification(p, AddonSounds.Global.POSITIVE_EVENT, "chat.blocks:payment", settings.claimBlockHourlyPayment.toString());

                var inventory = p.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;
                
                var hasShovel = false;
                for (var i = 0; i < inventory.inventorySize; i++) {
                    var item = inventory.container.getItem(i);

                    if (item && item.matches(SHOVEL_ID)) {
                        hasShovel = true;
                    }
                }

                // if the player doesn't have a claim shovel and its item behavior is set to must be crafted
                if (!hasShovel && (settings.claimShovelItemBehavior == ShovelBehavior.MUST_BE_CRAFTED)) {
                    // 2 second delay since last notif
                    system.runTimeout(() => {
                        // notify the player of how they can craft a claim shovel
                        sendNotification(p, AddonSounds.Global.NEUTRAl_EVENT, "chat.shovel:how_to_craft")
                    }, 40)
                }

                playerData.claimBlocks.resetPaymentTime();
            }
        }
    }
}, 1200)
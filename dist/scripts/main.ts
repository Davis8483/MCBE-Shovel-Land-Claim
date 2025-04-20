import { world, system, Player, Vector3, ItemStack, EntityRidingComponent, EntityRideableComponent, RawMessage, BlockComponentTypes, EntityComponentTypes, EntityInventoryComponent, EntityProjectileComponent, } from '@minecraft/server';
import { database, PlayerData, Claim, PlayerPermissions, PermissionTypes, settings } from './database.js';
import { playSound, AddonSounds } from './sounds.js';
import { sendNotification } from './notifications.js';
import { ShovelUI } from './shovel_ui.js';

const shovelID = "slc:claim_shovel"

/**
 * Runs the callback for every claim saved in the database
 * 
 */
function runInAllClaims(callback: (playerId: string, playerName: string, claimData: Claim) => void) {

    for (var player of database) {

        var claims = player.claims;
        for (var claim of claims) {
            callback(player.id, player.name, claim);
        }
    }
}

/**
 * Gets the player closest to the specified block
 * 
 * @param blockLocation - Point to test from
 * 
 * @return - The player closest to the specified point
 */
function getClosestPlayer(blockLocation: Vector3): Player {
    var closestPlayer: Player = undefined;
    var closestDistance: number = Number.MAX_VALUE;

    // find player closest to the specified block
    for (var p of world.getAllPlayers()) {
        if (p.dimension == world.getDimension("overworld")) {
            var distance = Math.sqrt(
                Math.pow(p.location.x - blockLocation.x, 2) +
                Math.pow(p.location.y - blockLocation.y, 2) +
                Math.pow(p.location.z - blockLocation.z, 2)
            );

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlayer = p;
            }
        }
    }

    return closestPlayer;
}

world.afterEvents.playerJoin.subscribe((data) => {

    system.runTimeout(() => {
        world.sendMessage("§cWarning: your playing a development build of Shovel Land Claim, bugs and data loss may occur.");
    }, 200);

    // verify player data is on file
    var playerFound = false;

    for (var p of database) {
        if (p.id == data.playerId) {

            // update player name in db to current; in case they changed it
            p.setName(data.playerName);

            // set other values to default
            p.setViewingClaim(false);
            p.setResizingClaimName("");

            // if player is not in a claim this flag will automatically be set back to false
            p.setPendingEntranceDisallow(true);

            playerFound = true;
            break;
        }
    }

    // player is not saved in db
    if (!playerFound) {
        // create new player in db
        database.push(new PlayerData(data.playerId, data.playerName));
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
    // make sure player has only 1 claim shovel
    data.player.runCommandAsync(`execute if entity @s[hasitem = { item=${shovelID}, quantity =! 1}] run clear @s ${shovelID} 0`);
    data.player.runCommandAsync(`execute if entity @s[hasitem = { item=${shovelID}, quantity = 0}] run give @s ${shovelID} 1 0 { "keep_on_death": { }, "item_lock": { "mode": "lock_in_inventory" } } `);

    // set flag to false since all camera positions will be reset upon rejoining
    PlayerData.fromId(data.player.id).setViewingClaim(false);
});

// open menu when claim shovel is used
world.afterEvents.itemUse.subscribe((data) => {
    if (data.itemStack.typeId == shovelID) {
        new ShovelUI(data.source).main();
    };
});

// Set/adjust claim points if player is sneaking
world.beforeEvents.playerBreakBlock.subscribe((data) => {

    var playerData = PlayerData.fromId(data.player.id);

    // handle creating claims by setting first and second point
    if ((data.itemStack != undefined) && (data.itemStack.typeId == shovelID)) {
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

                                sendNotification(data.player, "chat.point.resize:selected", data.block.x.toString(), data.block.y.toString(), data.block.z.toString());

                                playSound(data.player, AddonSounds.Shovel.RESIZE);

                            } else {
                                sendNotification(data.player, "chat.point.resize:disallowed");
                                playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                            }
                        }
                    });

                    if (!isResize) {
                        sendNotification(data.player, "chat.point.new:selected", data.block.x.toString(), data.block.y.toString(), data.block.z.toString());
                        playSound(data.player, AddonSounds.Shovel.SELECT);
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
                            sendNotification(data.player, "chat.claim:claim_intersecting");
                            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        }
                        // player is in the way warning message, cancel resize
                        else if (playerIntersectingClaim) {
                            sendNotification(data.player, "chat.claim:player_intersecting");
                            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        }
                        // claim isn't wide enough warning message, cancel resize
                        else if (newClaimWidth < settings.claimMinimumWidth || newClaimLength < settings.claimMinimumWidth) {
                            sendNotification(data.player, "chat.claim:width", settings.claimMinimumWidth.toString());
                            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        }
                        // not enough claim blocks warning message, cancel resize
                        else if (playerData.claimBlocks.amount < blockDifference) {
                            sendNotification(data.player, "chat.claim:blocks_resize", ((blockDifference) - playerData.claimBlocks.amount).toString());
                            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
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
                            sendNotification(data.player, "chat.claim:claim_intersecting");
                            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        }
                        // player is in the way warning message, cancel creation
                        else if (playerIntersectingClaim) {
                            sendNotification(data.player, "chat.claim:player_intersecting");
                            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        }
                        // claim is not wide enough warning message, cancel creation
                        else if (claimWidth < settings.claimMinimumWidth || claimLength < settings.claimMinimumWidth) {
                            sendNotification(data.player, "chat.claim:width", settings.claimMinimumWidth.toString());
                            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        }
                        // not enough claim blocks warning message, cancel creation
                        else if (playerData.claimBlocks.amount < (claimWidth * claimLength)) {
                            sendNotification(data.player, "chat.claim:blocks_new", ((claimWidth * claimLength) - playerData.claimBlocks.amount).toString());
                            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
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
            sendNotification(data.player, "chat.shovel:dimension_warning");
            playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
        }

    }
    else {
        if (playerData.viewingClaim) {
            data.cancel = true;
        }
        //                                                              *added for compatibility with gravestone addon*
        else if (data.dimension == world.getDimension("overworld") && !(data.block.typeId == "darkosto_gravestone:gravestone")) {
            runInAllClaims((playerID, playerName, claim) => {
                // check if a block is broken by a player without permissions within the claim
                if (claim.isOverlap(data.block, data.block) && (playerID != data.player.id) && !claim.hasPermission(PermissionTypes.BREAK_BLOCKS, data.player)) {
                    data.cancel = true;

                    playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                    sendNotification(data.player, "chat.claim.permission:break_blocks");

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
            playSound(closestPlayer, AddonSounds.Global.NEGATIVE_EVENT);
            sendNotification(closestPlayer, "chat.claim.permission:use_tnt");
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
            playSound(closestPlayer, AddonSounds.Global.NEGATIVE_EVENT);
            sendNotification(closestPlayer, "chat.claim:piston");
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
                playSound(data.source, AddonSounds.Global.NEGATIVE_EVENT);
                sendNotification(data.source, "chat.claim.permission:hurt_entities");
                 
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
                    playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                    sendNotification(data.player, "chat.claim.permission:enter_claim");
                }

                // disallow player from interacting with entities based on permissions
                if(!claim.hasPermission(PermissionTypes.INTERACT_WITH_ENTITIES, data.player)) {

                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                    sendNotification(data.player, "chat.claim.permission:interact_with_entities");
                }
            }
        });
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe((data) => {
    
    // blocks that are disabled by admin; can't be placed
    if (data.itemStack && settings.disallowedBlocks.includes(data.itemStack.typeId)) {
        // notify player
        playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
        sendNotification(data.player, "chat.world:disabled_item");

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
                        playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        sendNotification(data.player, "chat.claim.permission:use_doors");
                    
                    }
                }
                // lever/button interaction permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && (data.block.matches("minecraft:lever") || data.block.typeId.includes("button")) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_SWITCHES, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        sendNotification(data.player, "chat.claim.permission:use_switches");
                    }
                }
                // bed interaction permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.matches("minecraft:bed") && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_BEDS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        sendNotification(data.player, "chat.claim.permission:use_beds");
                         
                    }
                }
                // opening chests/container permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.getComponent(BlockComponentTypes.Inventory) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.OPEN_CONTAINERS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        sendNotification(data.player, "chat.claim.permission:open_containers");
                    }
                }
                // editing signs permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.getComponent(BlockComponentTypes.Sign) && !data.player.isSneaking && !data.itemStack?.matches("minecraft:honeycomb")) {
                    if (!claim.hasPermission(PermissionTypes.EDIT_SIGNS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        sendNotification(data.player, "chat.claim.permission:edit_signs");
                    }
                }
                // block placing/using items on blocks permissions
                else if ((claim.isOverlap(data.block, data.block) || claim.isOverlap(placedBlock, placedBlock)) && data.itemStack && !data.itemStack.matches(shovelID)) {
                    if (!claim.hasPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        playSound(data.player, AddonSounds.Global.NEGATIVE_EVENT);
                        sendNotification(data.player, "chat.claim.permission:use_item_on_block");
                          
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
                                playSound(p, AddonSounds.Global.NEGATIVE_EVENT);
                                sendNotification(p, "chat.claim.permission:hurt_entities");
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
                                    { "translate": "claim:name_color" },
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
                                    playSound(p, AddonSounds.Global.NEGATIVE_EVENT);
                                    sendNotification(p, "chat.claim.permission:teleport_enter_claim");
                                }, 10);
                            }
                            // player did not teleport, send a normal notif
                            else {
                                playSound(p, AddonSounds.Global.NEGATIVE_EVENT);
                                sendNotification(p, "chat.claim.permission:enter_claim");
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
});

// renders claim particles every 1 second
system.runInterval(() => {

    var dimension = world.getDimension("overworld");

    runInAllClaims((playerID, playerName, claim) => {

        // user defined start and end points of the claim
        var s = claim.start;
        var e = claim.end;

        // all 4 points of the claim
        var points = [
            [[s.x, s.z], [s.x, e.z]],
            [[e.x, s.z], [e.x, e.z]]
        ]

        var averageY = (s.y + e.y) / 2
        var numSegments = 3 // the number of border particle segments to generate above and below the average y level
        var segmentHeight = 10
        var averageOffset = (segmentHeight * numSegments)

        var claimShovelOut = false;

        // check if claim owner has claim shovel out
        for (var p of world.getAllPlayers()) {
            if (p.id == playerID && p.getComponent(EntityComponentTypes.Inventory).container.getItem(p.selectedSlotIndex)?.matches(shovelID)) {
                // set flag
                claimShovelOut = true;
                
                break;
            }
        }

        // only render if particles are enabled or owner has claim shovel out
        if (claim.particlesEnabled || claimShovelOut) {
            // loop through all claim points to determine particle type
            for (var a = 0; a < points.length; a++) {
                for (var b = 0; b < points[a].length; b++) {

                    // only render if claim point is in render distance
                    if (dimension.getBlock({ "x": points[a][b][0], "y": averageY, "z": points[a][b][1] }) != undefined) {

                        // creates sets of verticle claim particles 20 blocks below and above the claim
                        for (var i = averageY - averageOffset; i <= averageY + averageOffset; i += segmentHeight) {
                            if (points[a][b][0] > points[a ^ 1][b][0]) {
                                var xParticleType = "slc:negx_claim_dust";
                            }
                            else {
                                var xParticleType = "slc:posx_claim_dust";
                            }

                            if (points[a][b][1] > points[a][b ^ 1][1]) {
                                var yParticleType = "slc:negz_claim_dust";
                            }
                            else {
                                var yParticleType = "slc:posz_claim_dust";
                            }

                            var particlePoint: Vector3 = { "x": points[a][b][0] + 0.5, "y": i + 0.5, "z": points[a][b][1] + 0.5 };

                            try {
                                if (claim.particlesEnabled) {
                                    dimension.spawnParticle(xParticleType, particlePoint);
                                    dimension.spawnParticle(yParticleType, particlePoint);
                                    dimension.spawnParticle("slc:rising_claim_dust", particlePoint);
                                    dimension.spawnParticle("slc:falling_claim_dust", particlePoint);
                                } else if (claimShovelOut) {
                                    p.spawnParticle(xParticleType, particlePoint);
                                    p.spawnParticle(yParticleType, particlePoint);
                                    p.spawnParticle("slc:rising_claim_dust", particlePoint);
                                    p.spawnParticle("slc:falling_claim_dust", particlePoint);
                                }
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
}, 20);

// every minute decrement each online players time remaining until they recieve more claim blocks
system.runInterval(() => {
    for (var p of world.getAllPlayers()) {

        var playerData = PlayerData.fromId(p.id);

        // decrement timer by 1
        playerData.claimBlocks.decrementPaymentTime();

        // if time is up reward blocks and reset timer
        if (playerData.claimBlocks.paymentTimeRemaining <= 0) {
            playerData.claimBlocks.incrementAmount(settings.claimBlockHourlyPayment);
            sendNotification(p, "chat.blocks:payment", settings.claimBlockHourlyPayment.toString());
            playSound(p, AddonSounds.Global.POSITIVE_EVENT);

            playerData.claimBlocks.resetPaymentTime();
        }
    }
}, 1200)
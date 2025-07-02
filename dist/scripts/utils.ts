import { Entity, EntityComponentTypes, EntityInventoryComponent, EntityLeashableComponent, EntityQueryOptions, ItemLockMode, ItemStack, Player, StructureSaveMode, system, Vector3, world } from "@minecraft/server";
import { Claim, database, settings, ShovelBehavior } from "./database";

export const SHOVEL_ID = "slc:claim_shovel"

/**
 * When ran, this function will check if the player has a claim shovel in their inventory already and if not will give them one.
 * 
 * @param player - The player to give the claim shovel to
 * 
 * @param isLocked - Locks the claim shovel to the players inventory. This will also lock an existing claim shovel if found as an alternative to giving a new one.
 */
export function giveClaimShovel(player: Player, isLocked: boolean) {
    var inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;

    // check if player has a claim shovel in their inventory
    var hasShovel = false;
    var hasLockedShovel = true;
    for (var i = 0; i < inventory.inventorySize; i++) {
        var item = inventory.container.getItem(i);

        if (item && item.matches(SHOVEL_ID)) {
            hasShovel = true;

            // if the player already has a locked shovel, break
            if (item.lockMode == ItemLockMode.inventory) {
                hasLockedShovel = true;
                break;
            }
            // edit the item to make it locked
            else if (isLocked) {
                hasLockedShovel = true;

                item.lockMode = ItemLockMode.inventory;
                item.keepOnDeath = true;

                inventory.container.setItem(i, item) // update the current slots item

                break;
            }
        }
    }

    // give player a claim shovel if they don't have one
    if (!hasShovel || (isLocked && !hasLockedShovel)) {
        var item = new ItemStack(SHOVEL_ID, 1);

        if (isLocked){
            item.lockMode = ItemLockMode.inventory;
            item.keepOnDeath = true;
        }

        inventory.container.addItem(item);
    }
}

/**
 * Edits the claim shovel attributes to unlock it from the inventory and disable keep on death
 * 
 * @param player - The player to unlock the claim shovel for
 */
export function unlockClaimShovel(player: Player) {
    var inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;

    // find and edit any claim shovels that are locked to inventory
    for (var i = 0; i < inventory.inventorySize; i++) {
        var item = inventory.container.getItem(i);
        if (item && item.matches(SHOVEL_ID) && (item.lockMode == ItemLockMode.inventory)) {

            item.lockMode = ItemLockMode.none
            item.keepOnDeath = false;

            inventory.container.setItem(i, item) // replace the shovel with the updated one
        }
    }
}

/**
 * Updates how the claim shovel is given to a player
 * 
 * @param player - The player to update the claim shovels item behavior for
 */
export function updateShovelBehavior(player: Player, behaviorType: ShovelBehavior) {

    // forces the player to have a claim shovel at all times; default option
    if (behaviorType == ShovelBehavior.LOCK_TO_INVENTORY) {
        giveClaimShovel(player, true);
    }
    // gives the player a new claim shovel when the spawn in, it won't be locked to their inventory
    else if (behaviorType == ShovelBehavior.GIVE_AT_SPAWN) {
        giveClaimShovel(player, false);
    }

    // unlock the existing claim shovel item when switching to the crafting only or give at spawn modes
    if ((behaviorType == ShovelBehavior.MUST_BE_CRAFTED) || (behaviorType == ShovelBehavior.GIVE_AT_SPAWN)) {
        unlockClaimShovel(player)
    }
}

/**
 * Runs the callback for every claim saved in the database
 */
export function runInAllClaims(callback: (claimData: Claim) => void) {

    for (var player of database) {
        for (var claim of player.claims) {
            callback(claim);
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
export function getClosestPlayer(blockLocation: Vector3): Player {
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

/**
 * Creates a save for an entity using the worlds structure manager.
 * This is done in case the entity is killed by a disallowed player in one hit. (usually the health will be reset tho without a death, this is just a backup)
 * 
 * @param entity - Entity to save
 */
export function createEntitySave(entity: Entity): void {
    // an extra delay to ensure all entity components have loaded properly
    system.runTimeout(() => {
        // make sure the entity still exists after the timeout
        if (entity.isValid()) {

            var queryOptions: EntityQueryOptions = {};
            queryOptions.maxDistance = 1.5;
            queryOptions.location = entity.location;

            // prevent more than one entities from being saved to the structure
            if (world.getDimension("overworld").getEntities(queryOptions).length == 1) {
            
                const structureID = (entity.id as unknown as number) * Math.random();

                // filter out item stack entities to prevent performance issues
                if (entity.id != "minecraft:item") {
                    world.structureManager.createFromWorld("slc:" + structureID.toString(), world.getDimension("overworld"), entity.location, entity.location, {"includeBlocks": false, "includeEntities": true, "saveMode": StructureSaveMode.Memory});
                }

                entity.setDynamicProperty("structureID", structureID);
            }

            const leashComponent: EntityLeashableComponent = entity.getComponent(EntityComponentTypes.Leashable);

            // if the entity is connected to a leash knot save its location
            if (leashComponent && leashComponent.leashHolder && (leashComponent.leashHolderEntityId == "minecraft:leash_knot")) {
                entity.setDynamicProperty("leashKnotLocation", leashComponent.leashHolder.location);
            }
            else {
                entity.setDynamicProperty("leashKnotLocation"); // clear the property
            }
        }
    }, 10)
}
import { EntityComponentTypes, EntityInventoryComponent, ItemLockMode, ItemStack, Player, Vector3, world } from "@minecraft/server";
import { Claim, database } from "./database";

export const SHOVEL_ID = "slc:claim_shovel"

/**
 * When ran, this function will check if the player has a locked claim shovel in their inventory and if not will give them one.
 * 
 * @param player - The player to give the claim shovel to
 */
export function forceClaimShovelInInventory(player: Player) {
    var inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;

    // check if player has a claim shovel in their inventory
    var hasShovel = false;
    for (var i = 0; i < inventory.inventorySize; i++) {
        var item = inventory.container.getItem(i);
        if (item && item.matches(SHOVEL_ID) && (item.lockMode == ItemLockMode.inventory)) {
            hasShovel = true;
            break;
        }
    }

    if (!hasShovel) {
        // give player a claim shovel if they don't have one
        var item = new ItemStack(SHOVEL_ID, 1);
        item.lockMode = ItemLockMode.inventory;
        item.keepOnDeath = true;
        inventory.container.addItem(item);
    }
}

/**
 * Used when the Lock Claim Shovel To Inventory addon setting is disabled to remove any existing locked claim shovels
 * 
 * @param player - The player to remove locked claim shovels from
 */
export function removeLockedClaimShovel(player: Player) {
    var inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;

    // find and remove any claim shovels that are locked to inventory
    for (var i = 0; i < inventory.inventorySize; i++) {
        var item = inventory.container.getItem(i);
        if (item && item.matches(SHOVEL_ID) && (item.lockMode == ItemLockMode.inventory)) {
            inventory.container.setItem(i, undefined) // clear the slot
        }
    }
}

/**
 * Runs the callback for every claim saved in the database
 */
export function runInAllClaims(callback: (playerID: string, playerName: string, claimData: Claim) => void) {

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
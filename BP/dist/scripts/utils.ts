import { Entity, EntityComponentTypes, EntityInventoryComponent, ItemLockMode, ItemStack, Player, system, Vector3, world } from "@minecraft/server";
import { Claim, database, ShovelBehavior } from "./database.js";

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

        if (item && item.typeId === SHOVEL_ID) {
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
        if (item && item.typeId === SHOVEL_ID && (item.lockMode == ItemLockMode.inventory)) {

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
 * Waits for the entity to be fully loaded and valid in the world
 * 
 * @param entity - The entity to wait for
 * @param timeout - The maximum time to wait in ticks
 * @returns A boolean promise that resolves when the entity is valid (true), or rejects if it times out (false)
 */
export function waitForEntityLoad(entity: Entity, timeout: number): Promise<boolean> {
    const startTime = system.currentTick;

    return new Promise((resolve) => {
        const intervalId = system.runInterval(() => {
            if (entity.isValid) {
                system.clearRun(intervalId);

                resolve(true);
            } else if (system.currentTick - startTime >= timeout) {
                system.clearRun(intervalId);

                resolve(false);
            }
        }, 10); // every 10 ticks
    });
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
            if (getDistance(p.location, blockLocation) < closestDistance) {
                closestDistance = getDistance(p.location, blockLocation);
                closestPlayer = p;
            }
        }
    }

    return closestPlayer;
}

/**
 * Calculates the distance between two points in 3D space using pythagorean theorem or some shit idk copilot wrote it.
 *
 * @param pointA - The first point.
 * @param pointB - The second point.
 * @returns The distance between the two points.
 */
export function getDistance(pointA: Vector3, pointB: Vector3): number {
    return Math.sqrt(
        Math.pow(pointA.x - pointB.x, 2) +
        Math.pow(pointA.y - pointB.y, 2) +
        Math.pow(pointA.z - pointB.z, 2)
    );
}

/**
 * Represents a timer for managing event drops.
 * 
 * @property Id - The unique identifier for the event.
 * @property sentTimestamp - The timestamp when the event was sent.
 * @property dropTimer - The duration in ticks before the event can be sent again.
 */
export interface DropTimer {
    Id: string;
    sentTimestamp: number; // in ticks
    dropTimer: number; // in ticks; any event sent within this time will be dropped
}

/**
 * Manages a set of drop timers for events to ensure they are not sent too frequently.
 */
export class DropTimerManager {
    public activeTimers: DropTimer[] = [];

    /**
     * Clears expired timers from the active timers list.
     */
    public clearExpiredTimers() {
        this.activeTimers = this.activeTimers.filter(timer => {
            // Keep timers that are still within their drop timer
            return (system.currentTick - timer.sentTimestamp) < timer.dropTimer;
        });
    }
}
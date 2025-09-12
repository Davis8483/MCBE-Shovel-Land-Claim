import { Player, world, system } from "@minecraft/server";
import { playSound, AddonSounds } from './sounds.js';
import { DropTimerManager } from './utils.js';

/**
 * Manages notifications for a specific player, ensuring that duplicate messages are not sent within a specified drop timer.
 */
export class NotificationManager extends DropTimerManager {
    public player: Player;

    /**
     * Creates an instance of the NotificationManager for a specific player.
     * 
     * @param player - The player to manage notifications for.
     */
    constructor(player: Player) {
        super();

        this.player = player;
    }

    /**
     * Sends a notification message to the player with a custom SLC prefix.
     * 
     * @param player - The player to send the message to.
     * @param sound - The sound to play when sending the message.
     * @param dropTimer - The time in ticks to wait before allowing the same message to be sent again.
     * @param langId - The language entry for the message.
     * @param slots - The %s slots to replace in the message.
     */
    public send(player: Player, sound: AddonSounds.Shovel | AddonSounds.Claim | AddonSounds.Global, dropTimer: number | undefined, langId: string, ...slots: string[]) {

        this.clearExpiredTimers();

        // if notif drop timer exists, meaning its still active, do not send the message
        if (!this.activeTimers.find(timer => timer.Id === langId)) {
            player.sendMessage([{ "translate": "chat.prefix" }, { "text": " " }, { "translate": `${langId}` , "with": slots}]);

            playSound(player, sound);

            // push new timer to active timers
            this.activeTimers.push({
                Id: langId,
                sentTimestamp: system.currentTick,
                dropTimer: dropTimer || 2 // default drop timer is 2 ticks
            });
        }
    }
}

/**
 * Manages a stack of NotificationManager instances for different players.
 */
export class NotificationManagerStack {
    private static stack: NotificationManager[] = [];

    /**
     * Gets the NotificationManager for a specific player.
     * If it does not exist, a new one is created and added to the stack.
     * 
     * @param playerId - The player entity id.
     * @returns The NotificationManager for the specified player; undefined if the player is not found/online.
     */
    static getById(playerId: string): NotificationManager | undefined {

        const manager = this.stack.find(manager => manager.player.id === playerId);
        const player = world.getEntity(playerId);

        // If no manager found, create a new one and add it to the stack
        if (!manager && player && player instanceof Player) {
            const newManager = new NotificationManager(player);
            this.stack.push(newManager);
            return newManager;
        }

        return manager;
    }
}
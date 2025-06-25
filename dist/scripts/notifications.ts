import { Player } from "@minecraft/server";
import { playSound, AddonSounds } from './sounds.js';

var lastNotificationTime = Date.now();
var lastNotificationLangEntry = "";

/**
 * Sends a notification message to the player with a custom SLC prefix.
 * 
 * @param player - The player to send the message to.
 * @param sound - The sound to play when sending the message.
 * @param langEntry - The language entry for the message.
 * @param slots - The %s slots to replace in the message.
 */
export function sendNotification(player: Player, sound: AddonSounds.Shovel | AddonSounds.Claim | AddonSounds.Global, langEntry: string, ...slots: string[]) {

    // only send the message if the last notification with the same langEntry was sent after 200ms
    if ((Date.now() - lastNotificationTime > 200) || (lastNotificationLangEntry != langEntry)) {
        player.sendMessage([{ "translate": "chat.prefix" }, { "text": " " }, { "translate": `${langEntry}` , "with": slots}]);

        playSound(player, sound);
    }

    lastNotificationLangEntry = langEntry;
    lastNotificationTime = Date.now();
}
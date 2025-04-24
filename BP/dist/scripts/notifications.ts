import { Player, RawMessage } from "@minecraft/server";

/**
 * Sends a notification message to the player with a custom SLC prefix.
 * 
 * @param player - The player to send the message to.
 * @param langEntry - The language entry for the message.
 * @param slots - The %s slots to replace in the message.
 */
export function sendNotification(player: Player, langEntry: string, ...slots: string[]) {
    player.sendMessage([{ "translate": "chat.prefix" }, { "text": " " }, { "translate": `${langEntry}` , "with": slots}]);
}
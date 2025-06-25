import { world, system, Player, Vector3, CameraFadeOptions, CameraSetPosOptions, EasingType, InputPermissionCategory, HudVisibility, RawMessage } from '@minecraft/server';
import { CallbackActionFormData, CallbackModalFormData, CallbackMessageFormData, clearNavigationStack, ModalDataCorrect, ModalDataError, navigateBack, popNavigationStack } from './ui_wrapper.js';
import { database, PlayerData, Claim, PlayerPermissions, PermissionTypes, settings } from './database.js';
import { playSound, AddonSounds } from './sounds.js';
import { sendNotification } from './notifications.js';

export class ShovelUI {
    private player: Player;
    private opModeActive: boolean = false; // if the player is in op mode or not

    // player selected icons for their claims
    private claimIcons = {
        // name: path
        "ui.claim.icons:land": "textures/ui/icon_recipe_nature.png",
        "ui.claim.icons:bed": "textures/ui/icon_recipe_item.png",
        "ui.claim.icons:farmland": "textures/ui/icon_new.png",
        "ui.claim.icons:weapons": "textures/ui/icon_recipe_equipment.png",
        "ui.claim.icons:flowers": "textures/ui/icon_spring.png"
    };

    /**
     * Creates a new ShovelUI object.
     * 
     * @param player - The player to show the UI to
     */
    constructor(player: Player) {
        this.player = player;
        this.opModeActive = false; // set to false by default

        clearNavigationStack();
    }

    /**
     * Main menu for the shovel land claim addon.
     */
    public main() {
        var playerData: PlayerData = PlayerData.fromId(this.player.id);

        const form = new CallbackActionFormData(() => this.main())
            .title({"translate": "ui.main:title"})
            .body({
                "rawtext": [
                    { "translate": "ui.main:body.paragraph:1" },
                    { "text": "\n\n" },
                    { "translate": "ui.main:body.paragraph:2" },
                    { "text": "\n\n" },
                    { "translate": "ui.main:body.paragraph:3" },
                    // conditionally show the claim blocks information
                    !playerData.ignoreClaimBlockRequirements ? { "rawtext": [
                        { "text": "\n\n" },
                        { "translate": "ui.main:body.paragraph:4" }, { "text": ` §e${playerData.claimBlocks.amount}§r ` },
                        // conditionally show the claim block hourly payment information
                        !playerData.disableClaimBlockPayment ? { "rawtext": [
                            { "text": "\n\n" },
                            { "translate": "ui.main:body.paragraph:5", "with": [settings.claimBlockHourlyPayment.toString(), playerData.claimBlocks.paymentTimeRemaining.toString()] }
                        ]} : { "rawtext": [] }
                    ]} : { "rawtext": [] }
                ]
            })

            // conditionally show the manage claims button if the player has any claims
            if (playerData.claims.length > 0){
                form.button({ 
                    "rawtext": [
                        {"translate": "ui.main.button:manage"},
                        { "text": settings.maxClaimAmount > 0 ? (((playerData.claims.length >= settings.maxClaimAmount) ? " §c" : " ") + `(${playerData.claims.length}/${settings.maxClaimAmount})`) : "" }
                    ]
                }, "textures/ui/icon_saleribbon.png", () => {
                    this.claimsList(playerData.id);
                });
            }

            form.button({"translate": "ui.main.button:global_player_permissions"}, "textures/ui/worldsIcon.png", () => {
                this.playerPermissionsList(playerData);
            })
            if (this.player.hasTag("shovel.op")) {
                form.button({"translate": "ui.main.button:op_panel"}, "textures/ui/permissions_op_crown.png", () => {
                    this.opPanel();
                })
            }
    
            form.button({"translate": "ui.main.button:addon_info"}, "textures/ui/infobulb.png", () => {
                this.addonInfo();
            })
            .button({"translate": "ui.main.button:close"})
        

        form.show(this.player);
    }

    /**
     * Menu for managing players and addon settings.
     */
    private opPanel() {
        this.opModeActive = true; // set to true when in op mode

        const form = new CallbackActionFormData(() => this.opPanel())
            .title({"translate": "ui.op_panel:title"})
            .button({"translate": "ui.op_panel.addon_settings:title"}, "textures/ui/icon_setting.png", () => {this.opAddonSettings()})
            .button({"translate": "ui.op_panel.button:manage_players"}, "textures/ui/multiplayer_glyph_color.png", () => {this.opPlayerList()})
            .button({"translate": "ui.op_panel.button:disallowed_blocks"}, "textures/blocks/barrier.png", () => {this.opDisallowedBlocks()})
            .button({"translate": "ui.global.button:back"}, undefined, () => {this.opModeActive = false; navigateBack();})
            .show(this.player);
    }

    private opPlayerList() {
        const form = new CallbackActionFormData(() => this.opPlayerList())
            .title({"translate": "ui.op_panel.player_list:title"})

        for (const p of database) {
            var isOnline = world.getAllPlayers().filter(player => player.id == p.id).length > 0 ? true : false;

            form.button({"rawtext": [{"text": p.name + "\n"}, {"translate": isOnline? "ui.op_panel.player_list.online": "ui.op_panel.player_list.offline"}]}, isOnline? "textures/ui/profile_glyph_color.png" : "textures/ui/profile_glyph.png", () => {this.opManagePlayer(p.id)});
        }

        form.button({"translate": "ui.global.button:back"}, undefined, () => {navigateBack();})
        form.show(this.player);
    }

    private opAddonSettings() {
        const form = new CallbackModalFormData(() => this.opAddonSettings())
            .title({"translate": "ui.op_panel.addon_settings:title"})
            .textField({"translate": "ui.op_panel.addon_settings.textbox:claim_block_payment"}, {"translate": "ui.op_panel.addon_settings.textbox:claim_block_payment_placeholder"}, settings.claimBlockHourlyPayment.toString(), (value) => {
                var newClaimBlockPayment = parseInt(value as string);

                if (isNaN(newClaimBlockPayment) || newClaimBlockPayment < 0) {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.op_panel.addon_settings.error:must_be_positive_number");
                }
                else {
                    // update claim block payment
                    settings.setClaimBlockHourlyPayment(newClaimBlockPayment);

                    return new ModalDataCorrect();
                }
            })
            .textField({"translate": "ui.op_panel.addon_settings.textbox:starting_claim_blocks"}, {"translate": "ui.op_panel.addon_settings.textbox:starting_claim_blocks_placeholder"}, settings.startingClaimBlocks.toString(), (value) => {
                var newStartingClaimBlocks = parseInt(value as string);

                if (isNaN(newStartingClaimBlocks) || newStartingClaimBlocks < 0) {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.op_panel.addon_settings.error:must_be_positive_number");
                }
                else {
                    // update claim block starting amount
                    settings.setStartingClaimBlocks(newStartingClaimBlocks);

                    return new ModalDataCorrect();
                }
            })
            .textField({"translate": "ui.op_panel.addon_settings.textbox:claim_min_width"}, {"translate": "ui.op_panel.addon_settings.textbox:claim_min_width_placeholder"}, settings.claimMinimumWidth.toString(), (value) => {
                var newClaimMinimumWidth = parseInt(value as string);

                if (isNaN(newClaimMinimumWidth) || newClaimMinimumWidth < 0) {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.op_panel.addon_settings.error:must_be_positive_number");
                }
                else {
                    // update claim minimum width
                    settings.setClaimMinimumWidth(newClaimMinimumWidth);

                    return new ModalDataCorrect();
                }
            })
            .textField({"translate": "ui.op_panel.addon_settings.textbox:max_claim_amount"}, {"translate": "ui.op_panel.addon_settings.textbox:max_claim_amount_placeholder"}, settings.maxClaimAmount.toString(), (value) => {
                var newMaxClaimAmount = parseInt(value as string);

                if (isNaN(newMaxClaimAmount) || newMaxClaimAmount < 0) {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.op_panel.addon_settings.error:must_be_positive_number");
                }
                else {
                    // update max claim amount
                    settings.setMaxClaimAmount(newMaxClaimAmount);

                    return new ModalDataCorrect();
                }
            })
            .submitButton({"translate": "ui.op_panel.addon_settings.button:save"}, (response) => {
                playSound(this.player, AddonSounds.Claim.SAVE);
                navigateBack();
            });
        form.show(this.player);
    }

    private opManagePlayer(playerId: string) {
        var playerData: PlayerData = PlayerData.fromId(playerId || this.player.id);

        const form = new CallbackActionFormData(() => this.opManagePlayer(playerId))
            .title(this.opModeActive? {"translate": "ui.main.op_mode:title", "with": [playerData.name]} : {"translate": "ui.main:title"})

            form.button({"translate": "ui.op_manage_player.button:player_config"}, "textures/ui/icon_setting.png", () => {this.opPlayerConfig(playerId)})

            // conditionally show the manage claims button if the player has any claims
            if (playerData.claims.length > 0){
                form.button({"translate": "ui.main.button:manage"}, "textures/ui/icon_saleribbon.png", () => {
                    this.claimsList(playerData.id);
                });
            }

            // conditionally show the edit claim blocks button
            if (!playerData.ignoreClaimBlockRequirements){
                form.button({"translate": "ui.op_manage_player.button:edit_claim_blocks", "with": [playerData.claimBlocks.amount.toString()]}, "textures/ui/pencil_edit_icon.png", () => {this.opEditClaimBlocks(playerId)})
            }

            form.button({"translate": "ui.main.button:global_player_permissions"}, "textures/ui/icon_multiplayer.png", () => {
                this.playerPermissionsList(playerData);
            })
            // if player is offline
            if (world.getAllPlayers().filter(p => p.id == playerId).length == 0) {
                form.button({"translate": "ui.op_manage_player.button:delete_player_data"}, "textures/ui/redX1.png", () => {
                    this.opDeletePlayerConfirm(playerId);
                })
            }
            form.button({"translate": "ui.global.button:back"}, undefined, () => {navigateBack();});


        form.show(this.player);
    }

    private opPlayerConfig(playerId: string) {

        var playerData: PlayerData = PlayerData.fromId(playerId);

        const form = new CallbackModalFormData(() => this.opPlayerConfig(playerId))
            .title({"translate": "ui.op_player_config:title", "with": [playerData.name]})
            .toggle({"translate": "ui.op_player_config.toggle:ignore_claim_block_requirements"}, playerData.ignoreClaimBlockRequirements, (value) => {

                playerData.setIgnoreClaimBlockRequirements(value);

                return new ModalDataCorrect();

            })
            .toggle({"translate": "ui.op_player_config.toggle:disable_claim_block_hourly_payement"}, playerData.disableClaimBlockPayment, (value) => {
                playerData.setDisableClaimBlockPayment(value);

                return new ModalDataCorrect();
            });

            form.submitButton({"translate": "ui.global.button:save"}, (response) => {

                playSound(this.player, AddonSounds.Claim.SAVE);

                // navigate back to the previous menu
                navigateBack();
            })
        form.show(this.player);
    }

    private opDeletePlayerConfirm(playerId: string) {
        const form = new CallbackMessageFormData(() => this.opDeletePlayerConfirm(playerId))
            .title({"translate": "ui.op_delete_player:title"})
            .body({"translate": "ui.op_delete_player:body"})
            .button1({"translate": "ui.op_delete_player.button:cancel"}, () => {
                // return to previous menu
                navigateBack();
            })
            .button2({"translate": "ui.op_delete_player.button:confirm"}, () => {
                // remove player from database
                PlayerData.fromId(playerId).delete();
                playSound(this.player, AddonSounds.Claim.DELETE);

                // return to previous menu
                popNavigationStack(); // remove the player list menu from the stack
                navigateBack();
            });

        form.show(this.player);
    }

    private opEditClaimBlocks(playerId: string) {
        var playerData: PlayerData = PlayerData.fromId(playerId || this.player.id);
        var claimBlocks = playerData.claimBlocks.amount;

        const form = new CallbackModalFormData(() => this.opEditClaimBlocks(playerId))
            .title({"translate": "ui.op_edit_claim_blocks:title"})
            .textField({"translate": "ui.op_edit_claim_blocks.textbox:claim_blocks"}, {"translate": "ui.op_edit_claim_blocks.textbox:claim_blocks_placeholder"}, claimBlocks.toString(), (value) => {
                var newClaimBlocks = parseInt(value as string);

                if (isNaN(newClaimBlocks) || newClaimBlocks < 0) {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.op_edit_claim_blocks.error:must_be_positive_number");
                }
                else {
                    // update claim blocks
                    playerData.claimBlocks.setAmount(newClaimBlocks);

                    return new ModalDataCorrect();
                }
            })
            .submitButton({"translate": "ui.global.button:save"}, (response) => {

                playSound(this.player, AddonSounds.Claim.SAVE);

                // navigate back to the previous menu
                navigateBack();
            })
    form.show(this.player);
    }

    /**
     * Shows the disallowed blocks menu for the OP panel.
     */
    private opDisallowedBlocks() {
        const form = new CallbackActionFormData(() => this.opDisallowedBlocks())
            .title({"translate": "ui.op_disallowed_blocks:title"});

        for (const bId of settings.disallowedBlocks) {
            form.button({"text": bId }, "textures/blocks/structure_void.png", () => {popNavigationStack(); this.opDisallowedBlocks()});
        }

        form.button({"translate": "ui.op_disallowed_blocks.button:add_block"}, "textures/ui/realms_slot_check.png", () => {this.opEditDisallowedBlocks(true)})
            .button({"translate": "ui.op_disallowed_blocks.button:remove_block"}, "textures/ui/redX1.png", () => {this.opEditDisallowedBlocks(false)})
            .button({"translate": "ui.global.button:back"}, undefined, () => {navigateBack();});

        form.show(this.player);
    }

    /**
     * Adds or removes a block from the disallowed blocks list.
     * 
     * @param add - Wether to add or remove the block from the disallowed blocks list
     */
    private opEditDisallowedBlocks(add: boolean) {
        const form = new CallbackModalFormData(() => this.opEditDisallowedBlocks(add))
            .title({"translate": "ui.op_edit_disallowed_blocks:title"})

        if (add) {
            form.textField({"translate": "ui.op_edit_disallowed_blocks.textbox:block_id"}, {"translate": "ui.op_edit_disallowed_blocks.textbox:block_id_placeholder"}, "", (value) => {
                var blockId = value as string;

                if (blockId == "") {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.op_edit_disallowed_blocks.error:must_not_be_empty");
                }
                else if (settings.disallowedBlocks.includes(blockId)) {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.op_edit_disallowed_blocks.error:block_already_disallowed");
                }
                else {
                    // add the block to the disallowed blocks list
                    settings.disallowedBlocks.push(blockId);

                    return new ModalDataCorrect();
                }
            })
        }
        else {
            form.dropdown({"translate": "ui.op_edit_disallowed_blocks.dropdown:block_id"}, settings.disallowedBlocks.map(b => ({"text": b})), undefined, (value) => {

                // remove the block from the disallowed blocks list
                settings.removeDisallowedBlock(settings.disallowedBlocks[value as number]);

                return new ModalDataCorrect();
            })
        }

        form.submitButton({"translate": "ui.global.button:save"}, (response) => {
            playSound(this.player, AddonSounds.Claim.SAVE);

            // navigate back to the previous menu
            navigateBack();
        });

        form.show(this.player);
    }

    private addonInfo() {
        const form = new CallbackActionFormData(() => this.addonInfo())
            .title({"translate": "ui.addon_info:title"})
            .body({
                "rawtext": [
                    { "translate": "ui.addon_info:body.paragraph:1" },
                    { "text": "\n\n" },
                    { "translate": "ui.addon_info:body.paragraph:2" },
                    { "text": "\n\n" },
                    { "translate": "ui.addon_info:body.paragraph:3" },
                    { "text": "\n\n" },
                    { "translate": "ui.addon_info:body.paragraph:4" },
                    { "text": "\n\n" },
                    { "translate": "ui.addon_info:body.paragraph:5" },
                    { "text": "\n\n" },
                    { "translate": "ui.addon_info:body.paragraph:6" },
                    { "text": "\n\n" }
                ]
            })
            .button({"translate": "ui.global.button:back"}, undefined, () => {navigateBack();})
            .show(this.player);
    }

    /**
     * New claim creation page, uses the claimConfig page under the hood.
     * 
     * @param start - The starting Vector3 of the claim
     * @param end - The ending Vector3 of the claim
     */
    public newClaim(start: Vector3, end: Vector3) {
        this.claimConfig(new Claim("", start, end, this.claimIcons[Object.keys(this.claimIcons)[0]]));
    }

    /**
     * Popup to confirm resizing a claim.
     * 
     * @param claim - The claim to resize
     * @param start - The starting Vector3 of the claim
     * @param end - The ending Vector3 of the claim
     */
    public resizeClaim(claim: Claim, start: Vector3, end: Vector3) {
        var playerData: PlayerData = claim.getOwnerData();

        const oldClaimWidth = Math.abs(claim.start.x - claim.end.x) + 1;
        const oldClaimLength = Math.abs(claim.start.z - claim.end.z) + 1;

        const newClaimWidth = Math.abs(start.x - end.x) + 1;
        const newClaimLength = Math.abs(start.z - end.z) + 1;

        const blockDifference = (oldClaimLength * oldClaimWidth) - (newClaimLength * newClaimWidth)

        const form = new CallbackMessageFormData(()=> this.resizeClaim(claim, start, end))
            .title({"translate": "ui.claim.resize:title"})
            .body({
                "rawtext": [
                    { "translate": "ui.claim.resize:body" },
                    { "text": `§l\n\n${blockDifference < 0 ? "§c-" : "§a+"}${blockDifference} ` },
                    { "translate": "ui.manage.resize:label:claim_blocks" }
                ]
            })
            .button1({"translate": "ui.claim.resize.button:cancel"})
            .button2({"translate": "ui.claim.resize.button:resize"}, ()=> {
                claim.setStart(start);
                claim.setEnd(end);

                // notify player
                sendNotification(this.player, AddonSounds.Global.POSITIVE_EVENT, "chat.claim:resized")

                //add/subtract the blocks from players balance
                playerData.claimBlocks.incrementAmount(blockDifference);

                playerData.setResizingClaimName("");
            });

        form.show(this.player);
    }

    /**
     * Shows a list of claims the player owns.
     * 
     * @param ownerId - The entity id of the player that owns the claims
     */
    private claimsList(ownerId: string) {
        var playerData: PlayerData = PlayerData.fromId(ownerId);

        const form = new CallbackActionFormData(() => this.claimsList(ownerId))
            .title({
                rawtext: [
                    {"translate": "ui.manage:title"},
                    { "text": settings.maxClaimAmount > 0 ? (((playerData.claims.length >= settings.maxClaimAmount) ? " §c" : " ") + `(${playerData.claims.length}/${settings.maxClaimAmount})`) : "" }
                ]
            });

        for (const c of playerData.claims) {

            form.button(
                {
                    "rawtext": [
                        { "text": `${c.name}§r\n§c${c.getSize().width}§8x§9${c.getSize().length} ` }
                    ]
                }, c.icon, () => {this.manageClaim(c)});
        }

        form.button({"translate": "ui.global.button:back"}, undefined, () => {navigateBack();});
        form.show(this.player);
    }

    /**
     * A form with options to manage a claim. These options include, configuring the claim, managing permissions, viewing the claim and removing it.
     * 
     * @param claim - The claim to manage
     */
    private manageClaim(claim: Claim) {
        const form = new CallbackActionFormData(() => this.manageClaim(claim))
            .title({
                "rawtext": [
                    { "translate": "ui.manage:title" },
                    { "text": `: ${claim.name}` }
                ]
            })
            .body({
                "rawtext": [
                    { "text": "\n" },
                    { "translate": "ui.manage.body:claim_start", "with": [claim.start.x.toString(), claim.start.z.toString()] },
                    { "text": "\n\n" },
                    { "translate": "ui.manage.body:claim_end", "with": [claim.end.x.toString(), claim.end.z.toString()] },
                    { "text": "\n " }
                ]
            })
            .button({"translate": "ui.manage.button:config"}, "textures/ui/icon_setting.png", () => {this.claimConfig(claim)})
            .button({"translate": "ui.manage.button:public_permissions"}, "textures/ui/icon_multiplayer.png", () => {this.managePermissions(claim)})
            .button({"translate": "ui.manage.button:player_permissions"}, "textures/ui/friend1_black_outline_2x.png", () => {this.playerPermissionsList(claim)})
            .button({"translate": "ui.manage.button:view"}, "textures/ui/magnifyingGlass.png", () => {this.viewClaim(claim)})
            .button({"translate": "ui.manage.button:remove"}, "textures/ui/icon_trash.png", () => {this.removeClaim(claim)})
            .button({"translate": "ui.global.button:back"}, undefined, () => {navigateBack();});

        form.show(this.player);
    }

    /**
     * Shows a message form asking if the player would like to either edit the global permissions or overwrite them with a local claim player permission.
     * 
     * @param listParent - The parent class that contains the player permissions list
     * @param playerID - The entity id of the player to manage permissions for
     */
    private editGlobalPermissionIntent(listParent: Claim, playerID: string) {
        // we're telling the navigation stack to go back to the player permissions list menu instead of this one :thumbs_up:
        const form = new CallbackMessageFormData(() => this.playerPermissionsList(listParent))
            .title({"translate": "ui.edit_global_permissions_intent.title"})
            .body({"translate": "ui.edit_global_permissions_intent.body"})
            .button1({"translate": "ui.edit_global_permissions_intent.button:overwrite"}, () => {this.managePermissions(listParent, playerID)})
            .button2({"translate": "ui.edit_global_permissions_intent.button:edit"}, () => {this.managePermissions(listParent.getOwnerData(), playerID)});


        form.show(this.player);
    }

    /**
     * Shows a form to manage individual player permissions.
     * 
     * @param listParent - The parent class that contains the player permissions list
     */
    private playerPermissionsList(listParent: Claim | PlayerData) {

        const form = new CallbackActionFormData(() => this.playerPermissionsList(listParent))
            .title({
                "rawtext": [
                    { "translate": listParent instanceof Claim ? "ui.manage.permissions.player.selection:title": "ui.manage.gloabl_permissions.player.selection:title" },
                    listParent instanceof Claim ? { "text": `: ${listParent.name}` } : {}
                ]
            })
            .body({"translate": listParent instanceof Claim ? "ui.manage.permissions.player.selection:body" : "ui.manage.gloabl_permissions.player.selection:body"});
        
        // show all global player permissions; include an extra Global badge next to the player name
        if (listParent instanceof Claim) {
            // make sure to filter out global player permissions that are overiden in the claim
            for (const pP of listParent.getOwnerData().playerPermissionsList.filter(p => !listParent.playerPermissionsList.some(p2 => p2.id == p.id))) {
                var isOnline = world.getAllPlayers().filter(player => player.id == pP.id).length > 0 ? true : false;

                form.button({"rawtext": [{"text": pP.name + "\n"}, {"translate": isOnline? "ui.manage.permissions.player.selection:global_online": "ui.manage.permissions.player.selection:global_offline"}]}, isOnline? "textures/ui/profile_glyph_color.png" : "textures/ui/profile_glyph.png", () => {this.editGlobalPermissionIntent(listParent, pP.id)});
            }
        }
        
        // show all local/claim specific player permissions
        for (const pP of listParent instanceof Claim ? listParent.playerPermissionsList : listParent.playerPermissionsList) {
            var isOnline = world.getAllPlayers().filter(player => player.id == pP.id).length > 0 ? true : false;

            form.button({"rawtext": [{"text": pP.name + "\n"}, {"translate": isOnline? "ui.manage.permissions.player.selection.online": "ui.manage.permissions.player.selection.offline"}]}, isOnline? "textures/ui/profile_glyph_color.png" : "textures/ui/profile_glyph.png", () => {this.managePermissions(listParent, pP.id)});
        }

        if (listParent.getUnsavedPlayers().length > 0){
            form.button({"translate": "ui.manage.permissions.player.selection:add_player"}, "textures/ui/realms_slot_check.png", () => {this.playerPermissionsListModify(true, listParent)});
        }

        if (listParent.playerPermissionsList.length > 0){
            form.button({"translate": "ui.manage.permissions.player.selection:remove_player"}, "textures/ui/redX1.png", () => {this.playerPermissionsListModify(false, listParent)});
        }

        form.button({"translate": "ui.global.button:back"}, undefined, () => {navigateBack();});

        form.show(this.player);
    }
    /**
     * Creates a prompt to specify what player to add or remove from permissions list
     * 
     * @param add - Wether to add or remove the selected player from the specific player permissions list
     * 
     * @param listParent - The parent class that contains the player permissions list
     */
    private playerPermissionsListModify(add: boolean, listParent: Claim | PlayerData) {

        // get unsaved players list
        var unsavedPlayers: string[] = listParent.getUnsavedPlayers();

        const form = new CallbackModalFormData(() => this.playerPermissionsListModify(add, listParent))
            .title(add ? {
                "rawtext": [
                    { "translate": "ui.manage.permissions.player.selection.modify.add:title" }
                ]
            } :
                {
                    "rawtext": [
                        { "translate": "ui.manage.permissions.player.selection.modify.remove:title" }
                    ]
                }
            )
            .dropdown({"translate": "ui.manage.permissions.player.selection.modify:player_dropdown"}, add ? unsavedPlayers.map(id => ({"text": PlayerData.fromId(id).name})) : listParent.playerPermissionsList.map(p => ({"text": p.name || ""})))
            .submitButton(add ? {"translate": "ui.manage.permissions.player.selection.modify.add:submit"} : {"translate": "ui.manage.permissions.player.selection.modify.remove:submit"}, (response) => {
                const playerID = add ? unsavedPlayers[response.formValues[0] as number] : listParent.playerPermissionsList[response.formValues[0] as number].id;

                if (add) {

                    // if player was added open the permissions menu for them
                    popNavigationStack(); // remove the player permissions list menu from the stack
                    this.managePermissions(listParent, playerID);
                }
                else {

                    // list of players that are set to be disallowed from entering the claim
                    var pendingEntranceDisallowList: PlayerData[] = [];
                    var pendingEntranceDisallowClaimName: string;

                    for (var p of world.getAllPlayers()) {
                        var playerData: PlayerData = PlayerData.fromId(p.id);

                        // if a players permissions have been deleted notify them
                        if (p.id == playerID) {
                            sendNotification(p, AddonSounds.Claim.SAVE, listParent instanceof Claim ? "chat.claim:player_permissions_reset_notif" : "chat.claim:global_player_permissions_reset_notif", this.player.name, listParent.name);

                            // get the claim the player is in, this will be undefined if the player is not in a claim
                            const claim = listParent instanceof Claim ? 
                                listParent.isOverlap(p.location, p.location) ? 
                                    listParent : undefined
                                : listParent.claims.filter(c => c.isOverlap(p.location, p.location))[0];

                            // check if the player will lose access to the claim they are in
                            // compares permissions of soon to be deleted player permissions to the claim permissions
                            if (claim && !claim.permissions.getPermission(PermissionTypes.ENTER_CLAIM) && claim.hasPermission(PermissionTypes.ENTER_CLAIM, p)) {
                                
                                // set flag so the player is not ejected from the claim
                                playerData.setPendingEntranceDisallow(true);

                                pendingEntranceDisallowList.push(playerData);
                                pendingEntranceDisallowClaimName = claim.name;

                            }
                        }
                    }

                    // remove player from list
                    listParent.removePlayerPermissions(playerID);

                    playSound(this.player, AddonSounds.Claim.DELETE);

                    if (pendingEntranceDisallowList.length > 0) {
                        // notify the owner that players are pending entrance disallowed
                        this.pendingEntranceDisallow(pendingEntranceDisallowList, pendingEntranceDisallowClaimName);
                    }
                    else {
                        // return to previous menu
                        navigateBack();
                    }
                }
            });
        form.show(this.player)
    }

    /**
    * A page for editing permissions.
    * 
    * @param listParent - The parent class that contains the player permissions list
    * 
    * @param playerID - The entity id of the player to manage permissions for, if not specified the claims public permissions will be updated.
    */
    private managePermissions(listParent: Claim | PlayerData, playerID?: string) {

        var playerPermissions = listParent.playerPermissionsList.filter(p => p.id == playerID)[0];

        // player is not in the list, so we need to create a new player permissions object
        if (playerPermissions == undefined && playerID) {

            playerPermissions = new PlayerPermissions(playerID, PlayerData.fromId(playerID).name);

            // if a claim, copy private permissions to new player permissions
            if (listParent instanceof Claim) {
                for (var perm of Object.values(PermissionTypes)) {
                    playerPermissions.setPermission(perm, listParent.permissions.getPermission(perm));
                }
            }

            // save new player permission to list
            listParent.addPlayerPermissions(playerPermissions);
        }

        const target = playerID ? playerPermissions : (listParent instanceof Claim ? listParent.permissions : undefined); // target is either the claim or the player permissions object
        const defaults = playerID ? playerPermissions : (listParent instanceof Claim ? listParent.permissions : undefined); // defaults is either the claim or the player permissions object
        const form = new CallbackModalFormData(() => this.managePermissions(listParent, playerID))
            .title(playerID ? {
                "rawtext": [
                    { "translate": listParent instanceof Claim? "ui.manage.permissions.player:title" : "ui.manage.global_permissions.player:title", "with": [playerPermissions.name, listParent.name] },
                ]
            } :
                {
                    "rawtext": [
                        { "translate": "ui.manage.permissions.public:title", "with": [listParent.name] }
                    ]
                }
            )
            .toggle({"translate": "ui.manage.permissions:enter_claim"}, defaults.getPermission(PermissionTypes.ENTER_CLAIM), (value)=> {
                target.setPermission(PermissionTypes.ENTER_CLAIM, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:break_blocks"}, defaults.getPermission(PermissionTypes.BREAK_BLOCKS), (value)=> {
                target.setPermission(PermissionTypes.BREAK_BLOCKS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_items_on_blocks"}, defaults.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS), (value)=> {
                target.setPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:hurt_entities"}, defaults.getPermission(PermissionTypes.HURT_ENTITIES), (value)=> {
                target.setPermission(PermissionTypes.HURT_ENTITIES, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:interact_with_entities"}, defaults.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES), (value)=> {
                target.setPermission(PermissionTypes.INTERACT_WITH_ENTITIES, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_doors"}, defaults.getPermission(PermissionTypes.USE_DOORS), (value)=> {
                target.setPermission(PermissionTypes.USE_DOORS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_switches"}, defaults.getPermission(PermissionTypes.USE_SWITCHES), (value)=> {
                target.setPermission(PermissionTypes.USE_SWITCHES, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_beds"}, defaults.getPermission(PermissionTypes.USE_BEDS), (value)=> {
                target.setPermission(PermissionTypes.USE_BEDS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:open_containers"}, defaults.getPermission(PermissionTypes.OPEN_CONTAINERS), (value)=> {
                target.setPermission(PermissionTypes.OPEN_CONTAINERS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:edit_signs"}, defaults.getPermission(PermissionTypes.EDIT_SIGNS), (value)=> {
                target.setPermission(PermissionTypes.EDIT_SIGNS, value);

                return new ModalDataCorrect();
            })

        if (!playerID) {
            form.toggle({"translate": "ui.manage.permissions:use_tnt"}, defaults.getPermission(PermissionTypes.USE_TNT), (value)=> {
                target.setPermission(PermissionTypes.USE_TNT, value);

                return new ModalDataCorrect();
            });
        }

        form.submitButton({"translate": "ui.global.button:save"}, ()=> {
            playSound(this.player, AddonSounds.Claim.SAVE);

            // list of players that are set to be disallowed from entering the claim
            var pendingEntranceDisallowList: PlayerData[] = [];
            var pendingEntranceDisallowClaimName: string;

            for (var p of world.getAllPlayers()) {
                var playerData: PlayerData = PlayerData.fromId(p.id);

                // if a players permissions have been updated notify them
                if (playerID && p.id == playerID) {
                    sendNotification(p, AddonSounds.Claim.SAVE, listParent instanceof Claim ? "chat.claim:player_permissions_updated_notif" : "chat.claim:global_permissions_updated_notif" , this.player.name, listParent.name)
                }

                // if the claims global permissions have been updated notify all players in the claim
                if (!playerID && listParent instanceof Claim && listParent.isOverlap(p.location, p.location) && (playerData.id != listParent.getOwnerData().id)) {
                    sendNotification(p, AddonSounds.Claim.SAVE, "chat.claim:public_permissions_updated_notif", this.player.name, listParent.name)
                }

                // get the claim the player is in, this will be undefined if the player is not in a claim
                const claim = listParent instanceof Claim ? 
                    listParent.isOverlap(p.location, p.location) ? 
                        listParent : undefined
                    : listParent.claims.filter(c => c.isOverlap(p.location, p.location))[0];

                // if a players enter claim permission has been removed while they are in the claim, notify the owner
                if (claim && !claim.hasPermission(PermissionTypes.ENTER_CLAIM, p) && (playerData.id != claim.getOwnerData().id) && (playerID ? (playerData.id == playerID) : true)) {
                    
                    // set flag so the player is not ejected from the claim
                    playerData.setPendingEntranceDisallow(true);

                    pendingEntranceDisallowList.push(playerData);
                    pendingEntranceDisallowClaimName = claim.name;

                }
            }

            if (pendingEntranceDisallowList.length > 0) {
                // notify the owner that players are pending entrance disallowed
                this.pendingEntranceDisallow(pendingEntranceDisallowList, pendingEntranceDisallowClaimName);
            }
            else {
                // return to previous menu
                navigateBack();
            }
        });
        form.show(this.player);
    }

    /**
     * Shows a message form to the player that lists all players that are set to be disallowed from entering the claim.
     * 
     * @param players - The list of players that are pending entrance disallowed
     * @param claimName - The name of the claim
     */
    private pendingEntranceDisallow(players: PlayerData[] = [], claimName: string) {
        const form = new CallbackActionFormData(() => this.pendingEntranceDisallow(players, claimName))
            .title({"translate": "ui.pending_entrance_disallow:title"})
            .body({
            "rawtext": [
                { "translate": "ui.pending_entrance_disallow:body", "with": [claimName] },
                { "text": "\n\n" },
                ...players.map(p => ({"text": "§l- " + p.name + "\n "}))
            ]})
            .button({"translate": "ui.pending_entrance_disallow.button:ok"}, undefined, () => {popNavigationStack(); navigateBack();});

            form.show(this.player);
    }


    /**
     * Uses the camera command to view a claim.
     * 
     * @param claim - The claim to view
     */
    private viewClaim(claim: Claim) {

        // only run if player is in overworld
        if (this.player.dimension == world.getDimension("overworld")) {

            var playerData = PlayerData.fromId(this.player.id);

            // set flag
            playerData.setViewingClaim(true);

            // disable player movement, besides sneaking which is used to cancel the view
            this.player.inputPermissions.cameraEnabled = false;
            this.player.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, false);

            // hide hud
            this.player.onScreenDisplay.setHudVisibility(HudVisibility.Hide);

            // fade parameters
            var transition: CameraFadeOptions = {
                "fadeColor": {
                    "red": 0,
                    "green": 0,
                    "blue": 0
                },
                "fadeTime": {
                    "fadeInTime": 0.5,
                    "fadeOutTime": 1,
                    "holdTime": 5
                }
            }

            // load the claim, make sure to remove old ticking area if it exsists
            this.player.runCommandAsync("tickingarea remove claimView"); // this will not break other players viewing session, their chunnk will still be rendered until the camera is gone
            this.player.runCommandAsync(`tickingarea add ${claim.start.x} ${claim.start.y} ${claim.start.z} ${claim.end.x} ${claim.end.y} ${claim.end.z} claimView`);

            // all 4 points of the claim
            var points = [
                [claim.start.x, claim.start.z],
                [claim.start.x, claim.end.z],
                [claim.end.x, claim.end.z],
                [claim.end.x, claim.start.z]
            ];

            // get the center most block of the claim to look at
            var centerBlock: Vector3 = {
                "x": (claim.start.x + claim.end.x) / 2,
                "y": (claim.start.y + claim.end.y) / 2,
                "z": (claim.start.z + claim.end.z) / 2
            }

            // find a reasonable height to position the camera at
            var width = Math.abs(claim.start.x - claim.end.x);
            var length = Math.abs(claim.start.z - claim.end.z);
            var height = Math.sqrt((width ** 2) + (length ** 2)) / 2;

            // camera parameters
            var cornerView: CameraSetPosOptions = {
                "facingLocation": centerBlock,
                "location": {
                    "x": points[3][0],
                    "y": centerBlock.y + height,
                    "z": points[3][1]
                }
            }

            // called recursively to cycle through all points
            const nextCorner = function(index: number, player: Player) {

                // the very first point should be set without a delay
                if (index == 0) {
                    var delay = 0;
                }
                else {
                    var delay = 60;
                }

                system.runTimeout(() => {
                    // check if player has canceled the viewing session
                    if (playerData.viewingClaim) {

                        cornerView.easeOptions = {
                            "easeTime": 3,
                            "easeType": EasingType.InOutSine
                        };
                        cornerView.location.x = points[index][0];
                        cornerView.location.z = points[index][1];
                        player.camera.setCamera("minecraft:free", cornerView);

                        // next corner
                        if (index < 3) {
                            nextCorner(index + 1, player);
                        }
                        // animation is over, return to first person
                        else {
                            system.runTimeout(() => {
                                if (playerData.viewingClaim) {
                                    ShovelUI.exitClaimView(player);
                                }
                            }, 60);
                        }
                    }
                }, delay);
            };

            // start transition
            this.player.camera.fade(transition);
            playSound(this.player, AddonSounds.Claim.VIEW);

            // goto the first corner and start the animation
            system.runTimeout(() => {
                // show title to player
                this.player.onScreenDisplay.setTitle({ "translate": "ui.manage.view:loading" });
                this.player.onScreenDisplay.updateSubtitle({ "translate": "ui.manage.view:loading_subtitle" });

                this.player.camera.setCamera("minecraft:free", cornerView);
                system.runTimeout(() => {
                    nextCorner(0, this.player);
                }, 100)
            }, 20);
        }
        // player is not in the right dimension
        else {
            sendNotification(this.player, AddonSounds.Global.NEGATIVE_EVENT, "chat.claim:view");
        }
    }

    /**
     * Exits the claim view and returns the player to first person.
     * 
     * @param player - The player to exit the claim view for
     */
    static exitClaimView(player: Player) {
        var playerData = PlayerData.fromId(player.id);

        // fade parameters
        var transition: CameraFadeOptions = {
            "fadeColor": {
                "red": 0,
                "green": 0,
                "blue": 0
            },
            "fadeTime": {
                "fadeInTime": 0.5,
                "fadeOutTime": 1,
                "holdTime": 5
            }
        }

        // unload the claim
        player.runCommandAsync("tickingarea remove claimView");
                    
        transition.fadeTime.holdTime = 1;
        player.camera.fade(transition);
        system.runTimeout(() => {
            player.camera.clear();

            // set flag back to false
            playerData.setViewingClaim(false);

            // enable player movement again
            player.inputPermissions.cameraEnabled = true;
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, true);

            // show hud
            player.onScreenDisplay.setHudVisibility(HudVisibility.Reset);

        }, 30);
    };

    private removeClaim(claim: Claim) {
        var playerData: PlayerData = claim.getOwnerData();

        const form = new CallbackMessageFormData(() => this.removeClaim(claim))
            .title({"translate": "ui.manage.remove:title"})
            .body({
                "rawtext": [
                    { "translate": "ui.manage.remove:body" },
                    { "text": `§l\n\n§a+${claim.getSize().width * claim.getSize().length} ` },
                    { "translate": "ui.manage.remove:label:claim_blocks" }
                ]
            })
            .button1({"translate": "ui.manage.remove.button:cancel"}, () => {
                // return to previous page on menu
                navigateBack();
            })
            .button2({"translate": "ui.manage.remove.button:confirm"}, () => {
                // delete claim
                playerData.removeClaim(claim);

                playSound(this.player, AddonSounds.Claim.DELETE);

                // add the claim blocks to the players balance
                playerData.claimBlocks.incrementAmount(claim.getSize().width * claim.getSize().length);

                // return to previous page on menu
                popNavigationStack(); // remove the manage claim menu from the stack
                navigateBack();
            });

        form.show(this.player);
    }

    /**
     * Creates a form to edit the claims name, icon and border particles.
     * 
     * @param claim - The claim to edit
     */
    private claimConfig(claim: Claim) {
        var playerData: PlayerData = claim.getOwnerData() || PlayerData.fromId(this.player.id);
        var newClaim: boolean = claim.getOwnerData() == undefined; // if the claim has no owner, it is a new claim

        const form = new CallbackModalFormData(() => this.claimConfig(claim))
            .title({
                "rawtext": [
                    { "translate": newClaim ? "ui.claim.new:title" : "ui.claim.config:title" },
                    { "text": newClaim ? "" : `: ${claim.name}` }
                ]
            })
            .textField({"translate": "ui.claim.config.textbox:name"}, {"translate": "ui.claim.config:name_placeholder"}, claim.name, (value) => {
                var isUniqueName = true;

                // names are used to identify claims, make sure player is using a unique name
                for (var c of playerData.claims) {
                    if ((c.name == value) && (claim != c)) {
                        isUniqueName = false;
                    }
                }

                if ((value as String).length == 0) {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.claim.config.error:no_name");
                }
                else if (!isUniqueName) {
                    playSound(this.player, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.claim.config.error:unique_name");
                }

                return new ModalDataCorrect();
            })
            .dropdown({"translate": "ui.claim.config.dropdown:icon"}, Object.keys(this.claimIcons).map((i)=>({"translate": i} as RawMessage)), Object.values(this.claimIcons).indexOf(claim.icon))
            .toggle({"translate": "ui.claim.config.toggle:border_particles"}, claim.particlesEnabled)
            .submitButton({"translate": newClaim ? "ui.claim.new:submit" : "ui.claim.config.submit"}, (response) => {
                var name = response.formValues[0].toString();
                var iconPath = this.claimIcons[Object.keys(this.claimIcons)[response.formValues[1].toString()]];
                var showBorderParticles = response.formValues[2] as boolean;

                // update claim data
                claim.setName(name);
                claim.setIcon(iconPath);
                claim.setParticlesEnabled(showBorderParticles);
                
                if (newClaim){
                    // subtract claim blocks
                    playerData.claimBlocks.decrementAmount(claim.getSize().area);

                    // save new claim to database
                    playerData.addClaim(claim);

                    // notify player
                    sendNotification(this.player, AddonSounds.Global.POSITIVE_EVENT, "chat.claim:created")

                    // Reset resizingClaimName to avoid incorrect resizing behavior
                    playerData.setResizingClaimName("");
                }
                else {
                    playSound(this.player, AddonSounds.Claim.SAVE);

                    // return to previous menu
                    navigateBack();
                }
            });

        form.show(this.player);
    }
}
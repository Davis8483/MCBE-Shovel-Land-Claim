import { world, system, Player, Vector3, CameraFadeOptions, CameraSetPosOptions, EasingType, InputPermissionCategory, HudVisibility, RawMessage, InputButton, ButtonState, PlayerPermissionLevel, PlatformType } from '@minecraft/server';
import { NavigationStack, CallbackActionFormData, CallbackModalFormData, CallbackMessageFormData, ModalDataCorrect, ModalDataError } from './ui_wrapper.js';
import { database, PlayerData, Claim, PlayerPermissions, PermissionTypes, settings, ClaimBlocksBehavior, ShovelBehavior, ShovelMobileMode } from './database.js';
import { playSound, AddonSounds } from './sounds.js';
import { NotificationManager } from './notifications.js';
import { updateShovelBehavior } from './utils.js';

export class ShovelUI {
    private player: Player; // the player to show the form to

    // player selected icons for their claims
    private claimIcons = {
        // name: path
        "ui.claim.icons:land": "textures/ui/icon_recipe_nature.png",
        "ui.claim.icons:bed": "textures/ui/icon_recipe_item.png",
        "ui.claim.icons:farmland": "textures/ui/icon_new.png",
        "ui.claim.icons:weapons": "textures/ui/icon_recipe_equipment.png",
        "ui.claim.icons:flowers": "textures/ui/icon_spring.png"
    };

    private navigationStack: NavigationStack = new NavigationStack();

    private notificationManager: NotificationManager;

    /**
     * Creates a new ShovelUI object.
     * 
     * @param player - The player to show the UI to
     * @param notificationManager - The notification manager for the player
     */
    constructor(player: Player, notificationManager: NotificationManager) {
        this.player = player;
        this.notificationManager = notificationManager;
    }

    /**
     * Main menu for the shovel land claim addon.
     */
    public main() {
        var playerData: PlayerData = PlayerData.fromId(this.player.id);

        const form = new CallbackActionFormData(this.navigationStack, () => this.main())
            .title({"translate": "ui.main:title", "with": [playerData.schemaVersion]})
            .body({
                "rawtext": [
                    { "translate": "ui.main:body.paragraph:1" },
                    { "text": "\n\n" },
                    { "translate": "ui.main:body.paragraph:2" },
                    { "text": "\n\n" },
                    { "translate": "ui.main:body.paragraph:3" },
                    // conditionally show the claim blocks information
                    (playerData.claimBlocks.behavior != ClaimBlocksBehavior.UNLIMITED) ? { "rawtext": [
                        { "text": "\n\n" },
                        { "translate": "ui.main:body.paragraph:4" }, { "text": ` §e${playerData.claimBlocks.amount}§r ` },
                        // conditionally show the claim block hourly payment information
                        (playerData.claimBlocks.behavior != ClaimBlocksBehavior.DISABLE_HOURLY_PAYMENT) ? { "rawtext": [
                            { "text": "\n\n" },
                            { "translate": "ui.main:body.paragraph:5", "with": [settings.claimBlockHourlyPayment.toString(), playerData.claimBlocks.paymentTimeRemaining.toString()] }
                        ]} : { "rawtext": [] }
                    ]} : { "rawtext": [] }
                ]
            })
            .button({ 
                "rawtext": [
                    {"translate": "ui.main.button:manage"},
                    { "text": settings.maxClaimAmount > 0 ? (((playerData.claims.length >= settings.maxClaimAmount) ? " §c" : " ") + `(${playerData.claims.length}/${settings.maxClaimAmount})`) : "" }
                ]
            }, "textures/ui/icon_saleribbon.png", () => {
                this.claimsList(playerData.id);
            })
            .button({"translate": "ui.main.button:global_player_permissions"}, "textures/ui/worldsIcon.png", () => {
                this.playerPermissionsList(playerData);
            })
            .button({"translate": "ui.main.button:player_config"}, "textures/ui/icon_setting.png", () => {
                this.playerConfig(playerData.id, false);
            })

            // conditionally show the op panel button
            if (this.player.playerPermissionLevel == PlayerPermissionLevel.Operator) {
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
     * A search box for... well, searching players
     * At lest one player must be in the list otherwise errors will be thrown
     * 
     * @param options - PlayerData objects to search through
     * @param callback - A callback that returns to the menu requesting a playerSearch
     */
    private playerSearch(options: PlayerData[], callback: (refinedOptions: PlayerData[]) => void) {
        const form  = new CallbackModalFormData(AddonSounds.Global.NEGATIVE_EVENT, this.navigationStack, () => this.playerSearch(options, callback))
            .title({"translate": "ui.player_search:title"})
            .textField({"translate": "ui.player_search.textbox:query"}, {"translate": "ui.player_search.textbox:query_placeholder", "with": [options[Math.floor(Math.random() * options.length)].name]}, {}, (value) => {
                return new ModalDataCorrect();
            })
            .submitButton({"translate": "ui.player_search.button:search"}, (response) => {
                var query = response.formValues[0] as string;

                const refinedOptions = options.filter(player => player.name.toLowerCase().includes(query.toLowerCase()));
                callback(refinedOptions);
            })
            .show(this.player);

        this.navigationStack.pop(); // remove the search form from the navigation stack
    }

    private playerPicker(options: PlayerData[], refinedOptions: PlayerData[] | undefined, callback: (selection: PlayerData) => void) {
        const form = new CallbackActionFormData(this.navigationStack, () => this.playerPicker(options, refinedOptions, callback))
            .title({"translate": "ui.player_picker:title"})

            // if there are no players to pick from, show a message instead of the search button
            if (options.length == 0) {
                form.label({"translate": "ui.player_picker.label:no_players"});
            }
            else {
                // only show if search has not been performed yet
                if (!refinedOptions) {
                    form.button({"translate": "ui.player_picker.button:search"}, "textures/ui/magnifyingGlass.png", () => {
                        this.playerSearch(options, (refinedOptions) => {
                            this.playerPicker(options, refinedOptions, callback);
                        })
                    })
                }
                else {
                    form.label({"translate": "ui.player_picker.label:search_results", "with": [refinedOptions.length.toString(), options.length.toString()]})
                }
            }

            if (refinedOptions?.length == 0) {
                form.label({"translate": "ui.player_picker.label:no_results"});
            }
            
            form.divider();

        for (const p of refinedOptions || options) {
            var isOnline = world.getAllPlayers().filter(player => player.id == p.id).length > 0 ? true : false;
            const statusText = isOnline
                ? { "translate": "ui.global.button:online" }
                : {"rawtext": [{"translate": "ui.global.button:offline" }, p.getLastOnlineFormated() ]};
            form.button({"rawtext": [{"text": p.name + "\n"}, statusText]}, isOnline? "textures/ui/profile_glyph_color.png" : "textures/ui/profile_glyph.png", () => {callback(p)});
        }

        // if this is a search result, remove this page from the nav stack
        // the back button will instead run .showCurrent to show the non-searched player list
        // oh the hacky things I have to do to make navigation work properly :sob:
        if (refinedOptions) {
            this.navigationStack.pop();
        }

        form.button({"translate": "ui.global.button:back"}, undefined, () => {refinedOptions ? this.navigationStack.showCurrent() : this.navigationStack.back()})
        form.show(this.player);
    }

    /**
     * Menu for managing players and addon settings.
     */
    private opPanel() {
        const form = new CallbackActionFormData(this.navigationStack, () => this.opPanel())
            .title({"translate": "ui.op_panel:title"})
            .button({"translate": "ui.op_panel.addon_settings:title"}, "textures/ui/icon_setting.png", () => {this.opAddonConfig()})
            .button({"translate": "ui.op_panel.button:manage_players"}, "textures/ui/multiplayer_glyph_color.png", () => {this.playerPicker(database, undefined, (selection) => {this.opManagePlayer(selection.id)})})
            .button({"translate": "ui.op_panel.button:disallowed_blocks"}, "textures/blocks/barrier.png", () => {this.opDisallowedBlocks()})

            // conditionally show the finish setup button
            if ((world.gameRules.showTags && (settings.claimShovelItemBehavior == ShovelBehavior.LOCK_TO_INVENTORY)) || world.gameRules.doFireTick) {
                form.button({"translate": "ui.op_panel.button:finish_setup"}, "textures/ui/chevron_new_white_right.png", () => {this.opAddonSetup()});
            }

            form.button({"translate": "ui.global.button:back"}, undefined, () => {this.navigationStack.back();})
            .show(this.player);
    }

    private opAddonConfig() {
        var startingClaimBlocksOld = settings.startingClaimBlocks

        const form = new CallbackModalFormData(AddonSounds.Global.NEGATIVE_EVENT, this.navigationStack, () => this.opAddonConfig())
            .title({"translate": "ui.op_panel.addon_settings:title"})
            .header({"translate": "ui.op_panel.addon_settings.header:claim_blocks_section"})
            .divider()
            .textField({"translate": "ui.op_panel.addon_settings.textbox:claim_block_payment"}, {"translate": "ui.op_panel.addon_settings.textbox:claim_block_payment_placeholder"}, {"defaultValue": settings.claimBlockHourlyPayment.toString()}, (value) => {
                var newClaimBlockPayment = parseInt(value as string);

                if (isNaN(newClaimBlockPayment) || newClaimBlockPayment < 0) {
                    return new ModalDataError("ui.op_panel.addon_settings.error:must_be_positive_number");
                }
                else {
                    // update claim block payment
                    settings.setClaimBlockHourlyPayment(newClaimBlockPayment);

                    return new ModalDataCorrect();
                }
            })
            .textField({"translate": "ui.op_panel.addon_settings.textbox:starting_claim_blocks"}, {"translate": "ui.op_panel.addon_settings.textbox:starting_claim_blocks_placeholder"}, {"defaultValue": settings.startingClaimBlocks.toString()}, (value) => {
                var newStartingClaimBlocks = parseInt(value as string);

                if (isNaN(newStartingClaimBlocks) || newStartingClaimBlocks < 0) {
                    return new ModalDataError("ui.op_panel.addon_settings.error:must_be_positive_number");
                }
                else {
                    // update claim block starting amount
                    settings.setStartingClaimBlocks(newStartingClaimBlocks);

                    return new ModalDataCorrect();
                }
            })
            .toggle({"translate": "ui.op_panel.addon_settings.toggle:update_existing_balances"}, {"defaultValue": false, "tooltip": {"translate": "ui.op_panel.addon_settings.tooltip:update_existing_balances"}}, (value) => {
                // if toggle is enabled
                if (value) {
                    // if Starting Balance field was changed go through and update all player balances to reflect it
                    if (startingClaimBlocksOld != settings.startingClaimBlocks) {
                        database.forEach((p: PlayerData) => {
                            p.claimBlocks.incrementAmount(settings.startingClaimBlocks - startingClaimBlocksOld)
                        })
                    }
                    // the Starting Balance field was not changed, raise an error for the user
                    else {
                        return new ModalDataError("ui.op_panel.addon_settings.error:must_change_starting_claim_blocks")
                    }
                }

                return new ModalDataCorrect();
            })
            .label({"text": ""})
            .header({"translate": "ui.op_panel.addon_settings.header:claim_section"})
            .divider()
            .toggle({"translate": "ui.op_panel.addon_settings.toggle:op_access"},
                {"tooltip": "ui.op_panel.addon_settings.tooltip:op_access", "defaultValue": settings.opAccess},
                (value) => {
                    settings.setOpAccess(value);

                    return new ModalDataCorrect();
                })
            .textField({"translate": "ui.op_panel.addon_settings.textbox:claim_min_width"}, {"translate": "ui.op_panel.addon_settings.textbox:claim_min_width_placeholder"}, {"defaultValue": settings.claimMinimumWidth.toString()}, (value) => {
                var newClaimMinimumWidth = parseInt(value as string);

                if (isNaN(newClaimMinimumWidth) || newClaimMinimumWidth < 0) {
                    return new ModalDataError("ui.op_panel.addon_settings.error:must_be_positive_number");
                }
                else {
                    // update claim minimum width
                    settings.setClaimMinimumWidth(newClaimMinimumWidth);

                    return new ModalDataCorrect();
                }
            })
            .textField({"translate": "ui.op_panel.addon_settings.textbox:max_claim_amount"}, {"translate": "ui.op_panel.addon_settings.textbox:max_claim_amount_placeholder"}, {"defaultValue": settings.maxClaimAmount.toString()}, (value) => {
                var newMaxClaimAmount = parseInt(value as string);

                if (isNaN(newMaxClaimAmount) || newMaxClaimAmount < 0) {
                    return new ModalDataError("ui.op_panel.addon_settings.error:must_be_positive_number");
                }
                else {
                    // update max claim amount
                    settings.setMaxClaimAmount(newMaxClaimAmount);

                    return new ModalDataCorrect();
                }
            })
            .dropdown({"translate": "ui.op_panel.addon_settings.dropdown:claim_name_display_behavior"},
                [
                    {"translate": "ui.op_panel.addon_settings.dropdown_option:action_bar"},
                    {"translate": "ui.op_panel.addon_settings.dropdown_option:chat_on_enter"},
                    {"translate": "ui.op_panel.addon_settings.dropdown_option:chat_on_enter_and_exit"},
                    {"translate": "ui.op_panel.addon_settings.dropdown_option:disabled"}
                ],
                {"defaultValueIndex": settings.claimNameDisplayBehavior}, (value) => {
                    settings.setClaimNameDisplayBehavior(value);
                    return new ModalDataCorrect();
                })
            .textField({"translate": "ui.op_panel.addon_settings.textbox:default_entrance_sound"},
                {"translate": "ui.op_panel.addon_settings.textbox:default_entrance_sound_placeholder"},
                {"defaultValue": settings.defaultEntranceSound, "tooltip": "ui.op_panel.addon_settings.tooltip:custom_entrance_exit_sound"},
                (value) => {
                    settings.setDefaultEntranceSound(value as string);

                    return new ModalDataCorrect();
                })
            .textField({"translate": "ui.op_panel.addon_settings.textbox:default_exit_sound"},
                {"translate": "ui.op_panel.addon_settings.textbox:default_exit_sound_placeholder"},
                {"defaultValue": settings.defaultExitSound, "tooltip": "ui.op_panel.addon_settings.tooltip:custom_entrance_exit_sound"},
                (value) => {
                    settings.setDefaultExitSound(value as string);

                    return new ModalDataCorrect();
                })
            .label({"text": ""})
            .header({"translate": "ui.op_panel.addon_settings.header:claim_shovel_section"})
            .divider()
            .dropdown({"translate": "ui.op_panel.addon_settings.dropdown:claim_shovel_item_behavior"},
                [
                    {"translate": "ui.op_panel.addon_settings.dropdown_option:lock_to_inventory"},
                    {"translate": "ui.op_panel.addon_settings.dropdown_option:give_at_spawn"},
                    {"translate": "ui.op_panel.addon_settings.dropdown_option:must_be_crafted"}
                ],
                {"defaultValueIndex": settings.claimShovelItemBehavior, "tooltip": "ui.op_panel.addon_settings.tooltip:claim_shovel_item_behavior"}, (value) => {

                // loop through all online players to modify their inventory
                for (var p of world.getAllPlayers()) {
                    // updates how the shovel is stored/given to the player; ex: locking to inventory
                    updateShovelBehavior(p, value)
                }

                settings.setClaimShovelItemBehavior(value);

                return new ModalDataCorrect();
            })
            .label({"text": ""})
            .header({"translate": "ui.op_panel.addon_settings.header:world_protections_section"})
            .divider()
            .toggle({"translate": "ui.op_panel.addon_settings.toggle:allow_wither"}, {"defaultValue": settings.allowWitherSpawningInOverworld}, (value) => {
                settings.setAllowWitherSpawningInOverworld(value);
                return new ModalDataCorrect(); })
            .label({"text": ""})
            .submitButton({"translate": "ui.op_panel.addon_settings.button:save"}, (response) => {
                playSound(this.player, AddonSounds.Claim.SAVE);
                this.navigationStack.back();
            });
        form.show(this.player);
    }

    /**
     * Opens a UI to manage a player's claims and other settings. Available to operators only.
     * 
     * @param playerId - The entity id of the player to manage
     */
    private opManagePlayer(playerId: string) {
        var playerData: PlayerData = PlayerData.fromId(playerId || this.player.id);

        const form = new CallbackActionFormData(this.navigationStack, () => this.opManagePlayer(playerId))
            .title({"translate": "ui.main.op_mode:title", "with": [playerData.name]})
            .button({"translate": "ui.op_manage_player.button:player_config"}, "textures/ui/icon_setting.png", () => {this.playerConfig(playerId, true)})
            .button({"translate": "ui.main.button:manage"}, "textures/ui/icon_saleribbon.png", () => {
                this.claimsList(playerData.id);
            })
            .button({"translate": "ui.main.button:global_player_permissions"}, "textures/ui/icon_multiplayer.png", () => {
                this.playerPermissionsList(playerData);
            })

            // if player is offline
            if (world.getAllPlayers().filter(p => p.id == playerId).length == 0) {
                form.button({"translate": "ui.op_manage_player.button:delete_player_data"}, "textures/ui/redX1.png", () => {
                    this.opDeletePlayerConfirm(playerId);
                })
            }

            form.button({"translate": "ui.global.button:back"}, undefined, () => {this.navigationStack.back();});


        form.show(this.player);
    }

    private playerConfig(playerId: string, opMode: Boolean) {

        var playerData: PlayerData = PlayerData.fromId(playerId);

        const form = new CallbackModalFormData(AddonSounds.Global.NEGATIVE_EVENT, this.navigationStack, () => this.playerConfig(playerId, opMode))
            .title({"translate": "ui.player_config:title", "with": [playerData.name]})
            .label({"translate": "ui.player_config.label:user_config"})
            .divider();

            form.slider({"translate": "ui.player_config.slider:claim_particle_density"}, 1, 5, {"valueStep": 1, "defaultValue": playerData.claimParticleDensity, "tooltip": "ui.player_config.tooltip:claim_particle_density"}, (value) => {
                playerData.setClaimParticleDensity(value as number);

                return new ModalDataCorrect();
            });

            form.toggle({"translate": "ui.player_config.toggle:enable_custom_entrance_exit_sounds"}, {"defaultValue": playerData.enableCustomEntranceExitSounds}, (value) => {
                playerData.setEnableCustomEntranceExitSounds(value);

                return new ModalDataCorrect();
            })

            form.textField({"translate": "ui.player_config.textbox:custom_entrance_sound"}, {"text": settings.defaultEntranceSound}, {"defaultValue": playerData.customEntranceSound, "tooltip": "ui.player_config.tooltip:custom_entrance_exit_sound"}, (value) => {

                if ((value.toString().length == 0) || playerData.enableCustomEntranceExitSounds) {
                    playerData.setCustomEntranceSound(value as string);

                    return new ModalDataCorrect();
                }
                else {
                    return new ModalDataError("ui.player_config.error:must_enable_toggle");
                }

            })
            form.textField({"translate": "ui.player_config.textbox:custom_exit_sound"}, {"text": settings.defaultExitSound}, {"defaultValue": playerData.customExitSound, "tooltip": "ui.player_config.tooltip:custom_entrance_exit_sound"}, (value) => {

                if ((value.toString().length == 0) || playerData.enableCustomEntranceExitSounds) {
                    playerData.setCustomExitSound(value as string);

                    return new ModalDataCorrect();
                }
                else {
                    return new ModalDataError("ui.player_config.error:must_enable_toggle");
                }

            })

            if (opMode) {
                form.label({"translate": "ui.player_config.label:op_user_config"})
                .divider()
                .dropdown({"translate": "ui.player_config.dropdown:claim_blocks_behavior"},
                    [
                        {"translate": "ui.player_config.dropdown_option:default"},
                        {"translate": "ui.player_config.dropdown_option:disable_payment"},
                        {"translate": "ui.player_config.dropdown_option:unlimited"}
                    ],
                    {"defaultValueIndex": playerData.claimBlocks.behavior}, (value) => {

                        playerData.claimBlocks.setBehavior(value)

                        return new ModalDataCorrect();
                    })
                .textField({"translate": "ui.player_config.textbox:claim_blocks"}, {"translate": "ui.player_config.textbox:claim_blocks_placeholder"}, {"defaultValue": playerData.claimBlocks.amount.toString()}, (value) => {
                    var newClaimBlocks = parseInt(value as string);

                    if (isNaN(newClaimBlocks) || newClaimBlocks < 0) {
                        return new ModalDataError("ui.player_config.error:must_be_positive_number");
                    }
                    else {
                        // update claim blocks
                        playerData.claimBlocks.setAmount(newClaimBlocks);

                        return new ModalDataCorrect();
                    }
                })
            }

            form.submitButton({"translate": "ui.player_config.submit"}, (response) => {

                playSound(this.player, AddonSounds.Claim.SAVE);

                // navigate back to the previous menu
                this.navigationStack.back();
            })
        form.show(this.player);
    }

    private opDeletePlayerConfirm(playerId: string) {
        const form = new CallbackMessageFormData(this.navigationStack, () => this.opDeletePlayerConfirm(playerId))
            .title({"translate": "ui.op_delete_player:title"})
            .body({"translate": "ui.op_delete_player:body"})
            .button1({"translate": "ui.op_delete_player.button:cancel"}, () => {
                // return to previous menu
                this.navigationStack.back();
            })
            .button2({"translate": "ui.op_delete_player.button:confirm"}, () => {
                // remove player from database
                PlayerData.fromId(playerId).delete();
                playSound(this.player, AddonSounds.Claim.DELETE);

                // return to previous menu
                this.navigationStack.pop();
                this.navigationStack.back();
            });

        form.show(this.player);
    }

    /**
     * Shows the disallowed blocks menu for the OP panel.
     */
    private opDisallowedBlocks() {
        const form = new CallbackActionFormData(this.navigationStack, () => this.opDisallowedBlocks())
            .title({"translate": "ui.op_disallowed_blocks:title"});

        for (const bId of settings.disallowedBlocks) {
            form.button({"text": bId }, "textures/blocks/structure_void.png", () => {this.navigationStack.pop(); this.opDisallowedBlocks()});
        }

        form.button({"translate": "ui.op_disallowed_blocks.button:add_block"}, "textures/ui/realms_slot_check.png", () => {this.opEditDisallowedBlocks(true)})
            .button({"translate": "ui.op_disallowed_blocks.button:remove_block"}, "textures/ui/redX1.png", () => {this.opEditDisallowedBlocks(false)})
            .button({"translate": "ui.global.button:back"}, undefined, () => {this.navigationStack.back();});

        form.show(this.player);
    }

    /**
     * Adds or removes a block from the disallowed blocks list.
     * 
     * @param add - Wether to add or remove the block from the disallowed blocks list
     */
    private opEditDisallowedBlocks(add: boolean) {
        const form = new CallbackModalFormData(AddonSounds.Global.NEGATIVE_EVENT, this.navigationStack, () => this.opEditDisallowedBlocks(add))
            .title({"translate": "ui.op_edit_disallowed_blocks:title"})

        if (add) {
            form.textField({"translate": "ui.op_edit_disallowed_blocks.textbox:block_id"}, {"translate": "ui.op_edit_disallowed_blocks.textbox:block_id_placeholder"}, {}, (value) => {
                var blockId = value as string;

                if (blockId == "") {
                    return new ModalDataError("ui.op_edit_disallowed_blocks.error:must_not_be_empty");
                }
                else if (settings.disallowedBlocks.includes(blockId)) {
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
            this.navigationStack.back();
        });

        form.show(this.player);
    }

    private addonInfo() {
        const form = new CallbackActionFormData(this.navigationStack, () => this.addonInfo())
            .title({"translate": "ui.addon_info:title"})
            .body({
                "rawtext": [
                    { "translate": "ui.addon_info:body.paragraph:1" },
                    { "translate": "ui.addon_info:translator_credit" },
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
            .button({"translate": "ui.addon_info.button:changelog"}, undefined, () => {this.viewChangeLog();})
            .button({"translate": "ui.global.button:back"}, undefined, () => {this.navigationStack.back();})
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

        const form = new CallbackMessageFormData(this.navigationStack, ()=> this.resizeClaim(claim, start, end))
            .title({"translate": "ui.claim.resize:title"})
            .body({
                "rawtext": [
                    { "translate": "ui.claim.resize:body_1" },
                    // conditionaly show the claim block requirements/warning
                    (playerData.claimBlocks.behavior != ClaimBlocksBehavior.UNLIMITED) ? { "rawtext": [
                        {"text": " " },
                        {"translate": "ui.claim.resize:body_2" },
                        { "text": `§l\n\n${blockDifference < 0 ? "§c-" : "§a+"}${blockDifference} ` },
                        { "translate": "ui.manage.resize:label:claim_blocks" }
                    ]} : {},
                ]
            })
            .button1({"translate": "ui.claim.resize.button:cancel"})
            .button2({"translate": "ui.claim.resize.button:resize"}, ()=> {
                claim.setStart(start);
                claim.setEnd(end);

                // notify player
                this.notificationManager.send(this.player, AddonSounds.Global.POSITIVE_EVENT, undefined, "chat.claim:resized")

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

        const form = new CallbackActionFormData(this.navigationStack, () => this.claimsList(ownerId))
            .title({
                rawtext: [
                    {"translate": "ui.manage:title"},
                    { "text": settings.maxClaimAmount > 0 ? (((playerData.claims.length >= settings.maxClaimAmount) ? " §c" : " ") + `(${playerData.claims.length}/${settings.maxClaimAmount})`) : "" }
                ]
            });

        if (playerData.claims.length == 0) {
            form.body(
                {"rawtext": [
                    {"text": "\n" },
                    {"translate": "ui.manage.body:no_claims"},
                    {"text": "\n\n" },
                    {"translate": "ui.main:body.paragraph:2"}, // we're just gonna reuse the instructions from the main menu :)
                    {"text": "\n " },
                ]});
        }

        for (const c of playerData.claims) {

            form.button(
                {
                    "rawtext": [
                        { "text": `${c.name}§r\n§c${c.getSize().width}§8x§9${c.getSize().length} ` }
                    ]
                }, c.icon, () => {this.manageClaim(c)});
        }

        // conditionaly show the new claim button for mobile players only
        if (this.player.clientSystemInfo.platformType == PlatformType.Mobile) {
            form.button({"translate": "ui.manage.button:claim_mode_mobile"}, undefined, () => {
                // set flag to no longer open the menu and only allow claim creation
                playerData.setMobileMode(ShovelMobileMode.CLAIM);

                // notify player that claim creation is enabled
                this.notificationManager.send(this.player, AddonSounds.Global.POSITIVE_EVENT, undefined, "chat.claim:enabled_mobile");

                // this menu should now close
            });
        }

        form.button({"translate": "ui.global.button:back"}, undefined, () => {this.navigationStack.back();});
        form.show(this.player);
    }

    /**
     * A form with options to manage a claim. These options include, configuring the claim, managing permissions, viewing the claim and removing it.
     * 
     * @param claim - The claim to manage
     */
    private manageClaim(claim: Claim) {
        const form = new CallbackActionFormData(this.navigationStack, () => this.manageClaim(claim))
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
            .button({"translate": "ui.global.button:back"}, undefined, () => {this.navigationStack.back();});

        form.show(this.player);
    }

    private opAcess(){
        const form = new CallbackActionFormData(this.navigationStack, () => this.opAcess())
            .title({"translate": "ui.op_access.title"})
            .header({"translate": "ui.op_access.header:world_operators"})
            .label({"translate": "ui.op_access.label:access_notice"})
            .divider();

            for (const playerData of database.filter((pD) => pD.isOp)) {
                form.label({"text": "- " + playerData.name});
            }

            form.label({"text": ""})
            .button({"translate": "ui.global.button:back"}, undefined, () => {
                this.navigationStack.back();
            })
            .show(this.player);
    }

    /**
     * Shows a message form asking if the player would like to either edit the global permissions or overwrite them with a local claim player permission.
     * 
     * @param listParent - The parent class that contains the player permissions list
     * @param playerID - The entity id of the player to manage permissions for
     */
    private editGlobalPermissionIntent(listParent: Claim, playerID: string) {
        // we're telling the navigation stack to go back to the player permissions list menu instead of this one :thumbs_up:
        const form = new CallbackMessageFormData(this.navigationStack, () => this.playerPermissionsList(listParent))
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

        const form = new CallbackActionFormData(this.navigationStack, () => this.playerPermissionsList(listParent))
            .title({
                "rawtext": [
                    { "translate": listParent instanceof Claim ? "ui.manage.permissions.player.selection:title": "ui.manage.global_permissions.player.selection:title" },
                    listParent instanceof Claim ? { "text": `: ${listParent.name}` } : {}
                ]
            })
            .body({"translate": listParent instanceof Claim ? "ui.manage.permissions.player.selection:body" : "ui.manage.global_permissions.player.selection:body"});

        // if Operator Acess setting is enabled, show the player an additional entry
        if (settings.opAccess) {
            form.button({"translate": "ui.manage.permissions.player.selection:op_access"}, "textures/ui/permissions_op_crown_hover.png", () => {
                this.opAcess();
            })
        }

        // show all global player permissions; include an extra Global badge next to the player name
        if (listParent instanceof Claim) {
            // make sure to filter out global player permissions that are overiden in the claim
            for (const pP of listParent.getOwnerData().playerPermissionsList.filter(p => !listParent.playerPermissionsList.some(p2 => p2.id == p.id))) {
                var isOnline = world.getAllPlayers().filter(player => player.id == pP.id).length > 0 ? true : false;

                // get the players data
                const pD = PlayerData.fromId(pP.id);

                form.button({"rawtext": [{"text": pD.name + "\n"}, {"translate": "ui.manage.permissions.player.selection:global_badge"},
                    isOnline? {"translate": "ui.global.button:online"} : {"rawtext": [{"translate": "ui.global.button:offline" }, pD.getLastOnlineFormated() ]}]},
                    isOnline? "textures/ui/profile_glyph_color.png" : "textures/ui/profile_glyph.png", () => {this.editGlobalPermissionIntent(listParent, pP.id)});
            }
        }
        
        // show all local/claim specific player permissions
        for (const pP of listParent instanceof Claim ? listParent.playerPermissionsList : listParent.playerPermissionsList) {
            var isOnline = world.getAllPlayers().filter(player => player.id == pP.id).length > 0 ? true : false;

            // get the players data
            const pD = PlayerData.fromId(pP.id);

            form.button({"rawtext": [{"text": pD.name + "\n"}, isOnline? {"translate": "ui.global.button:online"} : {"rawtext": [{"translate": "ui.global.button:offline" }, pD.getLastOnlineFormated() ]}]},
                isOnline? "textures/ui/profile_glyph_color.png" : "textures/ui/profile_glyph.png", () => {this.managePermissions(listParent, pP.id)});
        }

        form.button({"translate": "ui.manage.permissions.player.selection:add_player"}, "textures/ui/realms_slot_check.png", () => {
            // get all players that are not currently in the list
            var options = listParent.getUnsavedPlayers().map(id => PlayerData.fromId(id));
            
            this.playerPicker(options, undefined, (selection) => {

                // make sure to not include the player picker when going back
                this.navigationStack.pop();

                // if player was added redirect to the permissions menu, this menu will handle adding the object to the list
                this.managePermissions(listParent, selection.id);
            });
        });

        form.button({"translate": "ui.manage.permissions.player.selection:remove_player"}, "textures/ui/redX1.png", () => {
            // get all players that are currently in the list
            var options = listParent.playerPermissionsList.map(p => PlayerData.fromId(p.id));

            this.playerPicker(options, undefined, (selection) => {

                // list of players that are set to be disallowed from entering the claim
                var pendingEntranceDisallowList: PlayerData[] = [];
                var pendingEntranceDisallowClaimName: string;

                for (var p of world.getAllPlayers()) {
                    var playerData: PlayerData = PlayerData.fromId(p.id);

                    // if a players permissions have been deleted notify them
                    if (p.id == selection.id) {
                        this.notificationManager.send(p, AddonSounds.Claim.SAVE, undefined, listParent instanceof Claim ? "chat.claim:player_permissions_reset_notif" : "chat.claim:global_player_permissions_reset_notif", this.player.name, listParent.name);

                        // get the claim the player is in, this will be undefined if the player is not in a claim
                        const claim = listParent instanceof Claim ? 
                            listParent.isOverlap(p.location) ? 
                                listParent : undefined
                            : listParent.claims.filter(c => c.isOverlap(p.location))[0];

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
                listParent.removePlayerPermissions(selection.id);

                playSound(this.player, AddonSounds.Claim.DELETE);

                if (pendingEntranceDisallowList.length > 0) {
                    // notify the owner that players are pending entrance disallowed
                    this.pendingEntranceDisallow(pendingEntranceDisallowList, pendingEntranceDisallowClaimName);
                }
                else {
                    // return to previous menu
                    this.navigationStack.back();
                }
            });
        });

        form.button({"translate": "ui.global.button:back"}, undefined, () => {this.navigationStack.back();});

        form.show(this.player);
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

            playerPermissions = new PlayerPermissions(playerID);

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
        const form = new CallbackModalFormData(AddonSounds.Global.NEGATIVE_EVENT, this.navigationStack, () => this.managePermissions(listParent, playerID))
            .title(playerID ? {
                "rawtext": [
                    { "translate": listParent instanceof Claim? "ui.manage.permissions.player:title" : "ui.manage.global_permissions.player:title", "with": [PlayerData.fromId(playerPermissions.id).name] },
                ]
            } :
                {
                    "rawtext": [
                        { "translate": "ui.manage.permissions.public:title", "with": [listParent.name] }
                    ]
                }
            )
            .header({"translate": "ui.manage.permissions.header:general"})
            .divider()
            .toggle({"translate": "ui.manage.permissions:enter_claim"}, {"defaultValue": defaults.getPermission(PermissionTypes.ENTER_CLAIM), "tooltip": {"translate": "ui.manage.permissions.tooltip:enter_claim"}}, (value)=> {

                // if public entrance is not allowed, force claim particles to be enabled
                if ((listParent instanceof Claim) && !listParent.particlesEnabled && !value) {
                    listParent.setParticlesEnabled(true);
                }

                target.setPermission(PermissionTypes.ENTER_CLAIM, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:break_blocks"}, {"defaultValue": defaults.getPermission(PermissionTypes.BREAK_BLOCKS)}, (value)=> {
                target.setPermission(PermissionTypes.BREAK_BLOCKS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_items_on_blocks"}, {"defaultValue": defaults.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS), "tooltip": {"translate": "ui.manage.permissions.tooltip:use_items_on_blocks"}}, (value)=> {
                target.setPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_doors"}, {"defaultValue": defaults.getPermission(PermissionTypes.USE_DOORS)}, (value)=> {
                target.setPermission(PermissionTypes.USE_DOORS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_switches"}, {"defaultValue": defaults.getPermission(PermissionTypes.USE_SWITCHES), "tooltip": {"translate": "ui.manage.permissions.tooltip:use_switches"}}, (value)=> {
                target.setPermission(PermissionTypes.USE_SWITCHES, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_beds"}, {"defaultValue": defaults.getPermission(PermissionTypes.USE_BEDS)}, (value)=> {
                target.setPermission(PermissionTypes.USE_BEDS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:open_containers"}, {"defaultValue": defaults.getPermission(PermissionTypes.OPEN_CONTAINERS), "tooltip": {"translate": "ui.manage.permissions.tooltip:open_containers"}}, (value)=> {
                target.setPermission(PermissionTypes.OPEN_CONTAINERS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:interact_with_item_displays"}, {"defaultValue": defaults.getPermission(PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS), "tooltip": {"translate": "ui.manage.permissions.tooltip:interact_with_item_displays"} }, (value)=> {
                target.setPermission(PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:edit_signs"}, {"defaultValue": defaults.getPermission(PermissionTypes.EDIT_SIGNS)}, (value)=> {
                target.setPermission(PermissionTypes.EDIT_SIGNS, value);

                return new ModalDataCorrect();
            });
        
        // if we are editing the claims public permissions, show the tnt toggle
        if (!playerID) {
            form.toggle({"translate": "ui.manage.permissions:use_tnt"}, {"defaultValue": defaults.getPermission(PermissionTypes.USE_TNT)}, (value)=> {
                target.setPermission(PermissionTypes.USE_TNT, value);

                return new ModalDataCorrect();
            });
        }

        form.label({"text": ""})
            .header({"translate": "ui.manage.permissions.header:entities"})
            .divider()
            .toggle({"translate": "ui.manage.permissions:hurt_mobs"}, {"defaultValue":defaults.getPermission(PermissionTypes.HURT_MOBS)}, (value)=> {
                target.setPermission(PermissionTypes.HURT_MOBS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:hurt_monsters"}, {"defaultValue":defaults.getPermission(PermissionTypes.HURT_MONSTERS), "tooltip": {"translate": "ui.manage.permissions.tooltip:hurt_monsters"}}, (value)=> {
                target.setPermission(PermissionTypes.HURT_MONSTERS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:hurt_players"}, {"defaultValue":defaults.getPermission(PermissionTypes.HURT_PLAYERS)}, (value)=> {
                target.setPermission(PermissionTypes.HURT_PLAYERS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:interact_with_entities"}, {"defaultValue": defaults.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES)}, (value)=> {
                target.setPermission(PermissionTypes.INTERACT_WITH_ENTITIES, value);

                return new ModalDataCorrect();
            })
            .label({"text": ""});

        form.submitButton({"translate": "ui.global.button:save"}, ()=> {
            playSound(this.player, AddonSounds.Claim.SAVE);

            // list of players that are set to be disallowed from entering the claim
            var pendingEntranceDisallowList: PlayerData[] = [];
            var pendingEntranceDisallowClaimName: string;

            for (var p of world.getAllPlayers()) {
                var playerData: PlayerData = PlayerData.fromId(p.id);

                // if a players permissions have been updated notify them
                if (playerID && p.id == playerID) {
                    this.notificationManager.send(p, AddonSounds.Claim.SAVE, undefined, listParent instanceof Claim ? "chat.claim:player_permissions_updated_notif" : "chat.claim:global_permissions_updated_notif" , this.player.name, listParent.name)
                }

                // if the claims public permissions have been updated notify all players in the claim
                if (!playerID && listParent instanceof Claim && listParent.isOverlap(p.location) && (playerData.id != listParent.getOwnerData().id)) {
                    this.notificationManager.send(p, AddonSounds.Claim.SAVE, undefined, "chat.claim:public_permissions_updated_notif", this.player.name, listParent.name)
                }

                // get the claim the player is in, this will be undefined if the player is not in a claim
                const claim = listParent instanceof Claim ? 
                    listParent.isOverlap(p.location) ? 
                        listParent : undefined
                    : listParent.claims.filter(c => c.isOverlap(p.location))[0];

                // if a players enter claim permission has been removed while they are in the claim, notify the owner
                if (claim && !claim.hasPermission(PermissionTypes.ENTER_CLAIM, p) && (playerID ? (playerData.id == playerID) : true)) {
                    
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
                this.navigationStack.back();
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
        const form = new CallbackActionFormData(this.navigationStack, () => this.pendingEntranceDisallow(players, claimName))
            .title({"translate": "ui.pending_entrance_disallow:title"})
            .body({
            "rawtext": [
                { "translate": "ui.pending_entrance_disallow:body", "with": [claimName] },
                { "text": "\n\n" },
                ...players.map(p => ({"text": "§l- " + p.name + "\n "}))
            ]})
            .button({"translate": "ui.pending_entrance_disallow.button:ok"}, undefined, () => {this.navigationStack.pop(); this.navigationStack.back();});

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
            
            // register an after event to detect if the player is trying to exit the claim viewer
            const sneakExitEventHandler = world.afterEvents.playerButtonInput.subscribe((data) => {
                if ((data.button == InputButton.Sneak) && (data.newButtonState == ButtonState.Pressed) && (data.player == this.player)){
                    
                    // unregister this event
                    world.afterEvents.playerButtonInput.unsubscribe(sneakExitEventHandler);
                    
                    // exit claim view
                    ShovelUI.exitClaimView(this.player, this.navigationStack);
                }
            })

            var playerData = PlayerData.fromId(this.player.id);

            // set flag
            playerData.setViewingClaim(true);

            // disable player movement
            this.player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false);
            this.player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);

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
            this.player.runCommand("tickingarea remove claimView"); // this will not break other players viewing session, their chunnk will still be rendered until the camera is gone
            this.player.runCommand(`tickingarea add ${claim.start.x} ${claim.start.y} ${claim.start.z} ${claim.end.x} ${claim.end.y} ${claim.end.z} claimView`);

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
            const nextCorner = function(index: number, player: Player, navStack: NavigationStack) {

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
                            nextCorner(index + 1, player, navStack);
                        }
                        // animation is over, return to first person
                        else {
                            system.runTimeout(() => {
                                if (playerData.viewingClaim) {

                                    // unregister the event
                                    world.afterEvents.playerButtonInput.unsubscribe(sneakExitEventHandler);

                                    // exit claim view
                                    ShovelUI.exitClaimView(player, navStack);
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

                // crouch to cancel hint should not be shown on mobile since the sneak button is hidden
                if (this.player.clientSystemInfo.platformType != PlatformType.Mobile) {
                    this.player.onScreenDisplay.updateSubtitle({ "translate": "ui.manage.view:loading_subtitle" });
                }

                this.player.camera.setCamera("minecraft:free", cornerView);
                system.runTimeout(() => {
                    nextCorner(0, this.player, this.navigationStack);
                }, 100)
            }, 20);
        }
        // player is not in the right dimension
        else {
            this.notificationManager.send(this.player, AddonSounds.Global.NEGATIVE_EVENT, undefined, "chat.claim:view");
        }
    }

    /**
     * Exits the claim view and returns the player to first person.
     * 
     * @param player - The player to exit the claim view for
     * @param navStack - The navigation stack to return to
     */
    static exitClaimView(player: Player, navStack: NavigationStack) {
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
        player.runCommand("tickingarea remove claimView");
                    
        transition.fadeTime.holdTime = 1;
        player.camera.fade(transition);
        system.runTimeout(() => {
            player.camera.clear();

            // set flag back to false
            playerData.setViewingClaim(false);

            // enable player movement again
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);

            // show hud
            player.onScreenDisplay.setHudVisibility(HudVisibility.Reset);

            // re-show the last menu to the player
            navStack.showCurrent();

        }, 30);
    };

    private removeClaim(claim: Claim) {
        var playerData: PlayerData = claim.getOwnerData();

        const form = new CallbackMessageFormData(this.navigationStack, () => this.removeClaim(claim))
            .title({"translate": "ui.manage.remove:title"})
            .body({
                "rawtext": [
                    { "translate": "ui.manage.remove:body_1" },
                    (playerData.claimBlocks.behavior != ClaimBlocksBehavior.UNLIMITED) ? { "rawtext": [
                        { "text": " " },
                        { "translate": "ui.manage.remove:body_2" },
                        { "text": `§l\n\n§a+${claim.getSize().width * claim.getSize().length} ` },
                        { "translate": "ui.manage.remove:label:claim_blocks" }
                    ]} : {}
                ]
            })
            .button1({"translate": "ui.manage.remove.button:cancel"}, () => {
                // return to previous page on menu
                this.navigationStack.back();
            })
            .button2({"translate": "ui.manage.remove.button:confirm"}, () => {
                // delete claim
                playerData.removeClaim(claim);

                playSound(this.player, AddonSounds.Claim.DELETE);

                // add the claim blocks to the players balance
                playerData.claimBlocks.incrementAmount(claim.getSize().width * claim.getSize().length);

                // return to previous page on menu
                this.navigationStack.pop(); // remove the manage claim menu from the stack
                this.navigationStack.back();
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

        const form = new CallbackModalFormData(AddonSounds.Global.NEGATIVE_EVENT, this.navigationStack, () => this.claimConfig(claim))
            .title({
                "rawtext": [
                    { "translate": newClaim ? "ui.claim.new:title" : "ui.claim.config:title" },
                    { "text": newClaim ? "" : `: ${claim.name}` }
                ]
            })
            .textField({"translate": "ui.claim.config.textbox:name"}, {"translate": "ui.claim.config:name_placeholder"}, {"defaultValue": claim.name}, (value) => {
                var isUniqueName = true;

                // names are used to identify claims, make sure player is using a unique name
                for (var c of playerData.claims) {
                    if ((c.name == value) && (claim != c)) {
                        isUniqueName = false;
                    }
                }

                if ((value as String).length == 0) {
                    return new ModalDataError("ui.claim.config.error:no_name");
                }
                else if (!isUniqueName) {
                    return new ModalDataError("ui.claim.config.error:unique_name");
                }

                return new ModalDataCorrect();
            })
            .dropdown({"translate": "ui.claim.config.dropdown:icon"}, Object.keys(this.claimIcons).map((i)=>({"translate": i} as RawMessage)), {"defaultValueIndex": Object.values(this.claimIcons).indexOf(claim.icon)})
            .toggle({"translate": "ui.claim.config.toggle:border_particles"}, {"defaultValue": claim.particlesEnabled, "tooltip": {"translate": "ui.claim.config.tooltip:border_particles"}}, (value) => {
                if (!claim.permissions.getPermission(PermissionTypes.ENTER_CLAIM) && !value) {
                    return new ModalDataError("ui.claim.config.error:particles_required");
                }

                claim.setParticlesEnabled(value);

                return new ModalDataCorrect();
            })
            .submitButton({"translate": newClaim ? "ui.claim.new:submit" : "ui.claim.config.submit"}, (response) => {
                var name = response.formValues[0].toString();
                var iconPath = this.claimIcons[Object.keys(this.claimIcons)[response.formValues[1].toString()]];

                // update claim data
                claim.setName(name);
                claim.setIcon(iconPath);
                
                if (newClaim){
                    // subtract claim blocks
                    playerData.claimBlocks.decrementAmount(claim.getSize().area);

                    // save new claim to database
                    playerData.addClaim(claim);

                    // notify player
                    this.notificationManager.send(this.player, AddonSounds.Global.POSITIVE_EVENT, undefined, "chat.claim:created");

                    // reset claim new/resize vars
                    playerData.setResizingClaimName("");
                    playerData.setFirstPoint(null);
                }
                else {
                    playSound(this.player, AddonSounds.Claim.SAVE);

                    // return to previous menu
                    this.navigationStack.back();
                }
            });

        form.show(this.player);
    }

    /**
     * Operator addon setup wizard for changing gamerules.
     * 
     * @param pageQueue - An array of page ids to show in order
     * @param completedPages - The number of pages that have been completed so far
     */
    public opAddonSetup(pageQueue: string[] = ["showTagsGamerule", "doFireTickGamerule"], completedPages: number = 0) {
        const playerData = PlayerData.fromId(this.player.id);

        // set flag to true so it doesn't show again
        playerData.setShownSetupScreen(true);

        // remove pages that are not needed (only filter on the first call when completedPages is 0)
        if (completedPages === 0) {
            pageQueue = pageQueue.filter(p => !(p == "showTagsGamerule" && (!world.gameRules.showTags || settings.claimShovelItemBehavior != ShovelBehavior.LOCK_TO_INVENTORY)));

            pageQueue = pageQueue.filter(p => !(p == "doFireTickGamerule" && !world.gameRules.doFireTick));
        }

        // if the navigation stack is empty (meaning this was used as an entry point to the UI), push the main menu or changelog onto it
        if (this.navigationStack.length == 0) {
            this.navigationStack.push(() => {playerData.shownChangeLog ? this.main() : this.viewChangeLog()});
        }

        // all pages completed, show current page in nav stack
        if (completedPages >= pageQueue.length) {

            system.runTimeout(() => {
                this.player.playSound(AddonSounds.Global.POSITIVE_EVENT);
            }, 10);

            this.navigationStack.showCurrent();

            return;
        }

        const currentPage: string = pageQueue[completedPages];

        const form = new CallbackMessageFormData(this.navigationStack, () => this.opAddonSetup(pageQueue, completedPages))
            .title({"translate": "ui.addon_setup:title", "with": [(completedPages + 1).toString(), pageQueue.length.toString()]})
            .button1({"translate": "ui.addon_setup.button:skip"}, () => this.opAddonSetup(pageQueue, completedPages + 1));

        switch (currentPage) {
            case "showTagsGamerule":
                form.body({"translate": "ui.addon_setup.body:page_1"});
                form.button2({"translate": "ui.addon_setup.button:disable_showTags"}, () => {
                    world.gameRules.showTags = false;

                    this.player.playSound(AddonSounds.Claim.SAVE);

                    this.opAddonSetup(pageQueue, completedPages + 1);
                });
                break;

            case "doFireTickGamerule":
                form.body({"translate": "ui.addon_setup.body:page_2"});
                form.button2({"translate": "ui.addon_setup.button:disable_doFireTick"}, () => {
                    world.gameRules.doFireTick = false;

                    this.player.playSound(AddonSounds.Claim.SAVE);

                    this.opAddonSetup(pageQueue, completedPages + 1);
                });
                break;
        }

        // make sure this form is removed from the nav stack
        this.navigationStack.pop();

        form.show(this.player);
    }

    public viewChangeLog() {
        const playerData = PlayerData.fromId(this.player.id);
        const version = playerData.schemaVersion;

        const form = new CallbackActionFormData(this.navigationStack, () => this.viewChangeLog())
            .title({"translate": "ui.changelog:title", "with": [version]})
            .body({"translate": "ui.addon_info:body.paragraph:1"})
            .label({"translate": "ui.changelog.label:1"})
            .header({"translate": "ui.changelog.header:changes"})
            .divider()
            .label({"translate": "ui.changelog.label:2"})
            .label({"translate": "ui.changelog.label:3"})
            .label({"translate": "ui.changelog.label:4"})
            .label({"translate": "ui.changelog.label:5"})
            .label({"translate": "ui.changelog.label:6"})
            .label({"translate": "ui.changelog.label:7"})
            .label({"translate": "ui.changelog.label:8"})
            .header({"translate": "ui.changelog.header:bug_fixes"})
            .divider()
            .label({"translate": "ui.changelog.label:9"})
            .label({"translate": "ui.changelog.label:10"})
            .label({"translate": "ui.changelog.label:11"})
            .label({"translate": "ui.changelog.label:12"})
            .button({"translate": "ui.changelog.button:back"}, undefined, () => {this.main();});

        form.show(this.player);

        // set shownChangeLog to true so it doesn't show again
        playerData.setShownChangeLog(true);
    }
}
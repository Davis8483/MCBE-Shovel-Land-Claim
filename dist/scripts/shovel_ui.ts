import { world, system, Player, Vector3, CameraFadeOptions, CameraSetPosOptions, EasingType, InputPermissionCategory, HudVisibility, RawMessage } from '@minecraft/server';
import { MessageFormData } from '@minecraft/server-ui';
import { CallbackActionFormData, CallbackModalFormData, ModalDataCorrect, ModalDataError } from './ui_wrapper.js';
import { database, PlayerData, Claim, PlayerPermissions, PermissionTypes, settings } from './database.js';
import { playSound, AddonSounds } from './sounds.js';
import { sendNotification } from './notifications.js';

export class ShovelUI {
    // player selected icons for their claims
    static claimIcons = {
        // name: path
        "ui.claim.icons:land": "textures/ui/icon_recipe_nature.png",
        "ui.claim.icons:bed": "textures/ui/icon_recipe_item.png",
        "ui.claim.icons:farmland": "textures/ui/icon_new.png",
        "ui.claim.icons:weapons": "textures/ui/icon_recipe_equipment.png",
        "ui.claim.icons:flowers": "textures/ui/icon_spring.png"
    };

    /**
     * Main menu for the shovel land claim addon.
     * 
     * @param player - The player to show the form to
     */
    static main(player: Player) {
        var playerData: PlayerData = PlayerData.fromId(player.id);

        const form = new CallbackActionFormData()
            .title({"translate": "ui.main:title"})
            .body({
                "rawtext": [
                    { "translate": "ui.main:body.paragraph:1" },
                    { "text": "\n\n" },
                    { "translate": "ui.main:body.paragraph:2" },
                    { "text": "\n\n" },
                    { "translate": "ui.main:body.paragraph:3" },
                    { "text": "\n\n" },
                    { "translate": "ui.main:body.paragraph:4" }, { "text": ` §e${playerData.claimBlocks.amount}§r ` },
                    { "text": "\n\n" },
                    { "translate": "ui.main:body.paragraph:5", "with": [settings.claimBlockHourlyPayment.toString(), playerData.claimBlocks.paymentTimeRemaining.toString()] }
                ]
            })

            // conditionally show the manage claims button if the player has any claims
            if (playerData.claims.length > 0){
                form.button({"translate": "ui.main.button:manage"}, "textures/ui/icon_setting.png", () => {
                    this.claimsList(player);
                }
            })
            .button({"translate": "ui.main.button:close"})

        form.show(player);
    }

    /**
     * New claim creation page, uses the claimConfig page under the hood.
     * 
     * @param owner - The player that will own the claim
     * @param start - The starting Vector3 of the claim
     * @param end - The ending Vector3 of the claim
     */
    static newClaim(owner: Player, start: Vector3, end: Vector3) {
        this.claimConfig(owner, new Claim("", start, end, this.claimIcons[Object.keys(this.claimIcons)[0]]), true);
    }

    /**
     * Popup to confirm resizing a claim.
     * 
     * @param owner - The player that owns the claim
     * @param claim - The claim to resize
     * @param start - The starting Vector3 of the claim
     * @param end - The ending Vector3 of the claim
     */
    static resizeClaim(owner: Player, claim: Claim, start: Vector3, end: Vector3) {
        var playerData: PlayerData = PlayerData.fromId(owner.id);

        const oldClaimWidth = Math.abs(claim.start.x - claim.end.x) + 1;
        const oldClaimLength = Math.abs(claim.start.z - claim.end.z) + 1;

        const newClaimWidth = Math.abs(start.x - end.x) + 1;
        const newClaimLength = Math.abs(start.z - end.z) + 1;

        const blockDifference = (oldClaimLength * oldClaimWidth) - (newClaimLength * newClaimWidth)

        const form = new MessageFormData()
            .title("ui.claim.resize:title")
            .body({
                "rawtext": [
                    { "translate": "ui.claim.resize:body" },
                    { "text": `§l\n\n${blockDifference < 0 ? "§c-" : "§a+"}${blockDifference} ` },
                    { "translate": "ui.manage.resize:label:claim_blocks" }
                ]
            })
            .button1("ui.claim.resize.button:cancel")
            .button2("ui.claim.resize.button:resize")

        form.show(owner).then((response) => {
            // if claim resized
            if (response.selection == 1) {
                claim.setStart(start);
                claim.setEnd(end);

                // notify player
                sendNotification(owner, "chat.claim:resized")
                playSound(owner, AddonSounds.Global.POSITIVE_EVENT);

                //add/subtract the blocks from players balance
                playerData.claimBlocks.incrementAmount(blockDifference);

            }
        });
    }

    /**
     * Shows a list of claims the player owns.
     * 
     * @param owner - The player that owns the claims
     */
    static claimsList(owner: Player) {
        var playerData: PlayerData = PlayerData.fromId(owner.id);

        const form = new CallbackActionFormData()
            .title({"translate": "ui.manage:title"})

        for (const c of playerData.claims) {

            form.button(
                {
                    "rawtext": [
                        { "text": `${c.name}§r\n§c${c.getSize().width}§8x§9${c.getSize().length} ` }
                    ]
                }, c.icon, () => {this.manageClaim(owner, c)});
        }

        form.button({"translate": "ui.global.button:back"}, undefined, () => {this.main(owner)});
        form.show(owner)
    }

    /**
     * A form with options to manage a claim. These options include, configuring the claim, managing permissions, viewing the claim and removing it.
     * 
     * @param owner - The player that owns the claim
     * @param claim - The claim to manage
     */
    static manageClaim(owner: Player, claim: Claim) {

        const form = new CallbackActionFormData()
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
            .button({"translate": "ui.manage.button:config"}, "textures/ui/debug_glyph_color.png", () => {this.claimConfig(owner, claim)})
            .button({"translate": "ui.manage.button:public_permissions"}, "textures/ui/icon_multiplayer.png", () => {this.managePermissions(owner, claim)})
            .button({"translate": "ui.manage.button:player_permissions"}, "textures/ui/icon_steve.png", () => {this.playerPermissionsList(owner, claim)})
            .button({"translate": "ui.manage.button:view"}, "textures/ui/magnifyingGlass.png", () => {this.viewClaim(owner, claim)})
            .button({"translate": "ui.manage.button:remove"}, "textures/ui/icon_trash.png", () => {this.removeClaim(owner, claim)})
            .button({"translate": "ui.global.button:back"}, undefined, () => {this.claimsList(owner)});

        form.show(owner);
    }

    static playerPermissionsList(owner: Player, claim: Claim) {

        const form = new CallbackActionFormData()
            .title({
                "rawtext": [
                    { "translate": "ui.manage.permissions.player.selection:title" },
                    { "text": `: ${claim.name}` }
                ]
            })
            .body({"translate": "ui.manage.permissions.player.selection:body"});

        for (var pP of claim.playerPermissionsList) {
            form.button({"text": pP.name}, "textures/ui/profile_glyph_color.png", () => {this.managePermissions(owner, claim, pP.id)});
        }

        if (claim.getUnsavedPlayers().length > 0){
            form.button({"translate": "ui.manage.permissions.player.selection:add_player"}, "textures/ui/realms_slot_check.png", () => {this.playerPermissionsListModify(owner, claim, true)});
        }

        if (claim.playerPermissionsList.length > 0){
            form.button({"translate": "ui.manage.permissions.player.selection:remove_player"}, "textures/ui/redX1.png", () => {this.playerPermissionsListModify(owner, claim, false)});
        }

        form.button({"translate": "ui.global.button:back"}, undefined, () => {this.manageClaim(owner, claim)});

        form.show(owner);
    }
    /**
     * Creates a prompt to specify what player to add or remove from permissions list
     * 
     * @param owner - The player that ownes the claim
     * 
     * @param claim - The claim that is being updated
     * 
     * @param add - Wether to add or remove the selected player from the specific player permissions list
     */
    static playerPermissionsListModify(owner: Player, claim: Claim, add: boolean) {

        // get unsaved players list
        var unsavedPlayers: string[] = claim.getUnsavedPlayers();

        const form = new CallbackModalFormData()
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
            .dropdown({"translate": "ui.manage.permissions.player.selection.modify:player_dropdown"}, add ? unsavedPlayers.map(id => ({"text": database.filter(p => p.id == id)[0].name})) : claim.playerPermissionsList.map(p => ({"text": p.name})))
            .submitButton(add ? {"translate": "ui.manage.permissions.player.selection.modify.add:submit"} : {"translate": "ui.manage.permissions.player.selection.modify.remove:submit"}, (response) => {
                if (add) {
                    var newPlayerPermissions = new PlayerPermissions(unsavedPlayers[response.formValues[0] as number], database.filter(p => p.id == unsavedPlayers[response.formValues[0] as number])[0].name);

                    // copy public permissions to new player permissions
                    for (var perm of Object.values(PermissionTypes)) {
                        newPlayerPermissions.setPermission(perm, claim.getPermission(perm));
                    }

                    // save new player permission to list
                    claim.addPlayerPermissions(newPlayerPermissions);

                    // if player was added open the permissions menu for them
                    this.managePermissions(owner, claim, newPlayerPermissions.id);
                }
                else {

                    // if a players permissions have been removed/reset notify them
                    for (var p of world.getAllPlayers()) {
                        if (p.id == claim.playerPermissionsList[response.formValues[0] as number].id) {
                            p.runCommandAsync(`tellraw @s {"rawtext":[{"translate":"chat.prefix"}, {"text":" ${owner.name} "}, {"translate":"chat.claim:player_permissions_reset_notif"}, {"translate":"claim:name_color"}, {"text":" ${claim.name}"}]}`);
                            playSound(p, AddonSounds.Global.POSITIVE_EVENT);
                            break;
                        }
                    }

                    // remove player from list
                    claim.removePlayerPermissions(response.formValues[0] as number);

                    // return to previous menu
                    this.playerPermissionsList(owner, claim);
                }
            });
        form.show(owner)
    }

    /**
    * A page for editing a claims permissions.
    * If the player parameter is not specified the form will edit the claims global permissions.
    * 
    * @param owner - The player that ownes the claim
    * 
    * @param claim - The claim that is being updated
    * 
    * @param playerID - The entity id of the player to manage permissions for.
    */
    static managePermissions(owner: Player, claim: Claim, playerID?: string) {

        if (playerID) {
            for (var p of claim.playerPermissionsList) {
                if (p.id == playerID) {
                    var playerPermissions = p;
                    break;
                }
            }
        }

        const target = playerID ? playerPermissions : claim; // target is either the claim or the player permissions object
        const form = new CallbackModalFormData()
            .title(playerID ? {
                "rawtext": [
                    { "translate": "ui.manage.permissions.player:title", "with": [playerPermissions.name, claim.name] },
                ]
            } :
                {
                    "rawtext": [
                        { "translate": "ui.manage.permissions.public:title", "with": [claim.name] }
                    ]
                }
            )
            .toggle({"translate": "ui.manage.permissions:enter_claim"}, playerID ? playerPermissions.getPermission(PermissionTypes.ENTER_CLAIM) : claim.getPermission(PermissionTypes.ENTER_CLAIM), (value)=> {
                target.setPermission(PermissionTypes.ENTER_CLAIM, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:break_blocks"}, playerID ? playerPermissions.getPermission(PermissionTypes.BREAK_BLOCKS) : claim.getPermission(PermissionTypes.BREAK_BLOCKS), (value)=> {
                target.setPermission(PermissionTypes.BREAK_BLOCKS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_items_on_blocks"}, playerID ? playerPermissions.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS) : claim.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS), (value)=> {
                target.setPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:hurt_entities"}, playerID ? playerPermissions.getPermission(PermissionTypes.HURT_ENTITIES) : claim.getPermission(PermissionTypes.HURT_ENTITIES), (value)=> {
                target.setPermission(PermissionTypes.HURT_ENTITIES, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:interact_with_entities"}, playerID ? playerPermissions.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES) : claim.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES), (value)=> {
                target.setPermission(PermissionTypes.INTERACT_WITH_ENTITIES, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_doors"}, playerID ? playerPermissions.getPermission(PermissionTypes.USE_DOORS) : claim.getPermission(PermissionTypes.USE_DOORS), (value)=> {
                target.setPermission(PermissionTypes.USE_DOORS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_switches"}, playerID ? playerPermissions.getPermission(PermissionTypes.USE_SWITCHES) : claim.getPermission(PermissionTypes.USE_SWITCHES), (value)=> {
                target.setPermission(PermissionTypes.USE_SWITCHES, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:use_beds"}, playerID ? playerPermissions.getPermission(PermissionTypes.USE_BEDS) : claim.getPermission(PermissionTypes.USE_BEDS), (value)=> {
                target.setPermission(PermissionTypes.USE_BEDS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:open_containers"}, playerID ? playerPermissions.getPermission(PermissionTypes.OPEN_CONTAINERS) : claim.getPermission(PermissionTypes.OPEN_CONTAINERS), (value)=> {
                target.setPermission(PermissionTypes.OPEN_CONTAINERS, value);

                return new ModalDataCorrect();
            })
            .toggle({"translate": "ui.manage.permissions:edit_signs"}, playerID ? playerPermissions.getPermission(PermissionTypes.EDIT_SIGNS) : claim.getPermission(PermissionTypes.EDIT_SIGNS), (value)=> {
                target.setPermission(PermissionTypes.EDIT_SIGNS, value);

                return new ModalDataCorrect();
            })

        if (!playerID) {
            form.toggle({"translate": "ui.manage.permissions:use_tnt"}, claim.getPermission(PermissionTypes.USE_TNT), (value)=> {
                claim.setPermission(PermissionTypes.USE_TNT, value);

                return new ModalDataCorrect();
            });
        }

        form.submitButton({"translate": "ui.global.button:save"}, ()=> {
            playSound(owner, AddonSounds.Claim.SAVE);

            for (var p of world.getAllPlayers()) {
                var playerData: PlayerData = PlayerData.fromId(p.id);

                // if a players permissions have been updated notify them
                if (playerID && p.id == playerID) {
                    sendNotification(p, "chat.claim:player_permissions_updated_notif", owner.name, claim.name)
                    playSound(p, AddonSounds.Claim.SAVE);
                }

                // if the claims global permissions have been updated notify all players in the claim
                if (!playerID && claim.isOverlap(p.location, p.location) && (playerData.id != owner.id)) {
                    sendNotification(p, "chat.claim:public_permissions_updated_notif", owner.name, claim.name)
                    playSound(p, AddonSounds.Claim.SAVE);
                }

                // if a players enter claim permission has been removed while they are in the claim, notify the owner
                if (!claim.hasPermission(PermissionTypes.ENTER_CLAIM, p) && claim.isOverlap(p.location, p.location) && (playerData.id != owner.id) && (playerID ? (playerData.id == playerID) : true)) {
                    
                    // set flag so the player is not ejected from the claim
                    playerData.setPendingEntranceDisallow(true);

                    // notify owner
                    sendNotification(owner, "chat.claim:pending_entrance_disallow", playerData.name);
                }
            }

            // return to previous menu
            if (playerID) {
                this.playerPermissionsList(owner, claim);
            }
            else {
                this.manageClaim(owner, claim);
            }
        });
        form.show(owner);
    }

    /**
     * Uses the camera command to view a claim.
     * 
     * @param owner - The player that owns the claim
     * @param claim - The claim to view
     */
    static viewClaim(owner: Player, claim: Claim) {

        // only run if player is in overworld
        if (owner.dimension == world.getDimension("overworld")) {

            var playerData = PlayerData.fromId(owner.id);

            // set flag
            playerData.setViewingClaim(true);

            // disable player movement, besides sneaking which is used to cancel the view
            owner.inputPermissions.cameraEnabled = false;
            owner.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, false);

            // hide hud
            owner.onScreenDisplay.setHudVisibility(HudVisibility.Hide);

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
            owner.runCommandAsync("tickingarea remove claimView"); // this will not break other players viewing session, their chunnk will still be rendered until the camera is gone
            owner.runCommandAsync(`tickingarea add ${claim.start.x} ${claim.start.y} ${claim.start.z} ${claim.end.x} ${claim.end.y} ${claim.end.z} claimView`);

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
            const nextCorner = function(index) {

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
                        owner.camera.setCamera("minecraft:free", cornerView);

                        // next corner
                        if (index < 3) {
                            nextCorner(index + 1);
                        }
                        // animation is over, return to first person
                        else {
                            system.runTimeout(() => {
                                if (playerData.viewingClaim) {
                                    ShovelUI.exitClaimView(owner);
                                }
                            }, 60);
                        }
                    }
                }, delay);
            };

            // start transition
            owner.camera.fade(transition);
            playSound(owner, AddonSounds.Claim.VIEW);

            // goto the first corner and start the animation
            system.runTimeout(() => {
                // show title to player
                owner.onScreenDisplay.setTitle({ "translate": "ui.manage.view:loading" });
                owner.onScreenDisplay.updateSubtitle({ "translate": "ui.manage.view:loading_subtitle" });

                owner.camera.setCamera("minecraft:free", cornerView);
                system.runTimeout(() => {
                    nextCorner(0);
                }, 100)
            }, 20);
        }
        // player is not in the right dimension
        else {
            playSound(owner, AddonSounds.Global.NEGATIVE_EVENT);
            sendNotification(owner, "chat.claim:view");
        }
    }

    /**
     * Exits the claim view and returns the player to first person.
     * 
     * @param owner - The player that owns the claim
     */
    static exitClaimView(owner: Player) {
        var playerData = PlayerData.fromId(owner.id);

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
        owner.runCommandAsync("tickingarea remove claimView");
                    
        transition.fadeTime.holdTime = 1;
        owner.camera.fade(transition);
        system.runTimeout(() => {
            owner.camera.clear();

            // set flag back to false
            playerData.setViewingClaim(false);

            // enable player movement again
            owner.inputPermissions.cameraEnabled = true;
            owner.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, true);

            // show hud
            owner.onScreenDisplay.setHudVisibility(HudVisibility.Reset);

        }, 30);
    };

    static removeClaim(owner: Player, claim: Claim) {
        var playerData: PlayerData = PlayerData.fromId(owner.id);

        const form = new MessageFormData()
            .title("ui.manage.remove:title")
            .body({
                "rawtext": [
                    { "translate": "ui.manage.remove:body" },
                    { "text": `§l\n\n§a+${claim.getSize().width * claim.getSize().length} ` },
                    { "translate": "ui.manage.remove:label:claim_blocks" }
                ]
            })
            .button1("ui.manage.remove.button:cancel")
            .button2("ui.manage.remove.button:confirm")

        form.show(owner).then((response) => {
            // if deletion canceled
            if (response.selection == 0) {

                // return to previous page on menu
                this.manageClaim(owner, claim);
            }
            else if (response.selection == 1) {

                // delete claim
                playerData.removeClaim(claim);

                sendNotification(owner, "chat.claim:removed")
                playSound(owner, AddonSounds.Claim.DELETE);

                // add the claim blocks to the players balance
                playerData.claimBlocks.incrementAmount(claim.getSize().width * claim.getSize().length);

            }
        });
    }

    /**
     * Creates a form to edit the claims name, icon and border particles.
     * 
     * @param owner - The player that owns the claim
     * @param claim - The claim to edit
     * @param newClaim - Whether this is a new claim or an existing one. This influences text that is displayed.
     */
    static claimConfig(owner: Player, claim: Claim, newClaim: boolean = false) {
        var playerData: PlayerData = PlayerData.fromId(owner.id);

        const form = new CallbackModalFormData()
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
                    playSound(owner, AddonSounds.Global.NEGATIVE_EVENT);
                    return new ModalDataError("ui.claim.config.error:no_name");
                }
                else if (!isUniqueName) {
                    playSound(owner, AddonSounds.Global.NEGATIVE_EVENT);
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

                var isUniqueName = true;

                // names are used to identify claims, make sure player is using a unique name
                for (var c of playerData.claims) {
                    if ((c.name == name) && (claim != c)) {
                        isUniqueName = false;
                    }
                }

                // save new claim data
                if (newClaim) {
                    // subtract claim blocks
                    playerData.claimBlocks.decrementAmount(claim.getSize().area);

                    // create a new claim
                    playerData.addClaim(claim);

                    // notify player
                    sendNotification(owner, "chat.claim:created")
                    playSound(owner, AddonSounds.Global.POSITIVE_EVENT);

                    // Reset resizingClaimName to avoid incorrect resizing behavior
                    playerData.setResizingClaimName("");
                }
                // update claim data
                else {
                    claim.setName(name);
                    claim.setIcon(iconPath);
                    claim.setParticlesEnabled(showBorderParticles);

                    if (newClaim){
                        // subtract claim blocks
                        playerData.claimBlocks.decrementAmount(claim.getSize().area);

                        // save new claim to database
                        playerData.addClaim(claim);

                        // notify player
                        sendNotification(owner, "chat.claim:created")
                        playSound(owner, AddonSounds.Global.POSITIVE_EVENT);

                        // Reset resizingClaimName to avoid incorrect resizing behavior
                        playerData.setResizingClaimName("");
                    }
                    else {
                        playSound(owner, AddonSounds.Claim.SAVE);

                        // return to previous menu
                        this.manageClaim(owner, claim);
                    }
                }
            });

        form.show(owner);
    }
}
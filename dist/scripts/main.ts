import { world, system, Player, Vector3, ItemStack, CameraFadeOptions, CameraSetPosOptions, EasingType, EntityRidingComponent, EntityRideableComponent, RawMessage } from '@minecraft/server';
import { ActionFormData, MessageFormData, ModalFormData } from '@minecraft/server-ui';

const shovelID = "lca:claim_shovel"

const claimIcons = {

    // name: path
    "ui.claim.icons:land": "textures/ui/icon_recipe_nature.png",
    "ui.claim.icons:bed": "textures/ui/icon_recipe_item.png",
    "ui.claim.icons:farmland": "textures/ui/icon_new.png",
    "ui.claim.icons:weapons": "textures/ui/icon_recipe_equipment.png",
    "ui.claim.icons:flowers": "textures/ui/icon_spring.png"
};

// load settings ----------------------------------------------------------------------------------------------------------
const settingsDefault = {
    "claim-block-hourly-payment": 100,
    "starting-claim-blocks": 200,
    "claim-minimum-width": 10
}

// make sure settings exist
if (!world.getDynamicPropertyIds().includes("settings")) {
    world.setDynamicProperty("settings", JSON.stringify(settingsDefault));
}

// load settings and make sure it contains necessary keys
var settings = { ...settingsDefault, ...JSON.parse(world.getDynamicProperty("settings").toString()) }

// provide a function for saving the setttings
function saveSettings() {
    world.setDynamicProperty("settings", JSON.stringify(settings));
}

// load database ----------------------------------------------------------------------------------------------------------
enum PermissionTypes {
    ENTER_CLAIM = "enterClaim",
    BREAK_BLOCKS = "breakBlocks",
    USE_ITEMS_ON_BLOCKS = "useItemsOnBlocks",
    HURT_ENTITIES = "hurtEntities",
    USE_TNT = "useTNT"
}

/**
 * Represents a player's permissions in a claim.
 */
class PlayerPermissions {
    /**
     * The entity id of the player
     */
    id: string;

    /**
     * The name of the player; do not use for identification as it can change.
     */
    name: string;

    /**
     * The permissions the player has for the claim
     */
    permissions: {
        enterClaim: boolean;
        breakBlocks: boolean;
        useItemsOnBlocks: boolean;
        hurtEntities: boolean;
    }

    /**
     * Creates a new PlayerPermissions object
     * 
     * @param id - The entity id of the player
     * 
     * @param name - The name of the player
     */
    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
        this.permissions.enterClaim = true;
        this.permissions.breakBlocks = false;
        this.permissions.useItemsOnBlocks = false;
        this.permissions.hurtEntities = false;
    }

    /**
     * Returns a PlayerPermissions object loaded from JSON, if a key is missing it will be replaced with the default value.
     * 
     * @param data - The JSON object to load the PlayerPermissions object from
     * 
     * @return - The PlayerPermissions object loaded from the JSON object
     */
    static fromJSON(data: any): PlayerPermissions {
        const defaultPermissions = new PlayerPermissions(data.id, data.name);
        return {
            id: data.id || defaultPermissions.id,
            name: data.name || defaultPermissions.name,
            permissions: {
                enterClaim: data.permissions?.enterClaim !== undefined ? data.permissions.enterClaim : defaultPermissions.permissions.enterClaim,
                breakBlocks: data.permissions?.breakBlocks !== undefined ? data.permissions.breakBlocks : defaultPermissions.permissions.breakBlocks,
                useItemsOnBlocks: data.permissions?.useItemsOnBlocks !== undefined ? data.permissions.useItemsOnBlocks : defaultPermissions.permissions.useItemsOnBlocks,
                hurtEntities: data.permissions?.hurtEntities !== undefined ? data.permissions.hurtEntities : defaultPermissions.permissions.hurtEntities,
            }
        };
    }
}

/**
 * Represents a land claim in the world.
 */
class Claim {
    /**
     * The name of the claim. This is used to identify the claim and should be unique.
     */
    name: string;

    /**
     * The start x and z position of the claim. The y value is still included for particle rendering/camera movement.
     */
    start: Vector3;

    /**
     * The end x and z position of the claim. The y value is still included for particle rendering/camera movement.
     */
    end: Vector3;

    /**
     * The mincraft icon path to be displayed in the ui.
     */
    icon: string;

    /**
     * If particles should be rendered for the claim.
     */
    particlesEnabled: boolean;

    /**
     * An array containing what permissions each individual player has
     */
    playerPermissionsList: PlayerPermissions[];

    /**
     * The default permissions for all players
     */
    publicPermissions: {
        enterClaim: boolean;
        breakBlocks: boolean;
        useItemsOnBlocks: boolean;
        hurtEntities: boolean;
        useTNT: boolean;
    }

    /**
     * Creates a new Claim object
     * 
     * @param name - The name of the claim
     * 
     * @param start - The block representing the first corner of the claim
     * 
     * @param end - The block representing the opposite second corner of the claim
     * 
     * @param icon - The mincraft icon path to be displayed in the ui
     * 
     * @param particlesEnabled - If particles should be rendered for the claim; default is true
     */
    constructor(name: string, start: Vector3, end: Vector3, icon: string, particlesEnabled: boolean = true) {
        this.name = name;
        this.start = start;
        this.end = end;
        this.icon = icon;
        this.particlesEnabled = particlesEnabled;
        this.playerPermissionsList = [];
        this.publicPermissions = {
            enterClaim: true,
            breakBlocks: false,
            useItemsOnBlocks: false,
            hurtEntities: false,
            useTNT: false
        };
    }

    /**
     * Returns a Claim object loaded from JSON, if a key is missing it will be replaced with the default value.
     * 
     * @param data - The JSON object to load the Claim object from
     * 
     * @return - The Claim object loaded from the JSON object
     */
    static fromJSON(data: any): Claim {
        const defaultClaim = new Claim("Undefined", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, "textures/ui/icon_recipe_nature.png");
        const claim = new Claim(
            data.name || defaultClaim.name,
            data.start || defaultClaim.start,
            data.end || defaultClaim.end,
            data.icon || defaultClaim.icon,
            data.particlesEnabled !== undefined ? data.particlesEnabled : defaultClaim.particlesEnabled
        );

        claim.publicPermissions = {
            enterClaim: data.publicPermissions?.enterClaim !== undefined ? data.publicPermissions.enterClaim : defaultClaim.publicPermissions.enterClaim,
            breakBlocks: data.publicPermissions?.breakBlocks !== undefined ? data.publicPermissions.breakBlocks : defaultClaim.publicPermissions.breakBlocks,
            useItemsOnBlocks: data.publicPermissions?.useItemsOnBlocks !== undefined ? data.publicPermissions.useItemsOnBlocks : defaultClaim.publicPermissions.useItemsOnBlocks,
            hurtEntities: data.publicPermissions?.hurtEntities !== undefined ? data.publicPermissions.hurtEntities : defaultClaim.publicPermissions.hurtEntities,
            useTNT: data.publicPermissions?.useTNT !== undefined ? data.publicPermissions.useTNT : defaultClaim.publicPermissions.useTNT
        };

        claim.playerPermissionsList = data.playerPermissionsList ? data.playerPermissionsList.map(PlayerPermissions.fromJSON) : defaultClaim.playerPermissionsList;

        return claim;
    }

    /**
     * returns if a visitor has specified permissions
     * 
     * @param permission - The type of permission to check for
     * 
     * @param player - Optional; The player you would like to check the permission for
    */
    hasPermission(permission: PermissionTypes, player: Player = undefined): boolean {

        // check if player is in specific permissions list
        if (player != undefined) {

            // find the players permissions
            for (var p of this.playerPermissionsList) {
                if (p.id == player.id) {
                    var playerPermissions = p;
                    break;
                }
            }

            if (Object.keys(playerPermissions).includes(permission)) {

                return playerPermissions[permission]
            }
        }
        // default to claims global permissions list
        else {
            if (Object.keys(this.publicPermissions).includes(permission)) {

                return (this.publicPermissions[permission]);
            }
        }

        // permission not found or something else went wrong ¯\_(ツ)_/¯
        return (false);
    }

    /**
     * returns if the specified area overlaps with the claim
     * 
     * @param start - The block representing the first corner of the area
     * 
     * @param end - The block representing the opposite second corner of the area
    */
    isOverlap(start: Vector3, end: Vector3): boolean {
        // Get the left, right, bottom, and top coordinates of each rectangle
        const rect1Left = Math.min(this.start.x, this.end.x);
        const rect1Right = Math.max(this.start.x, this.end.x);
        const rect1Top = Math.max(this.start.z, this.end.z);
        const rect1Bottom = Math.min(this.start.z, this.end.z);

        const rect2Left = Math.min(start.x, end.x);
        const rect2Right = Math.max(start.x, end.x);
        const rect2Top = Math.max(start.z, end.z);
        const rect2Bottom = Math.min(start.z, end.z);

        // Check if there's no overlap on both x and y directions
        return !(rect1Right < rect2Left || rect2Right < rect1Left || rect1Top < rect2Bottom || rect2Top < rect1Bottom);
    }
}

class PlayerData {
    schemaVersion: string = "1.0.0";

    /**
     * The entity id of the player.
     */
    id: string;

    /**
     * The name of the player; do not use for identification as it can change.
     */
    name: string;

    /**
     * If the player is currently in a claim.
     */
    inClaim: boolean;

    /**
     * If the player is currently viewing a claim.
     */
    viewingClaim: boolean;

    /** 
     * The name of the claim the player is currently resizing.
     */
    resizingClaimName: string;

    /**
     * The first corner of the claim the player is creating.
     */
    firstPoint: Vector3;

    /**
     * The opposite corner of the claim the player is resizing.
     */
    oppositeCorner: Vector3;

    /**
     * The reverse velocity is applied to a player when they are not allowed in a claim to kick them out.
     */
    entranceVelocity: Vector3;

    claimBlocks: {
        /**
         * The amount of claim blocks the player has.
         */
        amount: number;

        /**
         * The time remaining until the player will recive more claim blocks.
         */
        paymentTimeRemaining: number;
    }

    /**
     * The claims the player has created.
     */
    claims: Claim[]

    /**
     * Creates a new PlayerData object
     * 
     * @param playerID - The entity id of the player
     * 
     * @param playerName - The name of the player
     */
    constructor(playerID: string, playerName: string) {
        this.id = playerID;
        this.name = playerName;
        this.inClaim = false;
        this.viewingClaim = false;
        this.resizingClaimName = "";
        this.firstPoint = { "x": 0, "y": 0, "z": 0 };
        this.oppositeCorner = { "x": 0, "y": 0, "z": 0 };
        this.entranceVelocity = { "x": 0, "y": 0, "z": 0 };
        this.claimBlocks = {
            amount: settings["starting-claim-blocks"],
            paymentTimeRemaining: settings["claim-block-hourly-payment"]
        };
        this.claims = [];
    }

    /**
    * Returns a PlayerData object loaded from JSON, if a key is missing it will be replaced with the default value
    *
    * @param data - The JSON object to load the PlayerData object from
    * 
    * @return - The PlayerData object loaded from the JSON object
    */
    static fromJSON(data: any): PlayerData {
        const defaultPlayerData = new PlayerData(data.id, data.name);
        const playerData = new PlayerData(data.id, data.name);
        playerData.schemaVersion = data.schemaVersion || defaultPlayerData.schemaVersion;
        playerData.inClaim = data.inClaim !== undefined ? data.inClaim : defaultPlayerData.inClaim;
        playerData.viewingClaim = data.viewingClaim !== undefined ? data.viewingClaim : defaultPlayerData.viewingClaim;
        playerData.resizingClaimName = data.resizingClaimName || defaultPlayerData.resizingClaimName;
        playerData.firstPoint = data.firstPoint || defaultPlayerData.firstPoint;
        playerData.oppositeCorner = data.oppositeCorner || defaultPlayerData.oppositeCorner;
        playerData.entranceVelocity = data.entranceVelocity || defaultPlayerData.entranceVelocity;
        playerData.claimBlocks = {
            amount: data.claimBlocks?.amount || defaultPlayerData.claimBlocks.amount,
            paymentTimeRemaining: data.claimBlocks?.paymentTimeRemaining || defaultPlayerData.claimBlocks.paymentTimeRemaining,
        };
        playerData.claims = data.claims ? data.claims.map(Claim.fromJSON) : defaultPlayerData.claims;
        return playerData;
    }

    /**
     * Returns the requested claim
     * 
     * @param claimName - The name of the claim to retrieve
     */
    getClaim(claimName: string): Claim {

        for (var c of this.claims) {
            if (c.name == claimName) {
                return c;
            }
        }
    }
}

const dbPlayerDefault = {
    "in-claim": false,
    "viewing-claim": false,
    "first-point": {
        "x": 0,
        "y": 0,
        "z": 0,
        "resizing-claim": "",
        "opposite-corner": {
            "x": 0,
            "y": 0,
            "z": 0
        }
    },
    "entrance-velocity": {
        "x": 0,
        "y": 0,
        "z": 0
    },
    "claim-blocks": settings["starting-claim-blocks"],
    "claim-block-payment-time-remaining": 60,
    "claims": {}
}

// player specific permissions
const dbPlayerPermissionsDefault = {
    "enter-claim": true,
    "break-blocks": false,
    "use-items-on-blocks": false,
    "hurt-entities": false
}

// global claim permissions
const dbPermissionsDefault = {
    "enter-claim": true,
    "break-blocks": false,
    "use-items-on-blocks": false,
    "use-tnt": false,
    "hurt-entities": false
}

const dbClaimDefault = {
    "start": { "x": 0, "y": 0, "z": 0 },
    "end": { "x": 0, "y": 0, "z": 0 },

    "icon": "",

    "particles": true,

    "permissions": {
        "public": { ...dbPermissionsDefault },
        "players": {}
    }
}

var database: PlayerData[] = [];

// compile database into a dict
for (var id of world.getDynamicPropertyIds()) {
    const property = world.getDynamicProperty(id);

    if (id.includes("db.")) {
        const parsedData = JSON.parse(property.toString());
        const validatedData = PlayerData.fromJSON(parsedData);
        database.push(validatedData);
    }
}

/**
 * Transfers the database from memory into long term storage using dynamic world properties
 */
function saveDb() {
    for (var playerData of database) {
        // deconstruct database to save each players data as an individual dynamic property
        world.setDynamicProperty(`db.${playerData.id}`, JSON.stringify(playerData));
    }
}

//----------------------------------------------------------------------------------------------------------------------------

function sendNotification(player: Player, langEntry: string | RawMessage) {
    var rawText: RawMessage[] = [{ "translate": "chat.prefix" }, { "text": " " }]

    if (typeof langEntry == "string") {
        rawText.push({ "translate": `${langEntry}` });
    }
    else {
        for (var segment of langEntry.rawtext) {
            rawText.push(segment);
        }
    }

    player.runCommandAsync(`tellraw @s {"rawtext":${JSON.stringify(rawText)}}`);
}

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

/**
 * Returns the players data including claims
 * 
 * @param playerId - The entity id of the player
 */
function getPlayerData(playerId: string): PlayerData {

    for (var player of database) {
        if (playerId == player.id) {
            return player;
        }
    }
}

class Ui {
    // player selected icons for their claims
    static claimIcons = {
        // name: path
        "ui.claim.icons:land": "textures/ui/icon_recipe_nature.png",
        "ui.claim.icons:bed": "textures/ui/icon_recipe_item.png",
        "ui.claim.icons:farmland": "textures/ui/icon_new.png",
        "ui.claim.icons:weapons": "textures/ui/icon_recipe_equipment.png",
        "ui.claim.icons:flowers": "textures/ui/icon_spring.png"
    };

    static main(owner: Player) {
        var playerData: PlayerData = getPlayerData(owner.id);

        const form = new ActionFormData()
            .title("ui.main:title")
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
                    { "translate": "ui.main:body.paragraph:5-1" }, { "text": ` §a+${settings["claim-block-hourly-payment"]}§r ` }, { "translate": "ui.main:body.paragraph:5-2" }, { "text": ` §9${playerData.claimBlocks.paymentTimeRemaining}§r ` }, { "translate": "ui.main:body.paragraph:5-3" }
                ]
            })
            .button("ui.main.button:manage", "textures/ui/icon_setting.png")
            .button("ui.main.button:close")

        form.show(owner).then((response) => {
            if (response.selection == 0) {
                if (playerData.claims.length == 0) {
                    sendNotification(owner, "chat.claim:no_claims");
                    owner.playSound("note.didgeridoo");
                }
                else {
                    this.managePage(owner);
                }
            }
        });
    }

    static newClaim(owner: Player, start: Vector3, end: Vector3) {
        var playerData: PlayerData = getPlayerData(owner.id);

        const form = new ModalFormData()
            .title("ui.claim.new:title")
            .textField("ui.claim.config.textbox:name", "ui.claim.config:name_placeholder")
            .dropdown("ui.claim.config.dropdown:icon", Object.keys(claimIcons))
            .toggle("ui.claim.config.toggle:border_particles", true)

        form.show(owner).then((response) => {

            if (!response.canceled) {

                const name = response.formValues[0].toString();
                const iconPath = claimIcons[Object.keys(claimIcons)[response.formValues[1].toString()]];
                const showBorderParticles = response.formValues[2] as boolean;
                const claimWidth = Math.abs(start.x - end.x) + 1;
                const claimLength = Math.abs(start.z - end.z) + 1;

                var isUniqueName = true;

                // names are used to identify claims, make sure player is using a unique name
                for (var c of playerData.claims) {
                    if (c.name == name) {
                        isUniqueName = false;
                    }
                }

                if (name.length == 0) {
                    sendNotification(owner, "chat.claim:name_required")
                    owner.playSound("note.didgeridoo");
                }
                else if (!isUniqueName) {
                    sendNotification(owner, "chat.claim:use_unique_name")
                    owner.playSound("note.didgeridoo");
                }
                // passed all the checks, now make the claim
                else {

                    // subtract claim blocks
                    playerData.claimBlocks.amount -= (claimWidth * claimLength);

                    // create a new claim
                    playerData.claims.push(new Claim(name, start, end, iconPath, showBorderParticles));

                    sendNotification(owner, "chat.claim:created")
                    owner.playSound("random.levelup");
                }
            }
            saveDb();

        });
    }

    static resizeClaim(owner: Player, claim: Claim, start: Vector3, end: Vector3) {
        var playerData: PlayerData = getPlayerData(owner.id);

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
                claim.start = start;
                claim.end = end;

                sendNotification(owner, "chat.claim:resized")
                owner.playSound("random.levelup");

                //add/subtract the blocks from players balance
                playerData.claimBlocks.amount += blockDifference

                saveDb();
            }
        });
    }

    static managePage(owner: Player) {
        var playerData: PlayerData = getPlayerData(owner.id);

        const form = new ActionFormData()
            .title("ui.manage:title")

        for (var c of playerData.claims) {

            var claimWidth = Math.abs(c.start.x - c.end.x) + 1;
            var claimLength = Math.abs(c.start.z - c.end.z) + 1;

            form.button(
                {
                    "rawtext": [
                        { "text": `${c.name}§r\n§c${claimWidth}§8x§9${claimLength} ` }
                    ]
                }, c.icon);
        }

        form.button("ui.global.button:back")

        form.show(owner).then((response) => {
            if (response.selection == playerData.claims.length) {
                // return to previous menu
                this.main(owner);
            }
            else {
                this.manageClaim(owner, playerData.claims[response.selection]);
            }
        });
    }

    static manageClaim(owner: Player, claim: Claim) {

        const form = new ActionFormData()
            .title({
                "rawtext": [
                    { "translate": "ui.manage:title" },
                    { "text": `: ${claim.name}` }
                ]
            })
            .body({
                "rawtext": [
                    { "text": "\n" },
                    { "translate": "ui.manage.body:claim_start" },
                    { "text": `:  §cX§r=${claim.start.x} §9Z§r=${claim.start.z}\n\n` },
                    { "translate": "ui.manage.body:claim_end" },
                    { "text": `: §cX§r=${claim.end.x} §9Z§r=${claim.end.z}\n ` }
                ]
            })
            .button("ui.manage.button:config", "textures/ui/debug_glyph_color.png")
            .button("ui.manage.button:public_permissions", "textures/ui/icon_multiplayer.png")
            .button("ui.manage.button:player_permissions", "textures/ui/icon_steve.png")
            .button("ui.manage.button:view", "textures/ui/magnifyingGlass.png")
            .button("ui.manage.button:remove", "textures/ui/icon_trash.png")
            .button("ui.global.button:back")

        form.show(owner).then((response) => {
            if (response.selection == 0) {
                this.claimConfig(owner, claim);
            }
            else if (response.selection == 1) {
                this.managePermissions(owner, claim);
            }
            else if (response.selection == 2) {
                this.playerPermissionsList(owner, claim);
            }
            else if (response.selection == 3) {
                this.viewClaim(owner, claim);
            }
            else if (response.selection == 4) {
                this.removeClaim(owner, claim);
            }
            else if (response.selection == 5) {
                // return to previous menu
                this.managePage(owner);
            }
        });
    }

    static playerPermissionsList(owner: Player, claim: Claim) {

        const form = new ActionFormData()
            .title({
                "rawtext": [
                    { "translate": "ui.manage.permissions.player.selection:title" },
                    { "text": `: ${claim.name}` }
                ]
            })
            .body("ui.manage.permissions.player.selection:body");

        for (var playerPermissions of claim.playerPermissionsList) {
            form.button(playerPermissions.name, "textures/ui/profile_glyph_color.png");
        }

        form.button("ui.manage.permissions.player.selection:add_player", "textures/ui/realms_slot_check.png");
        form.button("ui.manage.permissions.player.selection:remove_player", "textures/ui/redX1.png");
        form.button("ui.global.button:back");

        form.show(owner).then((response) => {
            if (response.selection == claim.playerPermissionsList.length) {
                // open add player menu
                this.playerPermissionsListModify(owner, claim, true);
            }
            else if (response.selection == claim.playerPermissionsList.length + 1) {
                // open remove player menu
                this.playerPermissionsListModify(owner, claim, false);
            }
            else if (response.selection == claim.playerPermissionsList.length + 2) {
                // return to previous menu
                this.manageClaim(owner, claim);
            }
            else {
                // open player permissions menu
                this.managePermissions(owner, claim, claim.playerPermissionsList[response.selection].name);
            }
        });
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

        var players = []

        // if adding player, only show players not in list
        if (add) {

            // get the entire list of players that have ever joined the world
            for (var playerData of database) {
                players.push(playerData.name)
            }

            // filter players from the list, we don't want to add people who are already in it
            for (var playerPermissions of claim.playerPermissionsList) {

                var index = players.indexOf(playerPermissions.name);
                players.splice(index, 1);
            }

            // make sure to remove owner from list as well
            players.splice(players.indexOf(owner.name), 1);
        }
        // if removing player, only show players in list
        else {

            for (var playerPermissions of claim.playerPermissionsList) {
                players.push(playerPermissions.name);
            }
        }

        const form = new ModalFormData()
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
            .dropdown("ui.manage.permissions.player.selection.modify:player_dropdown", players);

        form.show(owner).then((response) => {

            const playerName = players[Number(response.formValues[0])];

            if (add) {
                // set up default permissions for specified player
                const newPlayerPermissions = new PlayerPermissions(owner.id, owner.name);
                claim.playerPermissionsList.push(newPlayerPermissions);
            }
            else {
                // remove player from list
                var index = claim.playerPermissionsList.indexOf(playerName);
                claim.playerPermissionsList.splice(index, 1);

                // if a players permissions have been removed notify them
                for (var p of world.getAllPlayers()) {
                    if (p.name == playerName) {
                        p.runCommandAsync(`tellraw @s {"rawtext":[{"translate":"chat.prefix"}, {"text":" ${owner.name} "}, {"translate":"chat.claim:player_permissions_reset_notif"}, {"translate":"claim:name_color"}, {"text":" ${claim.name}"}]}`);
                        p.playSound("random.levelup");
                        break;
                    }
                }
            }


            saveDb();

            // return to previous menu
            this.playerPermissionsList(owner, claim)

        });

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

        const form = new ModalFormData()
            .title(playerID ? {
                "rawtext": [
                    { "text": `${playerPermissions.name}` },
                    { "translate": "ui.manage.permissions.player:title" },
                    { "text": `: ${claim.name}` }
                ]
            } :
                {
                    "rawtext": [
                        { "translate": "ui.manage.permissions.public:title" },
                        { "text": `: ${claim.name}` }
                    ]
                }
            )
            .toggle("ui.manage.permissions:enter_claim", playerID ? playerPermissions.permissions.enterClaim : claim.publicPermissions.enterClaim)
            .toggle("ui.manage.permissions:break_blocks", playerID ? playerPermissions.permissions.breakBlocks : claim.publicPermissions.breakBlocks)
            .toggle("ui.manage.permissions:use_items_on_blocks", playerID ? playerPermissions.permissions.useItemsOnBlocks : claim.publicPermissions.useItemsOnBlocks)
            .toggle("ui.manage.permissions:hurt_entities", playerID ? playerPermissions.permissions.hurtEntities : claim.publicPermissions.hurtEntities);

        if (!playerID) {
            form.toggle("ui.manage.permissions:use_tnt", claim.publicPermissions.useTNT);
        }

        form.show(owner).then((response) => {

            if (!response.canceled) {

                // save data
                if (playerID) {
                    playerPermissions.permissions.enterClaim = response.formValues[0] as boolean;
                    playerPermissions.permissions.breakBlocks = response.formValues[1] as boolean;
                    playerPermissions.permissions.useItemsOnBlocks = response.formValues[2] as boolean;
                    playerPermissions.permissions.hurtEntities = response.formValues[3] as boolean;
                }
                else {
                    claim.publicPermissions.enterClaim = response.formValues[0] as boolean;
                    claim.publicPermissions.breakBlocks = response.formValues[1] as boolean;
                    claim.publicPermissions.useItemsOnBlocks = response.formValues[2] as boolean;
                    claim.publicPermissions.hurtEntities = response.formValues[3] as boolean;
                    claim.publicPermissions.useTNT = response.formValues[4] as boolean;
                }

                sendNotification(owner, "chat.claim:permissions_updated");
                owner.playSound("random.levelup");

                // if a players permissions have been updated notify them
                for (var p of world.getAllPlayers()) {
                    if (p.id == playerID) {
                        p.runCommandAsync(`tellraw @s {"rawtext":[{"translate":"chat.prefix"}, {"text":" ${owner.name} "}, {"translate":"chat.claim:player_permissions_updated_notif"}, {"translate":"claim:name_color"}, {"text":" ${claim.name}"}]}`);
                        p.playSound("random.levelup");
                        break;
                    }
                }
            }
            saveDb();

        });
    }

    /*
    Uses the camera command to circle around the specified claim.
    */
    static viewClaim(owner: Player, claim: Claim) {

        // only run if player is in overworld
        if (owner.dimension == world.getDimension("overworld")) {

            var playerData = getPlayerData(owner.id);

            // set flag
            playerData.viewingClaim = true;

            // disable player movement
            owner.runCommandAsync("inputpermission set @s camera disabled");
            owner.runCommandAsync("inputpermission set @s movement disabled");

            // hide hud
            owner.runCommandAsync("hud @s hide");

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

            // load the claim
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
                            transition.fadeTime.holdTime = 1;
                            owner.camera.fade(transition);
                            system.runTimeout(() => {
                                owner.camera.clear();

                                // unload the claim
                                owner.runCommandAsync("tickingarea remove claimView");

                                // set flag back to false
                                playerData.viewingClaim = false;

                                // enable player movement again
                                owner.runCommandAsync("inputpermission set @s camera enabled");
                                owner.runCommandAsync("inputpermission set @s movement enabled");

                                // show hud
                                owner.runCommandAsync("hud @s reset");

                            }, 30);
                        }, 60);
                    }
                }, delay);
            };

            // start transition
            owner.camera.fade(transition);
            owner.playSound("beacon.activate");

            // goto the first corner and start the animation
            system.runTimeout(() => {
                // show title to player
                owner.onScreenDisplay.setTitle({ "translate": "ui.manage.view:loading" });

                owner.camera.setCamera("minecraft:free", cornerView);
                system.runTimeout(() => {
                    nextCorner(0);
                }, 100)
            }, 20);
        }
        // player is not in the right dimension
        else {
            owner.playSound("note.didgeridoo");
            sendNotification(owner, "chat.claim:view");
        }
    }

    static removeClaim(owner: Player, claim: Claim) {
        var playerData: PlayerData = getPlayerData(owner.id);

        var claimWidth = Math.abs(claim.start.x - claim.end.x) + 1;
        var claimLength = Math.abs(claim.start.z - claim.end.z) + 1;

        var playerData = getPlayerData(owner.id);

        const form = new MessageFormData()
            .title("ui.manage.remove:title")
            .body({
                "rawtext": [
                    { "translate": "ui.manage.remove:body" },
                    { "text": `§l\n\n§a+${claimWidth * claimLength} ` },
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
                playerData.claims = playerData.claims.filter(c => c !== claim);

                sendNotification(owner, "chat.claim:removed")
                owner.playSound("mob.creeper.say");

                // add the claim blocks to the players balance
                playerData.claimBlocks.amount += claimWidth * claimLength

                saveDb();
            }
        });
    }

    static claimConfig(owner: Player, claim: Claim) {

        const form = new ModalFormData()
            .title({
                "rawtext": [
                    { "translate": "ui.manage.config:title" },
                    { "text": `: ${claim.name}` }
                ]
            })
            .textField("ui.claim.config.textbox:name", "ui.claim.config:name_placeholder", claim.name)
            .dropdown("ui.claim.config.dropdown:icon", Object.keys(claimIcons), Object.values(claimIcons).indexOf(claim.icon))
            .toggle("ui.claim.config.toggle:border_particles", claim.particlesEnabled)

        form.show(owner).then((response) => {

            if (!response.canceled) {

                var name = response.formValues[0].toString();
                var iconPath = claimIcons[Object.keys(claimIcons)[response.formValues[1].toString()]];
                var showBorderParticles = response.formValues[2] as boolean;

                if (name.length == 0) {
                    sendNotification(owner, "chat.claim:name_required")
                    owner.playSound("note.didgeridoo");
                }
                else {

                    // update data
                    claim.name = name;
                    claim.icon = iconPath;
                    claim.particlesEnabled = showBorderParticles;

                    sendNotification(owner, "chat.claim:updated")
                    owner.playSound("note.cow_bell");
                }
            }
            saveDb();

        });
    }
}

world.afterEvents.playerJoin.subscribe((data) => {

    // verify player data is on file
    var playerFound = false;

    for (var p of database) {
        if (p.id == data.playerId) {
            playerFound = true;
            break;
        }
    }

    // player is not saved in db
    if (!playerFound) {
        // create new player in db
        database.push(new PlayerData(data.playerId, data.playerName));
    }

    // save changes to the database
    saveDb();

});

world.afterEvents.playerSpawn.subscribe((data) => {
    // make sure player has a claim shovel
    data.player.runCommandAsync(`execute if entity @s[hasitem = { item=${shovelID}, quantity = 0}] run give @s ${shovelID} 1 0 { "keep_on_death": { }, "item_lock": { "mode": "lock_in_inventory" } } `);

    // set flag to false since all camera positions will be reset upon rejoining
    getPlayerData(data.player.id).viewingClaim = false;
});

// open menu when claim shovel is used
world.afterEvents.itemUse.subscribe((data) => {
    if (data.itemStack.typeId == shovelID) {
        Ui.main(data.source);
    };
});

// disallow players from using items when viewing a claim
world.beforeEvents.itemUse.subscribe((data) => {
    if (getPlayerData(data.source.id).viewingClaim) {
        data.cancel = true;
    }
});

world.beforeEvents.itemUseOn.subscribe((data) => {

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
    if (getPlayerData(data.source.id).viewingClaim) {
        data.cancel = true;
    }

    if (data.block.dimension == world.getDimension("overworld")) {
        runInAllClaims((playerID, playerName, claim) => {
            // checks if the used on block or calculated placed block is within a claim and if the player has permission
            if (
                ((claim.isOverlap(data.block, data.block) || claim.isOverlap(placedBlock, placedBlock))) && (playerID != data.source.id) && !claim.hasPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, data.source)) {
                data.cancel = true;

                system.run(() => {
                    sendNotification(data.source, "chat.claim.permission:use_item_on_block");
                    data.source.playSound("note.didgeridoo");
                })
            }
        });
    }
});

// Set/adjust claim points if player is sneaking
world.beforeEvents.playerBreakBlock.subscribe((data) => {

    var playerData = getPlayerData(data.player.id);

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
                    playerData.resizingClaimName = "";
                    playerData.firstPoint.x = data.block.x;
                    playerData.firstPoint.y = data.block.y;
                    playerData.firstPoint.z = data.block.z;

                    runInAllClaims((playerID, playerName, claim) => {

                        // user defined start and end points of the claim
                        var s = claim.start;
                        var e = claim.end;

                        // all 4 points of the claim
                        var points = [
                            [[s.x, s.z], [s.x, e.z]],
                            [[e.x, s.z], [e.x, e.z]]
                        ]

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
                                playerData.oppositeCorner = { "x": points[aIndex ^ 1][bIndex ^ 1][0], "y": data.block.y, "z": points[aIndex ^ 1][bIndex ^ 1][1] }
                                playerData.resizingClaimName = claim.name;

                                data.player.sendMessage({
                                    "rawtext": [
                                        { "translate": "chat.prefix" },
                                        { "text": " " },
                                        { "translate": "chat.point.resize:selected" },
                                        { "text": `: [§c${data.block.x}§r, §a${data.block.y}§r, §9${data.block.z}§r]\n` },
                                        { "translate": "chat.point.resize:hint" }
                                    ]
                                });

                                system.run(() => {
                                    data.player.playSound("note.banjo")
                                });

                            }
                            else {
                                sendNotification(data.player, "chat.point.resize:disallowed");
                                system.run(() => {
                                    data.player.playSound("note.didgeridoo")
                                });
                            }
                        }
                    });

                    if (!isResize) {
                        data.player.sendMessage({
                            "rawtext": [
                                { "translate": "chat.prefix" },
                                { "text": " " },
                                { "translate": "chat.point.new:selected" },
                                { "text": `: [§c${data.block.x}§r, §a${data.block.y}§r, §9${data.block.z}§r]\n` },
                                { "translate": "chat.point.new:hint" }
                            ]
                        });

                        system.run(() => {
                            data.player.playSound("note.cow_bell")
                        });
                    }
                }
                // if player is crouching
                else {
                    var secondPoint = { "x": data.block.x, "y": data.block.y, "z": data.block.z };
                    var intersectingClaim = false;

                    // if claim is resized
                    if (playerData.resizingClaimName.length > 0) {

                        // get the claim object that is being resized
                        for (var c of playerData.claims) {
                            if (c.name == playerData.resizingClaimName) {
                                var claim = c;
                                break;
                            }
                        }

                        const oldClaimWidth = Math.abs(claim.start.x - claim.end.x) + 1;
                        const oldClaimLength = Math.abs(claim.start.z - claim.end.z) + 1;

                        const newClaimWidth = Math.abs(playerData.oppositeCorner.x - secondPoint.x) + 1;
                        const newClaimLength = Math.abs(playerData.oppositeCorner.z - secondPoint.z) + 1;

                        const blockDifference = (newClaimLength * newClaimWidth) - (oldClaimLength * oldClaimWidth)

                        // make sure new claim isn't intersecting others not counting itself
                        runInAllClaims((playerID, playerName, claim) => {
                            if (claim.isOverlap(playerData.firstPoint, secondPoint) && ((playerID != data.player.id) || (claim.name != playerData.resizingClaimName))) {
                                intersectingClaim = true;
                            }
                        });

                        // intersecting claim warning message, cancel resize
                        if (intersectingClaim) {
                            sendNotification(data.player, "chat.claim:intersecting")

                            system.run(() => {
                                data.player.playSound("note.didgeridoo")
                            });
                        }
                        // claim isn't wide enough warning message, cancel resize
                        else if (newClaimWidth < settings["claim-minimum-width"] || newClaimLength < settings["claim-minimum-width"]) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:width1" }, { "text": ` ${settings["claim-minimum-width"]} ` }, { "translate": "chat.claim:width2" }] });
                            system.run(() => {
                                data.player.playSound("note.didgeridoo")
                            });
                        }
                        // not enough claim blocks warning message, cancel resize
                        else if (playerData.claimBlocks.amount < blockDifference) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:blocks1" }, { "text": ` ${(blockDifference) - playerData.claimBlocks.amount} ` }, { "translate": "chat.claim:blocks3" }] });
                            system.run(() => {
                                data.player.playSound("note.didgeridoo")
                            });
                        }
                        // all requirements met, open the claim resizing ui
                        else {
                            system.run(() => {
                                data.player.playSound("note.cow_bell");

                                Ui.resizeClaim(data.player, claim, playerData.oppositeCorner, secondPoint);
                            });
                        }
                    }
                    // not resizing, create a new claim
                    else {

                        const claimWidth = Math.abs(playerData.firstPoint.x - secondPoint.x) + 1;
                        const claimLength = Math.abs(playerData.firstPoint.z - secondPoint.z) + 1;

                        // make sure new claim isn't intersecting others
                        runInAllClaims((playerID, playerName, claim) => {
                            if (claim.isOverlap(playerData.firstPoint, secondPoint)) {
                                intersectingClaim = true;
                            }
                        });
                        // intersecting claim warning message, cancel creation
                        if (intersectingClaim) {
                            sendNotification(data.player, "chat.claim:intersecting")

                            system.run(() => {
                                data.player.playSound("note.didgeridoo")
                            });
                        }
                        // claim is not wide enough warning message, cancel creation
                        else if (claimWidth < settings["claim-minimum-width"] || claimLength < settings["claim-minimum-width"]) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:width1" }, { "text": ` ${settings["claim-minimum-width"]} ` }, { "translate": "chat.claim:width2" }] });
                            system.run(() => {
                                data.player.playSound("note.didgeridoo")
                            });
                        }
                        // not enough claim blocks warning message, cancel creation
                        else if (playerData.claimBlocks.amount < (claimWidth * claimLength)) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:blocks1" }, { "text": ` ${(claimWidth * claimLength) - playerData.claimBlocks.amount} ` }, { "translate": "chat.claim:blocks2" }] });
                            system.run(() => {
                                data.player.playSound("note.didgeridoo")
                            });
                        }
                        // all requirements are met, open the claim creation ui
                        else {
                            system.run(() => {
                                data.player.playSound("note.cow_bell");

                                Ui.newClaim(data.player, playerData.firstPoint, secondPoint);
                            });
                        }
                    }

                }
            }

            // save changes to the database
            saveDb();

        }
        // player is not in the overworld, warn them that they are not allowed to create a claim here
        else {
            sendNotification(data.player, "chat.shovel:dimension_warning");
            system.run(() => {
                data.player.playSound("note.didgeridoo");
            });
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

                    system.run(() => {
                        sendNotification(data.player, "chat.claim.permission:break_blocks");
                        data.player.playSound("note.didgeridoo");
                    })
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
            if ((data.source.typeId != "minecraft:tnt") || claim.hasPermission(PermissionTypes.USE_TNT)) {
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
            system.run(() => {
                sendNotification(closestPlayer, "chat.claim.permission:use_tnt");
                closestPlayer.playSound("note.didgeridoo");
            });
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
            system.run(() => {
                sendNotification(closestPlayer, "chat.claim:piston");
                closestPlayer.playSound("note.didgeridoo");
            });
        }
    }

})

world.beforeEvents.itemUse.subscribe((data) => {

    // disallowed items that could cause harm to an entity
    var disallowedItems = ["minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:bow", "minecraft:crossbow"]

    if (disallowedItems.includes(data.itemStack.typeId) && (data.source.dimension == world.getDimension("overworld"))) {
        runInAllClaims((playerID, playerName, claim) => {

            // if player has used the disallowed item in a claim
            if (claim.isOverlap(data.source.location, data.source.location) && (playerID != data.source.id) && !claim.hasPermission(PermissionTypes.HURT_ENTITIES, data.source)) {

                // cancel the action
                data.cancel = true;

                // notify player they don't have permissions
                system.run(() => {
                    sendNotification(data.source, "chat.claim.permission:hurt_entities");
                    data.source.playSound("note.didgeridoo");
                })
            }
        });
    }
})

// player management in claims, runs every 1/20th of a second
system.runInterval(() => {

    // make sure fire charges can't fly into claims
    // also make sure withers can't fly into claim
    for (var e of world.getDimension("overworld").getEntities()) {
        runInAllClaims((playerID, playerName, claim) => {
            if (claim.isOverlap(e.location, e.location)) {
                if (e.typeId == "minecraft:small_fireball" || e.typeId == "minecraft:wither") {
                    e.remove();
                }
            }
        });
    }

    for (var p of world.getAllPlayers()) {

        var playerData = getPlayerData(p.id);

        // only run if player is in overworld
        if (p.dimension == world.getDimension("overworld")) {

            // capture the state of player attribute "in-claim" before it is updated
            var inClaimOld: boolean = playerData.inClaim;

            // set flag to false before for loop updates it
            playerData.inClaim = false;

            runInAllClaims((playerID, playerName, claim) => {

                // apply an offset to the player location to be more accurate with claim bounds
                const location: Vector3 = { "x": p.location.x - 0.5, "y": p.location.y - 0.5, "z": p.location.z - 0.5 };

                // if player is in the claim
                if (claim.isOverlap(location, location)) {

                    playerData.inClaim = true

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
                    if ((playerID != p.id) && !claim.hasPermission(PermissionTypes.ENTER_CLAIM, p)) {
                        // player has entered claim
                        if (!inClaimOld && playerData.inClaim) {

                            // send player a notification
                            sendNotification(p, "chat.claim.permission:enter_claim");
                            p.playSound("note.didgeridoo");

                            // save entrance velocity
                            playerData.entranceVelocity = p.getVelocity();
                        }

                        const velocity: Vector3 = playerData.entranceVelocity;

                        // if player is riding an entity eject them
                        if (p.hasComponent(EntityRidingComponent.componentId)) {
                            const ridingComponent = p.getComponent(EntityRidingComponent.componentId) as EntityRidingComponent;
                            const riddenComponent = ridingComponent.entityRidingOn.getComponent(EntityRideableComponent.componentId) as EntityRideableComponent;

                            riddenComponent.ejectRider(p);
                        }

                        p.applyKnockback(-velocity.x, -velocity.z, 3, 0.5);
                        p.addEffect("wither", 40)

                    }
                }
            });



            // player has entered claim
            if (!inClaimOld && playerData.inClaim) {
                // play entrance sound
                p.playSound("random.door_open")
            }
            // player has exited the claim
            else if (inClaimOld && !playerData.inClaim) {
                // play exit sound
                p.playSound("random.door_close")
            }
        }
        // player is not in overworld
        else {
            playerData.inClaim = false;
        }
    }
}, 1);

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

        // only render if particles are enabled
        if (claim.particlesEnabled) {
            // loop through all claim points to determine particle type
            for (var a = 0; a < points.length; a++) {
                for (var b = 0; b < points[a].length; b++) {

                    // only render if claim point is in render distance
                    if (dimension.getBlock({ "x": points[a][b][0], "y": averageY, "z": points[a][b][1] }) != undefined) {

                        // creates sets of verticle claim particles 20 blocks below and above the claim
                        for (var i = averageY - averageOffset; i <= averageY + averageOffset; i += segmentHeight) {
                            if (points[a][b][0] > points[a ^ 1][b][0]) {
                                var xParticleType = "lca:negx_claim_dust";
                            }
                            else {
                                var xParticleType = "lca:posx_claim_dust";
                            }

                            if (points[a][b][1] > points[a][b ^ 1][1]) {
                                var yParticleType = "lca:negz_claim_dust";
                            }
                            else {
                                var yParticleType = "lca:posz_claim_dust";
                            }

                            var particlePoint: Vector3 = { "x": points[a][b][0] + 0.5, "y": i + 0.5, "z": points[a][b][1] + 0.5 };

                            try {
                                dimension.spawnParticle(xParticleType, particlePoint);
                                dimension.spawnParticle(yParticleType, particlePoint);
                                dimension.spawnParticle("lca:rising_claim_dust", particlePoint);
                                dimension.spawnParticle("lca:falling_claim_dust", particlePoint);
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

        var playerData = getPlayerData(p.id);

        // decrement timer by 1
        playerData.claimBlocks.paymentTimeRemaining -= 1;

        // if time is up reward blocks and reset timer
        if (playerData.claimBlocks.paymentTimeRemaining <= 0) {
            playerData.claimBlocks.amount += settings["claim-block-hourly-payment"];
            sendNotification(p, {
                "rawtext": [
                    { "translate": "chat.blocks:payment1" },
                    { "text": ` ${settings["claim-block-hourly-payment"]} ` },
                    { "translate": "chat.blocks:payment2" }]
            })
            p.playSound("random.levelup");

            playerData.claimBlocks.paymentTimeRemaining = 60;
        }
    }
    saveDb();
}, 1200)
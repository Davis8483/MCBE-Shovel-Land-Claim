import { world, system, ItemStack, EasingType, EntityRidingComponent, EntityRideableComponent, BlockComponentTypes } from '@minecraft/server';
import { ActionFormData, MessageFormData, ModalFormData } from '@minecraft/server-ui';
var shovelID = "lca:claim_shovel";
var claimIcons = {
    // name: path
    "ui.claim.icons:land": "textures/ui/icon_recipe_nature.png",
    "ui.claim.icons:bed": "textures/ui/icon_recipe_item.png",
    "ui.claim.icons:farmland": "textures/ui/icon_new.png",
    "ui.claim.icons:weapons": "textures/ui/icon_recipe_equipment.png",
    "ui.claim.icons:flowers": "textures/ui/icon_spring.png"
};
// MARK: load settings ----------------------------------------------------------------------------------------------------------
/**
 * An object containing global settings for the addon
 */
var Settings = /** @class */ (function () {
    /**
     * Creates a new Settings object with default values
     */
    function Settings() {
        this.claimBlockHourlyPayment = 100;
        this.startingClaimBlocks = 200;
        this.claimMinimumWidth = 10;
        this.disallowedBlocks = [
            // "minecraft:bedrock",
            // "minecraft:barrier",
            // "minecraft:command_block",
            // "minecraft:repeating_command_block",
            // "minecraft:chain_command_block",
            // "minecraft:structure_block",
            // "minecraft:jigsaw",
            // "minecraft:structure_void",
            // "minecraft:structure_block",
            "minecraft:sculk_catalyst" // can be used for griefing
        ];
    }
    /**
     * Returns a Settings object loaded from JSON, if a key is missing it will be replaced with the default value.
     *
     * @param data - The JSON object to load the Settings object from
     *
     * @return - The Settings object loaded from the JSON object
     */
    Settings.fromJSON = function (data) {
        var defaultSettings = new Settings();
        var settings = new Settings();
        settings.claimBlockHourlyPayment = data.claimBlockHourlyPayment || defaultSettings.claimBlockHourlyPayment;
        settings.startingClaimBlocks = data.startingClaimBlocks || defaultSettings.startingClaimBlocks;
        settings.claimMinimumWidth = data.claimMinimumWidth || defaultSettings.claimMinimumWidth;
        settings.disallowedBlocks = data.disallowedBlocks || defaultSettings.disallowedBlocks;
        return settings;
    };
    return Settings;
}());
// make sure settings exist
if (!world.getDynamicPropertyIds().includes("settings")) {
    world.setDynamicProperty("settings", JSON.stringify(new Settings()));
}
// load settings and make sure it contains necessary keys
var settings = Settings.fromJSON(JSON.parse(world.getDynamicProperty("settings").toString()));
// provide a function for saving the setttings
function saveSettings() {
    world.setDynamicProperty("settings", JSON.stringify(settings));
}
// MARK: load database ----------------------------------------------------------------------------------------------------------
var PermissionTypes;
(function (PermissionTypes) {
    PermissionTypes["ENTER_CLAIM"] = "enterClaim";
    PermissionTypes["BREAK_BLOCKS"] = "breakBlocks";
    PermissionTypes["USE_ITEMS_ON_BLOCKS"] = "useItemsOnBlocks";
    PermissionTypes["HURT_ENTITIES"] = "hurtEntities";
    PermissionTypes["USE_TNT"] = "useTNT";
    PermissionTypes["INTERACT_WITH_ENTITIES"] = "interactWithEntities";
    PermissionTypes["USE_DOORS"] = "useDoors";
    PermissionTypes["USE_SWITCHES"] = "useSwitches";
    PermissionTypes["OPEN_CONTAINERS"] = "openContainers";
    PermissionTypes["EDIT_SIGNS"] = "editSigns";
})(PermissionTypes || (PermissionTypes = {}));
/**
 * Represents a player's permissions in a claim.
 */
var PlayerPermissions = /** @class */ (function () {
    /**
     * Creates a new PlayerPermissions object
     *
     * @param id - The entity id of the player
     *
     * @param name - The name of the player
     */
    function PlayerPermissions(id, name) {
        this.id = id;
        this.name = name;
        this.permissions.enterClaim = true;
        this.permissions.breakBlocks = false;
        this.permissions.useItemsOnBlocks = false;
        this.permissions.hurtEntities = false;
        this.permissions.interactWithEntities = false;
        this.permissions.useDoors = true;
        this.permissions.useSwitches = true;
        this.permissions.openContainers = false;
        this.permissions.editSigns = false;
    }
    /**
     * Returns a PlayerPermissions object loaded from JSON, if a key is missing it will be replaced with the default value.
     *
     * @param data - The JSON object to load the PlayerPermissions object from
     *
     * @return - The PlayerPermissions object loaded from the JSON object
     */
    PlayerPermissions.fromJSON = function (data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        var defaultPermissions = new PlayerPermissions(data.id, data.name);
        return {
            id: data.id || defaultPermissions.id,
            name: data.name || defaultPermissions.name,
            permissions: {
                enterClaim: ((_a = data.permissions) === null || _a === void 0 ? void 0 : _a.enterClaim) !== undefined ? data.permissions.enterClaim : defaultPermissions.permissions.enterClaim,
                breakBlocks: ((_b = data.permissions) === null || _b === void 0 ? void 0 : _b.breakBlocks) !== undefined ? data.permissions.breakBlocks : defaultPermissions.permissions.breakBlocks,
                useItemsOnBlocks: ((_c = data.permissions) === null || _c === void 0 ? void 0 : _c.useItemsOnBlocks) !== undefined ? data.permissions.useItemsOnBlocks : defaultPermissions.permissions.useItemsOnBlocks,
                hurtEntities: ((_d = data.permissions) === null || _d === void 0 ? void 0 : _d.hurtEntities) !== undefined ? data.permissions.hurtEntities : defaultPermissions.permissions.hurtEntities,
                interactWithEntities: ((_e = data.permissions) === null || _e === void 0 ? void 0 : _e.interactWithEntities) !== undefined ? data.permissions.interactWithEntities : defaultPermissions.permissions.interactWithEntities,
                useDoors: ((_f = data.permissions) === null || _f === void 0 ? void 0 : _f.useDoors) !== undefined ? data.permissions.useDoors : defaultPermissions.permissions.useDoors,
                useSwitches: ((_g = data.permissions) === null || _g === void 0 ? void 0 : _g.useSwitches) !== undefined ? data.permissions.useSwitches : defaultPermissions.permissions.useSwitches,
                openContainers: ((_h = data.permissions) === null || _h === void 0 ? void 0 : _h.openContainers) !== undefined ? data.permissions.openContainers : defaultPermissions.permissions.openContainers,
                editSigns: ((_j = data.permissions) === null || _j === void 0 ? void 0 : _j.editSigns) !== undefined ? data.permissions.editSigns : defaultPermissions.permissions.editSigns
            }
        };
    };
    return PlayerPermissions;
}());
/**
 * Represents a land claim in the world.
 */
var Claim = /** @class */ (function () {
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
    function Claim(name, start, end, icon, particlesEnabled) {
        if (particlesEnabled === void 0) { particlesEnabled = true; }
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
            useTNT: false,
            interactWithEntities: false,
            useDoors: true,
            useSwitches: true,
            openContainers: false,
            editSigns: false
        };
    }
    /**
     * Returns a Claim object loaded from JSON, if a key is missing it will be replaced with the default value.
     *
     * @param data - The JSON object to load the Claim object from
     *
     * @return - The Claim object loaded from the JSON object
     */
    Claim.fromJSON = function (data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        var defaultClaim = new Claim("Undefined", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, "textures/ui/icon_recipe_nature.png");
        var claim = new Claim(data.name || defaultClaim.name, data.start || defaultClaim.start, data.end || defaultClaim.end, data.icon || defaultClaim.icon, data.particlesEnabled !== undefined ? data.particlesEnabled : defaultClaim.particlesEnabled);
        claim.publicPermissions = {
            enterClaim: ((_a = data.publicPermissions) === null || _a === void 0 ? void 0 : _a.enterClaim) !== undefined ? data.publicPermissions.enterClaim : defaultClaim.publicPermissions.enterClaim,
            breakBlocks: ((_b = data.publicPermissions) === null || _b === void 0 ? void 0 : _b.breakBlocks) !== undefined ? data.publicPermissions.breakBlocks : defaultClaim.publicPermissions.breakBlocks,
            useItemsOnBlocks: ((_c = data.publicPermissions) === null || _c === void 0 ? void 0 : _c.useItemsOnBlocks) !== undefined ? data.publicPermissions.useItemsOnBlocks : defaultClaim.publicPermissions.useItemsOnBlocks,
            hurtEntities: ((_d = data.publicPermissions) === null || _d === void 0 ? void 0 : _d.hurtEntities) !== undefined ? data.publicPermissions.hurtEntities : defaultClaim.publicPermissions.hurtEntities,
            useTNT: ((_e = data.publicPermissions) === null || _e === void 0 ? void 0 : _e.useTNT) !== undefined ? data.publicPermissions.useTNT : defaultClaim.publicPermissions.useTNT,
            interactWithEntities: ((_f = data.publicPermissions) === null || _f === void 0 ? void 0 : _f.interactWithEntities) !== undefined ? data.publicPermissions.interactWithEntities : defaultClaim.publicPermissions.interactWithEntities,
            useDoors: ((_g = data.publicPermissions) === null || _g === void 0 ? void 0 : _g.useDoors) !== undefined ? data.publicPermissions.useDoors : defaultClaim.publicPermissions.useDoors,
            useSwitches: ((_h = data.publicPermissions) === null || _h === void 0 ? void 0 : _h.useSwitches) !== undefined ? data.publicPermissions.useSwitches : defaultClaim.publicPermissions.useSwitches,
            openContainers: ((_j = data.publicPermissions) === null || _j === void 0 ? void 0 : _j.openContainers) !== undefined ? data.publicPermissions.openContainers : defaultClaim.publicPermissions.openContainers,
            editSigns: ((_k = data.publicPermissions) === null || _k === void 0 ? void 0 : _k.editSigns) !== undefined ? data.publicPermissions.editSigns : defaultClaim.publicPermissions.editSigns
        };
        claim.playerPermissionsList = data.playerPermissionsList ? data.playerPermissionsList.map(PlayerPermissions.fromJSON) : defaultClaim.playerPermissionsList;
        return claim;
    };
    /**
     * returns if a visitor has specified permissions
     *
     * @param permission - The type of permission to check for
     *
     * @param player - Optional; The player you would like to check the permission for
    */
    Claim.prototype.hasPermission = function (permission, player) {
        if (player === void 0) { player = undefined; }
        // check if player is in specific permissions list
        if (player != undefined) {
            var playerPermissions = undefined;
            // find the players permissions
            for (var _i = 0, _a = this.playerPermissionsList; _i < _a.length; _i++) {
                var p = _a[_i];
                if (p.id == player.id) {
                    playerPermissions = p;
                    break;
                }
            }
            if ((playerPermissions != undefined) && Object.keys(playerPermissions).includes(permission)) {
                return playerPermissions[permission];
            }
        }
        // if player specific permission is not found, default to claims global permissions list
        if (Object.keys(this.publicPermissions).includes(permission)) {
            return (this.publicPermissions[permission]);
        }
    };
    /**
     * returns if the specified area overlaps with the claim
     *
     * @param start - The block representing the first corner of the area
     *
     * @param end - The block representing the opposite second corner of the area
    */
    Claim.prototype.isOverlap = function (start, end) {
        // Get the left, right, bottom, and top coordinates of each rectangle
        var rect1Left = Math.min(this.start.x, this.end.x);
        var rect1Right = Math.max(this.start.x, this.end.x);
        var rect1Top = Math.max(this.start.z, this.end.z);
        var rect1Bottom = Math.min(this.start.z, this.end.z);
        var rect2Left = Math.min(start.x, end.x);
        var rect2Right = Math.max(start.x, end.x);
        var rect2Top = Math.max(start.z, end.z);
        var rect2Bottom = Math.min(start.z, end.z);
        // Check if there's no overlap on both x and y directions
        return !(rect1Right < rect2Left || rect2Right < rect1Left || rect1Top < rect2Bottom || rect2Top < rect1Bottom);
    };
    return Claim;
}());
var PlayerData = /** @class */ (function () {
    /**
     * Creates a new PlayerData object
     *
     * @param playerID - The entity id of the player
     *
     * @param playerName - The name of the player
     */
    function PlayerData(playerID, playerName) {
        this.schemaVersion = "1.0.0";
        this.id = playerID;
        this.name = playerName;
        this.inClaim = false;
        this.viewingClaim = false;
        this.resizingClaimName = "";
        this.firstPoint = { "x": 0, "y": 0, "z": 0 };
        this.oppositeCorner = { "x": 0, "y": 0, "z": 0 };
        this.entranceVelocity = { "x": 0, "y": 0, "z": 0 };
        this.claimBlocks = {
            amount: settings.startingClaimBlocks,
            paymentTimeRemaining: settings.claimBlockHourlyPayment
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
    PlayerData.fromJSON = function (data) {
        var _a, _b;
        var defaultPlayerData = new PlayerData(data.id, data.name);
        var playerData = new PlayerData(data.id, data.name);
        playerData.schemaVersion = data.schemaVersion || defaultPlayerData.schemaVersion;
        playerData.inClaim = data.inClaim !== undefined ? data.inClaim : defaultPlayerData.inClaim;
        playerData.viewingClaim = data.viewingClaim !== undefined ? data.viewingClaim : defaultPlayerData.viewingClaim;
        playerData.resizingClaimName = data.resizingClaimName || defaultPlayerData.resizingClaimName;
        playerData.firstPoint = data.firstPoint || defaultPlayerData.firstPoint;
        playerData.oppositeCorner = data.oppositeCorner || defaultPlayerData.oppositeCorner;
        playerData.entranceVelocity = data.entranceVelocity || defaultPlayerData.entranceVelocity;
        playerData.claimBlocks = {
            amount: ((_a = data.claimBlocks) === null || _a === void 0 ? void 0 : _a.amount) || defaultPlayerData.claimBlocks.amount,
            paymentTimeRemaining: ((_b = data.claimBlocks) === null || _b === void 0 ? void 0 : _b.paymentTimeRemaining) || defaultPlayerData.claimBlocks.paymentTimeRemaining,
        };
        playerData.claims = data.claims ? data.claims.map(Claim.fromJSON) : defaultPlayerData.claims;
        return playerData;
    };
    /**
     * Returns the requested claim
     *
     * @param claimName - The name of the claim to retrieve
     */
    PlayerData.prototype.getClaim = function (claimName) {
        for (var _i = 0, _a = this.claims; _i < _a.length; _i++) {
            var c = _a[_i];
            if (c.name == claimName) {
                return c;
            }
        }
    };
    return PlayerData;
}());
var database = [];
// compile database into a dict
for (var _i = 0, _a = world.getDynamicPropertyIds(); _i < _a.length; _i++) {
    var id = _a[_i];
    var property = world.getDynamicProperty(id);
    if (id.includes("db.")) {
        var parsedData = JSON.parse(property.toString());
        var validatedData = PlayerData.fromJSON(parsedData);
        database.push(validatedData);
    }
}
/**
 * Transfers the database from memory into long term storage using dynamic world properties
 */
function saveDb() {
    for (var _i = 0, database_1 = database; _i < database_1.length; _i++) {
        var playerData = database_1[_i];
        // deconstruct database to save each players data as an individual dynamic property
        world.setDynamicProperty("db.".concat(playerData.id), JSON.stringify(playerData));
    }
}
//----------------------------------------------------------------------------------------------------------------------------
function sendNotification(player, langEntry) {
    var rawText = [{ "translate": "chat.prefix" }, { "text": " " }];
    if (typeof langEntry == "string") {
        rawText.push({ "translate": "".concat(langEntry) });
    }
    else {
        for (var _i = 0, _a = langEntry.rawtext; _i < _a.length; _i++) {
            var segment = _a[_i];
            rawText.push(segment);
        }
    }
    player.runCommandAsync("tellraw @s {\"rawtext\":".concat(JSON.stringify(rawText), "}"));
}
/**
 * Runs the callback for every claim saved in the database
 *
 */
function runInAllClaims(callback) {
    for (var _i = 0, database_2 = database; _i < database_2.length; _i++) {
        var player = database_2[_i];
        var claims = player.claims;
        for (var _a = 0, claims_1 = claims; _a < claims_1.length; _a++) {
            var claim = claims_1[_a];
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
function getClosestPlayer(blockLocation) {
    var closestPlayer = undefined;
    var closestDistance = Number.MAX_VALUE;
    // find player closest to the specified block
    for (var _i = 0, _a = world.getAllPlayers(); _i < _a.length; _i++) {
        var p = _a[_i];
        if (p.dimension == world.getDimension("overworld")) {
            var distance = Math.sqrt(Math.pow(p.location.x - blockLocation.x, 2) +
                Math.pow(p.location.y - blockLocation.y, 2) +
                Math.pow(p.location.z - blockLocation.z, 2));
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
function getPlayerData(playerId) {
    for (var _i = 0, database_3 = database; _i < database_3.length; _i++) {
        var player = database_3[_i];
        if (playerId == player.id) {
            return player;
        }
    }
}
var Ui = /** @class */ (function () {
    function Ui() {
    }
    Ui.main = function (owner) {
        var _this = this;
        var playerData = getPlayerData(owner.id);
        var form = new ActionFormData()
            .title("ui.main:title")
            .body({
            "rawtext": [
                { "translate": "ui.main:body.paragraph:1" },
                { "text": "\n\n" },
                { "translate": "ui.main:body.paragraph:2" },
                { "text": "\n\n" },
                { "translate": "ui.main:body.paragraph:3" },
                { "text": "\n\n" },
                { "translate": "ui.main:body.paragraph:4" }, { "text": " \u00A7e".concat(playerData.claimBlocks.amount, "\u00A7r ") },
                { "text": "\n\n" },
                { "translate": "ui.main:body.paragraph:5-1" }, { "text": " \u00A7a+".concat(settings.claimBlockHourlyPayment, "\u00A7r ") }, { "translate": "ui.main:body.paragraph:5-2" }, { "text": " \u00A79".concat(playerData.claimBlocks.paymentTimeRemaining, "\u00A7r ") }, { "translate": "ui.main:body.paragraph:5-3" }
            ]
        })
            .button("ui.main.button:manage", "textures/ui/icon_setting.png")
            .button("ui.main.button:close");
        form.show(owner).then(function (response) {
            if (response.selection == 0) {
                if (playerData.claims.length == 0) {
                    sendNotification(owner, "chat.claim:no_claims");
                    owner.playSound("note.didgeridoo");
                }
                else {
                    _this.managePage(owner);
                }
            }
        });
    };
    Ui.newClaim = function (owner, start, end) {
        var playerData = getPlayerData(owner.id);
        var form = new ModalFormData()
            .title("ui.claim.new:title")
            .textField("ui.claim.config.textbox:name", "ui.claim.config:name_placeholder")
            .dropdown("ui.claim.config.dropdown:icon", Object.keys(claimIcons))
            .toggle("ui.claim.config.toggle:border_particles", true);
        form.show(owner).then(function (response) {
            if (!response.canceled) {
                var name_1 = response.formValues[0].toString();
                var iconPath = claimIcons[Object.keys(claimIcons)[response.formValues[1].toString()]];
                var showBorderParticles = response.formValues[2];
                var claimWidth = Math.abs(start.x - end.x) + 1;
                var claimLength = Math.abs(start.z - end.z) + 1;
                var isUniqueName = true;
                // names are used to identify claims, make sure player is using a unique name
                for (var _i = 0, _a = playerData.claims; _i < _a.length; _i++) {
                    var c = _a[_i];
                    if (c.name == name_1) {
                        isUniqueName = false;
                    }
                }
                if (name_1.length == 0) {
                    sendNotification(owner, "chat.claim:name_required");
                    owner.playSound("note.didgeridoo");
                }
                else if (!isUniqueName) {
                    sendNotification(owner, "chat.claim:use_unique_name");
                    owner.playSound("note.didgeridoo");
                }
                // passed all the checks, now make the claim
                else {
                    // subtract claim blocks
                    playerData.claimBlocks.amount -= (claimWidth * claimLength);
                    // create a new claim
                    playerData.claims.push(new Claim(name_1, start, end, iconPath, showBorderParticles));
                    sendNotification(owner, "chat.claim:created");
                    owner.playSound("random.levelup");
                }
            }
            saveDb();
        });
    };
    Ui.resizeClaim = function (owner, claim, start, end) {
        var playerData = getPlayerData(owner.id);
        var oldClaimWidth = Math.abs(claim.start.x - claim.end.x) + 1;
        var oldClaimLength = Math.abs(claim.start.z - claim.end.z) + 1;
        var newClaimWidth = Math.abs(start.x - end.x) + 1;
        var newClaimLength = Math.abs(start.z - end.z) + 1;
        var blockDifference = (oldClaimLength * oldClaimWidth) - (newClaimLength * newClaimWidth);
        var form = new MessageFormData()
            .title("ui.claim.resize:title")
            .body({
            "rawtext": [
                { "translate": "ui.claim.resize:body" },
                { "text": "\u00A7l\n\n".concat(blockDifference < 0 ? "§c-" : "§a+").concat(blockDifference, " ") },
                { "translate": "ui.manage.resize:label:claim_blocks" }
            ]
        })
            .button1("ui.claim.resize.button:cancel")
            .button2("ui.claim.resize.button:resize");
        form.show(owner).then(function (response) {
            // if claim resized
            if (response.selection == 1) {
                claim.start = start;
                claim.end = end;
                sendNotification(owner, "chat.claim:resized");
                owner.playSound("random.levelup");
                //add/subtract the blocks from players balance
                playerData.claimBlocks.amount += blockDifference;
                saveDb();
            }
        });
    };
    Ui.managePage = function (owner) {
        var _this = this;
        var playerData = getPlayerData(owner.id);
        var form = new ActionFormData()
            .title("ui.manage:title");
        for (var _i = 0, _a = playerData.claims; _i < _a.length; _i++) {
            var c = _a[_i];
            var claimWidth = Math.abs(c.start.x - c.end.x) + 1;
            var claimLength = Math.abs(c.start.z - c.end.z) + 1;
            form.button({
                "rawtext": [
                    { "text": "".concat(c.name, "\u00A7r\n\u00A7c").concat(claimWidth, "\u00A78x\u00A79").concat(claimLength, " ") }
                ]
            }, c.icon);
        }
        form.button("ui.global.button:back");
        form.show(owner).then(function (response) {
            if (response.selection == playerData.claims.length) {
                // return to previous menu
                _this.main(owner);
            }
            else {
                _this.manageClaim(owner, playerData.claims[response.selection]);
            }
        });
    };
    Ui.manageClaim = function (owner, claim) {
        var _this = this;
        var form = new ActionFormData()
            .title({
            "rawtext": [
                { "translate": "ui.manage:title" },
                { "text": ": ".concat(claim.name) }
            ]
        })
            .body({
            "rawtext": [
                { "text": "\n" },
                { "translate": "ui.manage.body:claim_start" },
                { "text": ":  \u00A7cX\u00A7r=".concat(claim.start.x, " \u00A79Z\u00A7r=").concat(claim.start.z, "\n\n") },
                { "translate": "ui.manage.body:claim_end" },
                { "text": ": \u00A7cX\u00A7r=".concat(claim.end.x, " \u00A79Z\u00A7r=").concat(claim.end.z, "\n ") }
            ]
        })
            .button("ui.manage.button:config", "textures/ui/debug_glyph_color.png")
            .button("ui.manage.button:public_permissions", "textures/ui/icon_multiplayer.png")
            .button("ui.manage.button:player_permissions", "textures/ui/icon_steve.png")
            .button("ui.manage.button:view", "textures/ui/magnifyingGlass.png")
            .button("ui.manage.button:remove", "textures/ui/icon_trash.png")
            .button("ui.global.button:back");
        form.show(owner).then(function (response) {
            if (response.selection == 0) {
                _this.claimConfig(owner, claim);
            }
            else if (response.selection == 1) {
                _this.managePermissions(owner, claim);
            }
            else if (response.selection == 2) {
                _this.playerPermissionsList(owner, claim);
            }
            else if (response.selection == 3) {
                _this.viewClaim(owner, claim);
            }
            else if (response.selection == 4) {
                _this.removeClaim(owner, claim);
            }
            else if (response.selection == 5) {
                // return to previous menu
                _this.managePage(owner);
            }
        });
    };
    Ui.playerPermissionsList = function (owner, claim) {
        var _this = this;
        var form = new ActionFormData()
            .title({
            "rawtext": [
                { "translate": "ui.manage.permissions.player.selection:title" },
                { "text": ": ".concat(claim.name) }
            ]
        })
            .body("ui.manage.permissions.player.selection:body");
        for (var _i = 0, _a = claim.playerPermissionsList; _i < _a.length; _i++) {
            var playerPermissions = _a[_i];
            form.button(playerPermissions.name, "textures/ui/profile_glyph_color.png");
        }
        form.button("ui.manage.permissions.player.selection:add_player", "textures/ui/realms_slot_check.png");
        form.button("ui.manage.permissions.player.selection:remove_player", "textures/ui/redX1.png");
        form.button("ui.global.button:back");
        form.show(owner).then(function (response) {
            if (response.selection == claim.playerPermissionsList.length) {
                // open add player menu
                _this.playerPermissionsListModify(owner, claim, true);
            }
            else if (response.selection == claim.playerPermissionsList.length + 1) {
                // open remove player menu
                _this.playerPermissionsListModify(owner, claim, false);
            }
            else if (response.selection == claim.playerPermissionsList.length + 2) {
                // return to previous menu
                _this.manageClaim(owner, claim);
            }
            else {
                // open player permissions menu
                _this.managePermissions(owner, claim, claim.playerPermissionsList[response.selection].name);
            }
        });
    };
    /**
     * Creates a prompt to specify what player to add or remove from permissions list
     *
     * @param owner - The player that ownes the claim
     *
     * @param claim - The claim that is being updated
     *
     * @param add - Wether to add or remove the selected player from the specific player permissions list
     */
    Ui.playerPermissionsListModify = function (owner, claim, add) {
        var _this = this;
        var players = [];
        // if adding player, only show players not in list
        if (add) {
            // get the entire list of players that have ever joined the world
            for (var _i = 0, database_4 = database; _i < database_4.length; _i++) {
                var playerData = database_4[_i];
                players.push(playerData.name);
            }
            // filter players from the list, we don't want to add people who are already in it
            for (var _a = 0, _b = claim.playerPermissionsList; _a < _b.length; _a++) {
                var playerPermissions = _b[_a];
                var index = players.indexOf(playerPermissions.name);
                players.splice(index, 1);
            }
            // make sure to remove owner from list as well
            players.splice(players.indexOf(owner.name), 1);
        }
        // if removing player, only show players in list
        else {
            for (var _c = 0, _d = claim.playerPermissionsList; _c < _d.length; _c++) {
                var playerPermissions = _d[_c];
                players.push(playerPermissions.name);
            }
        }
        // if no players are available to add or remove, notify the owner
        if (players.length == 0) {
            sendNotification(owner, "chat.claim:no_players");
            owner.playSound("note.didgeridoo");
            return;
        }
        var form = new ModalFormData()
            .title(add ? {
            "rawtext": [
                { "translate": "ui.manage.permissions.player.selection.modify.add:title" }
            ]
        } :
            {
                "rawtext": [
                    { "translate": "ui.manage.permissions.player.selection.modify.remove:title" }
                ]
            })
            .dropdown("ui.manage.permissions.player.selection.modify:player_dropdown", players);
        form.show(owner).then(function (response) {
            var playerName = players[Number(response.formValues[0])];
            if (add) {
                // set up default permissions for specified player
                var newPlayerPermissions = new PlayerPermissions(owner.id, owner.name);
                claim.playerPermissionsList.push(newPlayerPermissions);
            }
            else {
                // remove player from list
                var index = claim.playerPermissionsList.indexOf(playerName);
                claim.playerPermissionsList.splice(index, 1);
                // if a players permissions have been removed notify them
                for (var _i = 0, _a = world.getAllPlayers(); _i < _a.length; _i++) {
                    var p = _a[_i];
                    if (p.name == playerName) {
                        p.runCommandAsync("tellraw @s {\"rawtext\":[{\"translate\":\"chat.prefix\"}, {\"text\":\" ".concat(owner.name, " \"}, {\"translate\":\"chat.claim:player_permissions_reset_notif\"}, {\"translate\":\"claim:name_color\"}, {\"text\":\" ").concat(claim.name, "\"}]}"));
                        p.playSound("random.levelup");
                        break;
                    }
                }
            }
            saveDb();
            // return to previous menu
            _this.playerPermissionsList(owner, claim);
        });
    };
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
    Ui.managePermissions = function (owner, claim, playerID) {
        if (playerID) {
            for (var _i = 0, _a = claim.playerPermissionsList; _i < _a.length; _i++) {
                var p = _a[_i];
                if (p.id == playerID) {
                    var playerPermissions = p;
                    break;
                }
            }
        }
        var form = new ModalFormData()
            .title(playerID ? {
            "rawtext": [
                { "text": "".concat(playerPermissions.name) },
                { "translate": "ui.manage.permissions.player:title" },
                { "text": ": ".concat(claim.name) }
            ]
        } :
            {
                "rawtext": [
                    { "translate": "ui.manage.permissions.public:title" },
                    { "text": ": ".concat(claim.name) }
                ]
            })
            .toggle("ui.manage.permissions:enter_claim", playerID ? playerPermissions.permissions.enterClaim : claim.publicPermissions.enterClaim)
            .toggle("ui.manage.permissions:break_blocks", playerID ? playerPermissions.permissions.breakBlocks : claim.publicPermissions.breakBlocks)
            .toggle("ui.manage.permissions:use_items_on_blocks", playerID ? playerPermissions.permissions.useItemsOnBlocks : claim.publicPermissions.useItemsOnBlocks)
            .toggle("ui.manage.permissions:hurt_entities", playerID ? playerPermissions.permissions.hurtEntities : claim.publicPermissions.hurtEntities)
            .toggle("ui.manage.permissions:interact_with_entities", playerID ? playerPermissions.permissions.interactWithEntities : claim.publicPermissions.interactWithEntities)
            .toggle("ui.manage.permissions:use_doors", playerID ? playerPermissions.permissions.useDoors : claim.publicPermissions.useDoors)
            .toggle("ui.manage.permissions:use_switches", playerID ? playerPermissions.permissions.useSwitches : claim.publicPermissions.useSwitches)
            .toggle("ui.manage.permissions:open_containers", playerID ? playerPermissions.permissions.openContainers : claim.publicPermissions.openContainers)
            .toggle("ui.manage.permissions:edit_signs", playerID ? playerPermissions.permissions.editSigns : claim.publicPermissions.editSigns);
        if (!playerID) {
            form.toggle("ui.manage.permissions:use_tnt", claim.publicPermissions.useTNT);
        }
        form.show(owner).then(function (response) {
            if (!response.canceled) {
                // save data
                if (playerID) {
                    playerPermissions.permissions.enterClaim = response.formValues[0];
                    playerPermissions.permissions.breakBlocks = response.formValues[1];
                    playerPermissions.permissions.useItemsOnBlocks = response.formValues[2];
                    playerPermissions.permissions.hurtEntities = response.formValues[3];
                    playerPermissions.permissions.interactWithEntities = response.formValues[4];
                    playerPermissions.permissions.useDoors = response.formValues[5];
                    playerPermissions.permissions.useSwitches = response.formValues[6];
                    playerPermissions.permissions.editSigns = response.formValues[7];
                    playerPermissions.permissions.openContainers = response.formValues[8];
                }
                else {
                    claim.publicPermissions.enterClaim = response.formValues[0];
                    claim.publicPermissions.breakBlocks = response.formValues[1];
                    claim.publicPermissions.useItemsOnBlocks = response.formValues[2];
                    claim.publicPermissions.hurtEntities = response.formValues[3];
                    claim.publicPermissions.interactWithEntities = response.formValues[4];
                    claim.publicPermissions.useDoors = response.formValues[5];
                    claim.publicPermissions.useSwitches = response.formValues[6];
                    claim.publicPermissions.openContainers = response.formValues[7];
                    claim.publicPermissions.editSigns = response.formValues[8];
                    claim.publicPermissions.useTNT = response.formValues[9];
                }
                sendNotification(owner, "chat.claim:permissions_updated");
                owner.playSound("random.levelup");
                // if a players permissions have been updated notify them
                for (var _i = 0, _a = world.getAllPlayers(); _i < _a.length; _i++) {
                    var p = _a[_i];
                    if (p.id == playerID) {
                        p.runCommandAsync("tellraw @s {\"rawtext\":[{\"translate\":\"chat.prefix\"}, {\"text\":\" ".concat(owner.name, " \"}, {\"translate\":\"chat.claim:player_permissions_updated_notif\"}, {\"translate\":\"claim:name_color\"}, {\"text\":\" ").concat(claim.name, "\"}]}"));
                        p.playSound("random.levelup");
                        break;
                    }
                }
            }
            saveDb();
        });
    };
    /*
    Uses the camera command to circle around the specified claim.
    */
    Ui.viewClaim = function (owner, claim) {
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
            var transition = {
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
            };
            // load the claim
            owner.runCommandAsync("tickingarea add ".concat(claim.start.x, " ").concat(claim.start.y, " ").concat(claim.start.z, " ").concat(claim.end.x, " ").concat(claim.end.y, " ").concat(claim.end.z, " claimView"));
            // all 4 points of the claim
            var points = [
                [claim.start.x, claim.start.z],
                [claim.start.x, claim.end.z],
                [claim.end.x, claim.end.z],
                [claim.end.x, claim.start.z]
            ];
            // get the center most block of the claim to look at
            var centerBlock = {
                "x": (claim.start.x + claim.end.x) / 2,
                "y": (claim.start.y + claim.end.y) / 2,
                "z": (claim.start.z + claim.end.z) / 2
            };
            // find a reasonable height to position the camera at
            var width = Math.abs(claim.start.x - claim.end.x);
            var length = Math.abs(claim.start.z - claim.end.z);
            var height = Math.sqrt((Math.pow(width, 2)) + (Math.pow(length, 2))) / 2;
            // camera parameters
            var cornerView = {
                "facingLocation": centerBlock,
                "location": {
                    "x": points[3][0],
                    "y": centerBlock.y + height,
                    "z": points[3][1]
                }
            };
            // called recursively to cycle through all points
            var nextCorner_1 = function (index) {
                // the very first point should be set without a delay
                if (index == 0) {
                    var delay = 0;
                }
                else {
                    var delay = 60;
                }
                system.runTimeout(function () {
                    cornerView.easeOptions = {
                        "easeTime": 3,
                        "easeType": EasingType.InOutSine
                    };
                    cornerView.location.x = points[index][0];
                    cornerView.location.z = points[index][1];
                    owner.camera.setCamera("minecraft:free", cornerView);
                    // next corner
                    if (index < 3) {
                        nextCorner_1(index + 1);
                    }
                    // animation is over, return to first person
                    else {
                        system.runTimeout(function () {
                            transition.fadeTime.holdTime = 1;
                            owner.camera.fade(transition);
                            system.runTimeout(function () {
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
            system.runTimeout(function () {
                // show title to player
                owner.onScreenDisplay.setTitle({ "translate": "ui.manage.view:loading" });
                owner.camera.setCamera("minecraft:free", cornerView);
                system.runTimeout(function () {
                    nextCorner_1(0);
                }, 100);
            }, 20);
        }
        // player is not in the right dimension
        else {
            owner.playSound("note.didgeridoo");
            sendNotification(owner, "chat.claim:view");
        }
    };
    Ui.removeClaim = function (owner, claim) {
        var _this = this;
        var playerData = getPlayerData(owner.id);
        var claimWidth = Math.abs(claim.start.x - claim.end.x) + 1;
        var claimLength = Math.abs(claim.start.z - claim.end.z) + 1;
        var playerData = getPlayerData(owner.id);
        var form = new MessageFormData()
            .title("ui.manage.remove:title")
            .body({
            "rawtext": [
                { "translate": "ui.manage.remove:body" },
                { "text": "\u00A7l\n\n\u00A7a+".concat(claimWidth * claimLength, " ") },
                { "translate": "ui.manage.remove:label:claim_blocks" }
            ]
        })
            .button1("ui.manage.remove.button:cancel")
            .button2("ui.manage.remove.button:confirm");
        form.show(owner).then(function (response) {
            // if deletion canceled
            if (response.selection == 0) {
                // return to previous page on menu
                _this.manageClaim(owner, claim);
            }
            else if (response.selection == 1) {
                // delete claim
                playerData.claims = playerData.claims.filter(function (c) { return c !== claim; });
                sendNotification(owner, "chat.claim:removed");
                owner.playSound("mob.creeper.say");
                // add the claim blocks to the players balance
                playerData.claimBlocks.amount += claimWidth * claimLength;
                saveDb();
            }
        });
    };
    Ui.claimConfig = function (owner, claim) {
        var form = new ModalFormData()
            .title({
            "rawtext": [
                { "translate": "ui.manage.config:title" },
                { "text": ": ".concat(claim.name) }
            ]
        })
            .textField("ui.claim.config.textbox:name", "ui.claim.config:name_placeholder", claim.name)
            .dropdown("ui.claim.config.dropdown:icon", Object.keys(claimIcons), Object.values(claimIcons).indexOf(claim.icon))
            .toggle("ui.claim.config.toggle:border_particles", claim.particlesEnabled);
        form.show(owner).then(function (response) {
            if (!response.canceled) {
                var name = response.formValues[0].toString();
                var iconPath = claimIcons[Object.keys(claimIcons)[response.formValues[1].toString()]];
                var showBorderParticles = response.formValues[2];
                if (name.length == 0) {
                    sendNotification(owner, "chat.claim:name_required");
                    owner.playSound("note.didgeridoo");
                }
                else {
                    // update data
                    claim.name = name;
                    claim.icon = iconPath;
                    claim.particlesEnabled = showBorderParticles;
                    sendNotification(owner, "chat.claim:updated");
                    owner.playSound("note.cow_bell");
                }
            }
            saveDb();
        });
    };
    // player selected icons for their claims
    Ui.claimIcons = {
        // name: path
        "ui.claim.icons:land": "textures/ui/icon_recipe_nature.png",
        "ui.claim.icons:bed": "textures/ui/icon_recipe_item.png",
        "ui.claim.icons:farmland": "textures/ui/icon_new.png",
        "ui.claim.icons:weapons": "textures/ui/icon_recipe_equipment.png",
        "ui.claim.icons:flowers": "textures/ui/icon_spring.png"
    };
    return Ui;
}());
world.afterEvents.playerJoin.subscribe(function (data) {
    // verify player data is on file
    var playerFound = false;
    for (var _i = 0, database_5 = database; _i < database_5.length; _i++) {
        var p = database_5[_i];
        if (p.id == data.playerId) {
            // update player name in db to current; in case they changed it
            p.name = data.playerName;
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
world.afterEvents.playerSpawn.subscribe(function (data) {
    // make sure player has a claim shovel
    data.player.runCommandAsync("execute if entity @s[hasitem = { item=".concat(shovelID, ", quantity = 0}] run give @s ").concat(shovelID, " 1 0 { \"keep_on_death\": { }, \"item_lock\": { \"mode\": \"lock_in_inventory\" } } "));
    // set flag to false since all camera positions will be reset upon rejoining
    getPlayerData(data.player.id).viewingClaim = false;
});
// open menu when claim shovel is used
world.afterEvents.itemUse.subscribe(function (data) {
    if (data.itemStack.typeId == shovelID) {
        Ui.main(data.source);
    }
    ;
});
// disallow players from using items when viewing a claim
world.beforeEvents.itemUse.subscribe(function (data) {
    if (getPlayerData(data.source.id).viewingClaim) {
        data.cancel = true;
    }
});
// Set/adjust claim points if player is sneaking
world.beforeEvents.playerBreakBlock.subscribe(function (data) {
    var playerData = getPlayerData(data.player.id);
    // handle creating claims by setting first and second point
    if ((data.itemStack != undefined) && (data.itemStack.typeId == shovelID)) {
        // stop the shovel from breaking the block
        data.cancel = true;
        if (data.dimension == world.getDimension("overworld")) {
            // only allow if cooldown is over
            if (data.player.getItemCooldown("land_shovel_use") == 0) {
                // start shovel cooldown of 1 sec
                system.run(function () {
                    data.player.startItemCooldown("land_shovel_use", 20);
                });
                var isResize = false;
                if (!data.player.isSneaking) {
                    playerData.resizingClaimName = "";
                    playerData.firstPoint.x = data.block.x;
                    playerData.firstPoint.y = data.block.y;
                    playerData.firstPoint.z = data.block.z;
                    runInAllClaims(function (playerID, playerName, claim) {
                        // user defined start and end points of the claim
                        var s = claim.start;
                        var e = claim.end;
                        // all 4 points of the claim
                        var points = [
                            [[s.x, s.z], [s.x, e.z]],
                            [[e.x, s.z], [e.x, e.z]]
                        ];
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
                                playerData.oppositeCorner = { "x": points[aIndex ^ 1][bIndex ^ 1][0], "y": data.block.y, "z": points[aIndex ^ 1][bIndex ^ 1][1] };
                                playerData.resizingClaimName = claim.name;
                                data.player.sendMessage({
                                    "rawtext": [
                                        { "translate": "chat.prefix" },
                                        { "text": " " },
                                        { "translate": "chat.point.resize:selected" },
                                        { "text": ": [\u00A7c".concat(data.block.x, "\u00A7r, \u00A7a").concat(data.block.y, "\u00A7r, \u00A79").concat(data.block.z, "\u00A7r]\n") },
                                        { "translate": "chat.point.resize:hint" }
                                    ]
                                });
                                system.run(function () {
                                    data.player.playSound("note.banjo");
                                });
                            }
                            else {
                                sendNotification(data.player, "chat.point.resize:disallowed");
                                system.run(function () {
                                    data.player.playSound("note.didgeridoo");
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
                                { "text": ": [\u00A7c".concat(data.block.x, "\u00A7r, \u00A7a").concat(data.block.y, "\u00A7r, \u00A79").concat(data.block.z, "\u00A7r]\n") },
                                { "translate": "chat.point.new:hint" }
                            ]
                        });
                        system.run(function () {
                            data.player.playSound("note.cow_bell");
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
                        for (var _i = 0, _a = playerData.claims; _i < _a.length; _i++) {
                            var c = _a[_i];
                            if (c.name == playerData.resizingClaimName) {
                                var claim = c;
                                break;
                            }
                        }
                        var oldClaimWidth = Math.abs(claim.start.x - claim.end.x) + 1;
                        var oldClaimLength = Math.abs(claim.start.z - claim.end.z) + 1;
                        var newClaimWidth = Math.abs(playerData.oppositeCorner.x - secondPoint.x) + 1;
                        var newClaimLength = Math.abs(playerData.oppositeCorner.z - secondPoint.z) + 1;
                        var blockDifference = (newClaimLength * newClaimWidth) - (oldClaimLength * oldClaimWidth);
                        // make sure new claim isn't intersecting others not counting itself
                        runInAllClaims(function (playerID, playerName, claim) {
                            if (claim.isOverlap(playerData.firstPoint, secondPoint) && ((playerID != data.player.id) || (claim.name != playerData.resizingClaimName))) {
                                intersectingClaim = true;
                            }
                        });
                        // intersecting claim warning message, cancel resize
                        if (intersectingClaim) {
                            sendNotification(data.player, "chat.claim:intersecting");
                            system.run(function () {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // claim isn't wide enough warning message, cancel resize
                        else if (newClaimWidth < settings.claimMinimumWidth || newClaimLength < settings.claimMinimumWidth) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:width1" }, { "text": " ".concat(settings.claimMinimumWidth, " ") }, { "translate": "chat.claim:width2" }] });
                            system.run(function () {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // not enough claim blocks warning message, cancel resize
                        else if (playerData.claimBlocks.amount < blockDifference) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:blocks1" }, { "text": " ".concat((blockDifference) - playerData.claimBlocks.amount, " ") }, { "translate": "chat.claim:blocks3" }] });
                            system.run(function () {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // all requirements met, open the claim resizing ui
                        else {
                            system.run(function () {
                                data.player.playSound("note.cow_bell");
                                Ui.resizeClaim(data.player, claim, playerData.oppositeCorner, secondPoint);
                            });
                        }
                    }
                    // not resizing, create a new claim
                    else {
                        var claimWidth = Math.abs(playerData.firstPoint.x - secondPoint.x) + 1;
                        var claimLength = Math.abs(playerData.firstPoint.z - secondPoint.z) + 1;
                        // make sure new claim isn't intersecting others
                        runInAllClaims(function (playerID, playerName, claim) {
                            if (claim.isOverlap(playerData.firstPoint, secondPoint)) {
                                intersectingClaim = true;
                            }
                        });
                        // intersecting claim warning message, cancel creation
                        if (intersectingClaim) {
                            sendNotification(data.player, "chat.claim:intersecting");
                            system.run(function () {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // claim is not wide enough warning message, cancel creation
                        else if (claimWidth < settings.claimMinimumWidth || claimLength < settings.claimMinimumWidth) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:width1" }, { "text": " ".concat(settings.claimMinimumWidth, " ") }, { "translate": "chat.claim:width2" }] });
                            system.run(function () {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // not enough claim blocks warning message, cancel creation
                        else if (playerData.claimBlocks.amount < (claimWidth * claimLength)) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:blocks1" }, { "text": " ".concat((claimWidth * claimLength) - playerData.claimBlocks.amount, " ") }, { "translate": "chat.claim:blocks2" }] });
                            system.run(function () {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // all requirements are met, open the claim creation ui
                        else {
                            system.run(function () {
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
            system.run(function () {
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
            runInAllClaims(function (playerID, playerName, claim) {
                // check if a block is broken by a player without permissions within the claim
                if (claim.isOverlap(data.block, data.block) && (playerID != data.player.id) && !claim.hasPermission(PermissionTypes.BREAK_BLOCKS, data.player)) {
                    data.cancel = true;
                    system.run(function () {
                        sendNotification(data.player, "chat.claim.permission:break_blocks");
                        data.player.playSound("note.didgeridoo");
                    });
                }
            });
        }
    }
});
world.beforeEvents.explosion.subscribe(function (data) {
    if (data.dimension == world.getDimension("overworld")) {
        var impactedBlocks = data.getImpactedBlocks();
        // find player closest to the explosion, we'll assume this is the player that placed the tnt
        var closestPlayer = getClosestPlayer(data.source.location);
        // flag to send notification
        var sendDisallowedNotification = false;
        // check if tnt blast effects a claim
        runInAllClaims(function (playerID, playerName, claim) {
            // if entity is a mob or player that doesn't have permissions
            if ((data.source.typeId != "minecraft:tnt") || !claim.hasPermission(PermissionTypes.USE_TNT)) {
                // remove all impacted blocks that lie within the claim
                for (var i = 0; i < impactedBlocks.length; i++) {
                    var block = impactedBlocks[i];
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
            system.run(function () {
                sendNotification(closestPlayer, "chat.claim.permission:use_tnt");
                closestPlayer.playSound("note.didgeridoo");
            });
        }
    }
});
// stop pistons from interacting with claims on the outside
world.afterEvents.pistonActivate.subscribe(function (data) {
    if (data.dimension == world.getDimension("overworld") && (data.piston.getAttachedBlocks().length > 0)) {
        var b = data.piston.getAttachedBlocks()[0];
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
        for (var _i = 0, _a = data.piston.getAttachedBlocks(); _i < _a.length; _i++) {
            var block = _a[_i];
            if (data.isExpanding) {
                var b = block.offset(directionOffset);
            }
            runInAllClaims(function (playerID, claimName, claim) {
                // if block is in claim but not piston
                if (claim.isOverlap(b.location, b.location) && !claim.isOverlap(data.piston.block.location, data.piston.block.location)) {
                    allowed = false;
                }
            });
        }
        // if attached block is in a claim but pistion is not, disallow the action
        if (!allowed) {
            for (var _b = 0, _c = data.piston.getAttachedBlocks().reverse(); _b < _c.length; _b++) {
                var block = _c[_b];
                data.dimension.runCommand("clone ".concat(block.x + directionOffset.x, " ").concat(block.y + directionOffset.y, " ").concat(block.z + directionOffset.z, " ").concat(block.x + directionOffset.x, " ").concat(block.y + directionOffset.y, " ").concat(block.z + directionOffset.z, " ").concat(block.x, " ").concat(block.y, " ").concat(block.z, " replace move"));
            }
            // remove the offending piston
            data.dimension.runCommand("setblock ".concat(data.piston.block.location.x, " ").concat(data.piston.block.location.y, " ").concat(data.piston.block.location.z, " air"));
            // drop the piston item
            var pistonDrop = new ItemStack(data.piston.typeId);
            data.dimension.spawnItem(pistonDrop, data.block.location);
            // get closest player to piston, we will assume they activated it
            var closestPlayer = getClosestPlayer(data.piston.block.location);
            // notify player
            system.run(function () {
                sendNotification(closestPlayer, "chat.claim:piston");
                closestPlayer.playSound("note.didgeridoo");
            });
        }
    }
});
world.beforeEvents.itemUse.subscribe(function (data) {
    // disallowed items that could cause harm to an entity
    var disallowedItems = ["minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:bow", "minecraft:crossbow"];
    if (disallowedItems.includes(data.itemStack.typeId) && (data.source.dimension == world.getDimension("overworld"))) {
        runInAllClaims(function (playerID, playerName, claim) {
            // if player has used the disallowed item in a claim
            if (claim.isOverlap(data.source.location, data.source.location) && (playerID != data.source.id) && !claim.hasPermission(PermissionTypes.HURT_ENTITIES, data.source)) {
                // cancel the action
                data.cancel = true;
                // notify player they don't have permissions
                system.run(function () {
                    sendNotification(data.source, "chat.claim.permission:hurt_entities");
                    data.source.playSound("note.didgeridoo");
                });
            }
        });
    }
});
world.beforeEvents.playerInteractWithEntity.subscribe(function (data) {
    if (data.target.dimension == world.getDimension("overworld")) {
        runInAllClaims(function (playerID, playerName, claim) {
            // if player has interacted with an entity in a claim
            if (claim.isOverlap(data.target.location, data.target.location) && (playerID != data.player.id) && !claim.hasPermission(PermissionTypes.INTERACT_WITH_ENTITIES, data.player)) {
                // cancel the action
                data.cancel = true;
                // notify player they don't have permissions
                system.run(function () {
                    sendNotification(data.player, "chat.claim.permission:interact_with_entities");
                    data.player.playSound("note.didgeridoo");
                });
            }
        });
    }
});
world.beforeEvents.playerInteractWithBlock.subscribe(function (data) {
    // blocks that are disabled by admin; can't be placed
    if (data.itemStack && settings.disallowedBlocks.includes(data.itemStack.typeId)) {
        // notify player
        sendNotification(data.player, "chat.world:disabled_item");
        system.run(function () {
            data.player.playSound("note.didgeridoo");
        });
        data.cancel = true;
    }
    // we can't detect where a block is placed so we must figure that out based on the face of the used on block
    var faces = {
        "North": data.block.north(1),
        "East": data.block.east(1),
        "South": data.block.south(1),
        "West": data.block.west(1),
        "Up": data.block.above(1),
        "Down": data.block.below(1)
    };
    var placedBlock = faces[data.blockFace];
    // disable input when viewing a claim
    if (getPlayerData(data.player.id).viewingClaim) {
        data.cancel = true;
    }
    if (data.block.dimension == world.getDimension("overworld")) {
        runInAllClaims(function (playerID, playerName, claim) {
            var _a;
            // only check for permissions if player is not the owner
            if (playerID != data.player.id) {
                // door interaction permissions
                if (claim.isOverlap(data.block.location, data.block.location) && data.block.typeId.includes("door") && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_DOORS, data.player)) {
                        // cancel the action
                        data.cancel = true;
                        // notify player they don't have permissions
                        system.run(function () {
                            sendNotification(data.player, "chat.claim.permission:use_doors");
                            data.player.playSound("note.didgeridoo");
                        });
                    }
                }
                // lever/button interaction permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && (data.block.matches("minecraft:lever") || data.block.typeId.includes("button")) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_SWITCHES, data.player)) {
                        // cancel the action
                        data.cancel = true;
                        // notify player they don't have permissions
                        system.run(function () {
                            sendNotification(data.player, "chat.claim.permission:use_switches");
                            data.player.playSound("note.didgeridoo");
                        });
                    }
                }
                // opening chests/container permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.getComponent(BlockComponentTypes.Inventory) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.OPEN_CONTAINERS, data.player)) {
                        // cancel the action
                        data.cancel = true;
                        // notify player they don't have permissions
                        system.run(function () {
                            sendNotification(data.player, "chat.claim.permission:open_containers");
                            data.player.playSound("note.didgeridoo");
                        });
                    }
                }
                // editing signs permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.getComponent(BlockComponentTypes.Sign) && !data.player.isSneaking && !((_a = data.itemStack) === null || _a === void 0 ? void 0 : _a.matches("minecraft:honeycomb"))) {
                    if (!claim.hasPermission(PermissionTypes.EDIT_SIGNS, data.player)) {
                        // cancel the action
                        data.cancel = true;
                        // notify player they don't have permissions
                        system.run(function () {
                            sendNotification(data.player, "chat.claim.permission:edit_signs");
                            data.player.playSound("note.didgeridoo");
                        });
                    }
                }
                // block placing/using items on blocks permissions
                else if ((claim.isOverlap(data.block, data.block) || claim.isOverlap(placedBlock, placedBlock)) && data.itemStack && !data.itemStack.matches(shovelID)) {
                    if (!claim.hasPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, data.player)) {
                        // cancel the action
                        data.cancel = true;
                        // notify player they don't have permissions
                        system.run(function () {
                            sendNotification(data.player, "chat.claim.permission:use_item_on_block");
                            data.player.playSound("note.didgeridoo");
                        });
                    }
                }
            }
        });
    }
});
// player management in claims, runs every 1/20th of a second
system.runInterval(function () {
    // make sure fire charges can't fly into claims
    // also make sure withers can't fly into claim
    for (var _i = 0, _a = world.getDimension("overworld").getEntities(); _i < _a.length; _i++) {
        var e = _a[_i];
        runInAllClaims(function (playerID, playerName, claim) {
            if (claim.isOverlap(e.location, e.location)) {
                if (e.typeId == "minecraft:small_fireball" || e.typeId == "minecraft:wither") {
                    e.remove();
                }
            }
        });
    }
    for (var _b = 0, _c = world.getAllPlayers(); _b < _c.length; _b++) {
        var p = _c[_b];
        var playerData = getPlayerData(p.id);
        // only run if player is in overworld
        if (p.dimension == world.getDimension("overworld")) {
            // capture the state of player attribute "in-claim" before it is updated
            var inClaimOld = playerData.inClaim;
            // set flag to false before for loop updates it
            playerData.inClaim = false;
            runInAllClaims(function (playerID, playerName, claim) {
                // apply an offset to the player location to be more accurate with claim bounds
                var location = { "x": p.location.x - 0.5, "y": p.location.y - 0.5, "z": p.location.z - 0.5 };
                // if player is in the claim
                if (claim.isOverlap(location, location)) {
                    playerData.inClaim = true;
                    // make sure player can't hurt entities if they don't have permission
                    if ((playerID != p.id) && !claim.hasPermission(PermissionTypes.HURT_ENTITIES, p)) {
                        p.addEffect("weakness", 40, { "amplifier": 255, "showParticles": false });
                    }
                    if (!playerData.viewingClaim) {
                        // show claim name and owner onscreen
                        p.onScreenDisplay.setActionBar({
                            "rawtext": [
                                { "translate": "claim:name_color" },
                                { "text": "".concat(claim.name, "\u00A7r - ").concat(playerName) },
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
                        var velocity = playerData.entranceVelocity;
                        // if player is riding an entity eject them
                        if (p.hasComponent(EntityRidingComponent.componentId)) {
                            var ridingComponent = p.getComponent(EntityRidingComponent.componentId);
                            var riddenComponent = ridingComponent.entityRidingOn.getComponent(EntityRideableComponent.componentId);
                            riddenComponent.ejectRider(p);
                        }
                        p.applyKnockback(-velocity.x, -velocity.z, 3, 0.5);
                        p.addEffect("wither", 40);
                    }
                }
            });
            // player has entered claim
            if (!inClaimOld && playerData.inClaim) {
                // play entrance sound
                p.playSound("random.door_open");
            }
            // player has exited the claim
            else if (inClaimOld && !playerData.inClaim) {
                // play exit sound
                p.playSound("random.door_close");
            }
        }
        // player is not in overworld
        else {
            playerData.inClaim = false;
        }
    }
}, 1);
// renders claim particles every 1 second
system.runInterval(function () {
    var dimension = world.getDimension("overworld");
    runInAllClaims(function (playerID, playerName, claim) {
        // user defined start and end points of the claim
        var s = claim.start;
        var e = claim.end;
        // all 4 points of the claim
        var points = [
            [[s.x, s.z], [s.x, e.z]],
            [[e.x, s.z], [e.x, e.z]]
        ];
        var averageY = (s.y + e.y) / 2;
        var numSegments = 3; // the number of border particle segments to generate above and below the average y level
        var segmentHeight = 10;
        var averageOffset = (segmentHeight * numSegments);
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
                            var particlePoint = { "x": points[a][b][0] + 0.5, "y": i + 0.5, "z": points[a][b][1] + 0.5 };
                            try {
                                dimension.spawnParticle(xParticleType, particlePoint);
                                dimension.spawnParticle(yParticleType, particlePoint);
                                dimension.spawnParticle("lca:rising_claim_dust", particlePoint);
                                dimension.spawnParticle("lca:falling_claim_dust", particlePoint);
                            }
                            catch (_a) {
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
system.runInterval(function () {
    for (var _i = 0, _a = world.getAllPlayers(); _i < _a.length; _i++) {
        var p = _a[_i];
        var playerData = getPlayerData(p.id);
        // decrement timer by 1
        playerData.claimBlocks.paymentTimeRemaining -= 1;
        // if time is up reward blocks and reset timer
        if (playerData.claimBlocks.paymentTimeRemaining <= 0) {
            playerData.claimBlocks.amount += settings.claimBlockHourlyPayment;
            sendNotification(p, {
                "rawtext": [
                    { "translate": "chat.blocks:payment1" },
                    { "text": " ".concat(settings.claimBlockHourlyPayment, " ") },
                    { "translate": "chat.blocks:payment2" }
                ]
            });
            p.playSound("random.levelup");
            playerData.claimBlocks.paymentTimeRemaining = 60;
        }
    }
    saveDb();
}, 1200);
//# sourceMappingURL=main.js.map
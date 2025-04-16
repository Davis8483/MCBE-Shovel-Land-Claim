var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var e_1, _a;
import { world } from "@minecraft/server";
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
export { Settings };
// make sure settings exist
if (!world.getDynamicPropertyIds().includes("settings")) {
    world.setDynamicProperty("settings", JSON.stringify(new Settings()));
}
// load settings and make sure it contains necessary keys
export var settings = Settings.fromJSON(JSON.parse(world.getDynamicProperty("settings").toString()));
// provide a function for saving the setttings
function saveSettings() {
    world.setDynamicProperty("settings", JSON.stringify(settings));
}
// MARK: load database ----------------------------------------------------------------------------------------------------------
export var PermissionTypes;
(function (PermissionTypes) {
    PermissionTypes["ENTER_CLAIM"] = "enterClaim";
    PermissionTypes["BREAK_BLOCKS"] = "breakBlocks";
    PermissionTypes["USE_ITEMS_ON_BLOCKS"] = "useItemsOnBlocks";
    PermissionTypes["HURT_ENTITIES"] = "hurtEntities";
    PermissionTypes["USE_TNT"] = "useTNT";
    PermissionTypes["INTERACT_WITH_ENTITIES"] = "interactWithEntities";
    PermissionTypes["USE_DOORS"] = "useDoors";
    PermissionTypes["USE_SWITCHES"] = "useSwitches";
    PermissionTypes["USE_BEDS"] = "useBeds";
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
        var _a;
        this._id = id;
        this._name = name;
        this._permissions = (_a = {},
            _a[PermissionTypes.ENTER_CLAIM] = true,
            _a[PermissionTypes.BREAK_BLOCKS] = false,
            _a[PermissionTypes.USE_ITEMS_ON_BLOCKS] = false,
            _a[PermissionTypes.HURT_ENTITIES] = false,
            _a[PermissionTypes.INTERACT_WITH_ENTITIES] = false,
            _a[PermissionTypes.USE_DOORS] = true,
            _a[PermissionTypes.USE_SWITCHES] = true,
            _a[PermissionTypes.USE_BEDS] = false,
            _a[PermissionTypes.OPEN_CONTAINERS] = false,
            _a[PermissionTypes.EDIT_SIGNS] = false,
            _a);
    }
    Object.defineProperty(PlayerPermissions.prototype, "id", {
        get: function () {
            return this._id;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerPermissions.prototype, "name", {
        get: function () {
            return this._name;
        },
        enumerable: false,
        configurable: true
    });
    PlayerPermissions.prototype.getPermission = function (permission) {
        // check if the permission is valid
        if (this._permissions[permission] != undefined) {
            return this._permissions[permission];
        }
        else {
            console.log("Invalid permission: ".concat(permission, " for player: ").concat(this._name));
            return false;
        }
    };
    PlayerPermissions.prototype.setPermission = function (permission, value) {
        // check if the permission is valid
        if (this._permissions[permission] != undefined) {
            this._permissions[permission] = value;
        }
        else {
            console.log("Invalid permission: ".concat(permission, " for player: ").concat(this._name));
        }
        saveDb();
    };
    /**
     * Returns a PlayerPermissions object loaded from JSON, if a key is missing it will be replaced with the default value.
     *
     * @param data - The JSON object to load the PlayerPermissions object from
     *
     * @return - The PlayerPermissions object loaded from the JSON object
     */
    PlayerPermissions.fromJSON = function (data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        var defaultPermissions = new PlayerPermissions(data._id, data._name);
        var permissions = new PlayerPermissions(data._id, data._name);
        permissions.setPermission(PermissionTypes.ENTER_CLAIM, ((_a = data._permissions) === null || _a === void 0 ? void 0 : _a.enterClaim) !== undefined ? data._permissions.enterClaim : defaultPermissions.getPermission(PermissionTypes.ENTER_CLAIM));
        permissions.setPermission(PermissionTypes.BREAK_BLOCKS, ((_b = data._permissions) === null || _b === void 0 ? void 0 : _b.breakBlocks) !== undefined ? data._permissions.breakBlocks : defaultPermissions.getPermission(PermissionTypes.BREAK_BLOCKS));
        permissions.setPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, ((_c = data._permissions) === null || _c === void 0 ? void 0 : _c.useItemsOnBlocks) !== undefined ? data._permissions.useItemsOnBlocks : defaultPermissions.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS));
        permissions.setPermission(PermissionTypes.HURT_ENTITIES, ((_d = data._permissions) === null || _d === void 0 ? void 0 : _d.hurtEntities) !== undefined ? data._permissions.hurtEntities : defaultPermissions.getPermission(PermissionTypes.HURT_ENTITIES));
        permissions.setPermission(PermissionTypes.INTERACT_WITH_ENTITIES, ((_e = data._permissions) === null || _e === void 0 ? void 0 : _e.interactWithEntities) !== undefined ? data._permissions.interactWithEntities : defaultPermissions.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES));
        permissions.setPermission(PermissionTypes.USE_DOORS, ((_f = data._permissions) === null || _f === void 0 ? void 0 : _f.useDoors) !== undefined ? data._permissions.useDoors : defaultPermissions.getPermission(PermissionTypes.USE_DOORS));
        permissions.setPermission(PermissionTypes.USE_SWITCHES, ((_g = data._permissions) === null || _g === void 0 ? void 0 : _g.useSwitches) !== undefined ? data._permissions.useSwitches : defaultPermissions.getPermission(PermissionTypes.USE_SWITCHES));
        permissions.setPermission(PermissionTypes.USE_BEDS, ((_h = data._permissions) === null || _h === void 0 ? void 0 : _h.useBeds) !== undefined ? data._permissions.useBeds : defaultPermissions.getPermission(PermissionTypes.USE_BEDS));
        permissions.setPermission(PermissionTypes.OPEN_CONTAINERS, ((_j = data._permissions) === null || _j === void 0 ? void 0 : _j.openContainers) !== undefined ? data._permissions.openContainers : defaultPermissions.getPermission(PermissionTypes.OPEN_CONTAINERS));
        permissions.setPermission(PermissionTypes.EDIT_SIGNS, ((_k = data._permissions) === null || _k === void 0 ? void 0 : _k.editSigns) !== undefined ? data._permissions.editSigns : defaultPermissions.getPermission(PermissionTypes.EDIT_SIGNS));
        return permissions;
    };
    return PlayerPermissions;
}());
export { PlayerPermissions };
/**
 * Represents a land claim in the world.
 */
var Claim = /** @class */ (function () {
    function Claim(name, start, end, icon, particlesEnabled) {
        var _a;
        if (particlesEnabled === void 0) { particlesEnabled = true; }
        this._name = name;
        this._start = start;
        this._end = end;
        this._icon = icon;
        this._particlesEnabled = particlesEnabled;
        this._playerPermissionsList = [];
        this._publicPermissions = (_a = {},
            _a[PermissionTypes.ENTER_CLAIM] = true,
            _a[PermissionTypes.BREAK_BLOCKS] = false,
            _a[PermissionTypes.USE_ITEMS_ON_BLOCKS] = false,
            _a[PermissionTypes.HURT_ENTITIES] = false,
            _a[PermissionTypes.USE_TNT] = false,
            _a[PermissionTypes.INTERACT_WITH_ENTITIES] = false,
            _a[PermissionTypes.USE_DOORS] = true,
            _a[PermissionTypes.USE_SWITCHES] = true,
            _a[PermissionTypes.USE_BEDS] = false,
            _a[PermissionTypes.OPEN_CONTAINERS] = false,
            _a[PermissionTypes.EDIT_SIGNS] = false,
            _a);
    }
    Object.defineProperty(Claim.prototype, "name", {
        // Getters
        get: function () {
            return this._name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Claim.prototype, "start", {
        get: function () {
            return this._start;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Claim.prototype, "end", {
        get: function () {
            return this._end;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Claim.prototype, "icon", {
        get: function () {
            return this._icon;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Claim.prototype, "particlesEnabled", {
        get: function () {
            return this._particlesEnabled;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Claim.prototype, "playerPermissionsList", {
        get: function () {
            return this._playerPermissionsList;
        },
        enumerable: false,
        configurable: true
    });
    // Get a specific public permission
    Claim.prototype.getPermission = function (permission) {
        // check if the permission is valid
        if (this._publicPermissions[permission] != undefined) {
            return this._publicPermissions[permission];
        }
        else {
            console.log("Invalid permission: ".concat(permission, " for claim ").concat(this._name));
            return false;
        }
    };
    // Set a specific public permission
    Claim.prototype.setPermission = function (permission, value) {
        // check if the permission is valid
        if (this._publicPermissions[permission] != undefined) {
            this._publicPermissions[permission] = value;
        }
        else {
            console.log("Invalid permission: ".concat(permission, " for claim ").concat(this._name));
        }
        saveDb();
    };
    // Setters
    Claim.prototype.setName = function (value) {
        this._name = value;
        saveDb();
    };
    Claim.prototype.setStart = function (value) {
        this._start = value;
        saveDb();
    };
    Claim.prototype.setEnd = function (value) {
        this._end = value;
        saveDb();
    };
    Claim.prototype.setIcon = function (value) {
        this._icon = value;
        saveDb();
    };
    Claim.prototype.setParticlesEnabled = function (value) {
        this._particlesEnabled = value;
        saveDb();
    };
    Claim.prototype.addPlayerPermissions = function (playerPermissions) {
        this._playerPermissionsList.push(playerPermissions);
        saveDb();
    };
    Claim.prototype.removePlayerPermissions = function (index) {
        this._playerPermissionsList.splice(index, 1);
        saveDb();
    };
    Claim.prototype.getSize = function () {
        var width = Math.abs(this._start.x - this._end.x) + 1;
        var length = Math.abs(this._start.z - this._end.z) + 1;
        var area = width * length;
        return { width: width, length: length, area: area };
    };
    /**
     * Returns a Claim object loaded from JSON, if a key is missing it will be replaced with the default value.
     * Claim name is required, if it is not found it will be replaced with "Undefined" and should be removed by the caller.
     *
     * @param data - The JSON object to load the Claim object from
     *
     * @return - The Claim object loaded from the JSON object
     */
    Claim.fromJSON = function (data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        var defaultClaim = new Claim("Undefined", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, "textures/ui/icon_recipe_nature.png");
        var claim = new Claim(data._name || defaultClaim.name, data._start || defaultClaim.start, data._end || defaultClaim.end, data._icon || defaultClaim.icon, data._particlesEnabled !== undefined ? data._particlesEnabled : defaultClaim.particlesEnabled);
        claim._publicPermissions = {
            enterClaim: ((_a = data._publicPermissions) === null || _a === void 0 ? void 0 : _a.enterClaim) !== undefined ? data._publicPermissions.enterClaim : defaultClaim.getPermission(PermissionTypes.ENTER_CLAIM),
            breakBlocks: ((_b = data._publicPermissions) === null || _b === void 0 ? void 0 : _b.breakBlocks) !== undefined ? data._publicPermissions.breakBlocks : defaultClaim.getPermission(PermissionTypes.BREAK_BLOCKS),
            useItemsOnBlocks: ((_c = data._publicPermissions) === null || _c === void 0 ? void 0 : _c.useItemsOnBlocks) !== undefined ? data._publicPermissions.useItemsOnBlocks : defaultClaim.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS),
            hurtEntities: ((_d = data._publicPermissions) === null || _d === void 0 ? void 0 : _d.hurtEntities) !== undefined ? data._publicPermissions.hurtEntities : defaultClaim.getPermission(PermissionTypes.HURT_ENTITIES),
            useTNT: ((_e = data._publicPermissions) === null || _e === void 0 ? void 0 : _e.useTNT) !== undefined ? data._publicPermissions.useTNT : defaultClaim.getPermission(PermissionTypes.USE_TNT),
            interactWithEntities: ((_f = data._publicPermissions) === null || _f === void 0 ? void 0 : _f.interactWithEntities) !== undefined ? data._publicPermissions.interactWithEntities : defaultClaim.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES),
            useDoors: ((_g = data._publicPermissions) === null || _g === void 0 ? void 0 : _g.useDoors) !== undefined ? data._publicPermissions.useDoors : defaultClaim.getPermission(PermissionTypes.USE_DOORS),
            useSwitches: ((_h = data._publicPermissions) === null || _h === void 0 ? void 0 : _h.useSwitches) !== undefined ? data._publicPermissions.useSwitches : defaultClaim.getPermission(PermissionTypes.USE_SWITCHES),
            useBeds: ((_j = data._publicPermissions) === null || _j === void 0 ? void 0 : _j.useBeds) !== undefined ? data._publicPermissions.useBeds : defaultClaim.getPermission(PermissionTypes.USE_BEDS),
            openContainers: ((_k = data._publicPermissions) === null || _k === void 0 ? void 0 : _k.openContainers) !== undefined ? data._publicPermissions.openContainers : defaultClaim.getPermission(PermissionTypes.OPEN_CONTAINERS),
            editSigns: ((_l = data._publicPermissions) === null || _l === void 0 ? void 0 : _l.editSigns) !== undefined ? data._publicPermissions.editSigns : defaultClaim.getPermission(PermissionTypes.EDIT_SIGNS)
        };
        claim._playerPermissionsList = data._playerPermissionsList
            ? data._playerPermissionsList
                .map(PlayerPermissions.fromJSON)
                .filter(function (permission) { return permission.id !== undefined && permission.name !== undefined; })
            : defaultClaim.playerPermissionsList;
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
        var e_2, _a;
        // check if player is in specific permissions list
        if (player) {
            var playerPermissions = undefined;
            try {
                // find the players permissions
                for (var _b = __values(this._playerPermissionsList), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var p = _c.value;
                    if (p.id == player.id) {
                        playerPermissions = p;
                        break;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        // if player is not in the list, use public permissions
        return playerPermissions ? playerPermissions.getPermission(permission) : this._publicPermissions[permission];
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
        var rect1Left = Math.min(this._start.x, this._end.x);
        var rect1Right = Math.max(this._start.x, this._end.x);
        var rect1Top = Math.max(this._start.z, this._end.z);
        var rect1Bottom = Math.min(this._start.z, this._end.z);
        var rect2Left = Math.min(start.x, end.x);
        var rect2Right = Math.max(start.x, end.x);
        var rect2Top = Math.max(start.z, end.z);
        var rect2Bottom = Math.min(start.z, end.z);
        // Check if there's no overlap on both x and y directions
        return !(rect1Right < rect2Left || rect2Right < rect1Left || rect1Top < rect2Bottom || rect2Top < rect1Bottom);
    };
    return Claim;
}());
export { Claim };
var PlayerClaimBlocks = /** @class */ (function () {
    function PlayerClaimBlocks(amount, paymentTimeRemaining) {
        this._amount = amount;
        this._paymentTimeRemaining = paymentTimeRemaining;
    }
    Object.defineProperty(PlayerClaimBlocks.prototype, "amount", {
        // Getters
        get: function () {
            return this._amount;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerClaimBlocks.prototype, "paymentTimeRemaining", {
        get: function () {
            return this._paymentTimeRemaining;
        },
        enumerable: false,
        configurable: true
    });
    // Setters
    PlayerClaimBlocks.prototype.setAmount = function (newAmount) {
        this._amount = newAmount;
        saveDb();
    };
    // Utility methods
    PlayerClaimBlocks.prototype.incrementAmount = function (value) {
        this._amount += value;
        saveDb();
    };
    PlayerClaimBlocks.prototype.decrementAmount = function (value) {
        this._amount -= value;
        saveDb();
    };
    PlayerClaimBlocks.prototype.decrementPaymentTime = function () {
        this._paymentTimeRemaining -= 1;
        saveDb();
    };
    PlayerClaimBlocks.prototype.resetPaymentTime = function () {
        this._paymentTimeRemaining = settings.claimBlockHourlyPayment;
        saveDb();
    };
    PlayerClaimBlocks.fromJSON = function (data) {
        return new PlayerClaimBlocks(data._amount || settings.startingClaimBlocks, data._paymentTimeRemaining || settings.claimBlockHourlyPayment);
    };
    return PlayerClaimBlocks;
}());
export { PlayerClaimBlocks };
var PlayerData = /** @class */ (function () {
    function PlayerData(playerID, playerName) {
        this.schemaVersion = "1.0.0";
        this._id = playerID;
        this._name = playerName;
        this._inClaim = false;
        this._itemCharged = false;
        this._viewingClaim = false;
        this._resizingClaimName = "";
        this._firstPoint = { x: 0, y: 0, z: 0 };
        this._oppositeCorner = { x: 0, y: 0, z: 0 };
        this._entranceVelocity = { x: 0, y: 0, z: 0 };
        this._previousLocation = { x: 0, y: 0, z: 0 };
        this._pendingEntranceDisallow = false;
        this._claimBlocks = new PlayerClaimBlocks(settings.startingClaimBlocks, settings.claimBlockHourlyPayment);
        this._claims = [];
    }
    Object.defineProperty(PlayerData.prototype, "id", {
        // Getters
        get: function () {
            return this._id;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "name", {
        get: function () {
            return this._name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "inClaim", {
        get: function () {
            return this._inClaim;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "itemCharged", {
        get: function () {
            return this._itemCharged;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "viewingClaim", {
        get: function () {
            return this._viewingClaim;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "resizingClaimName", {
        get: function () {
            return this._resizingClaimName;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "firstPoint", {
        get: function () {
            return this._firstPoint;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "oppositeCorner", {
        get: function () {
            return this._oppositeCorner;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "entranceVelocity", {
        get: function () {
            return this._entranceVelocity;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "previousLocation", {
        get: function () {
            return this._previousLocation;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "pendingEntranceDisallow", {
        get: function () {
            return this._pendingEntranceDisallow;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "claimBlocks", {
        get: function () {
            return this._claimBlocks;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PlayerData.prototype, "claims", {
        get: function () {
            return this._claims;
        },
        enumerable: false,
        configurable: true
    });
    // Setters
    PlayerData.prototype.setName = function (newName) {
        this._name = newName;
        saveDb();
    };
    PlayerData.prototype.setInClaim = function (value) {
        this._inClaim = value;
        saveDb();
    };
    PlayerData.prototype.setItemCharged = function (value) {
        this._itemCharged = value;
        saveDb();
    };
    PlayerData.prototype.setViewingClaim = function (value) {
        this._viewingClaim = value;
        saveDb();
    };
    PlayerData.prototype.setResizingClaimName = function (value) {
        this._resizingClaimName = value;
        saveDb();
    };
    PlayerData.prototype.setFirstPoint = function (value) {
        this._firstPoint = value;
        saveDb();
    };
    PlayerData.prototype.setOppositeCorner = function (value) {
        this._oppositeCorner = value;
        saveDb();
    };
    PlayerData.prototype.setEntranceVelocity = function (value) {
        this._entranceVelocity = value;
        saveDb();
    };
    PlayerData.prototype.setPreviousLocation = function (value) {
        this._previousLocation = value;
        saveDb();
    };
    PlayerData.prototype.setPendingEntranceDisallow = function (value) {
        this._pendingEntranceDisallow = value;
        saveDb();
    };
    PlayerData.prototype.addClaim = function (claim) {
        this._claims.push(claim);
        saveDb();
    };
    PlayerData.prototype.removeClaim = function (claim) {
        this._claims = this._claims.filter(function (c) { return c !== claim; });
        saveDb();
    };
    PlayerData.prototype.getClaim = function (claimName) {
        return this._claims.find(function (c) { return c.name === claimName; });
    };
    PlayerData.fromJSON = function (data) {
        var defaultPlayerData = new PlayerData(data._id, data._name);
        var playerData = new PlayerData(data._id, data._name);
        playerData.setInClaim(data._inClaim !== undefined ? data._inClaim : defaultPlayerData.inClaim);
        playerData.setItemCharged(data._itemCharged !== undefined ? data._itemCharged : defaultPlayerData.itemCharged);
        playerData.setViewingClaim(data._viewingClaim !== undefined ? data._viewingClaim : defaultPlayerData.viewingClaim);
        playerData.setResizingClaimName(data._resizingClaimName || defaultPlayerData._resizingClaimName);
        playerData.setFirstPoint(data._firstPoint || defaultPlayerData.firstPoint);
        playerData.setOppositeCorner(data._oppositeCorner || defaultPlayerData.oppositeCorner);
        playerData.setEntranceVelocity(data._entranceVelocity || defaultPlayerData.entranceVelocity);
        playerData.setPreviousLocation(data._previousLocation || defaultPlayerData.previousLocation);
        playerData.setPendingEntranceDisallow(data._pendingEntranceDisallow !== undefined ? data._pendingEntranceDisallow : defaultPlayerData.pendingEntranceDisallow);
        playerData._claimBlocks = PlayerClaimBlocks.fromJSON(data._claimBlocks || {});
        playerData._claims = data._claims
            ? data._claims.map(Claim.fromJSON).filter(function (claim) { return claim._name != "Undefined"; })
            : defaultPlayerData.claims;
        return playerData;
    };
    /**
     * Returns the players data including claims
     *
     * @param playerId - The entity id of the player
     */
    PlayerData.fromId = function (playerId) {
        var e_3, _a;
        try {
            for (var database_1 = __values(database), database_1_1 = database_1.next(); !database_1_1.done; database_1_1 = database_1.next()) {
                var player = database_1_1.value;
                if (playerId == player.id) {
                    return player;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (database_1_1 && !database_1_1.done && (_a = database_1.return)) _a.call(database_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    return PlayerData;
}());
export { PlayerData };
export var database = [];
try {
    // compile database into a dict
    for (var _b = __values(world.getDynamicPropertyIds()), _c = _b.next(); !_c.done; _c = _b.next()) {
        var id = _c.value;
        var property = world.getDynamicProperty(id);
        if (id.includes("db.")) {
            var parsedData = JSON.parse(property.toString());
            // player id and name is required make sure it exists
            if (Object.keys(parsedData).includes("_id") && Object.keys(parsedData).includes("_name")) {
                var validatedData = PlayerData.fromJSON(parsedData);
                database.push(validatedData);
            }
        }
    }
}
catch (e_1_1) { e_1 = { error: e_1_1 }; }
finally {
    try {
        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
    }
    finally { if (e_1) throw e_1.error; }
}
/**
 * Transfers the database from memory into long term storage using dynamic world properties
 */
function saveDb() {
    var e_4, _a;
    try {
        for (var database_2 = __values(database), database_2_1 = database_2.next(); !database_2_1.done; database_2_1 = database_2.next()) {
            var playerData = database_2_1.value;
            // deconstruct database to save each players data as an individual dynamic property
            world.setDynamicProperty("db.".concat(playerData.id), JSON.stringify(playerData));
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (database_2_1 && !database_2_1.done && (_a = database_2.return)) _a.call(database_2);
        }
        finally { if (e_4) throw e_4.error; }
    }
}
//# sourceMappingURL=database.js.map
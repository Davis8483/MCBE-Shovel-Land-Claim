import { world, system, Player, Vector3, ItemStack, CameraFadeOptions, CameraSetPosOptions, EasingType, EntityRidingComponent, EntityRideableComponent, RawMessage, BlockType, BlockComponentTypes, BlockPermutation, BlockTypes, EntityComponentTypes, InputPermissionCategory, HudElement, HudVisibility, EntityInventoryComponent } from '@minecraft/server';
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

// MARK: load settings ----------------------------------------------------------------------------------------------------------

/**
 * An object containing global settings for the addon
 */
class Settings{
    claimBlockHourlyPayment: number;
    startingClaimBlocks: number;
    claimMinimumWidth: number;
    disallowedBlocks: string[];

    /**
     * Creates a new Settings object with default values
     */
    constructor(){
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
    static fromJSON(data: any): Settings {
        const defaultSettings = new Settings();
        var settings = new Settings();
        settings.claimBlockHourlyPayment = data.claimBlockHourlyPayment || defaultSettings.claimBlockHourlyPayment;
        settings.startingClaimBlocks = data.startingClaimBlocks || defaultSettings.startingClaimBlocks;
        settings.claimMinimumWidth = data.claimMinimumWidth || defaultSettings.claimMinimumWidth;
        settings.disallowedBlocks = data.disallowedBlocks || defaultSettings.disallowedBlocks;
        return settings;
    }
}

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
enum PermissionTypes {
    ENTER_CLAIM = "enterClaim",
    BREAK_BLOCKS = "breakBlocks",
    USE_ITEMS_ON_BLOCKS = "useItemsOnBlocks",
    HURT_ENTITIES = "hurtEntities",
    USE_TNT = "useTNT",
    INTERACT_WITH_ENTITIES = "interactWithEntities",
    USE_DOORS = "useDoors",
    USE_SWITCHES = "useSwitches",
    OPEN_CONTAINERS = "openContainers",
    EDIT_SIGNS = "editSigns"
}

/**
 * Represents a player's permissions in a claim.
 */
class PlayerPermissions {
    /**
     * The entity id of the player
     */
    private _id: string;

    /**
     * The name of the player; do not use for identification as it can change.
     */
    private _name: string;

    /**
     * The permissions the player has for the claim
     */
    private _permissions: {
        enterClaim: boolean;
        breakBlocks: boolean;
        useItemsOnBlocks: boolean;
        hurtEntities: boolean;
        interactWithEntities: boolean;
        useDoors: boolean;
        useSwitches: boolean;
        openContainers: boolean;
        editSigns: boolean;
    }

    /**
     * Creates a new PlayerPermissions object
     * 
     * @param id - The entity id of the player
     * 
     * @param name - The name of the player
     */
    constructor(id: string, name: string) {
        this._id = id;
        this._name = name;
        this._permissions = {
            [PermissionTypes.ENTER_CLAIM]: true,
            [PermissionTypes.BREAK_BLOCKS]: false,
            [PermissionTypes.USE_ITEMS_ON_BLOCKS]: false,
            [PermissionTypes.HURT_ENTITIES]: false,
            [PermissionTypes.INTERACT_WITH_ENTITIES]: false,
            [PermissionTypes.USE_DOORS]: true,
            [PermissionTypes.USE_SWITCHES]: true,
            [PermissionTypes.OPEN_CONTAINERS]: false,
            [PermissionTypes.EDIT_SIGNS]: false,
        };
    }

    get id(): string {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    getPermission(permission: PermissionTypes): boolean {
        return this._permissions[permission];
    }

    setPermission(permission: PermissionTypes, value: boolean): void {
        this._permissions[permission] = value;
        saveDb();
    }

    /**
     * Returns a PlayerPermissions object loaded from JSON, if a key is missing it will be replaced with the default value.
     * 
     * @param data - The JSON object to load the PlayerPermissions object from
     * 
     * @return - The PlayerPermissions object loaded from the JSON object
     */
    static fromJSON(data: any): PlayerPermissions {
        const defaultPermissions = new PlayerPermissions(data._id, data._name);
        const permissions = new PlayerPermissions(data._id, data._name);
        permissions.setPermission(PermissionTypes.ENTER_CLAIM, data._permissions?.enterClaim !== undefined ? data._permissions.enterClaim : defaultPermissions.getPermission(PermissionTypes.ENTER_CLAIM));
        permissions.setPermission(PermissionTypes.BREAK_BLOCKS, data._permissions?.breakBlocks !== undefined ? data._permissions.breakBlocks : defaultPermissions.getPermission(PermissionTypes.BREAK_BLOCKS));
        permissions.setPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, data._permissions?.useItemsOnBlocks !== undefined ? data._permissions.useItemsOnBlocks : defaultPermissions.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS));
        permissions.setPermission(PermissionTypes.HURT_ENTITIES, data._permissions?.hurtEntities !== undefined ? data._permissions.hurtEntities : defaultPermissions.getPermission(PermissionTypes.HURT_ENTITIES));
        permissions.setPermission(PermissionTypes.INTERACT_WITH_ENTITIES, data._permissions?.interactWithEntities !== undefined ? data._permissions.interactWithEntities : defaultPermissions.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES));
        permissions.setPermission(PermissionTypes.USE_DOORS, data._permissions?.useDoors !== undefined ? data._permissions.useDoors : defaultPermissions.getPermission(PermissionTypes.USE_DOORS));
        permissions.setPermission(PermissionTypes.USE_SWITCHES, data._permissions?.useSwitches !== undefined ? data._permissions.useSwitches : defaultPermissions.getPermission(PermissionTypes.USE_SWITCHES));
        permissions.setPermission(PermissionTypes.OPEN_CONTAINERS, data._permissions?.openContainers !== undefined ? data._permissions.openContainers : defaultPermissions.getPermission(PermissionTypes.OPEN_CONTAINERS));
        permissions.setPermission(PermissionTypes.EDIT_SIGNS, data._permissions?.editSigns !== undefined ? data._permissions.editSigns : defaultPermissions.getPermission(PermissionTypes.EDIT_SIGNS));
        return permissions;
    }
}

/**
 * Represents a land claim in the world.
 */
class Claim {
    private _name: string;
    private _start: Vector3;
    private _end: Vector3;
    private _icon: string;
    private _particlesEnabled: boolean;
    private _playerPermissionsList: PlayerPermissions[];
    private _publicPermissions: {
        [key in PermissionTypes]: boolean;
    };

    constructor(name: string, start: Vector3, end: Vector3, icon: string, particlesEnabled: boolean = true) {
        this._name = name;
        this._start = start;
        this._end = end;
        this._icon = icon;
        this._particlesEnabled = particlesEnabled;
        this._playerPermissionsList = [];
        this._publicPermissions = {
            [PermissionTypes.ENTER_CLAIM]: true,
            [PermissionTypes.BREAK_BLOCKS]: false,
            [PermissionTypes.USE_ITEMS_ON_BLOCKS]: false,
            [PermissionTypes.HURT_ENTITIES]: false,
            [PermissionTypes.USE_TNT]: false,
            [PermissionTypes.INTERACT_WITH_ENTITIES]: false,
            [PermissionTypes.USE_DOORS]: true,
            [PermissionTypes.USE_SWITCHES]: true,
            [PermissionTypes.OPEN_CONTAINERS]: false,
            [PermissionTypes.EDIT_SIGNS]: false,
        };
    }

    // Getters
    get name(): string {
        return this._name;
    }

    get start(): Vector3 {
        return this._start;
    }

    get end(): Vector3 {
        return this._end;
    }

    get icon(): string {
        return this._icon;
    }

    get particlesEnabled(): boolean {
        return this._particlesEnabled;
    }

    get playerPermissionsList(): PlayerPermissions[] {
        return this._playerPermissionsList;
    }

    // Get a specific public permission
    getPublicPermission(permission: PermissionTypes): boolean {
        return this._publicPermissions[permission];
    }

    // Set a specific public permission
    setPublicPermission(permission: PermissionTypes, value: boolean): void {
        this._publicPermissions[permission] = value;
        saveDb();
    }

    // Setters
    setName(value: string) {
        this._name = value;
        saveDb();
    }

    setStart(value: Vector3) {
        this._start = value;
        saveDb();
    }

    setEnd(value: Vector3) {
        this._end = value;
        saveDb();
    }

    setIcon(value: string) {
        this._icon = value;
        saveDb();
    }

    setParticlesEnabled(value: boolean) {
        this._particlesEnabled = value;
        saveDb();
    }

    addPlayerPermissions(playerPermissions: PlayerPermissions) {
        this._playerPermissionsList.push(playerPermissions);
        saveDb();
    }

    removePlayerPermissions(index: number) {
        this._playerPermissionsList.splice(index, 1);
        saveDb();
    }

    /**
     * Returns a Claim object loaded from JSON, if a key is missing it will be replaced with the default value.
     * Claim name is required, if it is not found it will be replaced with "Undefined" and should be removed by the caller.
     * 
     * @param data - The JSON object to load the Claim object from
     * 
     * @return - The Claim object loaded from the JSON object
     */
    static fromJSON(data: any): Claim {
        const defaultClaim = new Claim("Undefined", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, "textures/ui/icon_recipe_nature.png");
        const claim = new Claim(
            data._name || defaultClaim.name,
            data._start || defaultClaim.start,
            data._end || defaultClaim.end,
            data._icon || defaultClaim.icon,
            data._particlesEnabled !== undefined ? data._particlesEnabled : defaultClaim.particlesEnabled
        );

        claim._publicPermissions = {
            enterClaim: data._publicPermissions?.enterClaim !== undefined ? data._publicPermissions.enterClaim : defaultClaim.getPublicPermission(PermissionTypes.ENTER_CLAIM),
            breakBlocks: data._publicPermissions?.breakBlocks !== undefined ? data._publicPermissions.breakBlocks : defaultClaim.getPublicPermission(PermissionTypes.BREAK_BLOCKS),
            useItemsOnBlocks: data._publicPermissions?.useItemsOnBlocks !== undefined ? data._publicPermissions.useItemsOnBlocks : defaultClaim.getPublicPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS),
            hurtEntities: data._publicPermissions?.hurtEntities !== undefined ? data._publicPermissions.hurtEntities : defaultClaim.getPublicPermission(PermissionTypes.HURT_ENTITIES),
            useTNT: data._publicPermissions?.useTNT !== undefined ? data._publicPermissions.useTNT : defaultClaim.getPublicPermission(PermissionTypes.USE_TNT),
            interactWithEntities: data._publicPermissions?.interactWithEntities !== undefined ? data._publicPermissions.interactWithEntities : defaultClaim.getPublicPermission(PermissionTypes.INTERACT_WITH_ENTITIES),
            useDoors: data._publicPermissions?.useDoors !== undefined ? data._publicPermissions.useDoors : defaultClaim.getPublicPermission(PermissionTypes.USE_DOORS),
            useSwitches: data._publicPermissions?.useSwitches !== undefined ? data._publicPermissions.useSwitches : defaultClaim.getPublicPermission(PermissionTypes.USE_SWITCHES),
            openContainers: data._publicPermissions?.openContainers !== undefined ? data._publicPermissions.openContainers : defaultClaim.getPublicPermission(PermissionTypes.OPEN_CONTAINERS),
            editSigns: data._publicPermissions?.editSigns !== undefined ? data._publicPermissions.editSigns : defaultClaim.getPublicPermission(PermissionTypes.EDIT_SIGNS)
        };

        claim._playerPermissionsList = data._playerPermissionsList 
            ? data._playerPermissionsList
            .map(PlayerPermissions.fromJSON)
            .filter(permission => permission.id !== undefined && permission.name !== undefined) 
            : defaultClaim.playerPermissionsList;

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
            
            var playerPermissions: PlayerPermissions = undefined;

            // find the players permissions
            for (var p of this._playerPermissionsList) {
                if (p.id == player.id) {
                    playerPermissions = p;
                    break;
                }
            }

            if ((playerPermissions != undefined) && Object.keys(playerPermissions).includes(permission)) {

                return playerPermissions[permission]
            }
        }
        // if player specific permission is not found, default to claims global permissions list
        if (Object.keys(this._publicPermissions).includes(permission)) {

            return (this._publicPermissions[permission]);
        }
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
        const rect1Left = Math.min(this._start.x, this._end.x);
        const rect1Right = Math.max(this._start.x, this._end.x);
        const rect1Top = Math.max(this._start.z, this._end.z);
        const rect1Bottom = Math.min(this._start.z, this._end.z);

        const rect2Left = Math.min(start.x, end.x);
        const rect2Right = Math.max(start.x, end.x);
        const rect2Top = Math.max(start.z, end.z);
        const rect2Bottom = Math.min(start.z, end.z);

        // Check if there's no overlap on both x and y directions
        return !(rect1Right < rect2Left || rect2Right < rect1Left || rect1Top < rect2Bottom || rect2Top < rect1Bottom);
    }
}

class PlayerClaimBlocks {
    private _amount: number;
    private _paymentTimeRemaining: number;

    constructor(amount: number, paymentTimeRemaining: number) {
        this._amount = amount;
        this._paymentTimeRemaining = paymentTimeRemaining;
    }

    // Getters
    get amount(): number {
        return this._amount;
    }

    get paymentTimeRemaining(): number {
        return this._paymentTimeRemaining;
    }

    // Setters
    setAmount(newAmount: number): void {
        this._amount = newAmount;
        saveDb();
    }

    // Utility methods
    incrementAmount(value: number): void {
        this._amount += value;
        saveDb();
    }

    decrementAmount(value: number): void {
        this._amount -= value;
        saveDb();
    }

    decrementPaymentTime(): void {
        this._paymentTimeRemaining -= 1;
        saveDb();
    }

    resetPaymentTime(): void {
        this._paymentTimeRemaining = settings.claimBlockHourlyPayment;
        saveDb();
    }

    static fromJSON(data: any): PlayerClaimBlocks {
        return new PlayerClaimBlocks(data._amount || settings.startingClaimBlocks, data._paymentTimeRemaining || settings.claimBlockHourlyPayment);
    }
}

class PlayerData {
    readonly schemaVersion: string = "1.0.0";

    private _id: string;
    private _name: string;
    private _inClaim: boolean;
    private _viewingClaim: boolean;
    private _resizingClaimName: string;
    private _firstPoint: Vector3;
    private _oppositeCorner: Vector3;
    private _entranceVelocity: Vector3;
    private _claimBlocks: PlayerClaimBlocks;
    private _claims: Claim[];

    constructor(playerID: string, playerName: string) {
        this._id = playerID;
        this._name = playerName;
        this._inClaim = false;
        this._viewingClaim = false;
        this._resizingClaimName = "";
        this._firstPoint = { x: 0, y: 0, z: 0 };
        this._oppositeCorner = { x: 0, y: 0, z: 0 };
        this._entranceVelocity = { x: 0, y: 0, z: 0 };
        this._claimBlocks = new PlayerClaimBlocks(settings.startingClaimBlocks, settings.claimBlockHourlyPayment);
        this._claims = [];
    }

    // Getters
    get id(): string {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    get inClaim(): boolean {
        return this._inClaim;
    }

    get viewingClaim(): boolean {
        return this._viewingClaim;
    }

    get resizingClaimName(): string {
        return this._resizingClaimName;
    }

    get firstPoint(): Vector3 {
        return this._firstPoint;
    }

    get oppositeCorner(): Vector3 {
        return this._oppositeCorner;
    }

    get entranceVelocity(): Vector3 {
        return this._entranceVelocity;
    }

    get claimBlocks(): PlayerClaimBlocks {
        return this._claimBlocks;
    }

    get claims(): Claim[] {
        return this._claims;
    }

    // Setters
    setName(newName: string): void {
        this._name = newName;
        saveDb();
    }

    setInClaim(value: boolean): void {
        this._inClaim = value;
        saveDb();
    }

    setViewingClaim(value: boolean): void {
        this._viewingClaim = value;
        saveDb();
    }

    setResizingClaimName(value: string): void {
        this._resizingClaimName = value;
        saveDb();
    }

    setFirstPoint(value: Vector3): void {
        this._firstPoint = value;
        saveDb();
    }

    setOppositeCorner(value: Vector3): void {
        this._oppositeCorner = value;
        saveDb();
    }

    setEntranceVelocity(value: Vector3): void {
        this._entranceVelocity = value;
        saveDb();
    }

    addClaim(claim: Claim): void {
        this._claims.push(claim);
        saveDb();
    }

    removeClaim(claim: Claim): void {
        this._claims = this._claims.filter((c) => c !== claim);
        saveDb();
    }

    getClaim(claimName: string): Claim | undefined {
        return this._claims.find((c) => c.name === claimName);
    }

    static fromJSON(data: any): PlayerData {

        const defaultPlayerData = new PlayerData(data._id, data._name);
        const playerData = new PlayerData(data._id, data._name);
        playerData.setInClaim(data._inClaim !== undefined ? data._inClaim : defaultPlayerData.inClaim);
        playerData.setViewingClaim(data._viewingClaim !== undefined ? data.viewingClaim : defaultPlayerData.viewingClaim);
        playerData.setResizingClaimName(data._resizingClaimName || defaultPlayerData.resizingClaimName);
        playerData.setFirstPoint(data._firstPoint || defaultPlayerData.firstPoint);
        playerData.setOppositeCorner(data._oppositeCorner || defaultPlayerData.oppositeCorner);
        playerData.setEntranceVelocity(data._entranceVelocity || defaultPlayerData.entranceVelocity);
        playerData._claimBlocks = PlayerClaimBlocks.fromJSON(data._claimBlocks || {});
        playerData._claims = data._claims 
            ? data._claims.map(Claim.fromJSON).filter(claim => claim._name != "Undefined") 
            : defaultPlayerData.claims;
        return playerData;
    }
}

var database: PlayerData[] = [];

// compile database into a dict
for (var id of world.getDynamicPropertyIds()) {
    const property = world.getDynamicProperty(id);

    if (id.includes("db.")) {
        const parsedData = JSON.parse(property.toString());

        // player id and name is required make sure it exists
        if (Object.keys(parsedData).includes("_id") && Object.keys(parsedData).includes("_name")) {
            const validatedData = PlayerData.fromJSON(parsedData);
            database.push(validatedData);
        }
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
                    { "translate": "ui.main:body.paragraph:5-1" }, { "text": ` §a+${settings.claimBlockHourlyPayment}§r ` }, { "translate": "ui.main:body.paragraph:5-2" }, { "text": ` §9${playerData.claimBlocks.paymentTimeRemaining}§r ` }, { "translate": "ui.main:body.paragraph:5-3" }
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
                    playerData.claimBlocks.decrementAmount(claimWidth * claimLength);

                    // create a new claim
                    playerData.addClaim(new Claim(name, start, end, iconPath, showBorderParticles));

                    sendNotification(owner, "chat.claim:created")
                    owner.playSound("random.levelup");

                    // Reset resizingClaimName to avoid incorrect resizing behavior
                    playerData.setResizingClaimName("");
                }
            }
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
                claim.setStart(start);
                claim.setEnd(end);

                sendNotification(owner, "chat.claim:resized")
                owner.playSound("random.levelup");

                //add/subtract the blocks from players balance
                playerData.claimBlocks.incrementAmount(blockDifference);

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
                this.managePermissions(owner, claim, claim.playerPermissionsList[response.selection].id);
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

        // player permissions not found in the claims list
        var unsavedPlayerPermissions: PlayerPermissions[] = []

        // get the entire list of players that have ever joined the world
        for (var playerData of database) {
            unsavedPlayerPermissions.push(new PlayerPermissions(playerData.id, playerData.name));
        }

        // filter players from the list, we don't want to add people who are already in it
        unsavedPlayerPermissions = unsavedPlayerPermissions.filter((p) => {
            for (var playerPermissions of claim.playerPermissionsList) {
                if (p.id == playerPermissions.id) {
                    return false;
                }
            }

            // make sure to remove owner from list as well
            if (p.id == owner.id) {
                return false;
            }

            return true;
        });
        
        // if no players are available to add notify the owner
        if ((unsavedPlayerPermissions.length == 0) && add) {
            sendNotification(owner, "chat.claim:no_players_to_add");
            owner.playSound("note.didgeridoo");
            return;
        }
        // if no players are available to remove notify the owner
        else if ((claim.playerPermissionsList.length == 0) && !add) {
            sendNotification(owner, "chat.claim:no_players_to_remove");
            owner.playSound("note.didgeridoo");
            return;
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
            .dropdown("ui.manage.permissions.player.selection.modify:player_dropdown", add ? unsavedPlayerPermissions.map(p => p.name) : claim.playerPermissionsList.map(p => p.name));

        form.show(owner).then((response) => {

            if (!response.canceled) {
                if (add) {
                    // save new player permission to list
                    claim.addPlayerPermissions(unsavedPlayerPermissions[response.formValues[0] as number]);
                }
                else {

                    // if a players permissions have been removed notify them
                    for (var p of world.getAllPlayers()) {
                        if (p.id == claim.playerPermissionsList[response.formValues[0] as number].id) {
                            p.runCommandAsync(`tellraw @s {"rawtext":[{"translate":"chat.prefix"}, {"text":" ${owner.name} "}, {"translate":"chat.claim:player_permissions_reset_notif"}, {"translate":"claim:name_color"}, {"text":" ${claim.name}"}]}`);
                            p.playSound("random.levelup");
                            break;
                        }
                    }

                    // remove player from list
                    claim.removePlayerPermissions(response.formValues[0] as number);
                }
            }

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
            .toggle("ui.manage.permissions:enter_claim", playerID ? playerPermissions.getPermission(PermissionTypes.ENTER_CLAIM) : claim.getPublicPermission(PermissionTypes.ENTER_CLAIM))
            .toggle("ui.manage.permissions:break_blocks", playerID ? playerPermissions.getPermission(PermissionTypes.BREAK_BLOCKS) : claim.getPublicPermission(PermissionTypes.BREAK_BLOCKS))
            .toggle("ui.manage.permissions:use_items_on_blocks", playerID ? playerPermissions.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS) : claim.getPublicPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS))
            .toggle("ui.manage.permissions:hurt_entities", playerID ? playerPermissions.getPermission(PermissionTypes.HURT_ENTITIES) : claim.getPublicPermission(PermissionTypes.HURT_ENTITIES))
            .toggle("ui.manage.permissions:interact_with_entities", playerID ? playerPermissions.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES) : claim.getPublicPermission(PermissionTypes.INTERACT_WITH_ENTITIES))
            .toggle("ui.manage.permissions:use_doors", playerID ? playerPermissions.getPermission(PermissionTypes.USE_DOORS) : claim.getPublicPermission(PermissionTypes.USE_DOORS))
            .toggle("ui.manage.permissions:use_switches", playerID ? playerPermissions.getPermission(PermissionTypes.USE_SWITCHES) : claim.getPublicPermission(PermissionTypes.USE_SWITCHES))
            .toggle("ui.manage.permissions:open_containers", playerID ? playerPermissions.getPermission(PermissionTypes.OPEN_CONTAINERS) : claim.getPublicPermission(PermissionTypes.OPEN_CONTAINERS))
            .toggle("ui.manage.permissions:edit_signs", playerID ? playerPermissions.getPermission(PermissionTypes.EDIT_SIGNS) : claim.getPublicPermission(PermissionTypes.EDIT_SIGNS))

        if (!playerID) {
            form.toggle("ui.manage.permissions:use_tnt", claim.getPublicPermission(PermissionTypes.USE_TNT));
        }

        form.show(owner).then((response) => {

            if (!response.canceled) {

                // save data
                if (playerID) {
                    playerPermissions.setPermission(PermissionTypes.ENTER_CLAIM, response.formValues[0] as boolean);
                    playerPermissions.setPermission(PermissionTypes.BREAK_BLOCKS, response.formValues[1] as boolean);
                    playerPermissions.setPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, response.formValues[2] as boolean);
                    playerPermissions.setPermission(PermissionTypes.HURT_ENTITIES, response.formValues[3] as boolean);
                    playerPermissions.setPermission(PermissionTypes.INTERACT_WITH_ENTITIES, response.formValues[4] as boolean);
                    playerPermissions.setPermission(PermissionTypes.USE_DOORS, response.formValues[5] as boolean);
                    playerPermissions.setPermission(PermissionTypes.USE_SWITCHES, response.formValues[6] as boolean);
                    playerPermissions.setPermission(PermissionTypes.OPEN_CONTAINERS, response.formValues[7] as boolean);
                    playerPermissions.setPermission(PermissionTypes.EDIT_SIGNS, response.formValues[8] as boolean);
                }
                else {
                    claim.setPublicPermission(PermissionTypes.ENTER_CLAIM, response.formValues[0] as boolean);
                    claim.setPublicPermission(PermissionTypes.BREAK_BLOCKS, response.formValues[1] as boolean);
                    claim.setPublicPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, response.formValues[2] as boolean);
                    claim.setPublicPermission(PermissionTypes.HURT_ENTITIES, response.formValues[3] as boolean);
                    claim.setPublicPermission(PermissionTypes.INTERACT_WITH_ENTITIES, response.formValues[4] as boolean);
                    claim.setPublicPermission(PermissionTypes.USE_DOORS, response.formValues[5] as boolean);
                    claim.setPublicPermission(PermissionTypes.USE_SWITCHES, response.formValues[6] as boolean);
                    claim.setPublicPermission(PermissionTypes.OPEN_CONTAINERS, response.formValues[7] as boolean);
                    claim.setPublicPermission(PermissionTypes.EDIT_SIGNS, response.formValues[8] as boolean);
                    claim.setPublicPermission(PermissionTypes.USE_TNT, response.formValues[9] as boolean);
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
                                    Ui.exitClaimView(owner);
                                }
                            }, 60);
                        }
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
                owner.onScreenDisplay.updateSubtitle({ "translate": "ui.manage.view:loading_subtitle" });

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

    static exitClaimView(owner: Player) {
        var playerData = getPlayerData(owner.id);

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
                playerData.removeClaim(claim);

                sendNotification(owner, "chat.claim:removed")
                owner.playSound("mob.creeper.say");

                // add the claim blocks to the players balance
                playerData.claimBlocks.incrementAmount(claimWidth * claimLength);

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
                    claim.setName(name);
                    claim.setIcon(iconPath);
                    claim.setParticlesEnabled(showBorderParticles);

                    sendNotification(owner, "chat.claim:updated")
                    owner.playSound("note.cow_bell");
                }
            }

        });
    }
}

world.afterEvents.playerJoin.subscribe((data) => {

    world.sendMessage("§cWarning: your playing a development build of Shovel Land Claim, bugs and data loss may occur.");

    // verify player data is on file
    var playerFound = false;

    for (var p of database) {
        if (p.id == data.playerId) {

            // update player name in db to current; in case they changed it
            p.setName(data.playerName);

            // set other values to default
            p.setViewingClaim(false);
            p.setResizingClaimName("");

            playerFound = true;
            break;
        }
    }

    // player is not saved in db
    if (!playerFound) {
        // create new player in db
        database.push(new PlayerData(data.playerId, data.playerName));
    }

});

world.afterEvents.playerLeave.subscribe((data) => {

    var playerData = getPlayerData(data.playerId);

    // remove claim view ticking area if player left while viewing a claim
    if (playerData.viewingClaim) {
        world.getDimension("overworld").runCommandAsync("tickingarea remove claimView");
    }
});

world.afterEvents.playerSpawn.subscribe((data) => {
    // make sure player has only 1 claim shovel
    data.player.runCommandAsync(`execute if entity @s[hasitem = { item=${shovelID}, quantity =! 1}] run clear @s ${shovelID} 0`);
    data.player.runCommandAsync(`execute if entity @s[hasitem = { item=${shovelID}, quantity = 0}] run give @s ${shovelID} 1 0 { "keep_on_death": { }, "item_lock": { "mode": "lock_in_inventory" } } `);

    // set flag to false since all camera positions will be reset upon rejoining
    getPlayerData(data.player.id).setViewingClaim(false);
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
                    playerData.setResizingClaimName("");
                    playerData.setFirstPoint(data.block.location);

                    runInAllClaims((playerID, playerName, claim) => {

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
                                playerData.setOppositeCorner({ "x": points[aIndex ^ 1][bIndex ^ 1][0], "y": data.block.y, "z": points[aIndex ^ 1][bIndex ^ 1][1] });
                                playerData.setResizingClaimName(claim.name);

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
                                    data.player.playSound("note.banjo");
                                });

                            } else {
                                sendNotification(data.player, "chat.point.resize:disallowed");
                                system.run(() => {
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
                                { "text": `: [§c${data.block.x}§r, §a${data.block.y}§r, §9${data.block.z}§r]\n` },
                                { "translate": "chat.point.new:hint" }
                            ]
                        });

                        system.run(() => {
                            data.player.playSound("note.cow_bell");
                        });
                    }
                }
                // if player is crouching
                else {
                    var secondPoint = { ...data.block.location }; // Ensure a new object is created
                    var claimIntersectingClaim = false;
                    var playerIntersectingClaim = false;

                    // if claim is resized
                    if (playerData.resizingClaimName.length > 0) {

                        // get the claim object that is being resized
                        var resizingClaim = playerData.getClaim(playerData.resizingClaimName);

                        const oldClaimWidth = Math.abs(resizingClaim.start.x - resizingClaim.end.x) + 1;
                        const oldClaimLength = Math.abs(resizingClaim.start.z - resizingClaim.end.z) + 1;

                        const newClaimWidth = Math.abs(playerData.oppositeCorner.x - secondPoint.x) + 1;
                        const newClaimLength = Math.abs(playerData.oppositeCorner.z - secondPoint.z) + 1;

                        const blockDifference = (newClaimLength * newClaimWidth) - (oldClaimLength * oldClaimWidth);

                        // make sure new claim isn't intersecting others not counting itself
                        runInAllClaims((playerID, playerName, claim) => {
                            if (claim.isOverlap(playerData.oppositeCorner, secondPoint) && ((playerID != data.player.id) || (claim.name != playerData.resizingClaimName))) {
                                claimIntersectingClaim = true;
                            }
                        });

                        // make sure another player isn't in the area
                        for (var p of world.getAllPlayers()) {
                            // we are creating a claim object just to use the isOverlap utility, this is not saved to the database
                            if (new Claim("", playerData.oppositeCorner, secondPoint, "").isOverlap(p.location, p.location) && (p.id != data.player.id)) {
                                playerIntersectingClaim = true;
                            }
                        }

                        // intersecting claim warning message, cancel resize
                        if (claimIntersectingClaim) {
                            sendNotification(data.player, "chat.claim:claim_intersecting");
                            system.run(() => {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // player is in the way warning message, cancel resize
                        else if (playerIntersectingClaim) {
                            sendNotification(data.player, "chat.claim:player_intersecting");
                            system.run(() => {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // claim isn't wide enough warning message, cancel resize
                        else if (newClaimWidth < settings.claimMinimumWidth || newClaimLength < settings.claimMinimumWidth) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:width1" }, { "text": ` ${settings.claimMinimumWidth} ` }, { "translate": "chat.claim:width2" }] });
                            system.run(() => {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // not enough claim blocks warning message, cancel resize
                        else if (playerData.claimBlocks.amount < blockDifference) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:blocks1" }, { "text": ` ${(blockDifference) - playerData.claimBlocks.amount} ` }, { "translate": "chat.claim:blocks3" }] });
                            system.run(() => {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // all requirements met, open the claim resizing ui
                        else {
                            system.run(() => {
                                data.player.playSound("note.cow_bell");

                                Ui.resizeClaim(data.player, resizingClaim, playerData.oppositeCorner, secondPoint);
                            });
                        }
                    }
                    // not resizing, create a new claim
                    else {

                        const claimWidth = Math.abs(playerData.firstPoint.x - secondPoint.x) + 1;
                        const claimLength = Math.abs(playerData.firstPoint.z - secondPoint.z) + 1;

                        runInAllClaims((playerID, playerName, claim) => {
                            // make sure new claim isn't intersecting others
                            if (claim.isOverlap(playerData.firstPoint, secondPoint)) {
                                claimIntersectingClaim = true;
                            }
                        });

                        // make sure another player isn't in the area
                        for (var p of world.getAllPlayers()) {
                            // we are creating a claim object just to use the isOverlap utility, this is not saved to the database
                            if (new Claim("", playerData.firstPoint, secondPoint, "").isOverlap(p.location, p.location) && (p.id != data.player.id)) {
                                playerIntersectingClaim = true;
                            }
                        }

                        // intersecting claim warning message, cancel creation
                        if (claimIntersectingClaim) {
                            sendNotification(data.player, "chat.claim:claim_intersecting");

                            system.run(() => {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // player is in the way warning message, cancel creation
                        else if (playerIntersectingClaim) {
                            sendNotification(data.player, "chat.claim:player_intersecting");

                            system.run(() => {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // claim is not wide enough warning message, cancel creation
                        else if (claimWidth < settings.claimMinimumWidth || claimLength < settings.claimMinimumWidth) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:width1" }, { "text": ` ${settings.claimMinimumWidth} ` }, { "translate": "chat.claim:width2" }] });
                            system.run(() => {
                                data.player.playSound("note.didgeridoo");
                            });
                        }
                        // not enough claim blocks warning message, cancel creation
                        else if (playerData.claimBlocks.amount < (claimWidth * claimLength)) {
                            sendNotification(data.player, { "rawtext": [{ "translate": "chat.claim:blocks1" }, { "text": ` ${(claimWidth * claimLength) - playerData.claimBlocks.amount} ` }, { "translate": "chat.claim:blocks2" }] });
                            system.run(() => {
                                data.player.playSound("note.didgeridoo");
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
                    });
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
            if ((data.source.typeId != "minecraft:tnt") || !claim.hasPermission(PermissionTypes.USE_TNT)) {
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

world.beforeEvents.playerInteractWithEntity.subscribe((data) => {
    
    if (data.target.dimension == world.getDimension("overworld")) {
        runInAllClaims((playerID, playerName, claim) => {

            const margin = 0.5;
            var start = { x: data.target.location.x - margin, y: data.target.location.y - margin, z: data.target.location.z - margin };
            var end = { x: data.target.location.x + margin, y: data.target.location.y + margin, z: data.target.location.z + margin };

            // if player has interacted with an entity in a claim
            if (claim.isOverlap(start, end) && (playerID != data.player.id)){
                // disallow player from interacting with rideable entities if they are not allowed to enter the claim
                if (!claim.hasPermission(PermissionTypes.ENTER_CLAIM, data.player) && data.target.getComponent(EntityComponentTypes.Rideable)) {
                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    system.run(() => {
                        sendNotification(data.player, "chat.claim.permission:enter_claim");
                        data.player.playSound("note.didgeridoo");
                    })
                }

                // disallow player from interacting with entities based on permissions
                if(!claim.hasPermission(PermissionTypes.INTERACT_WITH_ENTITIES, data.player)) {

                    // cancel the action
                    data.cancel = true;

                    // notify player they don't have permissions
                    system.run(() => {
                        sendNotification(data.player, "chat.claim.permission:interact_with_entities");
                        data.player.playSound("note.didgeridoo");
                    })
                }
            }
        });
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe((data) => {
    
    // blocks that are disabled by admin; can't be placed
    if (data.itemStack && settings.disallowedBlocks.includes(data.itemStack.typeId)) {
        // notify player
        sendNotification(data.player, "chat.world:disabled_item");

        system.run(() => {
            data.player.playSound("note.didgeridoo");
        });

        data.cancel = true;
    }

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
    if (getPlayerData(data.player.id).viewingClaim) {
        data.cancel = true;
    }

    if (data.block.dimension == world.getDimension("overworld")){
        runInAllClaims((playerID, playerName, claim) => {
        
            // only check for permissions if player is not the owner
            if (playerID != data.player.id){
                
                // door interaction permissions
                if (claim.isOverlap(data.block.location, data.block.location) && data.block.typeId.includes("door") && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_DOORS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        system.run(() => {
                            sendNotification(data.player, "chat.claim.permission:use_doors");
                            data.player.playSound("note.didgeridoo");
                        })
                    }
                }
                // lever/button interaction permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && (data.block.matches("minecraft:lever") || data.block.typeId.includes("button")) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.USE_SWITCHES, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        system.run(() => {
                            sendNotification(data.player, "chat.claim.permission:use_switches");
                            data.player.playSound("note.didgeridoo");
                        })
                    }
                }
                // opening chests/container permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.getComponent(BlockComponentTypes.Inventory) && !data.player.isSneaking) {
                    if (!claim.hasPermission(PermissionTypes.OPEN_CONTAINERS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        system.run(() => {
                            sendNotification(data.player, "chat.claim.permission:open_containers");
                            data.player.playSound("note.didgeridoo");
                        })
                    }
                }
                // editing signs permissions
                else if (claim.isOverlap(data.block.location, data.block.location) && data.block.getComponent(BlockComponentTypes.Sign) && !data.player.isSneaking && !data.itemStack?.matches("minecraft:honeycomb")) {
                    if (!claim.hasPermission(PermissionTypes.EDIT_SIGNS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        system.run(() => {
                            sendNotification(data.player, "chat.claim.permission:edit_signs");
                            data.player.playSound("note.didgeridoo");
                        })
                    }
                }
                // block placing/using items on blocks permissions
                else if ((claim.isOverlap(data.block, data.block) || claim.isOverlap(placedBlock, placedBlock)) && data.itemStack && !data.itemStack.matches(shovelID)) {
                    if (!claim.hasPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, data.player)){
                        // cancel the action
                        data.cancel = true;

                        // notify player they don't have permissions
                        system.run(() => {
                            sendNotification(data.player, "chat.claim.permission:use_item_on_block");
                            data.player.playSound("note.didgeridoo");
                        });
                    }
                }
            }
        });
    }
});

world.afterEvents.worldInitialize.subscribe(() => {
    // disable showing locked item text; the claim shovel is locked in the inventory
    world.gameRules.showTags = false;

    // disable fire spreads
    world.gameRules.doFireTick = false;

    // remove claim view ticking area if it exists
    world.getDimension("overworld").runCommandAsync("tickingarea remove claimView")
});

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
            playerData.setInClaim(false);

            // if player is crouching set viewing claim flag to false to cancel it and return to first person
            if (p.isSneaking && playerData.viewingClaim) {
                Ui.exitClaimView(p);
            }

            runInAllClaims((playerID, playerName, claim) => {

                // apply an offset to the player location to be more accurate with claim bounds
                const location: Vector3 = { "x": p.location.x - 0.5, "y": p.location.y - 0.5, "z": p.location.z - 0.5 };

                // if player is in the claim
                if (claim.isOverlap(location, location)) {

                    playerData.setInClaim(true);

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
                            playerData.setEntranceVelocity(p.getVelocity());
                        }

                        const velocity: Vector3 = playerData.entranceVelocity;

                        // if player is riding an entity eject them
                        if (p.hasComponent(EntityRidingComponent.componentId)) {
                            const entity = (p.getComponent(EntityRidingComponent.componentId) as EntityRidingComponent).entityRidingOn;
                            const riddenComponent = entity.getComponent(EntityRideableComponent.componentId) as EntityRideableComponent;

                            riddenComponent.ejectRider(p);

                            // teleport the ridden entity to the player 1 second after they are ejected
                            system.runTimeout(() => {
                                entity.teleport(p.location);
                                
                                // remount the player after a 0.5 second delay
                                system.runTimeout(() => {
                                    // const riddenComponent = entity.getComponent(EntityRideableComponent.componentId) as EntityRideableComponent;
                                    riddenComponent.addRider(p);
                                }, 10);
                            }, 20);
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
            playerData.setInClaim(false);
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
        playerData.claimBlocks.decrementPaymentTime();

        // if time is up reward blocks and reset timer
        if (playerData.claimBlocks.paymentTimeRemaining <= 0) {
            playerData.claimBlocks.incrementAmount(settings.claimBlockHourlyPayment);
            sendNotification(p, {
                "rawtext": [
                    { "translate": "chat.blocks:payment1" },
                    { "text": ` ${settings.claimBlockHourlyPayment} ` },
                    { "translate": "chat.blocks:payment2" }]
            })
            p.playSound("random.levelup");

            playerData.claimBlocks.resetPaymentTime();
        }
    }
}, 1200)
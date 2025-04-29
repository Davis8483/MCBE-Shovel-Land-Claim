import { world, Vector3, Player } from "@minecraft/server";

/**
 * An object containing global settings for the addon
 */
export class Settings{
    private _claimBlockHourlyPayment: number;
    private _startingClaimBlocks: number;
    private _claimMinimumWidth: number;
    private _disallowedBlocks: string[];

    /**
     * Creates a new Settings object with default values
     */
    constructor(){
        this._claimBlockHourlyPayment = 100;
        this._startingClaimBlocks = 200;
        this._claimMinimumWidth = 10;
        this._disallowedBlocks = [
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

    get claimBlockHourlyPayment(): number {
        return this._claimBlockHourlyPayment;
    }
    get startingClaimBlocks(): number {
        return this._startingClaimBlocks;
    }
    get claimMinimumWidth(): number {
        return this._claimMinimumWidth;
    }
    get disallowedBlocks(): string[] {
        return this._disallowedBlocks;
    }

    setClaimBlockHourlyPayment(value: number) {
        this._claimBlockHourlyPayment = value;
        saveSettings();
    }
    setStartingClaimBlocks(value: number) {
        this._startingClaimBlocks = value;
        saveSettings();
    }
    setClaimMinimumWidth(value: number) {
        this._claimMinimumWidth = value;
        saveSettings();
    }
    /**
     * Adds a block to the disallowed blocks list
     * 
     * @param blockId - The block to add to the disallowed blocks list
     */
    addDisallowedBlock(blockId: string) {
        this._disallowedBlocks.push(blockId);
        saveSettings();
    }

    /**
     * Removes a block from the disallowed blocks list
     * 
     * @param blockId - The block to remove from the disallowed blocks list
     */
    removeDisallowedBlock(blockId: string) {
        this._disallowedBlocks = this._disallowedBlocks.filter((block) => block !== blockId);
        saveSettings();
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
        settings._claimBlockHourlyPayment = data._claimBlockHourlyPayment || defaultSettings._claimBlockHourlyPayment;
        settings._startingClaimBlocks = data._startingClaimBlocks || defaultSettings._startingClaimBlocks;
        settings._claimMinimumWidth = data._claimMinimumWidth || defaultSettings._claimMinimumWidth;
        settings._disallowedBlocks = data._disallowedBlocks || defaultSettings._disallowedBlocks;
        return settings;
    }
}

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
export enum PermissionTypes {
    ENTER_CLAIM = "enterClaim",
    BREAK_BLOCKS = "breakBlocks",
    USE_ITEMS_ON_BLOCKS = "useItemsOnBlocks",
    HURT_ENTITIES = "hurtEntities",
    USE_TNT = "useTNT",
    INTERACT_WITH_ENTITIES = "interactWithEntities",
    USE_DOORS = "useDoors",
    USE_SWITCHES = "useSwitches",
    USE_BEDS = "useBeds",
    OPEN_CONTAINERS = "openContainers",
    EDIT_SIGNS = "editSigns"
}

/**
 * Represents a player's permissions in a claim.
 */
export class PlayerPermissions {
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
        useBeds: boolean;
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
            [PermissionTypes.USE_BEDS]: false,
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
        // check if the permission is valid
        if (this._permissions[permission] != undefined) {
            return this._permissions[permission];
        }
        else {
            console.log(`Invalid permission: ${permission} for player: ${this._name}`);
            return false;
        }
    }

    setPermission(permission: PermissionTypes, value: boolean): void {

        // check if the permission is valid
        if (this._permissions[permission] != undefined) {
            this._permissions[permission] = value;
        }
        else {
            console.log(`Invalid permission: ${permission} for player: ${this._name}`);
        }
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
        permissions.setPermission(PermissionTypes.USE_BEDS, data._permissions?.useBeds !== undefined ? data._permissions.useBeds : defaultPermissions.getPermission(PermissionTypes.USE_BEDS));
        permissions.setPermission(PermissionTypes.OPEN_CONTAINERS, data._permissions?.openContainers !== undefined ? data._permissions.openContainers : defaultPermissions.getPermission(PermissionTypes.OPEN_CONTAINERS));
        permissions.setPermission(PermissionTypes.EDIT_SIGNS, data._permissions?.editSigns !== undefined ? data._permissions.editSigns : defaultPermissions.getPermission(PermissionTypes.EDIT_SIGNS));
        return permissions;
    }
}

/**
 * Represents a land claim in the world.
 */
export class Claim {
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
            [PermissionTypes.USE_BEDS]: false,
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
    getPermission(permission: PermissionTypes): boolean {
        // check if the permission is valid
        if (this._publicPermissions[permission] != undefined) {
            return this._publicPermissions[permission];
        }
        else {
            console.log(`Invalid permission: ${permission} for claim ${this._name}`);
            return false;
        }
    }

    // Set a specific public permission
    setPermission(permission: PermissionTypes, value: boolean): void {
        // check if the permission is valid
        if (this._publicPermissions[permission] != undefined) {
            this._publicPermissions[permission] = value;
        }
        else {
            console.log(`Invalid permission: ${permission} for claim ${this._name}`);
        }
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

    removePlayerPermissions(playerId: string) {

        // find the player permissions object
        var playerPermissions: PlayerPermissions = undefined;

        for (var p of this._playerPermissionsList) {
            if (p.id == playerId) {
                playerPermissions = p;
                break;
            }
        }

        this._playerPermissionsList.splice(this._playerPermissionsList.indexOf(playerPermissions), 1);

        saveDb();
    }

    getSize(): {width: number, length: number, area: number} {
        const width = Math.abs(this._start.x - this._end.x) + 1;
        const length = Math.abs(this._start.z - this._end.z) + 1;
        const area = width * length;
        return { width, length, area };
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
            enterClaim: data._publicPermissions?.enterClaim !== undefined ? data._publicPermissions.enterClaim : defaultClaim.getPermission(PermissionTypes.ENTER_CLAIM),
            breakBlocks: data._publicPermissions?.breakBlocks !== undefined ? data._publicPermissions.breakBlocks : defaultClaim.getPermission(PermissionTypes.BREAK_BLOCKS),
            useItemsOnBlocks: data._publicPermissions?.useItemsOnBlocks !== undefined ? data._publicPermissions.useItemsOnBlocks : defaultClaim.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS),
            hurtEntities: data._publicPermissions?.hurtEntities !== undefined ? data._publicPermissions.hurtEntities : defaultClaim.getPermission(PermissionTypes.HURT_ENTITIES),
            useTNT: data._publicPermissions?.useTNT !== undefined ? data._publicPermissions.useTNT : defaultClaim.getPermission(PermissionTypes.USE_TNT),
            interactWithEntities: data._publicPermissions?.interactWithEntities !== undefined ? data._publicPermissions.interactWithEntities : defaultClaim.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES),
            useDoors: data._publicPermissions?.useDoors !== undefined ? data._publicPermissions.useDoors : defaultClaim.getPermission(PermissionTypes.USE_DOORS),
            useSwitches: data._publicPermissions?.useSwitches !== undefined ? data._publicPermissions.useSwitches : defaultClaim.getPermission(PermissionTypes.USE_SWITCHES),
            useBeds: data._publicPermissions?.useBeds !== undefined ? data._publicPermissions.useBeds : defaultClaim.getPermission(PermissionTypes.USE_BEDS),
            openContainers: data._publicPermissions?.openContainers !== undefined ? data._publicPermissions.openContainers : defaultClaim.getPermission(PermissionTypes.OPEN_CONTAINERS),
            editSigns: data._publicPermissions?.editSigns !== undefined ? data._publicPermissions.editSigns : defaultClaim.getPermission(PermissionTypes.EDIT_SIGNS)
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
    hasPermission(permission: PermissionTypes, player?: Player): boolean {

        // check if player is in specific permissions list
        if (player) {
            
            var playerPermissions: PlayerPermissions = undefined;

            // find the players permissions
            for (var p of this._playerPermissionsList) {
                if (p.id == player.id) {
                    playerPermissions = p;
                    break;
                }
            }
        }
        // if player is not in the list, use public permissions
        return playerPermissions ? playerPermissions.getPermission(permission) : this._publicPermissions[permission];
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

    /**
     * Returns a list of player id's that are not saved in the public permissions list
     */
    getUnsavedPlayers(): string[] {
        // player permissions not found in the claims list
        var unsavedPlayers: string[] = []

        // get the entire list of players that have ever joined the world
        for (var playerData of database) {
            unsavedPlayers.push(playerData.id);
        }

        // filter players from the list, we don't want to add people who are already in it
        unsavedPlayers = unsavedPlayers.filter((p) => {
            for (var playerPermissions of this.playerPermissionsList) {
                if (p == playerPermissions.id) {
                    return false;
                }
            }

            // make sure to remove owner from list as well
            if (p == this.getOwnerData().id) {
                return false;
            }

            return true;
        });

        return unsavedPlayers;
    }

    /**
     * Returns the PlayerData object of the owner of the claim
     * 
     * @returns - The PlayerData object of the owner of the claim
     */
    getOwnerData(): PlayerData {

        for (var pd of database){
            if (pd.claims.includes(this)) {
                return pd;
            }
        }

        return undefined;

    }
}

export class PlayerClaimBlocks {
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

export class PlayerData {
    readonly schemaVersion: number[] = [0, 1, 0]; // version 0.1.0

    private _id: string;
    private _name: string;
    private _inClaim: boolean;
    private _itemCharged: boolean;
    private _viewingClaim: boolean;
    private _resizingClaimName: string;
    private _firstPoint: Vector3;
    private _oppositeCorner: Vector3;
    private _entranceVelocity: Vector3;
    private _previousLocation: Vector3;
    private _pendingEntranceDisallow: boolean;
    private _claimBlocks: PlayerClaimBlocks;
    private _claims: Claim[];

    constructor(playerID: string, playerName: string) {
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

    get itemCharged(): boolean {
        return this._itemCharged;
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

    get previousLocation(): Vector3 {
        return this._previousLocation;
    }

    get pendingEntranceDisallow(): boolean {
        return this._pendingEntranceDisallow;
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

    setItemCharged(value: boolean): void {
        this._itemCharged = value;
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

    setPreviousLocation(value: Vector3): void {
        this._previousLocation = value;
        saveDb();
    }

    setPendingEntranceDisallow(value: boolean): void {
        this._pendingEntranceDisallow = value;
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

    /**
     * Deletes this PlayerData object from the database.
     */
    delete(): void {
        // remove player from database
        database = database.filter((p) => p.id !== this._id);

        // remove player from world dynamic properties
        world.setDynamicProperty(`db.${this._id}`, undefined);

        // recursively remove players permissions from all claims
        for (var pData of database) {
            for (var claim of pData.claims) {
                claim.removePlayerPermissions(this._id);
            }
        }

        saveDb();
    }

    static fromJSON(data: any): PlayerData {

        const defaultPlayerData = new PlayerData(data._id, data._name);
        const playerData = new PlayerData(data._id, data._name);
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
            ? data._claims.map(Claim.fromJSON).filter(claim => claim._name != "Undefined") 
            : defaultPlayerData.claims;
        return playerData;
    }

    /**
     * Returns the players data including claims
     * 
     * @param playerId - The entity id of the player
     */
    static fromId(playerId: string): PlayerData {
    
        for (var player of database) {
            if (playerId == player.id) {
                return player;
            }
        }
    }
}

export var database: PlayerData[] = [];

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

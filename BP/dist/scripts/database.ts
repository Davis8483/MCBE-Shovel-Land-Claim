import { world, Vector3, Player, system } from "@minecraft/server";

export enum ShovelBehavior {
    LOCK_TO_INVENTORY = 0,
    GIVE_AT_SPAWN = 1,
    MUST_BE_CRAFTED = 2
}

/**
 * An object containing global settings for the addon
 */
export class Settings{
    private _claimBlockHourlyPayment: number;
    private _startingClaimBlocks: number;
    private _claimMinimumWidth: number;
    private _disallowedBlocks: string[];
    private _maxClaimAmount: number;
    private _claimShovelItemBehavior: ShovelBehavior;

    /**
     * Creates a new Settings object with default values
     */
    constructor(){
        this._claimBlockHourlyPayment = 100;
        this._startingClaimBlocks = 200;
        this._claimMinimumWidth = 8;
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
        this._maxClaimAmount = 0;
        this._claimShovelItemBehavior = ShovelBehavior.LOCK_TO_INVENTORY;
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
    /**
     * The maximum number of claims a player can have, 0 means unlimited
     */
    get maxClaimAmount(): number {
        return this._maxClaimAmount;
    }

    get claimShovelItemBehavior(): ShovelBehavior {
        return this._claimShovelItemBehavior;
    }

    setClaimBlockHourlyPayment(value: number) {
        this._claimBlockHourlyPayment = value;
    }
    setStartingClaimBlocks(value: number) {
        this._startingClaimBlocks = value;
    }
    setClaimMinimumWidth(value: number) {
        this._claimMinimumWidth = value;
    }
    /**
     * 
     * @param value - The maximum number of claims a player can have, 0 means unlimited
     */
    setMaxClaimAmount(value: number) {
        this._maxClaimAmount = value;
    }
    /**
     * Adds a block to the disallowed blocks list
     * 
     * @param blockId - The block to add to the disallowed blocks list
     */
    addDisallowedBlock(blockId: string) {
        this._disallowedBlocks.push(blockId);
    }

    /**
     * Removes a block from the disallowed blocks list
     * 
     * @param blockId - The block to remove from the disallowed blocks list
     */
    removeDisallowedBlock(blockId: string) {
        this._disallowedBlocks = this._disallowedBlocks.filter((block) => block !== blockId);
    }
    
    /**
     * Determines how the claim shovel item is given to the player.
     * 
     * @param value - The type of item behavior, lock to inventory; give at spawn; crafting only
     */
    setClaimShovelItemBehavior(value: ShovelBehavior) {
        this._claimShovelItemBehavior = value;
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
        settings._maxClaimAmount = data._maxClaimAmount || defaultSettings._maxClaimAmount;
        settings._claimShovelItemBehavior = data._claimShovelItemBehavior || defaultSettings._claimShovelItemBehavior;
        return settings;
    }
}

export enum PermissionTypes {
    ENTER_CLAIM = "enterClaim",
    BREAK_BLOCKS = "breakBlocks",
    USE_ITEMS_ON_BLOCKS = "useItemsOnBlocks",
    HURT_MOBS = "hurtMobs",
    HURT_MONSTERS = "hurtMonsters",
    HURT_PLAYERS = "hurtPlayers",
    USE_TNT = "useTNT",
    INTERACT_WITH_ENTITIES = "interactWithEntities",
    USE_DOORS = "useDoors",
    USE_SWITCHES = "useSwitches",
    USE_BEDS = "useBeds",
    OPEN_CONTAINERS = "openContainers",
    INTERACT_WITH_ITEM_DISPLAYS = "interactWithItemDisplays",
    EDIT_SIGNS = "editSigns"
}

/**
 * Represents global player permissions, claim public, and claim global permissisons
 */
export class Permissions {
    /**
     * The permissions the player has for the claim
     */
    private _permissions: {
        [key in PermissionTypes]: boolean;
    }

    /**
     * Creates a new PlayerPermissions object
     * 
     * @param id - The entity id of the player
     * 
     * @param name - The name of the player
     */
    constructor() {
        this._permissions = {
            [PermissionTypes.ENTER_CLAIM]: true,
            [PermissionTypes.BREAK_BLOCKS]: false,
            [PermissionTypes.USE_ITEMS_ON_BLOCKS]: false,
            [PermissionTypes.HURT_MOBS]: false,
            [PermissionTypes.HURT_MONSTERS]: true,
            [PermissionTypes.HURT_PLAYERS]: false,
            [PermissionTypes.USE_TNT]: false,
            [PermissionTypes.INTERACT_WITH_ENTITIES]: false,
            [PermissionTypes.USE_DOORS]: true,
            [PermissionTypes.USE_SWITCHES]: true,
            [PermissionTypes.USE_BEDS]: false,
            [PermissionTypes.OPEN_CONTAINERS]: false,
            [PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS]: false,
            [PermissionTypes.EDIT_SIGNS]: false,
        };
    }

    getPermission(permission: PermissionTypes): boolean {
        // check if the permission is valid
        if (this._permissions[permission] != undefined) {
            return this._permissions[permission];
        }
        else {
            console.log(`Invalid permission: ${permission}`);
            return false;
        }
    }

    setPermission(permission: PermissionTypes, value: boolean): void {

        // check if the permission is valid
        if (this._permissions[permission] != undefined) {
            this._permissions[permission] = value;
        }
        else {
            console.log(`Invalid permission: ${permission}`);
        }
    }

    /**
     * Returns a PlayerPermissions object loaded from JSON, if a key is missing it will be replaced with the default value.
     * 
     * @param data - The JSON object to load the PlayerPermissions object from
     * 
     * @return - The PlayerPermissions object loaded from the JSON object
     */
    static fromJSON(data: any): Permissions {
        const defaultPermissions = new Permissions();
        const permissions = new Permissions();
        permissions.setPermission(PermissionTypes.ENTER_CLAIM, data._permissions?.enterClaim !== undefined ? data._permissions.enterClaim : defaultPermissions.getPermission(PermissionTypes.ENTER_CLAIM));
        permissions.setPermission(PermissionTypes.BREAK_BLOCKS, data._permissions?.breakBlocks !== undefined ? data._permissions.breakBlocks : defaultPermissions.getPermission(PermissionTypes.BREAK_BLOCKS));
        permissions.setPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS, data._permissions?.useItemsOnBlocks !== undefined ? data._permissions.useItemsOnBlocks : defaultPermissions.getPermission(PermissionTypes.USE_ITEMS_ON_BLOCKS));
        permissions.setPermission(PermissionTypes.HURT_MOBS, data._permissions?.hurtMobs !== undefined ? data._permissions.hurtMobs : defaultPermissions.getPermission(PermissionTypes.HURT_MOBS));
        permissions.setPermission(PermissionTypes.HURT_MONSTERS, data._permissions?.hurtMonsters !== undefined ? data._permissions.hurtMonsters : defaultPermissions.getPermission(PermissionTypes.HURT_MONSTERS));
        permissions.setPermission(PermissionTypes.HURT_PLAYERS, data._permissions?.hurtPlayers !== undefined ? data._permissions.hurtPlayers : defaultPermissions.getPermission(PermissionTypes.HURT_PLAYERS));
        permissions.setPermission(PermissionTypes.INTERACT_WITH_ENTITIES, data._permissions?.interactWithEntities !== undefined ? data._permissions.interactWithEntities : defaultPermissions.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES));
        permissions.setPermission(PermissionTypes.USE_DOORS, data._permissions?.useDoors !== undefined ? data._permissions.useDoors : defaultPermissions.getPermission(PermissionTypes.USE_DOORS));
        permissions.setPermission(PermissionTypes.USE_SWITCHES, data._permissions?.useSwitches !== undefined ? data._permissions.useSwitches : defaultPermissions.getPermission(PermissionTypes.USE_SWITCHES));
        permissions.setPermission(PermissionTypes.USE_BEDS, data._permissions?.useBeds !== undefined ? data._permissions.useBeds : defaultPermissions.getPermission(PermissionTypes.USE_BEDS));
        permissions.setPermission(PermissionTypes.OPEN_CONTAINERS, data._permissions?.openContainers !== undefined ? data._permissions.openContainers : defaultPermissions.getPermission(PermissionTypes.OPEN_CONTAINERS));
        permissions.setPermission(PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS, data._permissions?.interactWithItemDisplays !== undefined ? data._permissions.interactWithItemDisplays : defaultPermissions.getPermission(PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS));
        permissions.setPermission(PermissionTypes.EDIT_SIGNS, data._permissions?.editSigns !== undefined ? data._permissions.editSigns : defaultPermissions.getPermission(PermissionTypes.EDIT_SIGNS));
        return permissions;
    }
}

export class PlayerPermissions extends Permissions {
    /**
    * The entity id of the player
    */
    private _id: string;

    /**
     * The name of the player; do not use for identification as it can change.
     */
    private _name: string;

    /**
     * Creates a new PlayerPermissions object
     * 
     * @param id - The entity id of the player
     * 
     * @param name - The name of the player
     */
    constructor(id: string, name: string) {
        super();

        this._id = id;
        this._name = name;
    }

    // Getters
    get id(): string {
        return this._id;
    }

    get name(): string {
        return this._name;
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
        permissions.setPermission(PermissionTypes.HURT_MOBS, data._permissions?.hurtMobs !== undefined ? data._permissions.hurtMobs : defaultPermissions.getPermission(PermissionTypes.HURT_MOBS));
        permissions.setPermission(PermissionTypes.HURT_MONSTERS, data._permissions?.hurtMonsters !== undefined ? data._permissions.hurtMonsters : defaultPermissions.getPermission(PermissionTypes.HURT_MONSTERS));
        permissions.setPermission(PermissionTypes.HURT_PLAYERS, data._permissions?.hurtPlayers !== undefined ? data._permissions.hurtPlayers : defaultPermissions.getPermission(PermissionTypes.HURT_PLAYERS));
        permissions.setPermission(PermissionTypes.INTERACT_WITH_ENTITIES, data._permissions?.interactWithEntities !== undefined ? data._permissions.interactWithEntities : defaultPermissions.getPermission(PermissionTypes.INTERACT_WITH_ENTITIES));
        permissions.setPermission(PermissionTypes.USE_DOORS, data._permissions?.useDoors !== undefined ? data._permissions.useDoors : defaultPermissions.getPermission(PermissionTypes.USE_DOORS));
        permissions.setPermission(PermissionTypes.USE_SWITCHES, data._permissions?.useSwitches !== undefined ? data._permissions.useSwitches : defaultPermissions.getPermission(PermissionTypes.USE_SWITCHES));
        permissions.setPermission(PermissionTypes.USE_BEDS, data._permissions?.useBeds !== undefined ? data._permissions.useBeds : defaultPermissions.getPermission(PermissionTypes.USE_BEDS));
        permissions.setPermission(PermissionTypes.OPEN_CONTAINERS, data._permissions?.openContainers !== undefined ? data._permissions.openContainers : defaultPermissions.getPermission(PermissionTypes.OPEN_CONTAINERS));
        permissions.setPermission(PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS, data._permissions?.interactWithItemDisplays !== undefined ? data._permissions.interactWithItemDisplays : defaultPermissions.getPermission(PermissionTypes.INTERACT_WITH_ITEM_DISPLAYS));
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
    private _permissions: Permissions;

    constructor(name: string, start: Vector3, end: Vector3, icon: string, particlesEnabled: boolean = true) {
        this._name = name;
        this._start = start;
        this._end = end;
        this._icon = icon;
        this._particlesEnabled = particlesEnabled;
        this._playerPermissionsList = [];
        this._permissions = new Permissions();
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

    /**
     * Returns a list of permissions for individual players.
     */
    get playerPermissionsList(): PlayerPermissions[] {
        return this._playerPermissionsList;
    }

    /**
     * Returns the public permissions for the claim.
     */
    get permissions(): Permissions {
        return this._permissions;
    }

    // Setters
    setName(value: string) {
        this._name = value;
    }

    setStart(value: Vector3) {
        this._start = value;
    }

    setEnd(value: Vector3) {
        this._end = value;
    }

    setIcon(value: string) {
        this._icon = value;
    }

    setParticlesEnabled(value: boolean) {
        this._particlesEnabled = value;
    }

    addPlayerPermissions(playerPermissions: PlayerPermissions) {
        this._playerPermissionsList.push(playerPermissions);
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

        claim._permissions = Permissions.fromJSON(data._permissions || {});

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

        var perms: Permissions = this.permissions;

        if (player) {

            // if the player is the owner of the claim then they have all permissions
            if (player.id == this.getOwnerData().id) {
                return true;
            }

            var globalSearchResult = this.getOwnerData().playerPermissionsList.filter((p) => p.id == player.id);
            var claimSearchResult = this._playerPermissionsList.filter((p) => p.id == player.id);

            // check if player is in the claims permissions list
            if (claimSearchResult.length > 0) {
                perms = claimSearchResult[0];
            }
            // check if player is in global permissions list
            else if (globalSearchResult.length > 0) {
                perms = globalSearchResult[0];
            }
        }

        // check if the permission is valid
        if (perms.getPermission(permission) != undefined) {
            return perms.getPermission(permission);
        }
        // the permission is somehow invalid, just return false
        else {
            return false;
        }
    }

    /**
     * returns if the specified area overlaps with the claim
     * 
     * @param start - The block representing the first corner of the area, or single point
     * @param end - The block representing the opposite second corner of the area, not required
     * @param margin - The margin to use when checking for overlap, not required
    */
    isOverlap(start: Vector3, end?: Vector3, margin?: number): boolean {
        if (!end) {
            end = start;
        }

        // Get the left, right, bottom, and top coordinates of each rectangle
        var rect1Left = Math.min(this._start.x, this._end.x);
        var rect1Right = Math.max(this._start.x, this._end.x);
        var rect1Top = Math.max(this._start.z, this._end.z);
        var rect1Bottom = Math.min(this._start.z, this._end.z);

        var rect2Left = Math.min(start.x, end.x);
        var rect2Right = Math.max(start.x, end.x);
        var rect2Top = Math.max(start.z, end.z);
        var rect2Bottom = Math.min(start.z, end.z);

        if (margin) {
            // Expand the rectangles by the margin
            rect1Left -= margin;
            rect1Right += margin;
            rect1Top += margin;
            rect1Bottom -= margin;

            rect2Left -= margin;
            rect2Right += margin;
            rect2Top += margin;
            rect2Bottom -= margin;
        }

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

            if (this._playerPermissionsList.some((pP) => p == pP.id)) {
                return false;
            }

            // make sure to remove owner from list as well
            if (p == this.getOwnerData().id) {
                return false;
            }

            // also remove players who have permissions in the global list
            if (this.getOwnerData().playerPermissionsList.some((pP) => p == pP.id)) {
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

export enum ClaimBlocksBehavior {
    /** Claim blocks are required to claim/resize; the balance is added to hourly */
    DEFAULT = 0,
    /** Claim blocks are still required to claim/resize; there is no way to obtain more blocks unless given by an operator  */
    DISABLE_HOURLY_PAYMENT = 1,
    /** Any restrictions requiring claim blocks are removed and the ui hides anything mentioning claim blocks */
    UNLIMITED = 2
}

export class PlayerClaimBlocks {
    private _amount: number;
    private _paymentTimeRemaining: number;
    private _behavior: ClaimBlocksBehavior;

    constructor(amount: number, paymentTimeRemaining: number) {
        this._amount = amount;
        this._paymentTimeRemaining = paymentTimeRemaining;
        this._behavior = ClaimBlocksBehavior.DEFAULT;
    }

    // Getters
    get amount(): number {
        return this._amount;
    }

    get paymentTimeRemaining(): number {
        return this._paymentTimeRemaining;
    }

    get behavior(): ClaimBlocksBehavior {
        return this._behavior;
    }

    /**
     * This should only be used within the op panel to edit player data
     * 
     * @param value - number of claim blocks
     */
    setAmount(value: number): void {
        this._amount = value;
    }

    /**
     * A utility function that increases a players claim block balance.
     * This should only be used for claim creation and resizing as it will be disabled if the player has unlimited claim blocks.
     * 
     * @param value - number of claim blocks
     */
    incrementAmount(value: number): void {
        if (this._behavior != ClaimBlocksBehavior.UNLIMITED) {
            this._amount += value;
        }
    }

    /**
     * A utility function that decreases a players claim block balance.
     * This should only be used for claim creation and resizing as it will be disabled if the player has unlimited claim blocks.
     * 
     * @param value - number of claim blocks
     */
    decrementAmount(value: number): void {
        if (this._behavior != ClaimBlocksBehavior.UNLIMITED) {
            this._amount -= value;
        }
    }

    decrementPaymentTime(): void {
        this._paymentTimeRemaining -= 1;
    }

    resetPaymentTime(): void {
        this._paymentTimeRemaining = 60; // reset to 60 minutes; 1 hour
    }

    setBehavior(value: ClaimBlocksBehavior): void {
        this._behavior = value;
    }

    static fromJSON(data: any): PlayerClaimBlocks {
        var playerClaimBlocks = new PlayerClaimBlocks(data._amount || settings.startingClaimBlocks, data._paymentTimeRemaining || 60);
        playerClaimBlocks.setBehavior(data._behavior || ClaimBlocksBehavior.DEFAULT);

        return playerClaimBlocks
    }
}

/**
 *  only used for mobile players, used to switch between opening the menu and creating/resizing claims
 */
export enum ShovelMobileMode {
    MENU = "menu",
    CLAIM = "claim"
}

export class PlayerData {
    private _schemaVersion: string;
    private _shownChangeLog: boolean;
    private _shownSetupScreen: boolean;
    private _id: string;
    private _name: string;
    private _mobileMode: ShovelMobileMode | null;
    private _inClaim: boolean;
    private _viewingClaim: boolean;
    private _resizingClaimName: string;
    private _firstPoint: Vector3 | null;
    private _oppositeCorner: Vector3;
    private _entranceVelocity: Vector3;
    private _previousLocation: Vector3;
    private _pendingEntranceDisallow: boolean;
    private _claimBlocks: PlayerClaimBlocks;
    private _claims: Claim[];
    private _playerPermissionsList: PlayerPermissions[];

    constructor(playerID: string, playerName: string) {
        this._schemaVersion = "v1.0.5";
        this._shownChangeLog = true; // default to true so new players don't see the changelog
        this._shownSetupScreen = false; // default to false so all admins can go through the setup ui
        this._id = playerID;
        this._name = playerName;
        this._mobileMode = null;
        this._inClaim = false;
        this._viewingClaim = false;
        this._resizingClaimName = "";
        this._firstPoint = null; // null means the player has not set the first point yet
        this._oppositeCorner = { x: 0, y: 0, z: 0 };
        this._entranceVelocity = { x: 0, y: 0, z: 0 };
        this._previousLocation = { x: 0, y: 0, z: 0 };
        this._pendingEntranceDisallow = false;
        this._claimBlocks = new PlayerClaimBlocks(settings.startingClaimBlocks, 60); // 60 minutes; 1 hour
        this._claims = [];
        this._playerPermissionsList = [];
    }

    // Getters
    get id(): string {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    /**
     * Only used for mobile players, used to switch between opening the menu and creating/resizing claims.
     * 
     * Should be set back to null when no longer on mobile platform.
     */
    get mobileMode(): ShovelMobileMode | null {
        return this._mobileMode;
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

    get playerPermissionsList(): PlayerPermissions[] {
        return this._playerPermissionsList;
    }

    get schemaVersion(): string {
        return this._schemaVersion;
    }

    get shownChangeLog(): boolean {
        return this._shownChangeLog;
    }

    get shownSetupScreen(): boolean {
        return this._shownSetupScreen;
    }

    /**
     *  Setting this to false will show the setup screen to the player if they are an admin when first opening the claim shovel.
     * 
     * @param value - Whether the admin has seen the setup screen or not.
     */
    setShownSetupScreen(value: boolean) {
        this._shownSetupScreen = value;
    }

    /**
     * Setting this to false will show the changelog to the player.
     * 
     * @param value - Whether the changelog has been shown to the player or not.
     */
    setShownChangeLog(value: boolean): void {
        this._shownChangeLog = value;
    }

    private setSchemaVersion(version: string): void {
        this._schemaVersion = version;
    }

    setName(newName: string): void {
        this._name = newName;
    }

    /**
     * Switch between opening the menu and creating/resizing claims when using the claim shovel on mobile.
     * 
     * @param value - Should be set back to null when no longer on mobile platform.
     */
    setMobileMode(value: ShovelMobileMode | null): void {
        this._mobileMode = value;
    }

    setInClaim(value: boolean): void {
        this._inClaim = value;
    }

    setViewingClaim(value: boolean): void {
        this._viewingClaim = value;
    }

    setResizingClaimName(value: string): void {
        this._resizingClaimName = value;
    }

    setFirstPoint(value: Vector3 | null): void {
        this._firstPoint = value;
    }

    setOppositeCorner(value: Vector3): void {
        this._oppositeCorner = value;
    }

    setEntranceVelocity(value: Vector3): void {
        this._entranceVelocity = value;
    }

    setPreviousLocation(value: Vector3): void {
        this._previousLocation = value;
    }

    setPendingEntranceDisallow(value: boolean): void {
        this._pendingEntranceDisallow = value;
    }

    addClaim(claim: Claim): void {
        this._claims.push(claim);
    }

    removeClaim(claim: Claim): void {
        this._claims = this._claims.filter((c) => c !== claim);
    }

    getClaim(claimName: string): Claim | undefined {
        return this._claims.find((c) => c.name === claimName);
    }

    addPlayerPermissions(playerPermissions: PlayerPermissions): void {
        this._playerPermissionsList.push(playerPermissions);
    }

    removePlayerPermissions(playerId: string): void {
        this._playerPermissionsList = this._playerPermissionsList.filter((p) => p.id !== playerId);
    }

    getPlayerPermissions(playerId: string): PlayerPermissions | undefined {
        return this._playerPermissionsList.find((p) => p.id === playerId);
    }

    /**
     * Returns a list of player id's that are not saved in the global player permissions list
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
            for (var playerPermissions of this._playerPermissionsList) {
                if (p == playerPermissions.id) {
                    return false;
                }
            }

            // make sure to remove owner from list as well
            if (p == this.id) {
                return false;
            }

            return true;
        });

        return unsavedPlayers;
    }

    /**
     * Calculates the distance between the current location and the previous location.
     * Used to determine if the player has teleported.
     * Player must be online otherwise it will return undefined.
     * 
     * @return - The distance between the current location and the previous location in blocks
     */
    distanceToPrevLocation(): number | undefined {

        const player = world.getPlayers().find(p => p.id === this._id);

        if (!player) {
            return undefined; // player is not online
        }

        const currentLocation = player.location;
        const previousLocation = this._previousLocation;

        // calculate the distance using pythagorean theorem
        const distance = Math.sqrt(
            Math.pow(currentLocation.x - previousLocation.x, 2) +
            Math.pow(currentLocation.y - previousLocation.y, 2) +
            Math.pow(currentLocation.z - previousLocation.z, 2)
        );

        return distance;
    }

    /**
     * Deletes this PlayerData object from the database.
     */
    delete(): void {
        // remove player from database
        database = database.filter((p) => p.id !== this._id);

        // remove player from world dynamic properties
        world.setDynamicProperty(`db.${this._id}`, undefined);

        for (var pData of database) {
            // recursively remove players permissions from all claims
            for (var claim of pData.claims) {
                claim.removePlayerPermissions(this._id);
            }

            // remove players permissions from global permissions list
            pData.removePlayerPermissions(this._id);

        }
    }

    /**
     * Compares two semantic version strings. Used for database upgrades.
     * 
     * @param version1 - First version string (e.g., "v1.0.3" or "1.0.3")
     * @param version2 - Second version string (e.g., "v1.0.4" or "1.0.4")
     * @returns 0 if equal, 1 if version1 > version2, -1 if version1 < version2
     */
    private static compareVersions(version1: string, version2: string): number {
        // Remove 'v' prefix if present
        const v1 = version1.replace(/^v/, '');
        const v2 = version2.replace(/^v/, '');
        
        // Split versions into parts and convert to numbers
        const parts1 = v1.split('.').map(part => parseInt(part, 10));
        const parts2 = v2.split('.').map(part => parseInt(part, 10));
        
        // Compare each part (major, minor, patch)
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            
            if (part1 > part2) return 1;
            if (part1 < part2) return -1;
        }
        
        return 0;
    }

    /**
     * Check if a version is newer than another version. Used for database upgrades.
     * 
     * @param current - Current version string
     * @param target - Target version string to compare against
     * @returns true if current version is newer than target
     */
    private static isVersionNewerThan(current: string, target: string): boolean {
        return this.compareVersions(current, target) > 0;
    }

    static fromJSON(data: any): PlayerData {

        const defaultPlayerData = new PlayerData(data._id, data._name);
        const playerData = new PlayerData(data._id, data._name);

        // this will be used in future releases to migrate PlayerData to the latest version
        const currentSchemaVersion = data._schemaVersion;
        const latestSchemaVersion = defaultPlayerData.schemaVersion;

        playerData.setShownChangeLog(data._shownChangeLog !== undefined ? data._shownChangeLog : defaultPlayerData.shownChangeLog);
        playerData.setShownSetupScreen(data._shownSetupScreen !== undefined ? data._shownSetupScreen : defaultPlayerData.shownSetupScreen);
        playerData.setInClaim(data._inClaim !== undefined ? data._inClaim : defaultPlayerData.inClaim);
        playerData.setMobileMode(data._mobileMode || defaultPlayerData.mobileMode);
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

        playerData._playerPermissionsList = data._playerPermissionsList 
        ? data._playerPermissionsList
        .map(PlayerPermissions.fromJSON)
        .filter(permission => permission.id !== undefined && permission.name !== undefined) 
        : defaultPlayerData.playerPermissionsList;

        // upgrading from v1.0.2 to v1.0.3, schema version is broken in v1.0.2
        if (currentSchemaVersion == undefined) {
            /**
             * v1.0.3 only adds new properties, this should be handeled already by this fromJSON function
             */
            
            // fromJSON only loads existing players, set the flag so they see the changelog
            playerData.setShownChangeLog(false);

            // set to false so all admins can go through the setup ui
            playerData.setShownSetupScreen(false);

            playerData.setSchemaVersion("v1.0.3");
            
        }
        // upgrading from v1.0.3 to future versions, go through each upgrade until target schema version is reached
        else if (this.isVersionNewerThan(latestSchemaVersion, currentSchemaVersion)) {

            // fromJSON only loads existing players, set the flag so they see the changelog
            playerData.setShownChangeLog(false);

            // set to false so all admins can go through the setup ui; should be done every update as a reminder
            playerData.setShownSetupScreen(false);
         
            // v1.0.3 -> v1.0.4 migration logic
            if (currentSchemaVersion === "v1.0.3" && this.isVersionNewerThan(latestSchemaVersion, "v1.0.3")) {

                /**
                 * migrates hurtEntities preferences to the 3 new permission types
                 * 
                 * @param perms - The permissions object to upgrade
                 * @param hurtEntities - The old hurtEntities preference
                 */
                const upgradePerms = (perms: PlayerPermissions | Permissions, hurtEntities: boolean) => {
                    perms.setPermission(PermissionTypes.HURT_MOBS, hurtEntities); // use preference
                    perms.setPermission(PermissionTypes.HURT_MONSTERS, true); // default to true
                    perms.setPermission(PermissionTypes.HURT_PLAYERS, hurtEntities); // use preference
                };

                // upgrade global player perms
                data._playerPermissionsList.forEach((playerPerms) => {
                    const playerPermsCurrent = playerData.playerPermissionsList.find(p => p.id === playerPerms._id);
                    upgradePerms(playerPermsCurrent, playerPerms._permissions.hurtEntities);
                });

                data._claims.forEach((claim) => {
                    const claimCurrent = playerData.claims.find(c => c.name === claim._name);

                    // update claim specific player perms
                    claim._playerPermissionsList.forEach((playerPerms) => {
                        const playerPermsCurrent = claimCurrent.playerPermissionsList.find(p => p.id === playerPerms._id);
                        upgradePerms(playerPermsCurrent, playerPerms._permissions.hurtEntities);
                    });

                    // update claim public perms
                    upgradePerms(claimCurrent.permissions, claim._permissions._permissions.hurtEntities);
                });

                playerData.setSchemaVersion("v1.0.4");
            }

            // v1.0.4 -> v1.0.5 migration logic
            if (currentSchemaVersion === "v1.0.4" && this.isVersionNewerThan(latestSchemaVersion, "v1.0.4")) {
                // only a permission was added which fromJSON already handles
                
                playerData.setSchemaVersion("v1.0.5");
            }
        }

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
export var settings: Settings;

world.afterEvents.worldLoad.subscribe(() => {
    // make sure settings exist
    if (!world.getDynamicPropertyIds().includes("settings")) {
        world.setDynamicProperty("settings", JSON.stringify(new Settings()));
    }

    // load settings and make sure it contains necessary keys
    settings = Settings.fromJSON(JSON.parse(world.getDynamicProperty("settings").toString()));

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
});

/**
 * Transfers the database from memory into long term storage using dynamic world properties
 */
function saveDb() {
    for (var playerData of database) {
        // deconstruct database to save each players data as an individual dynamic property
        world.setDynamicProperty(`db.${playerData.id}`, JSON.stringify(playerData));
    }
}

/**
 * Provide a function for saving the setttings
 */
function saveSettings() {
    world.setDynamicProperty("settings", JSON.stringify(settings));
}

// save the database and settings when the world is shutting down
system.beforeEvents.shutdown.subscribe(() => {
    saveDb();
    saveSettings();
});

// periodically save the database and settings every minute in case of a crash
system.runInterval(() => {
    saveDb();
    saveSettings();
}, 20 * 60); // 20 ticks per second
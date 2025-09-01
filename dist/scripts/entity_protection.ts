import { Dimension, Entity, EntityComponentTypes, EntityLeashableComponent, EntityQueryOptions, StructureManager, StructureSaveMode, system, Vector3, world } from '@minecraft/server';
import { DropTimerManager, waitForEntityLoad } from './utils.js';

/**
 * Manages the loading and saving of entity data. Utilizing a drop timer to prevent unnecessary loading.
 * 
 * Implimented to prevent entities killed by lava from being duped (since that runs the hurtEntities event twice), especially low health entities which cause an exponential increase in entity count leading to a server crash.
 */
export class EntityLoaderManager extends DropTimerManager {

    /**
     * Deletes the entity save for the specified entity ID from the worlds structure manager.
     * 
     * @param entityID - The ID of the entity to delete the save for
     */
    public deleteSave(entityID: string): void {
        const structureID = "slc:" + entityID;
        const existingStructure = world.structureManager.get(structureID);

        if (existingStructure) {
            world.structureManager.delete(existingStructure);
        }
    }

    /**
     * Creates a save for an entity using the worlds structure manager.
     * This is done in case the entity is killed by a disallowed player in one hit. (usually the health will be reset tho without a death, this is just a backup)
     * 
     * @param entity - Entity to save
     */
    public async createSave(entity: Entity): Promise<void> {

        const entityLoaded = await waitForEntityLoad(entity, 40); // wait 2 seconds for entity components to fully load

        if (entityLoaded) {

            // check if entity is healthy before saving to prevent saving dying entities
            const healthComponent = entity.getComponent(EntityComponentTypes.Health);
            if (healthComponent && healthComponent.currentValue <= 0) {
                // entity is dead or dying, don't save it
                return;
            }

            var queryOptions: EntityQueryOptions = {};
            queryOptions.maxDistance = 1.5;
            queryOptions.location = entity.location;

            // prevent more than one entities from being saved to the structure
            if (world.getDimension("overworld").getEntities(queryOptions).length == 1) {
            
                const structureID = "slc:" + entity.id;

                // try to delete the existing save for the entity if it exists
                this.deleteSave(entity.id);

                // filter out players, xp, and item stack entities to prevent performance issues
                if ((entity.typeId != "minecraft:item") && (entity.typeId != "minecraft:player") && (entity.typeId != "minecraft:xp_orb")) {
                    world.structureManager.createFromWorld(structureID, world.getDimension("overworld"), entity.location, entity.location, {"includeBlocks": false, "includeEntities": true, "saveMode": StructureSaveMode.World});
                }

                entity.setDynamicProperty("structureID", structureID);
            }

            const leashComponent: EntityLeashableComponent = entity.getComponent(EntityComponentTypes.Leashable);

            // if the entity is connected to a leash knot save its location
            if (leashComponent && leashComponent.leashHolder && (leashComponent.leashHolderEntityId == "minecraft:leash_knot")) {
                entity.setDynamicProperty("leashKnotLocation", leashComponent.leashHolder.location);
            }
            else {
                entity.setDynamicProperty("leashKnotLocation"); // clear the property
            }
        }
    }

    /**
     * Loads an entity save from the worlds structure manager.
     * 
     * @param entityID - The ID of the entity to load
     * @param location - The location to load the entity at
     * @param entityTypeID - The type ID of the entity to load
     */
    public loadSave(entityID: string, location: Vector3, entityTypeID: string): void {
        const dimension: Dimension = world.getDimension("overworld");

        this.clearExpiredTimers();

        // if drop timer exists, do not load the entity save
        if (!this.activeTimers.find(timer => timer.Id === entityID)) {

            // try loading the entity save
            try {
                const structureID = "slc:" + entityID;
                world.structureManager.place(structureID, world.getDimension("overworld"), location, {"includeBlocks": false, "includeEntities": true})
            }
            // if theres an error in the loading process, just spawn a new one
            catch (e) {
                dimension.spawnEntity(entityTypeID, location);
            }

            // push new timer to active timers
            this.activeTimers.push({
                Id: entityID,
                sentTimestamp: system.currentTick,
                dropTimer: 2 // drop everything within 2 ticks
            });
        }
    }

    /**
     * Copies an entity save to a new entity id.
     * 
     * @param entityID - The ID of the entity to copy
     * @param newEntityID - The ID of the new entity
     */
    public transferSave(entityID: string, newEntityID: string): void {
        const existingSave = world.structureManager.get("slc:" + entityID);
        if (existingSave) {
            existingSave.saveAs("slc:" + newEntityID, StructureSaveMode.World);

            world.structureManager.delete(existingSave); // delete the old save
        }
    }
}
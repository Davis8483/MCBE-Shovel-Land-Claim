import {Player, system} from "@minecraft/server"

export namespace AddonSounds {

    export enum Shovel {
        SELECT = "note.cow_bell",
        RESIZE = "note.banjo",
    }

    export enum Claim {
        DELETE = "mob.creeper.say",
        ENTER = "random.door_open",
        LEAVE = "random.door_close",
        VIEW = "beacon.activate",
        SAVE = "note.cow_bell"
    }

    export enum Global {
        NEGATIVE_EVENT = "note.didgeridoo",
        POSITIVE_EVENT = "random.levelup",
        NEUTRAL_EVENT = "note.cow_bell",
        WARN_EVENT = "note.banjo"
    }
}

export function playSound(player: Player, sound: AddonSounds.Shovel | AddonSounds.Claim | AddonSounds.Global) {
    system.run(() => {
        player.playSound(sound, {
            location: player.location,
            volume: 1,
            pitch: 1,
        })
    });
}
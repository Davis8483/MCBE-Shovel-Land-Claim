<img src=docs/SLC_Animated_Banner.webp width=500vw align="left">

### Welcome to Shovel Land Claim!
A Minecraft Bedrock Edition addon that allows you to protect your builds from griefing and looting. It works similarly to the Java Golden Shovel mod

[![](https://dcbadge.limes.pink/api/server/https://discord.gg/JGsXDubjek)](https://discord.gg/JGsXDubjek)

<br clear="left"/>

## Creating Claims
Use the Claim Shovel to break a block, setting the first corner of your claim. Then break another block while crouching to set the opposite corner. This will bring up the claim creation menu.
> [!NOTE]
> On mobile, in the claims list menu, you must click the `New/Resize Mode >>` button first!

<img src=docs/create_claim.webp width=100%>

## Resizing Claims
While holding the Claim Shovel, break any corner of your claim, then break another block to specify the new corner. A confirmation menu will appear.

<img src=docs/resize_claim.webp width=100%>

## Available Permissions
### General
 <table>
  <tr>
    <th>Permission</th>
    <th>Info</th>
    <th>Default State</th>
  </tr>
  <tr>
    <td>Enter Claim</td>
    <td>Applies knockback and the Wither effect to prevent players from entering the claim. Players without this permission will always see red border particles on your claim even if its "Border Particles" setting is disabled. A warning in chat will also be issued to them when walking near the claim.</td>
    <td>True</td>
  </tr>
  <tr>
    <td>Break Blocks</td>
    <td></td>
    <td>False</td>
  </tr>
  <tr>
    <td>Use Items On Blocks</td>
    <td>Example: placing blocks, attempting to use a shovel to make paths, etc.</td>
    <td>False</td>
  </tr>
  <tr>
    <td>Interact With Blocks</td>
    <td></td>
    <td>False</td>
  </tr>
  <tr>
    <td>Interact With Entities</td>
    <td></td>
    <td>False</td>
  </tr>
  <tr>
    <td>Use Doors</td>
    <td></td>
    <td>False</td>
  </tr>
  <tr>
    <td>Use Switches</td>
    <td>Example: levers, buttons, etc. Pressure plates are not included due to technical limitations.</td>
    <td>False</td>
  </tr>
  <tr>
    <td>Use Beds</td>
    <td></td>
    <td>False</td>
  </tr>
  <tr>
    <td>Open Containers</td>
    <td>Example: chests, furnaces, etc.</td>
    <td>False</td>
  </tr>
  <tr>
    <td>Interact With Item Displays</td>
    <td>Includes shelves, chiseled bookshelves, and armor stands. Item frames are not supported :(</td>
    <td>False</td>
  </tr>
  <tr>
    <td>Edit Signs</td>
    <td></td>
    <td>False</td>
  </tr>
  <tr>
    <td>Use Tnt</td>
    <td>This can only be toggled for the entire claim in its "Public Permissions" menu.</td>
    <td>False</td>
  </tr>
</table> 

### Entities
 <table>
  <tr>
    <th>Permission</th>
    <th>Info</th>
    <th>Default State</th>
  </tr>
  <tr>
    <td>Hurt Mobs</td>
    <td>Any entity not included in "Hurt Monsters" or "Hurt Players" will be covered by this permission. Example: Cows, Chickens, etc.</td>
    <td>False</td>
  </tr>
  <tr>
    <td>Hurt Monsters</td>
    <td>Example: Zombies, Spiders, etc. It's not recommended to disable this. All damage sources will be prevented, even burning in sunlight! <em><b>Mob farms will not work!</b></em></td>
    <td>True</td>
  </tr>
  <tr>
    <td>Hurt Players</td>
    <td>Due to how the entity protection system is implemented, Player protection is a bit limited. When a player is hit, that damage taken will be restored. Although if the hit brings them to 0 health, nothing can be done. Typically when this happens with non-player entities, a previous copy of the entity will be loaded back into the world; this cannot be done with players sadly.</td>
    <td>False</td>
  </tr>
</table>

---

The following protections are also included by default, although cannot be toggled...
- Protection against pistons moving blocks in/out of claim borders.
- Fireballs being launched into claims.
- Spawning Withers in the overworld.

## Claim blocks

This addon uses a block balance for claim creation. Your claim block balance is displayed in the main menu of the claim shovel. You will obtain x number of claim blocks(set by admin) for every hour you play.

## Operator Panel
An Operator Panel is included for managing all aspects of this addon. World operators have access automatically.

> [!NOTE]
> In versions before v1.0.4 you must give yourself the `shovel.op` tag to gain access.<br> 
`/tag @s add shovel.op`

**Addon Config** - Allows you to change the Claim Block hourly payment, starting claim block amount, claim minimum width requirement, and max number of claims a player can have.

**Manage Players** - Manage their claims, edit Claim Block balance, and edit global player permissions.

**Disallowed Blocks/Items** - Edit a list of blocks/items that are not allowed to be placed anywhere in the world.

## Supported Languages
- English
- French - Translation by `yo4l` & `Yello`
- Spanish - Translation by `JakeJuegaMC`
- German - Auto-translated using Google Services

More to come soon, the auto translation script I wrote makes this super easy!!!<br>
If you find an error in the auto translations, consider contributing!

---

Hey, so like I develop this in my free time on top of school and a part time job.\
So if you enjoyed the addon, consider supporting me on [Buy Me A Coffee](https://buymeacoffee.com/davis8483). thx! (❤️ω❤️)

<p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/" align="center"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/Davis8483/MCBE-Shovel-Land-Claim">Shovel Land Claim</a> by <span property="cc:attributionName">nDavis</span> is licensed under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC BY-NC-SA 4.0<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/nc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/sa.svg?ref=chooser-v1" alt=""></a></p>

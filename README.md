# BG3 Combat Bar

A combat interface inspired by Baldur's Gate 3 for Foundry VTT 14 and D&D 5e 5.3.3. The frames and common-action icons are original artwork. This module does not require Argon.

## Installation

In Foundry's **Install Module** dialog, paste this manifest URL:

```text
https://github.com/webmaster94/bg3-combat-bar/releases/latest/download/module.json
```

Extract `bg3-combat-bar-0.1.4.zip` into your Foundry `Data/modules` directory, then enable **BG3 Combat Bar** in Module Management. On Forge, use **My Foundry → Summon Import Wizard** to import the ZIP, then enable it in the world.

The bar appears during combat for the selected owned PC or NPC. If nothing is selected, it follows the owned current combatant or the user's assigned character. The GM-controlled world setting **Show outside combat** allows everyone to prepare their bars before combat. **Bar scale** remains a personal client setting. Both settings apply when saved without a browser reload; changing scale updates the existing bar in place.

## Controls

- Click an empty slot to choose from the actor's matching items. Drop a sheet item onto any matching slot to assign it. Items belonging to another actor are rejected.
- Click an assigned slot to use its item through D&D's activity workflow. Right-click an assigned slot to replace or clear it. Alt-click has no separate slot-assignment behavior.
- The weapon tabs select melee or ranged loadouts. Each has two numbered loadouts with a main-hand and off-hand slot. Assigning a weapon or selecting a numbered loadout equips that loadout and unequips weapons managed by the other loadouts. Off-hand slots also accept shields.
- Drag assigned icons to exchange slots. Drag section headings to reorder features, spells, and items within their shared frame. Drag the colored right border of a feature, spell, or item section to adjust its visible width smoothly. The neighboring section gives or receives the same space. Slots retain their positions; narrowing the window clips them, including partial slots, without scrolling or wrapping. Widen the section to reveal them again. Escape cancels a resize. The focused border also accepts Left/Right arrows and Home/End. Drag the diamond above the portrait to move the whole bar.
- The page controls switch between ten pages. The adjacent **Rows + / −** controls reveal between two and six rows, starting at two. Reducing rows hides their assignments until expanded again. Weapons and resources are shared across pages. Locking prevents layout changes while allowing item use, page changes, and weapon switching.
- The grid button beside the lock, below the page and row controls, switches to Foundry's macro bar. **Shift+B** also switches bars. A return button remains above the macro bar.
- Click the die outside the left edge of the portrait for skills, saving throws, ending Hide, and escaping a grapple. Click the portrait to open the character sheet.
- Click an action, bonus-action, or reaction resource to mark it spent. Right-click to restore it, for corrections or additional actions granted by another feature. Reactions used through system activities are tracked, and recover at the start of the character's next turn.
- Click a spell-slot level or Pact Magic group to spend one slot; right-click to restore one. These controls update the character sheet's slot pool directly and stop at zero or its maximum. Actions and Features have separate headings above their respective grids.
- Click **+** in the resource strip and choose **Feature**, **Spell**, **Item**, or **Custom Counter**. The first three open a picker for entries on the character with their own limited uses. You can also drag an entry with limited uses onto the resource strip. Spells that only use spell slots are already tracked by the slot diamonds. Custom counters can recover on a turn, short rest, or long rest. Item-backed resources use the item's own consumption and recovery rules.
- Monk's Focus, Ki, Font of Magic, Sorcery Points, and Metamagic Adept resources appear automatically from their feature's prepared uses. Class points use circles, while spell slots use diamonds. Monk circles are red. Sorcery circles are pink when the actor has spell slots and purple otherwise. A fitted ornamental tier places class points above spell slots; noncasters keep a compact single resource row. Both tiers are centered and share one continuous outline, without a border between them. No spellcasting class is required to track feat-granted points.
- Click a class-point resource to use its feature through the system, and right-click to open the feature sheet. Uses, scale formulas, and rest recovery stay owned by the original feature. A manually tracked copy of the same feature is hidden from the lower strip to avoid duplicate counters. Older sheets with labeled Focus Points, Ki Points, or Sorcery Points actor resources are also supported; click those to spend one point, and right-click to restore one.
- End turn is enabled only on this token's turn. Rest opens the system's short- or long-rest workflow.

Assignments live in `flags.bg3-combat-bar.layout` on a linked actor, or on the TokenDocument for an unlinked token. Limited uses and spell slots come from the D&D system. Action counters refresh at the actor's own turn.

## 2024 actions

Dash consumes an action and adds the current movement speeds for the remainder of the turn. Disengage consumes an action and creates a temporary **Disengage** effect. Automation that recognizes that effect name, including Gambit's opportunity-attack handler, can honor it.

Hide normally consumes an action. After confirming the cover and visibility requirements, it rolls Stealth against DC 15. Success applies Invisible while hidden and stores the discovery DC. Attack rolls and spells with a Verbal component end this module's hiding effect. Use **End hiding** when an enemy discovers the creature or it makes noise. Foundry cannot determine all of those narrative events from scene geometry.

Grapple and shove replace an attack. A target within 5 feet and no more than one size larger saves against 8 + Strength modifier + proficiency. An NPC automatically uses its stronger Strength or Dexterity save. With Midi-QOL, an active player owner receives the save through Midi's roll request. A failed save immediately applies the condition or movement. No separate GM approval is required. An active GM client performs updates to tokens the initiating player does not own.

Shove offers Prone or a 5-foot push. Gold circles mark unoccupied destinations away from the source; walls, scene boundaries, and occupied spaces are checked again before moving. Escape cancels destination selection before an attack is spent. Pushes use Foundry's displacement movement so they do not spend the target's movement allowance.

Grapples record their source and escape DC. Leaving reach or incapacitating the source removes the grapple. The target can attempt Athletics or Acrobatics to escape using an action. A GM can remove the effect to release the target.

Extra Attack is recognized from an actor feature identifier/name, with Fighter progression for three and four attacks. NPC multiattack and unusual attack replacements vary by feature; set the flag below when needed. Special reach, automatic grapples on a hit, legendary resistance, and bespoke monster abilities should use their system items and Midi workflows.

## Active Effect flags

Add an Active Effect to a feature and enable **Transfer to actor**. Use **Override**, priority 20.

| Key | Value | Effect |
| --- | --- | --- |
| `flags.bg3-combat-bar.hideAsBonusAction` | `true` | Hide costs a bonus action. |
| `flags.bg3-combat-bar.actionCosts.dash` | `bonus` | Dash costs a bonus action. |
| `flags.bg3-combat-bar.actionCosts.disengage` | `bonus` | Disengage costs a bonus action. |
| `flags.bg3-combat-bar.actionCosts.hide` | `bonus` | Explicit Hide cost override. |
| `flags.bg3-combat-bar.attacksPerAction` | `2` | Attacks granted by an Attack action. |
| `flags.bg3-combat-bar.grappleAbility` | `dex` | Use Dexterity for grapple and shove DCs, for eligible Martial Arts users. |

These are actor flags applied by the feature's transferred effect. A non-transferred effect on an item does not change the actor's action costs.

## Midi-QOL

Items use `item.use()` and the system activity hooks, allowing Midi-QOL to run its normal attack, damage, resource, and effect workflows. Common grapple and shove saves use Midi's `rollAbility` socket handler when available. The module then applies the condition or push after resolving the save. It also works without Midi-QOL, using the D&D roll APIs and a GM request for documents a player cannot update.

When Midi-QOL reaction tracking is enabled for the actor, its reaction counter is authoritative. The bar reads that counter, including extra reactions, and uses Midi's API for manual spending and restoring. Reactions prompted by Midi update the bar without spending twice. Without Midi-QOL installed, or with its reaction tracking disabled, the bar maintains its own counter. Reaction activities spend it automatically, clicks spend it manually, and right-click restores it. It refreshes at the start of that actor's next turn, not at the round boundary.

## Active effects

Active effects appear at the top-right of the bar. Icons fill one row, then a second row; only overflow beyond both rows widens the bar. The resource frame keeps a gap from the icons, including its upper class-resource tier. Removing effects shrinks the bar again.

- Hover for the enriched description, source, remaining duration, and disabled/passive state.
- Double-click to enable or disable; Ctrl/Command-double-click opens the native effect editor.
- Right-click to cancel through Foundry's confirmation dialog. GMs can Shift-right-click to cancel immediately.
- Applicable item enchantments appear alongside actor effects. Suppressed effects and icons set to Never are hidden; Always Show overrides the passive/disabled filters.

Settings include personal visibility, icon size, tooltip font size, vertical gap and right inset, plus world-wide passive/disabled filters and player interaction permission. Changes apply without reloading. Players can only modify effects they own, and the GM can disable player interaction.

Visual Active Effects is optional. When active, its matching settings govern the dock, and its standalone panel is hidden while the combat bar is shown. Switching to macros or hiding the bar restores that panel. Position offsets apply relative to this bar. The `visual-active-effects.createEffectButtons` and `visual-active-effects.prepareActiveEffectContext` hooks support extension buttons and tooltip content.

The behavior was independently implemented against [Visual Active Effects 14.0.3](https://git.gay/Zhell/visual-active-effects). Its source files and artwork are not bundled.

## Development

`npm run check` checks JavaScript syntax. `npm test` runs model and storage tests. `npm run build` creates the ZIP in `dist`. There are no runtime dependencies or build-time package installs.

`tools/fixture.js` and `tools/live-tests.js` are local-only test scripts excluded from the distribution. They create and exercise marked test documents in the local test world. They refuse to run on a remote hostname.

Implementation references: [Argon D&D integration](https://github.com/theripper93/enhancedcombathud-dnd5e), [Foundry v14 API](https://foundryvtt.com/api/v14/), and the [2024 D&D rules glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary). Argon was consulted for system API usage; its source and artwork are not bundled.

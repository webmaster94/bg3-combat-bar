# Verification

## 0.1.3 reactions and class resources

Sixteen automated tests cover resource detection, prepared uses, legacy Ki/actor resources, feat-granted points without spellcasting, reaction refresh at the actor's own turn across round boundaries, and Midi reaction authority without double consumption.

Local Foundry v14 build 360 / D&D5e 5.3.3 tests passed for four marked fixtures: Monk 6 / Wizard 3, Monk 8 with Ki, Sorcerer 20, and Fighter 4 with Metamagic Adept. Each passed resource detection, native feature use, and native short- or long-rest recovery. The fixture class-point maxima use class-level formulas, except the feat's two-point pool. Visual checks confirmed red monk pips above spell slots, a compact noncasting monk row, twenty pink sorcery pips above nine slot levels, and purple feat-granted pips without spell slots. The final upper frame fits the class-point row rather than spanning the lower resource strip. DOM measurements confirmed the two tiers have the same horizontal center. A single SVG outline surrounds both tiers without an internal gold seam. Class-point pips are circles; spell-slot pips remain diamonds.

With Midi reaction tracking temporarily enabled, live checks passed for bar spend/restore, external Midi reaction consumption, and a native reaction activity consumed exactly once. The original Midi settings were restored. With Midi reaction tracking disabled, the bar's own spend/restore also passed.

The native settings dialog saved world-wide outside-combat visibility and personal scale without reloading. A slider change from 0.85 to 0.6 changed the rendered scale immediately; 0.85 and combat-only visibility were restored afterward. One Foundry CombatTracker render error occurred while the new test encounter was being created; it did not prevent the resource or reaction checks. The existing viewport-height warning also remains unrelated to this module.

`tools/resource-tests.js` creates the four local fixtures and provides the native-use/rest and Midi checks. It refuses remote execution and is excluded from release ZIPs.

## 0.1.2 fixed grids and shared frame

Eleven automated tests pass. New coverage checks migration from the original row/column layout to ten pages, fractional divider widths, conservation of adjacent section space, and preservation of assignments hidden by width or row limits.

Local browser checks verified a 20-pixel divider drag produced fractional viewport widths without changing the twelve-column grid; slot viewports use overflow clipping with no scrolling. The row controls reveal a third row and return to two, and page navigation wraps from 1 to 10 and back. Width and row settings survived reload. Native DialogV2 resource choice, item picker, custom-counter saving/removal, and skills/saves windows were exercised.

The final frame joins feature/spell/item slots, resources, and page/row controls. Portrait, weapon loadouts, end turn, and rest remain separate. Alt-click assignment and the redundant slot arrow were removed. Visual checks covered the external skills button, internal dividers, control alignment, and resource crown.

## 0.1.1 interface fixes

The tooltip regression test failed before the fix when the prior slot's leave timer canceled the next slot's open timer. It passes after canceling that timer on entry and invalidating stale descriptions. Nine automated tests pass, including this regression.

Local browser checks covered consecutive item/spell tooltips, feature picker labeling, feature and item resource selection, spell resource eligibility guidance, live border dragging from six to four columns, and persisted widths after reload. Visual inspection confirmed the portrait name position, centered resource strip, centered end-turn control, and increased control spacing.

## Initial release

Verified on September 12, 2026 in the local Foundry v14 test world with D&D 5e 5.3.3 and Midi-QOL 14.0.12.1 active.

- JavaScript syntax check passed.
- Eight model/storage tests passed.
- Nine live integration checks passed: weapon equipment changes, transferred Hide cost effect, Dash and turn expiration, invalid push destinations, automatic movement after an NPC's failed shove save, grapple application and removal, unlinked-token independence, enriched tooltip content, and spell-slot/action consumption.
- Browser checks covered the gold/dark bar, damaged portrait, skills/save panel and native saving throw, filtered assignment picker, page creation/switching, icon rearrangement, locking, macro-bar swap and return, native short-rest dialog, and shove destination overlay. A successful NPC save correctly prevented the push.

The live tests use marked local fixtures and refuse remote execution. A separate player/GM session was not exercised; active-player saving throw requests still need a multiplayer session check. Narrative Hide requirements and unusual monster abilities have the limits described in README.md.

Forge campaign verification: imported and enabled 0.1.0 on Foundry 14.364 / D&D 5e 5.3.3 with Midi-QOL and the existing module set active. Verified a player character's portrait, health, spell-slot resources, actor spell picker, disabled end-turn control outside combat, macro-bar swap, and return control. No BG3 module warnings or errors appeared in the browser logs. Restored the default combat-only visibility after previewing. No campaign items were assigned or used during this check.

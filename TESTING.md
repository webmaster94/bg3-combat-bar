## 0.1.10 Foundry v13 compatibility

Published to GitHub; the public ZIP hash matches the local build. Forge installation and campaign Module Management confirm 0.1.10 enabled on the existing v14 campaign. No BG3 errors were reported during the final campaign check.

Tested Foundry 13.351 with D&D5e 5.3.3, without Midi-QOL, in an isolated copy of the local v13 test world on port 30004. Existing campaigns and their installed system were not modified. The module can be enabled through native Module Management. The isolated server was then restarted on supported Node 22.23.2, and all three native effect compatibility checks passed again.

All nine `tools/live-tests.js` checks passed: weapon equipping, Active Effect Hide cost override, Dash movement and turn refresh, invalid shove rejection, successful shove movement, grapple application and reach cleanup, unlinked-token layout isolation, enriched item tooltip, and native spell/action consumption.

All four `tools/resource-tests.js` cases passed detection, native point consumption, and native rest recovery: Monk/Wizard, Monk, Sorcerer, and a noncaster with Metamagic Adept. Standalone reaction spend/restore passed. The item fixture confirmed preparation, higher-level slot availability, infinity, quantity plus uses, attunement warnings, and exhaustion. The activity pop-out and grouped spell picker rendered and opened correctly. Macro-bar switching worked in both directions.

`tools/compatibility-tests.js` checks both Active Effect schemas using native documents. On v13, temporary effect filtering, expiration, disable/enable, and deletion passed. The actual tooltip displayed an enriched description and remaining seconds; right-click opened the native deletion dialog and confirmed cancellation removed the icon. The v14-only icon visibility constants are optional, and v13 expiration is derived from remaining duration. Two regression tests cover these differences. All 41 automated checks and syntax validation pass.

The existing local v14.360 / D&D5e 5.3.3 / Midi-QOL world was reloaded with the changes. Its effect dock retained temporary, disabled, Always Show, and item-enchantment entries, and the enriched duration tooltip rendered correctly. No BG3 errors appeared.

## 0.1.9 manual activity choices

Published and installed on Forge. Module Management confirms 0.1.9 enabled. In Valyra Zarkannan's existing campaign bar, Chromatic Orb has no pop-out indicator and Command opens all five command choices. No campaign spell was cast and no BG3 errors were reported.

The original selector admitted any activity with canUse=true, including CPR's hidden Chromatic Orb Bounce rider. Regression tests failed on the extra menu and direct-use dispatch before the fix. The selector now respects system rider IDs, CPR hidden identifiers, Midi automation-only flags, and Midi's sole-attack/other-activity pairing. The Item's activities remain untouched for automation. Single manual choices call activity.use directly, and all-hidden items cannot reopen a manual selector.

39 automated tests and syntax checks pass. Local Foundry v14 / D&D5e 5.3.3 / Midi-QOL tests using native documents confirm Chromatic Orb has no menu chevrons and opens its Cast Spell configuration directly; Command retains Approach, Drop, Flee, Grovel, and Halt in its grid. The cast was canceled before consumption. No BG3 errors occurred in the final live run. The fixture uses CPR's rider metadata pattern and attaches references after Foundry assigns embedded activity IDs.

## 0.1.8 availability and unified pickers

Release 0.1.8 was published to GitHub; the downloaded release archive matches the local build hash. Forge installed the release, and Module Management after server restart confirms BG3 Combat Bar 0.1.8 enabled on Foundry 14.364 / D&D5e 5.3.3. No BG3 errors were reported during startup. Detailed item and picker interaction checks below were performed in the local world.

33 automated checks cover unrestricted versus resource-consuming uses, alternative activities, external and granting-item resources, attunement, preparation, depleted stacks, higher-level and Pact slots, shared picker filters, and Tidy section names, alongside the existing layout, resource, effect, and workflow checks. Syntax validation passes.

Local Foundry 14 / D&D5e 5.3.3 / Midi-QOL browser tests used native documents created by `tools/item-tests.js`. Verified unprepared spell and exhausted feature grayscale, native magical-item attunement requirements, a prepared level-1 spell available with only a level-2 slot, a cantrip infinity badge, and quantity 4 above 1/1 uses on a potion. The activity grid shows infinity for its free activity, no infinity for the charge activity, and 0/1 plus a red warning for the exhausted activity.

Custom picker tabs switch the same grouped renderer between inventory, spells, and features. Can Cast removes the unprepared spell while retaining the upcastable spell; feature search retains exhausted-use information. Header pencils open the appropriate native settings dialog. Hiding a shared section changes only personal visibility immediately; restoring it through Custom Sections returns the saved items without reloading. The base section headers have no edit/hide controls.

## 0.1.7 activity groups and custom sections

Twenty-six automated tests pass. New coverage checks custom-section migration and persistence across another player's layout save, shared staging and personal visibility overrides, mixed entry types, resizing past hidden sections, activity filtering/sorting/uses, and direct native activity invocation.

Local Foundry v14 / D&D 5e 5.3.3 with Midi-QOL checks on September 14, 2026:

- Created shared Combat Kit and personal My Favorites through their native settings dialogs. Both appeared on save, with no reload or reload prompt.
- Hid a GM default personally, restored it, then hid and restored the populated default as GM. Feature and spell assignments returned intact.
- Assigned a feature, spell, and inventory item through the mixed-type picker. Dragging the inventory item into the personal section moved it and preserved the other entries.
- Opened the three-activity Versatile Charm grid above its parent slot. Tooltips showed individual flavor, use counts, and costs. Selected Quick Step directly; its native use dialog appeared and consumed exactly one item use and one bonus action, with the pop-out closed afterward.
- Visually inspected the shared frame with both new sections and the activity grid. No BG3 module errors appeared in local browser logs.

Forge campaign confirmation: installed and enabled 0.1.7 on Foundry 14.364 / D&D 5e 5.3.3. Both section settings dialogs opened. Bardic Inspiration displayed its two available activities in a grid above its existing slot, without using the item. No BG3 errors appeared in browser logs.

A separate live player client was not used; personal-definition isolation and visibility merging are covered by automated tests. `tools/section-tests.js` creates only marked local fixtures and is excluded from the release ZIP.

## 0.1.6 effect size and frame alignment

Local browser measurements verified 25-by-25-pixel effect icons and zero difference between the dock's right edge and the shared items/control frame's right edge. Borders and duration/disabled badges scale with the icons. With the Monk/Wizard resource fixture, twenty-two effects filled two rows without expansion; twenty-five widened the bar by 108.15 pixels while retaining a 24-pixel resource gap and exact right alignment. Returning to seven effects removed expansion.

Twenty-two automated tests and JavaScript syntax checks pass. The existing preference test now also checks docked scaling with standalone and inherited VAE icon sizes, plus the personal scale override.

## 0.1.5 active effects

Twenty-two automated tests pass, including two-row capacity/expansion, effect filtering and grouping, ownership controls, optional VAE settings precedence, reactions with Midi absent, and reactions with Midi tracking disabled.

Local Foundry 14 / D&D 5e 5.3.3 checks used the marked Monk/Wizard fixture. Nine effects occupied one row without expansion; eighteen occupied two rows without expansion. Twenty-one expanded the frame by 110.15 pixels and retained a 24-pixel resource gap. Returning to seven effects removed expansion. Visual checks confirmed transparent gold icons, the continuous resource frame, disabled badges, and a distinct item-enchantment border.

Exercised enriched descriptions, source and duration text, extension tooltip buttons, double-click disable/enable, Ctrl-double-click native configuration, right-click confirmed deletion, and GM Shift-right-click immediate deletion. Passive, Never Show, and hook-vetoed effects were hidden; Always Show and applicable item enchantments appeared. No BG3 errors appeared in browser logs.

VAE settings inheritance and player permission gating are covered by automated tests. A simultaneous live VAE installation and a separate player client were not exercised for this release. Existing Midi-disabled live reaction checks remain documented below. `tools/effect-tests.js` provides repeatable local fixtures and is excluded from release ZIPs.

# Verification

## 0.1.4 spell-slot controls and headings

Seventeen automated tests pass. The new test checks serialized spell-slot clicks, empty/full limits, independent Pact Magic slots, and rejection of missing or invalid pools. Live local UI checks restored a level-one slot from 0/4 to 1/4, then spent it back to 0/4. DOM measurements confirmed that the Actions and Features headings align with the left edges of their corresponding grids. Visual inspection confirmed the shared resource frame and split headings.

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

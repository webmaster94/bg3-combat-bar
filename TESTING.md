# Verification — 0.1.0

Verified on September 12, 2026 in the local Foundry v14 test world with D&D 5e 5.3.3 and Midi-QOL 14.0.12.1 active.

- JavaScript syntax check passed.
- Eight model/storage tests passed.
- Nine live integration checks passed: weapon equipment changes, transferred Hide cost effect, Dash and turn expiration, invalid push destinations, automatic movement after an NPC's failed shove save, grapple application and removal, unlinked-token independence, enriched tooltip content, and spell-slot/action consumption.
- Browser checks covered the gold/dark bar, damaged portrait, skills/save panel and native saving throw, filtered assignment picker, page creation/switching, icon rearrangement, locking, macro-bar swap and return, native short-rest dialog, and shove destination overlay. A successful NPC save correctly prevented the push.

The live tests use marked local fixtures and refuse remote execution. A separate player/GM session was not exercised; active-player saving throw requests still need a multiplayer session check. Narrative Hide requirements and unusual monster abilities have the limits described in README.md.

Forge campaign verification: imported and enabled 0.1.0 on Foundry 14.364 / D&D 5e 5.3.3 with Midi-QOL and the existing module set active. Verified a player character's portrait, health, spell-slot resources, actor spell picker, disabled end-turn control outside combat, macro-bar swap, and return control. No BG3 module warnings or errors appeared in the browser logs. Restored the default combat-only visibility after previewing. No campaign items were assigned or used during this check.

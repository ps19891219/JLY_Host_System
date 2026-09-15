# Work Schedule DM/NPC regression

Run:

`node tests/work-schedule/work-schedule-dm-npc-sections.contract.test.js`

`node tests/work-schedule/work-schedule-dm-npc-boundary.contract.test.js`

These contracts verify that DM/NPC presentation is loaded, unsafe empty batch field writes are blocked, and existing batch assignment remains scoped to one role row rather than replacing sibling DM/NPC rows.

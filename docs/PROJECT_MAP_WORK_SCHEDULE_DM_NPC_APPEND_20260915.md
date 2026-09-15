# Project Map Append｜Work Schedule DM / NPC｜2026-09-15

Canonical continuation note for `docs/PROJECT_MAP.md`.

Work Schedule staff configuration keeps the existing `workShifts` / `workScheduleWorks` source of truth. DM and NPC are independent role rows with their own `staffSlots`; UI must present them as separate sections. Batch field editing is role-scoped and must never mutate sibling role rows. New presentation/guard entry point: `js/modules/work-schedule/work-schedule-dm-npc-sections.js`, with styles in `css/pages/work-schedule-dm-npc-sections.css`.

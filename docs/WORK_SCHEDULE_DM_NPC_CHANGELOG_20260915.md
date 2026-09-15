# Work Schedule DM/NPC Changelog 2026-09-15

- Added read-only DM/NPC role classification and section presentation for dashboard/detail UI.
- Added batch field guard that blocks empty DM/NPC batch submissions before the existing write handler.
- Kept existing role-row/staffSlots data model unchanged.
- Added contract coverage for role-scoped sibling boundaries, load order, classification, and no Firestore writes from the new presentation module.
- Updated Project Map continuation note.

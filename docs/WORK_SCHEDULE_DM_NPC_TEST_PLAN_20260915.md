# Work Schedule DM/NPC Preview Test Plan

1. Open Work Schedule month containing `孤注` shifts.
2. Verify each card shows DM and NPC as separate visual sections when both role rows exist.
3. Open a shift detail and verify DM appears before NPC, with each role retaining its own staffSlots.
4. Open 批次修改, select DM and confirm the apply button identifies DM. Repeat for NPC.
5. With neither 修改分工名稱 nor 修改人員 enabled, apply must be blocked before the existing write handler.
6. Modify one NPC field on Preview and verify the sibling DM row and assignments are unchanged. Repeat DM -> NPC.
7. No Production Firestore recovery/write is part of this change.

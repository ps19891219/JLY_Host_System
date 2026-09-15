# Implementation summary

New UI module classifies existing role rows as DM, NPC, or other and renders DM/NPC as separate sections without writing Firestore. Batch field UI is guarded so an empty DM/NPC mutation cannot reach the existing write handler. Existing Work Schedule role-row and staffSlots writes remain role-scoped.

# Studio × Employee Confirmation Integration — 2026-09-21

Studio Operations consumes employee-confirmation summaries; it does not own employee confirmation.

- tentative/confirmed employee rows are not Studio problems by themselves.
- declined → Studio staff issue.
- invalidated because date/time/role fingerprint changed → Studio staff issue and employee must confirm the new assignment again.
- Studio may route to scheduling/replacement actions, but does not directly mark a replacement formal.
- Employee confirmation API remains owned by #262.
- Studio does not scan employee Calendar or Work Schedule to infer availability.
- Input must come from a bounded prepared view/shared Pending Action projection. No Source-of-Truth list scan is permitted.

The current #262 API still contains explicit action/security reads and month-view update reads. Those require final cross-PR read-budget review before main merge; this document does not mark #262 production-ready.

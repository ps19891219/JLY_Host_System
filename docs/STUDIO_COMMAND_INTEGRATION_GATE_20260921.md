# Studio Command Integration Gate — 2026-09-21

## Current stacked-branch state
PR #264 was created from an earlier #263 head. Current #263 now contains Booking/Activity service and repository files that are not yet present in #264's branch ancestry.

Do not copy those upstream files into #264. That would create duplicate ownership and a conflict-prone fork.

## Ready wiring
The UI emits these domain commands:
- `confirm_booking`
- `reject_booking`
- `propose_booking_adjustment`
- `resolve_host_request`
- employee scheduling commands remain owned by #262

## Integration sequence
1. Stabilize/merge or rebase current #263 Booking/Activity foundation.
2. Bring #264 onto that exact current contract.
3. Add a thin command service that delegates to #263 repositories/services.
4. Bring in #262 employee-confirmation contract without copying its state machine.
5. Run cross-PR regression/read-budget checks.
6. Only then consider #264 ready for main.

## Safety rule
Until step 2, #264 must not add placeholder Firestore repositories or duplicate #263 files merely to make imports resolve.

No Production migration, repair, rebuild, or write is authorized here.

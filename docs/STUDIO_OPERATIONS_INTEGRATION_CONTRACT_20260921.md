# Studio Operations Integration Contract — 2026-09-21

The Studio operations page is a consumer, not a data crawler.

## Inputs
1. Booking inbox prepared view from the Player × Studio Booking × Activity work.
2. Studio-scoped Pending Action prepared input for activity-change, host request, employee confirmation/problem and recruitment tasks.
3. Work Schedule/Matching prepared views remain owned by their existing modules and are not copied into Studio operations.

## Adapter rule
`studio-operations-adapter.js` only normalizes already-prepared rows into a common UI task shape. It performs zero Firestore/API reads.

## Action rule
Opening a task may perform a bounded detail/action-validation read. The list itself never scans Source of Truth.

## Employee boundary
Employee confirmation remains owned by the employee workstream. Studio sees status/task summaries and may act on replacement/reassignment flows, but does not recreate employee confirmation state.

## Booking boundary
Booking acceptance/rejection/adjustment remains owned by the Booking/Activity service. Studio operations routes to those commands; it does not create a second Booking state machine.

## Missing-view behavior
If an upstream prepared view is not initialized, show a not-ready/empty state. Do not fall back to scanning formal collections.

## Production boundary
No migration, repair, rebuild, or production write is performed by this integration contract.

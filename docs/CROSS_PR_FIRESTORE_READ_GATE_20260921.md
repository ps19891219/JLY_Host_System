# Cross-PR Firestore Read Gate — 2026-09-21

This is a merge gate for Studio/Employee/Player parallel work. A raw query token is not automatically a defect; each read must be classified by purpose.

## Required classification
- LIST / DASHBOARD: must consume a bounded prepared Read View. No Source-of-Truth scan.
- ACTION VALIDATION: targeted single-document or tightly bounded identity/membership/permission read is allowed when required for correctness/security.
- WRITE PROJECTION: read-before-write is allowed only when needed to compute an incremental projection delta; no full rebuild.
- MIGRATION / REPAIR: never runs on normal page load and is not authorized for production in these PRs.
- EXTERNAL CALENDAR: employee-side Matching assist only, once for the relevant range; no Studio-triggered/background scan.

## Current audit
### PR #261
Query-bearing code remains because this PR contains the Read View repository/build/update layer itself plus targeted matching vote context. Before merge, verify every normal page path resolves to prepared views and that repair/rebuild code cannot execute implicitly.

### PR #262
`api/work-schedule-staff-confirmation.js` performs targeted identity, Studio membership, shift and confirmation reads for an explicit employee confirm/decline action. These are action/security reads, not list reconstruction. Before merge, bound legacy LINE identity lookup and ensure employee list pages do not use this endpoint as a list loader.

### PR #263
Repository/service reads are concentrated in explicit Booking/Activity commands and prepared-view maintenance. Existing read-budget/read-boundary tests are the correct direction. Before merge, confirm Booking/Recruitment list UIs never fall back to scanning `cars` or booking source collections when a view is absent.

### PR #264
Studio orchestration modules are pure and contain a test preventing Firestore collection/get/listener calls. The future Studio inbox must be fed by prepared projections only.

## Merge gate
Do not merge Studio/Employee/Player work to main until all are true:
1. No normal list/dashboard path scans formal collections.
2. Missing Read View fails closed/empty with a clear state; it does not silently scan Source of Truth.
3. UI-only filtering/sorting/checkbox/tab changes use already-loaded local state.
4. Explicit mutation paths have documented bounded reads.
5. No page-load migration/repair/rebuild.
6. Production old-data migration remains a separate deliberate operation.
7. No duplicate Activity/Person/Work Schedule core is introduced.
8. Cross-PR regression tests pass after rebasing/integration.

This gate intentionally does not claim that #261/#262/#263 have completed final read validation yet.

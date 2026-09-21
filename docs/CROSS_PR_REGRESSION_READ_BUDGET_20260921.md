# Cross-PR Regression + Firestore Read Budget — 2026-09-21

Scope: PR #262 Employee confirmation, #263 Player/Studio Booking/Activity, #264 Studio operations.

## PASS / acceptable by purpose
- #263 Studio Booking inbox reads exactly one prepared `studioBookingInboxViews/{studioId}` document for list display.
- #263 Studio Recruitment pool reads exactly one prepared `studioRecruitmentViews/{studioId}` document for list display.
- #263 recruitment projection update uses one targeted view transaction and incremental mutation.
- #264 Studio operations UI/adapters do not query Firestore. Domain commands delegate to owning services.
- #262 employee confirm/decline endpoint uses targeted identity/membership/shift/confirmation reads for an explicit action.

## BLOCKER found
`api/work-schedule-staff-context.js::loadReadViewRows` reads `workScheduleViews/month-index` and then loops through **every month in the index**, reading one month document each time before filtering to the employee/Studio.

This is still a prepared-view path, but it is not bounded. Cost grows with retained months and every employee page open repeats the fan-out.

### Required fix before merge
Employee staff context must use a bounded Person/Studio schedule projection or a bounded requested month/range. It must not fan out across the complete month index.

## Important but not a blocker by itself
`api/work-schedule-staff-confirmation.js` reads the affected month view once during an explicit confirmation write so it can update that projection. This is a write-projection read, not a list reconstruction. Keep it bounded to the affected month.

## Cross-PR ownership
- #262 owns employee confirmation.
- #263 owns Booking/Activity and Studio booking/recruitment prepared views.
- #264 owns Studio operations orchestration.
- Do not copy state machines across PRs.

## Merge gate result
NOT READY for main while the unbounded employee staff-context month fan-out remains and CI/stacked branch checks are not green.

No Production migration/repair/rebuild is authorized by this audit.

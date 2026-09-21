# Player × Studio Booking × Activity Audit — 2026-09-21

## Scope
Audit before implementation. No production migration is performed by this batch.

## KEEP
- `cars` remains the formal Activity source of truth. MyCar is a view of the same Activity, not a second activity model.
- Existing Person / Identity and Membership / Applications remain canonical for people and participation.
- Existing Studio / Work / Script and Work Schedule remain the studio/staff scheduling foundation.
- Existing Accounting, Calendar, LINE Identity and recruitment prepared-view infrastructure remain in place.
- Existing Activity Membership custom per-activity role/label fields remain the place for DM-edited player labels.
- Existing write-time MyCar/Membership prepared-view synchronization remains the preferred mutation pattern.

## OPTIMIZE
- Studio currently has management, scripts, staff, matching and Work Schedule surfaces, but no formal Booking lifecycle.
- Recruitment currently derives public visibility primarily from activity status + `visibility`; studio recruitment needs an explicit host public-recruitment preference plus vacancy-derived visibility.
- Pending Actions currently summarize player/DM applications from Activity data. Booking/change/reschedule/cancellation needs typed pending-action contracts with responsible Person/Studio scope.
- Studio permissions are mostly surface-level placeholders. Booking/activity operations need explicit view vs edit permission checks.
- Work Schedule must remain staff scheduling. Booking confirmation may link an Activity to an existing/created session, but schedule rows must not auto-create ghost Activities.
- Existing read paths must be audited before wiring Studio recruitment. New list pages must read bounded prepared views/indexes, never scan `cars`.

## ADD
- Booking Request domain contract with states: pending, adjustment_proposed, accepted, rejected, cancelled.
- Binding contract allowing either an existing Activity ID or creation of exactly one Activity on Studio acceptance.
- Activity change proposal contract. Important Studio changes stay pending until Host acceptance.
- Host reschedule/cancellation request contracts.
- Studio recruitment projection contract based on formal Activity + studio binding + host preference + vacancy.
- Read-view/index projection for Studio booking inbox, availability and recruitment. These are projections only, not duplicate formal Activities.

## Invariants
1. One real event = one formal Activity ID.
2. Booking/Session/Schedule records reference that Activity; they never clone it.
3. Existing MyCar Activity must be bound, not recreated.
4. Conflicting date/time/script/branch values require explicit human confirmation.
5. Confirmed Activity values are snapshots/agreed values. Script Master changes do not silently rewrite them.
6. Confirmed Studio operational changes use proposals + Host Pending Action.
7. Confirmed Studio sessions can only be rescheduled/cancelled through requests and approval.
8. Cancellation changes Activity status to `cancelled`; it does not delete history.
9. Recruitment display is derived from host preference and current vacancy.
10. No normal list/render/search path may perform a full `cars`, `players`, Work Schedule or Studio collection scan.

## Read-budget contract
- Opening a Studio booking inbox: one bounded prepared-view/index read.
- Opening Studio recruitment: one bounded prepared-view/index read.
- Checkbox/tab/render: zero Firestore reads.
- Search typing: zero Firestore reads; explicit search action only.
- Activity detail: bounded single-activity/detail reads.
- Mutations: write Source of Truth, then incrementally update affected projections only.
- No page-load repair/rebuild/migration.

## Production migration boundary
This batch must not execute or auto-trigger any production migration. Existing data remains untouched until a separately reviewed migration/repair plan is approved.

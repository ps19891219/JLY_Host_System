# JLY Work Schedule V1

## Positioning
Work Schedule is independent from My Car. It records work first and may later link to Script Master, Studio Master, Activity, Recruitment, Payroll and Accounting without replacing the original shift.

## Canonical rules
- Person remains the canonical human identity. No actor/NPC/DM person database.
- `workShifts` remains the V1 source of truth for work shifts; every saved date/role shift has a stable document ID.
- Work name, role, studio and headcount are configurable data, never hard-coded to a script, role or fixed team size.
- Same-name Person records are never automatically merged. Work setup searches canonical Person and stores Person IDs.
- A Person may belong to multiple role pools in the same work, e.g. DM and NPC.
- `scriptId`, `studioId`, `branchId`, `activityId` remain nullable future links.
- Cross-midnight time such as 19:00–02:00 produces the next end date.

## Real scheduling workflow
1. Create/select the work.
2. Create arbitrary role pools such as 主 G, DM, NPC, 演員 or 場控.
3. Search Person Directory and add only this work's schedulable people to each role pool.
4. Select one or many dates from an actual calendar.
5. Select start/end time and role.
6. Set required headcount for that role.
7. For every selected date, tap people independently. Selected people are highlighted; unselected people remain grey.
8. Save once after the batch is arranged. Draft taps do not write Firestore individually.

## Staffing completeness / Pending
- Each saved shift stores `requiredCount`, `missingCount` and `staffingStatus`.
- Assigned < required => `pending`, and the month view shows `待處理 · <role> 尚缺 N 人`.
- Assigned >= required => `complete`.
- This is the Work Schedule staffing pending state. Future platform Pending Action projection may surface these items without making a second source of truth.

## Mobile UX
- Dialog must fit the viewport and keep the close control compact.
- Full Person Directory is never dumped into the scheduling screen.
- Person lookup is search-first and results are bounded.
- Date selection is touch-first multi-select calendar.
- Daily assignment is a per-date matrix using the selected role pool.

## Read-volume direction
V1 starts with month-scoped reads. The public/player surface must not directly query the internal schedule. Before public player traffic is enabled, add Schedule/Public Projections so normal reads consume prebuilt views and writes only rebuild affected projections.

## Future, not V1 contracts
- Persisted reusable Work/Team/Role Pool master records. The V1 batch UI proves the interaction before introducing another source collection.
- Availability and conflict/continuous-shift warnings.
- Owner scheduling assistance.
- Attendance and payroll/pay rules.
- Script/Studio Master claiming by stable ID, never automatic name merge.
- Activity/Recruitment/player purchase-request flow.
- Formal JLY Calendar synchronization and event update mapping.
- Accounting integration after payroll obligations are formalized.

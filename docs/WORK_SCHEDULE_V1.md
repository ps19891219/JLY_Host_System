# JLY Work Schedule V1

## Positioning
Work Schedule is independent from My Car. It records work first and may later link to Script Master, Studio Master, Activity, Recruitment, Payroll and Accounting without replacing the original shift.

## Canonical rules
- Person remains the canonical human identity. No actor/NPC/DM person database.
- `workShifts` is the V1 source of truth for work shifts; every shift has a stable document/shift ID.
- Work name, role, studio and headcount are configurable data, not hard-coded to 孤注 / 主 G / NPC / four people.
- `scriptId`, `studioId`, `branchId`, `activityId` are nullable future links. V1 can keep display snapshots until Masters exist.
- A time such as 19:00–02:00 crosses into the next calendar date.
- Batch scheduling creates separate shift documents so one date can later be changed independently.
- Cancellation changes shift status rather than relying on name/date identity.

## V1 UI
- Mobile-first month view.
- All schedule / My schedule views.
- Create one or many dates in one operation.
- Pick existing canonical Person records directly from the Person Directory.
- Roles are free/configurable in V1 and must remain extensible.
- Edit/cancel a single shift.
- Add a shift to Google Calendar via a calendar template link. This is an export convenience, not yet bidirectional Calendar Sync.

## Read-volume direction
V1 starts with month-scoped reads. The public/player surface must not directly query the internal schedule. Before public player traffic is enabled, add Schedule/Public Projections so normal reads consume prebuilt views and writes only rebuild affected projections.

## Future, not V1 contracts
- Availability and conflict/continuous-shift warnings.
- Owner scheduling assistance.
- Attendance.
- Compensation/pay rules and payroll records.
- Script/Studio Master claiming by stable ID, never automatic name merge.
- Activity/Recruitment/player purchase-request flow.
- Formal JLY Calendar synchronization and event update mapping.
- Accounting integration after payroll obligations are formalized.

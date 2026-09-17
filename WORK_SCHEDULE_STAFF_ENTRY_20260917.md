# Work Schedule staff entry boundary

## Canonical flow

Studio manager shares one studio-scoped employee schedule URL.

`shared URL -> LINE session -> canonical Person aliases -> active Studio Membership -> staff schedule context -> mine-only Google Calendar import`

## Boundaries

- The URL identifies the Studio, never the employee.
- LINE identity and canonical Person determine who opened the URL.
- Active `studioMemberships` membership is required before schedule data is returned.
- Employee schedule is read-only.
- `全部班表` may show the Studio roster, but Google Calendar selection/import is exposed only in `只看我的` and only groups containing the authenticated Person are accepted.
- Employee Calendar event IDs are per-user import events and do not reuse the Studio manager row calendar event ID.
- No employee approval/claim workflow is introduced here.
- No new Person, LINE, Calendar, or Work Schedule core is created.
- Studio staff administration remains separate from shift administration.

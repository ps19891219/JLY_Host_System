# Calendar module boundaries

MyCar Calendar is isolated under `js/modules/calendar/mycar/` so repairs do not change shared Calendar Core or Work Schedule.

## Active MyCar files

- `entry.js`: MyCar-only entry.
- `sync.js`: the only active MyCar Google resync flow.
- `persist-guard.js`, `source-guard.js`, `clean-sync.js`: compatibility or reserved files and are not part of the active success path.

## Active sync rule

The active flow reads official `cars/{carId}` data, starts OAuth from the user's tap, confirms the primary Google Calendar, re-reads the car, finds an existing event only by a verified stored Event ID or `extendedProperties.private.carId`, then updates or creates it. The returned Event ID is exact-GET verified with the same OAuth token. Event ID, `private.carId`, start, and end must match JLY before `calendar.syncStatus` can become `synced`.

Google event titles and Work Schedule events are never used to infer MyCar events. A stale stored Event ID is never patched unless exact GET proves its `private.carId` belongs to the current car.

## Isolation rule

MyCar Calendar changes must not modify Work Schedule, Studio, LINE, Accounting, Person/Identity, Script Master, or player signup behavior. `工作－...` and `劇本－...` are separate domains.

Shared `auth/provider/data` files stay shared. Further folder moves are only allowed after consumers are verified first.

# Calendar module boundaries

MyCar Calendar is isolated under `js/modules/calendar/mycar/` so repairs do not change shared Calendar Core or Work Schedule.

## Active MyCar files

- `entry.js`: MyCar-only entry.
- `lifecycle-sync.js`: active MyCar Google resync flow.
- `sync.js`: previous flow kept for rollback/reference, not loaded by the active entry.
- `persist-guard.js`, `source-guard.js`, `clean-sync.js`: compatibility or reserved files, not active success judges.

## Active sync rule

The active flow reads official `cars/{carId}` data, starts OAuth from the user's tap, confirms the primary Google Calendar, and re-reads the car before any write.

A Google event is `synced` only when all of these are true: exact Event ID GET succeeds, `extendedProperties.private.carId` matches the JLY Car ID, start/end match JLY, and the same Event ID is present in a normal primary Calendar date-window LIST with `showDeleted=false`.

If exact GET succeeds but normal date LIST cannot see the event, it is treated as an orphan event. Only the explicit MyCar `重新同步 Google` action may delete that event, and only after exact GET proves the event's private Car ID belongs to that car. The flow then creates a new event and repeats exact GET plus normal date LIST verification. If the rebuilt event is still invisible, it remains `error` and is never marked `synced`.

Google event titles and Work Schedule events are never used to infer MyCar events. A stale stored Event ID is never patched or deleted unless exact GET proves its private Car ID belongs to the current car.

## Isolation rule

MyCar Calendar changes must not modify Work Schedule, Studio or other Calendar domains. `工作－...` and `劇本－...` are separate domains.

Shared `auth/provider/data` files stay shared. Further folder moves are only allowed after consumers are verified first.

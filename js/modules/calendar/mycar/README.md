# Calendar module boundaries

Calendar is split by responsibility so a repair in one area cannot silently change another area.

## Shared Calendar Core

Files kept directly under `js/modules/calendar/` are shared infrastructure only: Google OAuth/config/provider, generic calendar data persistence, generic sync/controller helpers, and schedule checks. Shared Core must not contain MyCar-only branching or Work Schedule business rules.

## MyCar Calendar

All MyCar-specific behavior lives under `js/modules/calendar/mycar/`:

- `entry.js`: MyCar-only module entry point.
- `sync.js`: MyCar batch resync / repair flow.
- `persist-guard.js`: MyCar persisted-event verification.
- `source-guard.js`: backward-compatible source guard slot.
- `clean-sync.js`: reserved MyCar clean-sync slot.

Source of truth is always `cars/{carId}`. Google Calendar is an external sync target. MyCar verification must use the same OAuth token and primary calendar, validate exact event ID, `extendedProperties.private.carId`, and official JLY start/end before persisting `synced`.

## Isolation rule

MyCar Calendar changes must not modify Work Schedule, Studio, LINE, Accounting, Person/Identity, Script Master, or player signup behavior. Work Schedule events such as `工作－...` are a separate domain from MyCar events such as `劇本－...`.

Legacy top-level `mycar-calendar-*.js` paths remain compatibility bridges only. New MyCar Calendar work must target the `mycar/` folder.

## Next classification candidates

The remaining shared files should only be moved into finer folders when their consumers are verified first. Do not relocate them just for cosmetics. Candidate groups are `core/` for auth/provider/data primitives and `activity/` for activity/detail scheduling behavior. Work Schedule stays in its own existing module tree and must not be folded into MyCar Calendar.

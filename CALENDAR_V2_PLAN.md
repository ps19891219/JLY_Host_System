# JLY Calendar V2

Google Calendar is an external time provider. JLY Activity remains the source of truth. Google deletion never deletes a JLY car. Host-side Google date/time changes require explicit confirmation before changing JLY. Member calendar changes never affect the car. Existing calendar IDs and URLs are preserved during migration. Google events titled `劇本－名稱` may be surfaced as pending candidates for creating a JLY car, but creation still requires host confirmation.

## Module boundary update 2026-09-14

Calendar code is classified by responsibility. Shared files directly under `js/modules/calendar/` are infrastructure only and must not own MyCar-specific branching. MyCar Calendar behavior is isolated under `js/modules/calendar/mycar/`. Legacy top-level MyCar Calendar files are compatibility bridges only.

MyCar and Work Schedule are separate domains even when both use Google Calendar. `劇本－...` events belong to MyCar/Activity sync; `工作－...` events belong to Work Schedule. Repairing MyCar must not alter Work Schedule, Studio, LINE, Accounting, Person/Identity, Script Master, or player signup behavior.

## MyCar resync single path

MyCar has one active Google resync success path only:

1. Read official `cars/{carId}` data.
2. Start Google OAuth directly from the user's tap.
3. Confirm the primary Google Calendar identity.
4. Re-read official car data before writing.
5. Trust a stored Event ID only when exact GET proves `extendedProperties.private.carId` matches the current Car ID.
6. Otherwise locate an existing event only by `private.carId`.
7. Update the exact matching event or create a new event when none exists.
8. Exact-GET the returned Event ID with the same OAuth token.
9. Verify Event ID, `private.carId`, official start, and official end.
10. Persist `calendar.syncStatus = synced` only after that verification passes.

Google title matching, same-date event lists, and Work Schedule events are never used as MyCar success authority. A stale Event ID is never patched unless exact GET proves it belongs to the same Car ID.

Any future folder split must update this map at the same time. Move shared Core files only after all consumers are verified, so classification work itself does not cause cross-module regressions.

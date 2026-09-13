# JLY Calendar V2

Google Calendar is an external time provider. JLY Activity remains the source of truth. Google deletion never deletes a JLY car. Host-side Google date/time changes require explicit confirmation before changing JLY. Member calendar changes never affect the car. Existing calendar IDs and URLs are preserved during migration. Google events titled `劇本－名稱` may be surfaced as pending candidates for creating a JLY car, but creation still requires host confirmation.

## Module boundary update 2026-09-14

Calendar code is now classified by responsibility. Shared files directly under `js/modules/calendar/` are infrastructure only and must not own MyCar-specific branching. MyCar Calendar behavior is isolated under `js/modules/calendar/mycar/` with its own entry point, sync flow, source guard, and persisted-event guard. Legacy top-level MyCar Calendar files are compatibility bridges only.

MyCar and Work Schedule are separate domains even when both use Google Calendar. `劇本－...` events belong to MyCar/Activity sync; `工作－...` events belong to Work Schedule. Repairing MyCar must not alter Work Schedule, Studio, LINE, Accounting, Person/Identity, Script Master, or player signup behavior.

Any future folder split must update this map at the same time. Move shared Core files only after all consumers are verified, so classification work itself does not cause cross-module regressions.

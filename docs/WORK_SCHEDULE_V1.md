# JLY Work Schedule V1

## Positioning
Work Schedule is independent from My Car. It records work first and may later link to Script Master, Studio Master, Activity, Recruitment, Payroll and Accounting without replacing the original shift.

## Canonical rules
- Person remains the canonical human identity. No actor/NPC/DM person database.
- `workShifts` is the source of truth for individual scheduled shifts.
- `workScheduleWorks` stores reusable Work configuration and role pools. It is configuration, not a second shift source.
- Role Pool answers「這個工作／角色有哪些人可以排」; Shift Assignment answers「這一天實際是誰上班」. Never collapse these two layers again.
- Work name, location, roles, eligible people, date, time, required count, actual assignments and note remain editable after creation.
- Same-name Person records are never automatically merged. Person IDs are canonical.
- A Person may belong to multiple role pools in the same work.
- Cross-midnight time such as 19:00–02:00 produces the next end date.

## Edit contract
Opening an existing shift must restore the full Work role pool, not only the people assigned that day. The original assigned people are highlighted; other eligible people remain available. Editing may add/remove/rename roles, add/remove eligible people, replace daily assignees, change work/location/date/time/headcount/note, and save the updated configuration.

## Google Calendar
- JLY Shift remains canonical; Google Calendar is the synchronization destination.
- New shifts default to `syncEnabled=true` in the Work Schedule UI.
- First sync creates one Google event and stores its `eventId` mapping on the shift.
- Later edits update the mapped Google event instead of creating duplicates.
- Cross-midnight duration is preserved.
- The old ICS/bulk-download flow is no longer the primary Work Schedule path.
- iPhone/Apple Calendar may display the same Google calendar through the user's Google account; JLY does not create a second Apple-specific calendar core.

## Staffing completeness
Each shift stores `requiredCount`, `missingCount` and `staffingStatus`. Assigned < required is pending; assigned >= required is complete.

## Mobile UX
Search Person rather than dumping the full directory. Date selection is touch-first. Candidate people stay visible during editing, selected people are highlighted, unselected candidates remain available.

## Read-volume direction
V1 uses month-scoped reads. Before public player traffic is enabled, add Schedule/Public Projections so high-volume readers consume prebuilt views and writes only rebuild affected projections.

## Future
Availability/conflict warnings, attendance, payroll/pay rules, Script/Studio stable-ID claiming, Activity/Recruitment flow, and public schedule projections remain later phases.
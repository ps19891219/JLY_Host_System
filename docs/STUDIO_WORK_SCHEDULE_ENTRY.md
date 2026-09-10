# Studio Work Schedule Entry

Status: current navigation contract

The existing `pages/work-schedule.html` is the studio/store administration scheduling surface. It is not the future Person-facing `我的工作` page and must not be presented as part of `我的車`.

Navigation responsibility:

- `index.html` → `pages/studio.html` → `pages/work-schedule.html`
- `pages/mycar.html` remains the car/activity surface and must not link directly to the studio scheduling backend.
- Future `我的工作` will be a Person-centric view over the same Work Schedule Core/Assignment data and may be linked from the personal area after Person/LINE identity integration.

This separation is navigation/view responsibility only. It does not create a second Work Schedule, Person, Calendar, Shift, Assignment, or Role Pool core.

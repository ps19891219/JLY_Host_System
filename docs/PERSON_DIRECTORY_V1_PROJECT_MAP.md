# Project Map — Person Directory V1

## Entry
- `index.html` → `pages/person-directory.html`

## Person Directory
- `pages/person-directory.html` — host roster management surface.
- `js/modules/member/person-directory.js` — create/search/filter/edit UI controller.
- `css/pages/person-directory.css` — mobile-first roster UI.
- `js/modules/member/picker/picker-data.js` — shared canonical Person loader, identity labels and strong-identity dedupe.

## Activity entry
- `js/car/car-view-actions.js` — player/DM claim UI. LINE group context selects an existing host-entered car name only; public context hides roster names.
- `services/line/member-welcome-card.js` — marks player/DM links as LINE group entry context.

## Host manual add
- `js/modules/car/detail/player/player-search.js` — canonical Person selection and explicit same-name override.
- `js/modules/car/detail/player/player-manual-add.js` — Car Detail seat/manual-add orchestration.

## Data rule
The existing `players` collection remains the current canonical Person source. Guest/Member are identity states; Activity Player/DM/Staff are roles and must not become duplicate Person stores.

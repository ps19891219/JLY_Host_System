# JLY Host System｜Project Map V3.31 Continuation

> Canonical continuation of `docs/PROJECT_MAP.md` and `docs/PROJECT_MAP_V3.22_V3.24_APPEND.md`.
>
> This is an append to the existing Project Map, not a second blueprint.
>
> Last Updated: 2026-09-04

## V3.31 MyCar Prepared View Seat Summary Root Fix

- `myCarViews/{viewerId}` remains the formal MyCar Read Model. A car is compacted into its Prepared View at build/mutation time only; `js/mycar.js` runtime consumes the stored prepared card and must not call `compactCar()` again.
- Seat occupancy truth for MyCar cards is projected from formal Core `slots` when a View is built or refreshed. `seatSummary` is then carried by the compact card so the UI does not fall back to guessing gender occupancy from `players.position`.
- `compactCar()` / `buildSeatSummary()` are defensive and idempotent: when Core `slots` are present, `seatSummary` is recalculated from them; when a prepared card has no Core `slots`, an existing valid `seatSummary` is preserved instead of being replaced with `null`.
- Seat and membership mutations continue to invalidate MyCar through the formal View Mutation chain. `players`, `playerIds`, `slots`, `maleSlots`, `femaleSlots`, `flexibleSlots`, and `totalPeople` must all resolve to the `mycar` impact and refresh the Prepared View rather than relying on page reload repair.
- Runtime cache entry: `pages/mycar.html` loads `mycar.js?v=48`; `js/mycar.js` loads `mycar-view.js?v=7`.
- Regression coverage: `tests/data-view/mycar-prepared-view-idempotency.test.js` protects the full 3男/3女 case across defensive re-compaction, forbids runtime re-projection of Prepared View cards, and asserts formal seat/membership invalidation triggers. Existing `mycar-seat-projection.test.js` continues to protect join/removal, cross-play, total-capacity, identity, and member-view refresh behavior.

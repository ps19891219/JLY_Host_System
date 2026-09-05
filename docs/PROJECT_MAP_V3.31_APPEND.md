# JLY Host System｜Project Map V3.31–V3.32 Continuation

> Canonical continuation of `docs/PROJECT_MAP.md` and `docs/PROJECT_MAP_V3.22_V3.24_APPEND.md`.
>
> This is an append to the existing Project Map, not a second blueprint.
>
> Last Updated: 2026-09-05

## V3.32 MyCar Historical Seat Projection Self-Repair

- V3.31 prevents new runtime double-projection, but production acceptance showed that historical `myCarViews/{viewerId}.cars[]` can already contain stale `seatSummary` / compact `players` from older mutations. A correct runtime consumer cannot repair data that was already stale when stored.
- `js/data-view/mycar-view-existence-repair.js` now performs a one-time Seat Projection repair for an existing MyCar View. It takes only the car IDs already present in that user's Prepared View, reads the corresponding canonical `cars/{carId}` documents in chunks of 10, runs the existing `JLYMyCarView.compactCar()` against current Core `slots`, and replaces only seat-related projection fields (`totalPeople`, seat capacity fields, `seatSummary`, compact `players`). It does not rebuild unrelated card metadata or scan the full cars collection.
- The same pass removes Prepared View cards whose Core car no longer exists, so historical ghost cleanup and stale seat repair share one bounded compatibility read instead of separate collection scans.
- The repaired view is marked with `seatProjectionRepairRevision = 1` and timestamp/count metadata. Normal future visits skip the Core read entirely after this revision is present. This is a compatibility repair only; normal MyCar remains View-first and future changes stay mutation-driven through `ViewImpactResolver → ViewMutationCoordinator → JLYMyCarView.applyCarMutation`.
- Existing formal `slots` remain the source for seat occupancy. The repair does not infer gender occupancy from player display names or `players.position` when current Core slots are available.
- Runtime cache entry: `pages/mycar.html` loads `mycar-view-existence-repair.js?v=2` after `mycar.js?v=48`.
- Regression coverage: `tests/data-view/mycar-seat-projection-repair.test.js` covers stale 3男/3女 Prepared View → current full Core seats, ghost removal in the same pass, and revision-based no-repeat behavior. Full repository regression after the final implementation: 386 tests / 386 pass / 0 fail.

## V3.31 MyCar Prepared View Seat Summary Root Fix

- `myCarViews/{viewerId}` remains the formal MyCar Read Model. A car is compacted into its Prepared View at build/mutation time only; `js/mycar.js` runtime consumes the stored prepared card and must not call `compactCar()` again.
- Seat occupancy truth for MyCar cards is projected from formal Core `slots` when a View is built or refreshed. `seatSummary` is then carried by the compact card so the UI does not fall back to guessing gender occupancy from `players.position`.
- `compactCar()` / `buildSeatSummary()` are defensive and idempotent: when Core `slots` are present, `seatSummary` is recalculated from them; when a prepared card has no Core `slots`, an existing valid `seatSummary` is preserved instead of being replaced with `null`.
- Seat and membership mutations continue to invalidate MyCar through the formal View Mutation chain. `players`, `playerIds`, `slots`, `maleSlots`, `femaleSlots`, `flexibleSlots`, and `totalPeople` must all resolve to the `mycar` impact and refresh the Prepared View rather than relying on page reload repair.
- Runtime cache entry: `pages/mycar.html` loads `mycar.js?v=48`; `js/mycar.js` loads `mycar-view.js?v=7`.
- Regression coverage: `tests/data-view/mycar-prepared-view-idempotency.test.js` protects the full 3男/3女 case across defensive re-compaction, forbids runtime re-projection of Prepared View cards, and asserts formal seat/membership invalidation triggers. Existing `mycar-seat-projection.test.js` continues to protect join/removal, cross-play, total-capacity, identity, and member-view refresh behavior.

# Recruit Prepared View read migration

## Runtime rule

Recruit list rendering must not read or hydrate `cars` Core. Host cards come from `myCarViews`; assist-only cards may use `carDetailViews`. Core is reserved for detail/edit/mutation and explicit repair/bootstrap.

## Schema 6

`myCarViews.cars[]` now also stores the Recruit card fields `visibility`, cover image URLs and `myRole`. The mutation impact resolver includes those fields so future car writes keep the snapshot current.

## Existing schema 5 views

Existing schema 5 snapshots do not contain `visibility`. They must be rebuilt by the existing explicit MyCar bootstrap/repair path before switching Recruit production traffic to the prepared-only reader. Do not silently treat a missing visibility as public, because that could expose a private car. Do not add a normal page-load Core fallback.

# MyCar View-first Contract

Status: Active contract for MyCar normal reads.

## Source of truth

- `cars/{carId}` and formal Membership/Identity data remain Core source of truth.
- `myCarViews/{viewerId}` is the prepared read model for MyCar UI. It is not a second Core.

## Normal page load

`pages/mycar.html` must read the prepared MyCar View through `js/mycar.js` / `js/data-view/mycar-view.js`.

Normal page load must not:

- scan all `cars` to rediscover membership;
- reverse-discover aliases;
- rebuild the MyCar View;
- write `myCarViews` or `myCarViewAliases`;
- mutate `cars.ownerId` or Membership identity.

A read/query/identity failure is not equivalent to an empty MyCar View and must never be persisted as an empty replacement.

## Role projection

Host/player classification is stored on each prepared car (`isHost`, `isPlayer`, `role`, `ownerType`). UI filters the same prepared collection. Host precedence remains unchanged.

## Writes

Prepared View updates belong to successful mutation/bootstrap/explicit repair flows. Repairs must be explicit and separately guarded from ordinary page reads.

## Recovery

If an existing prepared View has already been emptied or corrupted, restore it through an explicit controlled repair from formal Core data. Do not attach that recovery to page load.

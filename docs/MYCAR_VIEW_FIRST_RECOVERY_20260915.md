# MyCar View Recovery Boundary 2026-09-15

## Safe code baseline

- main at branch creation: `e66519aa3bcf3b63091e7f680ee3fe431828a05b`
- repair branch: `fix/mycar-view-first-readonly-20260915`
- first behavior change: `d0980e96de664028dee300515ec6bcda11047f42`

Rollback the repair branch to the baseline above if the new read-only page behavior causes a regression.

## Current step

The normal MyCar page no longer loads `mycar-legacy-identity-repair.js`. This prevents page entry from automatically rebuilding/writing MyCar Prepared View or aliases.

This step does not restore an already-empty Prepared View. Recovery is intentionally separate so that a read action cannot become a write action.

## Data safety

No change in this step writes `cars`, changes `cars.ownerId`, rewrites Membership, or repairs Identity. Calendar repair loading is preserved.

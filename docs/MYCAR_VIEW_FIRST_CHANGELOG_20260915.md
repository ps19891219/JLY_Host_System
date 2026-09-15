# MyCar View-first change set

This batch intentionally changes only the normal MyCar read contract and adds regression documentation/tests.

Functional change:
- `pages/mycar.html`: remove automatic legacy identity repair from normal page load.

Preserved:
- `js/mycar.js` View-first reader and role filters.
- MyCar calendar repair script.
- Core Car/Identity/Membership data.
- Matching work already present in main baseline.

Not performed in this batch:
- Firestore recovery write.
- alias discovery.
- ownerId migration.
- Production merge/deploy.

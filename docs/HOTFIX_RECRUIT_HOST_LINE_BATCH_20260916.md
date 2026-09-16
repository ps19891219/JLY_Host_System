# Recruit host LINE batch hotfix 2026-09-16

Scope: restore formal host cars on `/pages/recruit.html` so batch LINE recruiting copy can select recruiting cars.

Root cause: `JLYCarData.getCarsByOwner(ownerId)` returns raw `cars` Core records. `recruit-controller.js` then incorrectly filtered those raw records using `isHost` / `myRole`, which are MyCar Prepared View projection fields and are not required on Core records. Valid owner cars were therefore reduced to zero.

Fix: treat the bounded formal `ownerId` query result as the host-car set, then retain the existing recruiting-status and public-visibility filters. No `cars.ownerId` mutation, no full cars scan, no Work Schedule/Matching/Calendar/Accounting/LINE identity changes.

Restore base before hotfix: `1d96b820ac6c8a86d5c44f2ef369eab65bef54b1`.

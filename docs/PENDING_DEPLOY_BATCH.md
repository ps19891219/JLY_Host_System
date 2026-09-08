# JLY Host System｜Pending Deploy Batch

> Purpose: single source of truth for code that is completed/in progress but NOT yet available on the production site.
> Production must remain on the last successful Vercel deployment until the batch is explicitly deployed.

Updated: 2026-09-08
Batch branch: `batch/person-canonical-migration`
Production deploy status: READY FOR FINAL MERGE / PRODUCTION DEPLOY. Production is NOT yet verified.

## Ready in main, NOT deployed

### 1. Accounting reset page / accounting-only reset
Status: CODE READY, NOT YET PRODUCTION-VERIFIED

Included behavior:
- `pages/accounting-reset.html` provides the mobile reset confirmation UI.
- Accounting-only reset reuses `api/maintenance-reset-current-accounting.js`; no 13th top-level Vercel Function.
- Clears Accounting collections for owned cars only.
- Does NOT intentionally modify Person, player, DM/staff, seats, LINE identity, cars, Calendar, or reminders in accounting-only mode.
- Requires explicit `RESET_ACCOUNTING_ONLY` confirmation.
- Member session verification contract corrected through `{ valid, data }`.
- Regression test: `tests/accounting/accounting-reset-session-contract.test.js`.

Production verification remains required after the next successful deployment.

### 2. Person / Member Picker duplicate prevention
Status: CODE READY, NOT YET PRODUCTION-VERIFIED

Included behavior:
- Strong identity evidence is used for canonical Person matching.
- Same name alone is NOT identity proof and must not auto-merge people.
- Existing Person selection is preferred.
- Creating another same-name Person requires an explicit choice/confirmation.
- Provisional `line:<userId>` is not treated as formal Person evidence.

### 3. Canonical Person audit + historical reference inventory + dry-run migration plan
Status: CODE READY, READ-ONLY TOOLING, NO PRODUCTION PERSON MUTATION

Completed:
- `scripts/person-dedupe-audit.js` classifies candidate groups as `SAFE STRONG MATCH`, `REVIEW REQUIRED`, or `SAME NAME ONLY`.
- Candidate discovery includes same normalized name, shared `lineUserId`, shared `identityId`, shared formal `profileId`, and explicit canonical/merged/person/linkedPlayer relationships.
- Same-name remains candidate discovery only and never becomes identity proof.
- A whole candidate group is `SAFE STRONG MATCH` only when every record is connected through consistent strong identity evidence.
- Contradictory LINE / identity / formal profile values force `REVIEW REQUIRED`.
- Canonical score ties are surfaced for review instead of guessed.
- `scripts/person-canonical-migration-dry-run.js` is read-only and inventories candidate document IDs plus formal historical `personId` / `linkedPlayerIds` aliases.
- Provisional `line:<userId>` is excluded from Person migration aliases.
- Ambiguous historical aliases block migration moves.
- No apply/update/delete Person migration mode exists in this batch.

Future destructive Person migration remains a separate project gate and requires real-data dry-run/reference review first.

### 4. Person Directory + reusable identity for manual add
Status: CODE READY, NOT YET PRODUCTION-VERIFIED

Included behavior:
- Person Directory is a View over the existing Person source, not a second database.
- `pages/person-directory.html` adds the read-only mobile Person Directory surface.
- Member Picker and manual Player add prefer existing canonical Person records.
- A Person that already completed LINE Identity binding is reused in later Activities without a second LINE claim.
- Player / DM / Staff remain Activity roles.
- Stable Person IDs are authoritative. If both selected Person and existing car member have stable IDs and they differ, equal names do not make them the same person.
- Name fallback remains only for legacy missing-ID records.
- Creating another same-name Person requires explicit confirmation.
- Regression coverage includes `tests/member-person-directory.test.js` and `tests/car/player-manual-add-identity.test.js`.

### 5. LINE group binding authorization correction
Status: CODE READY, NOT YET PRODUCTION-VERIFIED

Architecture:
- LINE group creator, car host/owner, pairing-code sender, and pairing confirmer are separate concepts.
- Car-side authorization occurs when the short-lived pairing code is created.
- `api/line-group-pairing-code.js` verifies member session + car-owner identity before issuing the code.
- Authorized pairing codes record authorization metadata.
- Any participant in the target LINE group may paste a valid authorized pairing code. They do not need to be the car owner or group creator.
- Confirmation is restricted to the same LINE user and same LINE group that initiated pairing.
- Legacy pairing records without authorization metadata must be regenerated.
- Direct/legacy binding without an authorized code remains owner-gated.
- LINE reply text is aligned with this architecture and no longer tells users the confirmer must be the host.

## Architecture map

- Canonical `docs/PROJECT_MAP.md` historical content is preserved intact.
- New Person Directory responsibility is synchronized in `docs/project-map/person-directory.md` as an additive Project Map module.
- This avoids destructive full-file replacement of the large historical canonical map while keeping the new architecture formally documented.

## Final pre-deploy evidence

- Final tested branch head before this documentation-only gate update: `31d05dbb94f06d280d6aa2fa7f134f087172f4af`.
- GitHub Actions run `34214957449`: `npm ci` SUCCESS, `npm test` SUCCESS.
- Vercel Preview status for the tested head: SUCCESS.
- Existing batch workflow is now a permanent `batch/**` test gate, not a temporary per-PR workflow.
- Top-level `/api` function count remains 12.
- No production Person migration apply/delete path exists.

## Deployment gate

- [x] Finish intended code behavior.
- [x] Full `npm test` succeeded on tested code head.
- [x] Permanent batch CI gate established; no throwaway CI workflow.
- [x] Top-level `/api` count remains 12.
- [x] Pending Accounting Reset, Person safeguards, Person Directory, canonical read-only tooling, and LINE group binding correction are included in this batch.
- [x] Person Directory Project Map responsibility is recorded without overwriting canonical history.
- [x] Vercel Preview build succeeded on tested code head.
- [ ] Merge final batch to `main`.
- [ ] Confirm Vercel Production deployment SUCCESS for merged main commit.
- [ ] Verify production pages/API smoke checks.
- [ ] Perform Accounting Reset real production verification.
- [ ] Verify LINE group binding using a newly generated authorized pairing code in a real LINE group.
- [ ] Mark production items completed only after verification.

## Do not forget

GitHub merge is NOT production verification. Vercel Preview is NOT Production. Items remain unverified until the merged main commit is successfully deployed and the relevant production behavior is checked.

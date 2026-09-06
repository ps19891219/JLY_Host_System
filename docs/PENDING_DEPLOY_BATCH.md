# JLY Host System｜Pending Deploy Batch

> Purpose: single source of truth for code that is completed/in progress but NOT yet available on the production site.
> Production must remain on the last successful Vercel deployment until the batch is explicitly deployed.

Updated: 2026-09-06
Batch branch: `batch/person-canonical-migration`
Production deploy status: BLOCKED by Vercel deployment rate limit. Do not trigger extra deployments while blocked.

## Ready in main, NOT deployed

### 1. Accounting reset page / accounting-only reset
Status: CODE READY, NOT DEPLOYED

Included behavior:
- `pages/accounting-reset.html` provides the mobile reset confirmation UI.
- Accounting-only reset reuses `api/maintenance-reset-current-accounting.js`; no 13th top-level Vercel Function.
- Clears Accounting collections for owned cars only.
- Does NOT intentionally modify Person, player, DM/staff, seats, LINE identity, cars, Calendar, or reminders in accounting-only mode.
- Requires explicit `RESET_ACCOUNTING_ONLY` confirmation.
- Member session verification contract corrected through `{ valid, data }`.
- Regression test: `tests/accounting/accounting-reset-session-contract.test.js`.

Production verification remains required after the next successful deployment. Do not ask for retest before then.

### 2. Person / Member Picker duplicate prevention
Status: CODE READY IN MAIN, NOT YET PRODUCTION-VERIFIED

Included behavior:
- Strong identity evidence is used for canonical Person matching.
- Same name alone is NOT identity proof and must not auto-merge people.
- Existing Person selection is preferred.
- Creating another same-name Person requires an explicit choice/confirmation.
- Provisional `line:<userId>` is not treated as formal Person evidence.

## In progress in this batch

### 3. Canonical Person audit + historical reference inventory + dry-run migration plan
Status: CODE READY IN BATCH FOR TESTING, NO PRODUCTION WRITE, NOT MERGED

Completed in batch:
- `scripts/person-dedupe-audit.js` classifies candidate groups as `SAFE STRONG MATCH`, `REVIEW REQUIRED`, or `SAME NAME ONLY`.
- Same-name remains candidate discovery only and never becomes identity proof.
- Strong match evidence is restricted to shared LINE user ID, identity ID, or formal profile ID.
- Canonical/merged/person/linkedPlayer references can raise a group to review, but do not independently become safe identity proof.
- Canonical recommendation records reasons such as `LINE_LINKED`, `IDENTITY_MATCH`, `PROFILE_MATCH`, `LINKED_HISTORY`, and `CANONICAL_REFERENCE`.
- Provisional `line:<userId>` records are penalized as canonical candidates and are not treated as formal Person identity.
- `scripts/person-canonical-migration-dry-run.js` performs recursive read-only Firestore traversal across current top-level collections and nested subcollections.
- Historical reference inventory records exact document path, field path, referenced Person ID, and domain.
- Inventory domains cover Car, player/membership, staff/DM, applications, seats, Accounting, Pending Action, Calendar, reminder, LINE/profile/identity, and uncategorized historical references.
- Dry-run plans explicitly list `fromPersonId`, `toPersonId`, and every discovered reference that would require migration.
- `SAME NAME ONLY` and non-strong review groups remain blocked from migration moves.
- The dry-run tool has no apply mode and contains no update/delete migration path.
- Regression coverage added in `tests/person-canonical-migration.test.js`.

Safety rules:
- Preserve all historical Activity/Car membership history.
- Roles belong to Activity/Membership, not separate Person records.
- Never delete duplicate Person records before reference migration and verification.
- Migration apply is a future separate explicit stage, not part of this batch dry run.
- No production Firestore writes are authorized by these scripts.

Remaining before batch merge/deploy:
- Run the complete `npm test` suite on final batch head.
- Review dry-run output against real Firestore data with read-only credentials before any future apply design.
- Confirm no missing Person reference shapes appear in the `OTHER` inventory domain.
- Keep PR #32 Draft until the batch review is complete.

## Deployment gate

Before the next production deployment:
- [ ] Finish the intended batch work.
- [ ] Run full `npm test` on the final batch head.
- [ ] Confirm temporary CI workflow changes are absent.
- [ ] Confirm top-level `/api` function count remains within Vercel Hobby limit.
- [ ] Review `main` vs last successful production commit so every pending change is accounted for.
- [ ] Confirm every pending item in this document is included in the deployment candidate.
- [ ] Trigger ONE production deployment only after Vercel rate limit is restored.
- [ ] Verify production deployment success before asking the user to test.
- [ ] Perform accounting reset production verification only after successful deployment.
- [ ] Mark items completed only after production verification.

## Do not forget

A GitHub merge is NOT the same as production deployment. Any item listed here remains pending until Vercel reports a successful deployment and production verification is completed.

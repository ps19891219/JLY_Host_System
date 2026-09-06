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
- Candidate discovery now includes same normalized name, shared `lineUserId`, shared `identityId`, shared formal `profileId`, and explicit canonical/merged/person/linkedPlayer relationships. Name changes or blank/legacy naming therefore do not hide a strong-identity candidate.
- Same-name remains candidate discovery only and never becomes identity proof.
- A whole candidate group is `SAFE STRONG MATCH` only when every record is connected through consistent strong identity evidence. A partial strong edge cannot make unrelated same-name records safe.
- Contradictory LINE / identity / formal profile values force `REVIEW REQUIRED` even when another strong key is shared.
- Canonical/merged/person/linkedPlayer references can raise a group to review, but do not independently become safe identity proof.
- Canonical recommendation records reasons such as `LINE_LINKED`, `IDENTITY_MATCH`, `PROFILE_MATCH`, `LINKED_HISTORY`, and `CANONICAL_REFERENCE`; canonical score ties are surfaced for review instead of guessed.
- Provisional `line:<userId>` records are penalized as canonical candidates and are not treated as formal Person identity.
- `scripts/person-canonical-migration-dry-run.js` performs recursive read-only Firestore traversal across current top-level collections and nested subcollections.
- Historical reference inventory scans candidate document IDs plus formal historical `personId` / `linkedPlayerIds` aliases. Provisional `line:<userId>` is excluded from Person migration aliases.
- Historical reference inventory records exact document path, field path, matched alias, owning Person candidate(s), and domain.
- Inventory domains cover Car, player/membership, staff/DM, applications, seats, Accounting, Pending Action, Calendar, reminder, LINE/profile/identity, and uncategorized historical references.
- If one historical alias maps to multiple Person candidates, the dry-run reports `AMBIGUOUS_HISTORICAL_ALIAS`, blocks the group, and produces no migration moves.
- Dry-run plans explicitly list `fromPersonId`, `toPersonId`, aliases, and every discovered reference that would require migration only for unambiguous safe candidates.
- `SAME NAME ONLY`, conflicting identity, partial-strong, ambiguous-alias, and other review groups remain blocked from migration moves.
- The dry-run tool has no apply mode and contains no update/delete migration path.
- Regression coverage in `tests/person-canonical-migration.test.js` now covers renamed strong-identity candidates, conflicting strong identity, partial strong groups, historical aliases, ambiguous alias blocking, and same-name safety.

Safety rules:
- Preserve all historical Activity/Car membership history.
- Roles belong to Activity/Membership, not separate Person records.
- Never delete duplicate Person records before reference migration and verification.
- Migration apply is a future separate explicit stage, not part of this batch dry run.
- No production Firestore writes are authorized by these scripts.

### 4. Person Directory + reusable identity for manual add
Status: CODE READY IN BATCH FOR TESTING, NOT MERGED, NOT DEPLOYED

Purpose:
- A Person who already completed LINE Identity → Host Approval → Person Binding should be reusable in later Activities without claiming identity again.
- Player / DM / Staff remain Activity roles over the same Person, not separate identity records.

Included in batch:
- `js/modules/member/picker/picker-data.js` exposes canonical Person Directory identity state and labels.
- Existing canonical dedupe stays strong-evidence-only. Same-name People remain separate.
- LINE-linked Person records are visibly marked `已連結 LINE`; formal non-LINE Person records remain reusable; provisional `line:<userId>` is not promoted to formal Person proof.
- `pages/person-directory.html` adds a read-only mobile-friendly Person Directory surface over the existing `players` Person source.
- `js/modules/member/person-directory.js` renders/searches the canonical directory without creating a second Person store.
- `css/pages/person-directory.css` provides the directory UI.
- Member Picker wording is generalized from staff-only wording to Person selection and shows identity linkage state.
- `js/modules/car/detail/player/player-search.js` loads the same canonical Person Directory before manual player creation.
- Manual add of an existing LINE-linked Person reuses that Person ID and therefore does not require a new identity claim.
- Creating another same-name Person requires an explicit confirmation that this is a different real person.
- Regression coverage added in `tests/member-person-directory.test.js`.

Safety rules:
- No second Person / Player Person / DM Person / Staff Person system.
- No name-based automatic merge.
- No automatic LINE rebinding.
- Existing LINE Identity Claim approval flow remains authoritative for first-time binding.
- This batch does not migrate or delete production Person records.

Remaining before batch merge/deploy:
- Run the complete `npm test` suite on final batch head.
- Review dry-run output against real Firestore data with read-only credentials before any future apply design.
- Confirm no missing Person reference shapes appear in the `OTHER` inventory domain.
- Integrate the Person Directory Project Map supplement into canonical `docs/PROJECT_MAP.md` without truncating historical map entries.
- Keep PR #32 Draft until the batch review is complete.

## Deployment gate

Before the next production deployment:
- [ ] Finish the intended batch work.
- [ ] Run full `npm test` on the final batch head.
- [ ] Confirm temporary CI workflow changes are absent.
- [x] Confirm top-level `/api` function count remains within Vercel Hobby limit: currently 12.
- [ ] Review `main` vs last successful production commit so every pending change is accounted for.
- [ ] Confirm every pending item in this document is included in the deployment candidate.
- [ ] Integrate final Person Directory responsibility into canonical `docs/PROJECT_MAP.md` without losing historical entries.
- [ ] Trigger ONE production deployment only after Vercel rate limit is restored.
- [ ] Verify production deployment success before asking the user to test.
- [ ] Perform accounting reset production verification only after successful deployment.
- [ ] Mark items completed only after production verification.

## Do not forget

A GitHub merge is NOT the same as production deployment. Any item listed here remains pending until Vercel reports a successful deployment and production verification is completed.

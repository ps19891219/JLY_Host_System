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

Important follow-up fix already in `main`:
- Member session verification contract corrected: `verifyMemberSession()` result is read through `{ valid, data }`.
- Regression test: `tests/accounting/accounting-reset-session-contract.test.js`.

Production verification still required after next successful deployment:
1. Open `/pages/accounting-reset.html` while signed in.
2. Confirm no `member_identity_required` error.
3. Run reset once.
4. Verify old mutual receivable/payable/payment/settlement/pending accounting is zeroed.
5. Verify cars, Person, player/DM/staff, seats, LINE, reminders and Calendar remain intact.

### 2. Person / Member Picker duplicate prevention
Status: CODE READY IN MAIN, NOT YET PRODUCTION-VERIFIED

Included behavior:
- Strong identity evidence is used for canonical Person matching.
- Same name alone is NOT identity proof and must not auto-merge people.
- Existing Person selection is preferred.
- Creating another same-name Person requires an explicit choice/confirmation.
- Provisional `line:<userId>` is not treated as formal Person evidence.
- Read-only audit script exists at `scripts/person-dedupe-audit.js`.

Production/data migration still pending:
- Audit actual Firestore duplicate candidates.
- Select canonical Person using strong evidence.
- Inventory and migrate historical references before any duplicate deletion.
- Never delete duplicate Person records before reference verification.

## In progress in this batch

### 3. Canonical Person historical reference audit / migration design
Status: AUDIT HARDENED, REFERENCE INVENTORY NEXT, NO PRODUCTION WRITE

Completed in batch:
- Person duplicate audit now distinguishes strong-evidence groups from same-name-only groups.
- Evidence includes canonical/merged Person references, formal person/profile/identity IDs, LINE user ID and linked historical player IDs.
- Synthetic `line:<userId>` profile/identity values are excluded as formal evidence.
- Same-name-only groups receive no suggested canonical Person.
- Audit remains read-only and reports safety flags explicitly.
- Regression tests cover same-name separation, shared LINE identity, synthetic LINE exclusion and canonical/historical linkage.

Rules:
- Preserve all historical Activity/Car membership history.
- Roles belong to Activity/Membership, not separate Person records.
- Canonical priority: LINE linkage, identityId, profile relationship, linkedPlayerIds and complete historical linkage.
- Same-name-only groups require manual review.
- Migration must be dry-run/report first. Destructive apply is a separate explicit stage.

Next:
- Inventory every Person reference shape in current Car/Activity/Accounting/LINE code before designing migration apply.
- Add a dry-run reference migration plan that reports proposed changes without writing Firestore.

## Deployment gate

Before the next production deployment:
- [ ] Finish the intended batch work.
- [ ] Run full `npm test` on the final batch head.
- [ ] Confirm temporary CI workflow changes are absent.
- [ ] Confirm top-level `/api` function count remains within Vercel Hobby limit.
- [ ] Review `main` vs last successful production commit so every pending change is accounted for.
- [ ] Trigger ONE production deployment only after Vercel rate limit is restored.
- [ ] Verify production deployment success before asking the user to test.
- [ ] Perform the accounting reset production verification checklist above.
- [ ] Mark deployed items in this file after production verification.

## Do not forget

A GitHub merge is NOT the same as production deployment. Any item listed here remains pending until Vercel reports a successful deployment and production verification is completed.

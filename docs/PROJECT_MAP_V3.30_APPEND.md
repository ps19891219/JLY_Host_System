# JLY Host System｜Project Map Continuation V3.30

> Canonical continuation of `docs/PROJECT_MAP.md` and `docs/PROJECT_MAP_V3.22_V3.24_APPEND.md`.
> This is an architecture append, not a second blueprint.
> Updated: 2026-09-03

## V3.30 LINE Group Membership Health

- Existing `lineGroupBindings` remains the only LINE Group ↔ Car association. Membership health does not create a second binding model.
- Formal JLY Person / Activity Membership remains the source of truth. `lineGroupMembershipSnapshots` stores validation state only and must not become a second member ledger.
- The first membership baseline is initialized after a successful group-to-car binding, when `groupId → carId → Activity` is known. Existing active bindings can be initialized through bounded catch-up processing.
- Historical catch-up skips ended, cancelled, completed, closed, deleted, or past-date cars and processes only active bindings without an existing `verified` / `needs_review` snapshot. It never rescans every historical car during normal operation.
- Normal operation is event-driven. LINE `memberJoined` / `memberLeft` events affect only the event group and mark its snapshot `needs_review`; they do not trigger a global group scan or repeated roster polling.
- Membership change semantics are identity-change based, not count-only. A leave and join that keep the same total count still invalidate the verified snapshot and require host review.
- Snapshot verification records `verifiedAt` / `verifiedBy`, clears accumulated join/leave deltas, and completes the same `line_membership_review` Pending Action.
- `line_membership_review` uses the host/owner as `responsiblePersonId` and provides a direct target to the mobile review page.
- New server modules: `services/line/group-membership-client.js`, `services/line/group-membership-health-service.js`, `services/line/group-membership-event-service.js`, and `services/firebase/line-group-membership-repository.js`.
- New host surface: `pages/line-membership-review.html`, with homepage pending entry through `js/modules/pending/line-membership-pending.js` and server actions through `api/line-membership-health.js`.
- `api/line-webhook.js` keeps signature verification and the existing event router, while membership health processing is isolated so a membership-health failure does not replace the established LINE assistant routing path.
- Regression coverage: `tests/line/group-membership-health-service.test.js`. Full branch regression on 2026-09-03: `379 tests / 379 pass / 0 fail`.

## Formal Baseline

- Base before V3.30: `main @ 950a03af693909b9d08a22f76207b46c33c9a40e`.
- V3.30 is delivered through PR #10 and must be squash-merged only after regression is green.

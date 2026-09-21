# Studio Operations Control Audit — 2026-09-21

## Purpose
Studio-side orchestration only. This branch builds on the Player × Studio Booking × Activity foundation and must integrate, not duplicate, Employee confirmation and Work Schedule/Matching read-view work.

## KEEP
- One real event = one formal Activity in `cars`.
- Studio Booking/Session records bind to Activity; they never clone it.
- Existing Work / Script remains the source for script defaults and selectable DM/NPC pools.
- Work Schedule remains the formal staff scheduling source of truth.
- Existing Matching remains availability collection, not final employee commitment.
- Person / LINE Identity remains canonical identity.
- Studio Membership → Role → Permission remains the authorization direction.
- Pending Action is the workflow task source; LINE is an optional notification channel.
- Prepared Read Views remain the normal list/read path.

## OPTIMIZE
- Studio needs one operational inbox over existing booking, host-change, cancellation/reschedule, employee-decline/unavailable, and assignment-confirmation tasks.
- Studio must distinguish view permission from edit/action permission.
- Studio actions that affect an established Activity must create proposals/requests when Host or Employee confirmation is required.
- Studio recruitment visibility must stay derived from host public preference + vacancy, not a manually maintained duplicate status.
- Studio pages must consume bounded prepared views and update projections incrementally on writes.

## ADD
- Studio operations permission vocabulary and pure permission evaluator.
- Studio operations inbox projection that merges already-prepared task summaries without scanning formal collections.
- Explicit action categories for Booking, Activity changes, staff assignment, reschedule/cancellation, recruitment, and player-role editing.
- Feature gate boundary for optional proactive LINE notification. LINE Identity/Login is never gated by this feature.

## Cross-PR integration boundary
- PR #261 owns Work Schedule + Studio Matching read-view hardening.
- PR #262 owns Employee tentative assignment → employee confirmation lifecycle.
- PR #263 owns Player × Studio Booking × Activity foundation.
- This Studio branch must not reimplement those domains.
- Integration should occur after the upstream contracts are stable/rebased. Until then, keep Studio orchestration modules pure and independently testable.

## Firestore / cost contract
1. No normal Studio page scans `cars`, `workShifts`, `players`, `studioMatchings`, or other formal collections to build a list.
2. Opening an operational inbox uses bounded prepared view(s).
3. Tabs, filters, checkboxes and local search over loaded rows cause zero Firestore reads.
4. Writes update Source of Truth and only affected projections.
5. No page-load repair, rebuild, migration, or background Calendar monitoring.
6. Studio selecting an employee does not scan that employee's Calendar or other schedules merely for a conflict hint.

## Studio action ownership
- Booking Request: Studio can accept, reject, or propose adjustment.
- Established Activity important change: Studio proposes; Host confirms before formal values change.
- Host reschedule/cancel request: Studio resolves according to Studio policy; cancellation preserves history.
- Tentative staff assignment: Employee confirmation is required before formal commitment.
- Employee unavailable/decline: Studio handles replacement; original employee does not approve being replaced.
- Replacement candidate must confirm before becoming formal.
- Assigned DM may edit the existing per-Activity player role/label field when permission allows; Person identity is never edited by this action.

## Production boundary
No production migration, repair, rebuild, or main merge is authorized by this branch creation.

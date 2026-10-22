# LINE group custom welcome: implementation guardrails

Status: implementation pending; do not deploy or merge this branch as a completed feature.

## Existing production flow
- api/line-webhook.js dispatches memberJoined through services/line/member-welcome-fastpath.js before other processing.
- Bound groups receive services/line/member-welcome-card.js with DM, player signup and calendar actions.
- Unbound groups currently receive no memberJoined welcome. Do not silently enable them before group-specific opt-in and secure ownership verification.

## Requirements
- Both bound and unbound LINE groups can customize only the welcome text, with restore-default.
- Bound groups retain their existing DM, player and calendar actions, group binding, Car identity and LINE identity flows.
- Unbound groups get a text-only welcome; no Car actions.
- No mandatory LINE Notes text, no new Car or Person system, no duplicate welcome messages.
- Per-group settings must be authorized server-side. LINE Messaging API does not expose reliable group admin membership. Do not treat the first member to send a command as an admin.
- For bound groups reuse verified JLY Car owner/manager authorization. For unbound groups require an explicit verifiable ownership/management claim before allowing writes.
- Keep the reply-token fast path fast; use precise groupId document reads only and preserve existing failure fallback.
- Default behavior for groups with no settings must remain exactly as production until opt-in.

## Acceptance
- Tests for existing bound group default welcome and its DM/player/calendar actions.
- Tests for customized bound and unbound group messages, disabled/unconfigured groups, restore default, multi-join coalescing, and fail-safe lookup.
- Tests for unauthorized settings changes, replay/forgery, cross-group isolation, and bounded Firestore reads.
- Do not modify main, PR #330, production deployment, Firestore data, or billing without approval.

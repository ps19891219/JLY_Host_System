# JLY Host System｜Project Map V3.33 Continuation

> Append to the existing canonical Project Map. This is not a second blueprint.
>
> Last Updated: 2026-09-05

## LINE Membership Verified Baseline

- LINE roster review remains player-centered for the JLY side. Active `car.players` are displayed as the formal player roster; DM/staff are not forced into the numeric comparison because they may or may not join the LINE group.
- Player count versus LINE group count is diagnostic context only. Equality is not a correctness requirement and a count mismatch must not keep a group in review after the host has explicitly verified it.
- Host verification means: "the current car/person configuration and real-world LINE group state have been checked and are acceptable now." The snapshot records `verifiedAt`, `verifiedBy`, `verifiedMembershipRevision`, `verifiedLineMemberCount`, and `verifiedPlayerCount` as the accepted baseline.
- After verification, normal state is `verified`. A later LINE `memberJoined` or `memberLeft` webhook event invalidates that baseline to `needs_review`, aggregates the join/leave delta, and creates/reopens the existing `line_membership_review` Pending Action. Same-count member swaps still invalidate because events, not count equality, are authoritative for change detection.
- Review UX is a round trip: LINE review → Car Detail with `lineReview=1&groupId=...` → inspect formal roster/seat configuration → `確認目前人員名單` → verify snapshot → return directly to the originating group card in LINE review. A separate return button is also provided.
- No polling or full group scan is introduced. Existing initialization/catchup remains bounded, and post-verification monitoring remains webhook/event-driven.

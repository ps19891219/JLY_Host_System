# Studio Task Action Routing — 2026-09-21

Studio Operations does not own Booking, Activity, or Employee state machines. It emits explicit commands to the owning domain.

## Booking
- Accept → existing Booking service `confirmBooking`.
- Reject → Booking domain command, preserving request/history.
- Propose adjustment → Booking domain command; Host sees a pending decision.
- If an existing Activity conflicts with the Booking, acceptance must stop at human confirmation. No silent overwrite.

## Host reschedule/cancel request
- Studio may approve, reject, or propose adjustment.
- The task remains tied to the same Activity. Reschedule never creates a second car.
- Cancellation is status/history, not deletion.
- Deposit/refund policy is not hardcoded here.

## Employee issue
- Studio may invite a replacement, withdraw a tentative assignment, or open the formal scheduling flow.
- Employee confirmation remains in the Employee workstream.
- A replacement is not formal until the replacement employee confirms.
- Studio does not scan employee Calendar to decide availability.

## Read budget
These routing helpers are pure. The Studio list stays on prepared views. Only the invoked domain command may perform bounded validation reads/writes.

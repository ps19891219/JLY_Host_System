# Project Map｜Canonical Person Directory

Status: authoritative additive Project Map module
Updated: 2026-09-08

> This file extends `docs/PROJECT_MAP.md` without replacing or truncating its historical entries. Future architecture work involving Person Directory, Person identity reuse, Member Picker, or manual Activity membership must keep this module synchronized together with the canonical Project Map.

## Responsibility

Person Directory is a View over the existing canonical Person source. It is not a second Person database and must not create Player Person, DM Person, or Staff Person.

```text
Current Person source (`players` collection, compatibility name)
├─ js/modules/member/picker/picker-data.js
│  └─ canonical Person read/search, identity state, strong-evidence dedupe
├─ js/modules/member/person-directory.js
│  └─ read-only Person Directory View
├─ pages/person-directory.html
│  └─ host-facing mobile Person Directory
├─ js/modules/member/picker/*
│  └─ choose existing Person / explicit new Person
├─ js/modules/car/detail/player/player-search.js
│  └─ manual Player add reuses existing canonical Person
├─ js/modules/car/detail/player/player-manual-add.js
│  └─ stable Person IDs are authoritative; same-name fallback is legacy-only
├─ Activity Membership / Player / DM / Staff
│  └─ per-Activity roles only
└─ LINE Identity Binding
   └─ belongs to canonical Person and is reused across Activities
```

## Identity rules

- Completed `LINE Identity → Host Approval → Person Binding` is persistent Person identity.
- Manually adding that Person to a later Activity creates/uses only the Activity membership/role. It must not require another LINE claim.
- Same name is candidate/search information only, never identity proof.
- Different real people may have the same name.
- When both Person records have stable IDs, different IDs always mean they are not collapsed merely because names match.
- Name fallback exists only for legacy Activity records that genuinely lack a stable Person ID.
- Creating a second same-name Person requires explicit host confirmation.
- `line:<userId>` is provisional identity, not formal Person ID.
- Canonical migration remains Audit → Recommendation → Reference Inventory → Dry Run. No destructive apply exists in this batch.

## LINE group binding boundary

- LINE group creator, car host/owner, pairing-code sender, and pairing confirmer are separate roles.
- Car authorization occurs when the short-lived pairing code is minted from an authenticated JLY car-management session.
- A valid authorized code may be pasted in the target LINE group by any participant.
- Pairing confirmation is bound to the same LINE user and same LINE group that initiated the pairing.
- LINE group execution does not create or replace Person identity.

## Files

- `pages/person-directory.html`
- `css/pages/person-directory.css`
- `js/modules/member/person-directory.js`
- `js/modules/member/picker/picker-data.js`
- `js/modules/member/picker/picker-render.js`
- `js/modules/car/detail/player/player-search.js`
- `js/modules/car/detail/player/player-manual-add.js`
- `services/line/group-car-binding-service.js`
- `services/line/group-car-pairing-service.js`
- `api/line-group-pairing-code.js`
- `tests/member-person-directory.test.js`
- `tests/car/player-manual-add-identity.test.js`

## Deployment state

Architecture responsibility is finalized in this additive map module. Production behavior remains subject to the deployment/verification ledger in `docs/PENDING_DEPLOY_BATCH.md`.

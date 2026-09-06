# Project Map｜Canonical Person Directory

Status: batch architecture map, pending final integration into `docs/PROJECT_MAP.md`
Updated: 2026-09-06

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
- Creating a second same-name Person requires explicit host confirmation.
- `line:<userId>` is provisional identity, not formal Person ID.
- Canonical migration remains Audit → Recommendation → Reference Inventory → Dry Run. No destructive apply exists in this batch.

## Batch files

- `pages/person-directory.html`
- `css/pages/person-directory.css`
- `js/modules/member/person-directory.js`
- `js/modules/member/picker/picker-data.js`
- `js/modules/member/picker/picker-render.js`
- `js/modules/car/detail/player/player-search.js`
- `tests/member-person-directory.test.js`

## Deployment state

This map belongs to `batch/person-canonical-migration` / Draft PR #32. It is CODE READY FOR TESTING only. It is not merged, deployed, or production-verified.
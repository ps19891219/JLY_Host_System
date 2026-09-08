# Person Directory V1

- Canonical source remains the existing `players` Person collection. No second Guest or Member database is introduced.
- Guest and Member are identity states of the same Person. LINE claim upgrades the same Person and preserves history.
- Player, DM and Staff remain Activity roles, not permanent Person types.
- Same display names are allowed. Stable Person IDs are authoritative; names never auto-merge identities.
- Host Person Directory supports create, search, filter and edit.
- LINE group player/DM entry only allows claiming names already entered by the host for that car. It does not expose a self-add option.
- Public car entry does not display the host roster selection list.
- Car Detail manual add reuses canonical Person search and requires explicit confirmation before creating another same-name Person.

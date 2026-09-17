# Car role and ownership

Canonical rule: ownership/management and participant role are separate. `ownerId` preserves ownership/management compatibility. Explicit `myRole` determines the creator's participant role when present. Active `players[]` membership determines player participation for non-owner identities. Legacy owner-only records may retain the historical owner-as-host fallback only when no explicit role signal exists.

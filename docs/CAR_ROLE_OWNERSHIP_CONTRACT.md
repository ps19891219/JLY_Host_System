# Car Role / Ownership Contract

## Canonical distinction

- `ownerId` is ownership / management compatibility. It must not, by itself, redefine an explicit participant role.
- `myRole` is the creator's explicit role selection when the car is created (`host`, `player`, or `favorite`).
- `isHost` / `isPlayer` are persisted compatibility flags for that explicit creation role.
- `players[]` is the formal player-membership source for people who joined a car.

## Projection precedence

For the viewer who matches `ownerId`:

1. Explicit `myRole` wins.
2. If `myRole` is absent, persisted `isPlayer` / `isHost` may be used for compatibility.
3. Only legacy cars with no explicit role signal may fall back to historical `ownerId => host` behavior so old records do not disappear.

For a viewer who does not match `ownerId`, active `players[]` membership determines player participation.

## Safety boundary

Ownership and participant role are separate concepts. A creator may retain management rights while participating as a player. Consumers such as MyCar, Recruit and Matching must not infer host participation merely from management ownership when an explicit role exists.

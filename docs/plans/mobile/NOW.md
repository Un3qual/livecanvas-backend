# Mobile Lane Execution

Last reviewed: 2026-04-24
Status: active for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `profiles_social_basics`
- Source: `docs/plans/mobile/TRACK.md`
- Plan: `docs/plans/mobile/2026-04-24-profiles-social-basics.md`
- Batch: `Task 1: Build the Relay-backed viewer profile surface`
- Why now: Relay/auth/session is complete and verified. Profiles and relationship-aware social basics are the next recommended mobile slice before live discovery, watch flows, host flows, and chat.

## Do This Now

- Implement `Task 1` from `docs/plans/mobile/2026-04-24-profiles-social-basics.md`.
- Create the viewer profile presentation helpers and tests.
- Replace the placeholder profile route with a Relay-backed viewer profile query and sparse-data fallbacks.
- Run the focused profile tests, Relay compiler, and `tsc --noEmit`.

## Verification Scope

```bash
cd mobile
bun test src/profile/profilePresentation.test.ts
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

## Next Up

- Task 2: Add viewer privacy mode updates.
- Task 3: Add pending follow requests and accept/decline actions.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

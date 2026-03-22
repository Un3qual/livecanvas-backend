# Mobile Lane Execution

Last reviewed: 2026-03-22
Status: active for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `mobile_foundations`
- Source: `docs/plans/mobile/TRACK.md`
- Plan: `docs/plans/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md`
- Batch: `Task 1: Choose the routing model and define the top-level route groups`
- Why now: the Expo bootstrap slice is complete, and the next unblocked mobile task is to lock the app shell topology before auth, Relay, or realtime work lands.

## Do This Now

- Review `docs/plans/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md` and the current `mobile/` workspace state.
- Implement `Task 1` from the current mobile shell plan.
- Keep the work inside `mobile/` and `docs/plans/mobile/**`.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` in the completion summary instead of editing those shared files directly.
- If the next slice requires backend contract or schema changes, stop and report the dependency instead of editing backend code from the mobile lane.

## Verification Scope

```bash
test -d mobile
test -f mobile/package.json
test -f mobile/flake.nix
```

## Next Up

- Once the new mobile plan is committed, point this lane at its first executable task so the coordinator can dispatch a separate mobile implementation worker.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

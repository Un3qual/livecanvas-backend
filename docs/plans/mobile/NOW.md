# Mobile Lane Execution

Last reviewed: 2026-03-22
Status: active for planning

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `mobile_foundations`
- Source: `docs/plans/mobile/TRACK.md`
- Batch: `Create the next detailed mobile implementation plan`
- Why now: the Expo bootstrap slice is complete, but there is no post-bootstrap mobile implementation plan yet. The next unblocked mobile task is to turn the approved overview into a concrete plan that a dedicated mobile worker can execute without rediscovering scope.

## Do This Now

- Review `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`, `docs/plans/mobile/TRACK.md`, and the current `mobile/` workspace state.
- Create the next detailed plan file under `docs/plans/mobile/` for the highest-priority post-bootstrap mobile foundations slice.
- Update `docs/plans/mobile/TRACK.md` so it points at the new plan and its first executable batch.
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

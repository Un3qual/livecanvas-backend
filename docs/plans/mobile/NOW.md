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
- Batch: `Task 3: Add shell-level layout primitives and entry screens`
- Why now: the provider stack and startup boundary are in place, so the next unblocked shell slice is to give the route groups shared layout primitives and intentional entry screens.

## Do This Now

- Review `docs/plans/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md` and the current `mobile/` workspace state.
- Implement `Task 3` from the current mobile shell plan.
- Keep the work inside `mobile/` and `docs/plans/mobile/**`.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` in the completion summary instead of editing those shared files directly.
- If the next slice requires backend contract or schema changes, stop and report the dependency instead of editing backend code from the mobile lane.

## Verification Scope

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

## Next Up

- Once Task 3 is green and committed, advance this lane pointer to `Task 4` in `docs/plans/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md`.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

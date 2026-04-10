# Mobile Lane Execution

Last reviewed: 2026-04-10
Status: active for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `relay_auth_session`
- Source: `docs/plans/mobile/TRACK.md`
- Plan: `docs/plans/mobile/2026-03-27-relay-auth-session-lifecycle.md`
- Batch: `Task 5: Implement viewer bootstrap, session restoration, and auth-gated routing`
- Why now: Task 4 is green (password auth hooks, Google/Apple OAuth hooks, and real sign-in/sign-up screens). Task 5 completes the signed-in bootstrap and route protection.

## Do This Now

- Implement `Task 5` from `docs/plans/mobile/2026-03-27-relay-auth-session-lifecycle.md`.
- Create `ViewerBootstrap` and the viewer query artifact.
- Restore sessions against `issueViewerAuthTokens` on cold start.
- Gate `(app)` routes behind the auth provider and move landing redirects onto resolved auth state.
- Run Relay compiler and `tsc --noEmit` to verify.

## Verification Scope

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

## Next Up

- Task 6: Verify the Relay/auth slice and advance the mobile planning pointers.
- Profiles/social planning or the next unblocked mobile slice after Relay/auth closes.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

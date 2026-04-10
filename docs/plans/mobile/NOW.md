# Mobile Lane Execution

Last reviewed: 2026-03-29
Status: active for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `relay_auth_session`
- Source: `docs/plans/mobile/TRACK.md`
- Plan: `docs/plans/mobile/2026-03-27-relay-auth-session-lifecycle.md`
- Batch: `Task 4: Implement sign-in and sign-up screens with password and OAuth flows`
- Why now: Tasks 1–3 are green (Relay pipeline, auth state, authenticated network layer). Task 4 builds the user-facing auth screens.

## Do This Now

- Implement `Task 4` from `docs/plans/mobile/2026-03-27-relay-auth-session-lifecycle.md`.
- Install expo-auth-session and expo-apple-authentication.
- Create password auth, Google OAuth, and Apple OAuth hooks.
- Replace the placeholder sign-in screen and add a sign-up screen.
- Run `tsc --noEmit` to verify.

## Verification Scope

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

## Next Up

- Task 5: Implement viewer bootstrap, session restoration, and auth-gated routing.
- Task 6: Verify the Relay/auth slice and advance the mobile planning pointers.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

# Mobile Lane Execution

Last reviewed: 2026-03-27
Status: active for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `relay_auth_session`
- Source: `docs/plans/mobile/TRACK.md`
- Plan: `docs/plans/mobile/2026-03-27-relay-auth-session-lifecycle.md`
- Batch: `Task 1: Add Relay dependencies, configure codegen, and wire the environment provider`
- Why now: The Relay/auth/session plan is written and verified against backend contracts. Task 1 sets up the Relay codegen pipeline and environment provider — the foundation every subsequent task depends on.

## Do This Now

- Implement `Task 1` from `docs/plans/mobile/2026-03-27-relay-auth-session-lifecycle.md`.
- Install relay-runtime, react-relay, relay-compiler, graphql, and babel-plugin-relay.
- Create `relay.config.js`, `src/relay/environment.ts`, and `src/relay/RelayEnvironmentProvider.tsx`.
- Wire `RelayEnvironmentProvider` into `AppProviders` inside `StartupGate`.
- Run the Relay compiler and `tsc --noEmit` to verify the pipeline works.
- Keep the work inside `mobile/` and `docs/plans/mobile/**`.
- Report any required coordinator updates in the completion summary.

## Verification Scope

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

## Next Up

- Task 2: Build secure token storage and the auth state provider.
- Task 3: Build the authenticated network layer with token refresh and forced logout.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

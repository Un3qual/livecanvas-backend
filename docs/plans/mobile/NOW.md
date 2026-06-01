# Mobile Lane Execution

Last reviewed: 2026-04-25
Status: active for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `profiles_social_basics`
- Source: `docs/plans/mobile/TRACK.md`
- Plan: `docs/plans/mobile/2026-04-24-profiles-social-basics.md`
- Batch: `Task 3: Add pending follow requests and accept/decline actions`
- Why now: Task 2 now wires viewer privacy mode updates into the Relay-backed profile surface. Pending follow-request actions are the next unblocked profile interaction before other-user profile affordances.

## Do This Now

- Implement `Task 3` from `docs/plans/mobile/2026-04-24-profiles-social-basics.md`.
- Create the pending follow-request reducer and tests.
- Add Relay-backed `acceptFollowRequest` and `declineFollowRequest` mutations to the viewer profile screen.
- Render inbound pending requests with accept/decline actions and row-level error handling.
- Run the focused follow-request reducer tests, Relay compiler, and `tsc --noEmit`.

## Verification Scope

```bash
cd mobile
bun test src/profile/followRequestReducer.test.ts
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

## Next Up

- Task 4: Add other-user profile route and relationship follow affordance.
- Task 5: Verify the profiles/social slice and advance mobile planning pointers.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

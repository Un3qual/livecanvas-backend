# Mobile Lane Execution

Last reviewed: 2026-06-01
Status: active for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `profiles_social_basics`
- Source: `docs/plans/mobile/TRACK.md`
- Plan: `docs/plans/mobile/2026-04-24-profiles-social-basics.md`
- Batch: `Task 4: Add other-user profile route and relationship follow affordance`
- Why now: Task 3 now wires pending follow-request accept/decline actions into the Relay-backed viewer profile surface. Other-user profile navigation and supported follow/request affordances are the next unblocked profile interaction.

## Do This Now

- Implement `Task 4` from `docs/plans/mobile/2026-04-24-profiles-social-basics.md`.
- Create the relationship presentation helper and tests.
- Add the other-user profile route guarded through Relay `node(id:)`.
- Add profile-row navigation from social previews to `/profiles/[id]`.
- Wire the supported `followUser(input: { followedId })` affordance for states backed by the current GraphQL contract.
- Run the focused relationship presentation tests, Relay compiler, and `tsc --noEmit`.

## Verification Scope

```bash
cd mobile
bun test src/profile/relationshipPresentation.test.ts
pnpm exec relay-compiler
pnpm exec tsc --noEmit
```

## Next Up

- Task 5: Verify the profiles/social slice and advance mobile planning pointers.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

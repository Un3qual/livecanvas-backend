# Mobile Social Controls Implementation Plan

Date: 2026-07-08
Owner lane: mobile first; backend only for reversible controls
Status: complete; Tasks 1-4 delivered

## Executor Brief

Add visible profile social controls for muting and blocking using the backend
contracts that already exist. The approved next-five-product-batches sequence
now promotes unfollow and unblock through the detailed plan at
`docs/superpowers/plans/2026-07-09-reversible-social-controls.md`.

The mobile lane completed Tasks 1-2, then the approved cross-lane Batch 1
delivered Tasks 3-4 with the backend contract first and mobile consumption
second. Review hardening uses one synchronous action guard across all profile
relationship mutations.

## Context

- `OtherUserProfileScreen` already queries relationship state and can follow a
  user.
- `mobile/src/profile/relationshipPresentation.ts` currently avoids unfollow
  because no schema mutation exists.
- `lib/live_canvas_gql/social/social_mutations.ex` exposes follow, mute,
  unmute, and block mutations.
- `relationshipState == BLOCKED` does not distinguish whether the viewer
  blocked the profile or the profile blocked the viewer.

## Tasks

### Task 1: Extend relationship presentation for existing controls

Files:
- Modify: `mobile/src/profile/relationshipPresentation.ts`
- Test: `mobile/tests/profile/relationshipPresentation.test.ts`

Acceptance criteria:
- [x] Preserve current follow and request-follow presentation.
- [x] Add mute and unmute actions based on `isMuted`.
- [x] Add a destructive block action for profiles that are not already in a
      blocked state.
- [x] Do not expose unfollow or unblock in this task.
- [x] Cover accepted, requested, none, muted, and blocked permutations.

Focused verification:
- From `mobile/`: `bun test tests/profile/relationshipPresentation.test.ts`

### Task 2: Wire mute, unmute, and block profile actions

Files:
- Modify: `mobile/src/profile/other/OtherUserProfileScreen.tsx`
- Modify if useful: `mobile/src/profile/ProfileCards.tsx`
- Create or modify: `mobile/src/profile/socialControlOperations.ts`
- Modify generated Relay files under `mobile/src/__generated__/**`
- Test: `mobile/tests/profile/OtherUserProfileScreen.test.ts`
- Test: `mobile/tests/profile/OtherUserProfileScreen.rntl.tsx`

Acceptance criteria:
- [x] Mute commits `muteUser(input: {mutedId: user.id})`.
- [x] Unmute commits `unmuteUser(input: {mutedId: user.id})`.
- [x] Block commits `blockUser(input: {blockedId: user.id})`.
- [x] Only one social-control mutation can be in flight for the profile at a
      time.
- [x] Block requires confirmation and explains that unblock is not available
      in-app until the reversible-controls contract lands.
- [x] Successful mute and unmute update local presentation or refetch the
      profile in a tested way.
- [x] Payload errors use existing mutation error formatting.

Focused verification:
- From `mobile/`: `bun test tests/profile/OtherUserProfileScreen.test.ts`
- From `mobile/`: `pnpm exec jest --config ./jest.config.js tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand`
- From `mobile/`: `bun run relay`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run typecheck:tests`

### Task 3: Add reversible social-control backend contract

Owner: backend lane, or a widened cross-lane scope.

Files:
- Modify: `lib/live_canvas/social.ex`
- Modify: `lib/live_canvas_gql/social/social_mutations.ex`
- Modify: `lib/live_canvas_gql/social/social_types.ex`
- Modify if needed: social resolver/query modules
- Test: `test/live_canvas/social_test.exs`
- Test: `test/live_canvas_gql/social/social_mutations_test.exs`
- Test: relevant social query tests
- Refresh after schema export: `mobile/schema.graphql`

Acceptance criteria:
- [x] Add `unfollow_user/2` and GraphQL `unfollowUser`.
- [x] Add `unblock_user/2` and GraphQL `unblockUser`.
- [x] Add a direction-safe read such as `isBlockedByViewer`.
- [x] Keep unfollow and unblock idempotent from the viewer's perspective.
- [x] Do not leak whether another user blocked the viewer through reversible
      controls.

Focused verification:
- From repo root:
  `mix test test/live_canvas/social_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs`
- From repo root: `mix typecheck`
- From repo root: `mix format`

### Task 4: Add unfollow and direction-safe unblock UI

Depends on Task 3.

Files:
- Modify: `mobile/src/profile/relationshipPresentation.ts`
- Modify: `mobile/src/profile/other/OtherUserProfileScreen.tsx`
- Modify: `mobile/src/profile/socialControlOperations.ts`
- Modify generated Relay files under `mobile/src/__generated__/**`
- Test: `mobile/tests/profile/relationshipPresentation.test.ts`
- Test: `mobile/tests/profile/OtherUserProfileScreen.test.ts`
- Test: `mobile/tests/profile/OtherUserProfileScreen.rntl.tsx`

Acceptance criteria:
- [x] Accepted relationships show `Unfollow`.
- [x] Blocked profiles show `Unblock` only when `isBlockedByViewer` is true.
- [x] Profiles where the viewer is blocked do not expose an unblock action.
- [x] Successful unfollow and unblock refetch or update local relationship
      presentation in a tested way.

Focused verification:
- From `mobile/`:
  `bun test tests/profile/relationshipPresentation.test.ts tests/profile/OtherUserProfileScreen.test.ts`
- From `mobile/`:
  `pnpm exec jest --config ./jest.config.js tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand`
- From `mobile/`: `bun run relay`

## Evidence

- Implemented Tasks 1 and 2 against existing `muteUser`, `unmuteUser`, and
  `blockUser` contracts. Tasks 3 and 4 are promoted through
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`.
- `bun test tests/profile/relationshipPresentation.test.ts tests/profile/OtherUserProfileScreen.test.ts` -> 8 pass.
- `pnpm exec jest --config ./jest.config.js tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand` -> 3 pass.
- `pnpm exec jest --config ./jest.config.js tests/profile/ProfilePreviewLinks.rntl.tsx --runInBand` -> 2 pass.
- `bun run relay` -> completed.
- `bun run typecheck` -> passed.
- `bun run typecheck:tests` -> passed.
- `git diff --check` -> passed.
- Reversible backend suite -> 49 tests, 0 failures.
- Reversible backend `mix typecheck` -> 0 errors.
- Batch Elixir files pass the scoped formatter check. The repository-wide
  formatter check still reports seven pre-existing, untouched files outside
  this batch.
- Reversible focused mobile pure suites -> 9 tests, 0 failures.
- Reversible focused profile RNTL suite -> 11 tests, 0 failures, including the
  A -> B -> A stale-completion regression.
- Full `bun run test:quality` -> typechecks and lint passed; 457 Bun tests and
  87 Jest tests passed.

## Final Verification

For the mobile-only first batch:
- From `mobile/`:
  `bun test tests/profile/relationshipPresentation.test.ts tests/profile/OtherUserProfileScreen.test.ts`
- From `mobile/`:
  `pnpm exec jest --config ./jest.config.js tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand`
- From `mobile/`: `bun run relay`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run typecheck:tests`
- From repo root: `git diff --check`

For the full reversible-controls batch, also run:
- From repo root:
  `mix test test/live_canvas/social_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs`
- From repo root: `mix typecheck`

## Handoff

Tasks 1-4 are complete. Do not reopen this plan for Batch 2; create and approve
the Profile Content Surfaces implementation plan before promoting new work.

# Mobile Social Controls Implementation Plan

Date: 2026-07-08
Owner lane: mobile first; backend only for reversible controls
Status: draft ready for review

## Executor Brief

Add visible profile social controls for muting and blocking using the backend
contracts that already exist. Keep unfollow and unblock behind a backend
contract follow-up, because the current schema does not expose `unfollowUser`,
`unblockUser`, or a direction-safe blocked-by-viewer field.

This plan is not the active mobile lane batch until `docs/plans/mobile/NOW.md`
selects it.

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
- [ ] Preserve current follow and request-follow presentation.
- [ ] Add mute and unmute actions based on `isMuted`.
- [ ] Add a destructive block action for profiles that are not already in a
      blocked state.
- [ ] Do not expose unfollow or unblock in this task.
- [ ] Cover accepted, requested, none, muted, and blocked permutations.

Focused verification:
- From `mobile/`: `bun test tests/profile/relationshipPresentation.test.ts`

### Task 2: Wire mute, unmute, and block profile actions

Files:
- Modify: `mobile/src/profile/OtherUserProfileScreen.tsx`
- Modify if useful: `mobile/src/profile/ProfileCards.tsx`
- Create or modify: `mobile/src/profile/socialControlOperations.ts`
- Modify generated Relay files under `mobile/src/__generated__/**`
- Test: `mobile/tests/profile/OtherUserProfileScreen.test.tsx`

Acceptance criteria:
- [ ] Mute commits `muteUser(input: {mutedId: user.id})`.
- [ ] Unmute commits `unmuteUser(input: {mutedId: user.id})`.
- [ ] Block commits `blockUser(input: {blockedId: user.id})`.
- [ ] Only one social-control mutation can be in flight for the profile at a
      time.
- [ ] Block requires confirmation and explains that unblock is not available
      in-app until the reversible-controls contract lands.
- [ ] Successful mute and unmute update local presentation or refetch the
      profile in a tested way.
- [ ] Payload errors use existing mutation error formatting.

Focused verification:
- From `mobile/`: `bun test tests/profile/OtherUserProfileScreen.test.tsx`
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
- [ ] Add `unfollow_user/2` and GraphQL `unfollowUser`.
- [ ] Add `unblock_user/2` and GraphQL `unblockUser`.
- [ ] Add a direction-safe read such as `isBlockedByViewer`.
- [ ] Keep unfollow and unblock idempotent from the viewer's perspective.
- [ ] Do not leak whether another user blocked the viewer through reversible
      controls.

Focused verification:
- From repo root:
  `mix test test/live_canvas/social_test.exs test/live_canvas_gql/social/social_mutations_test.exs`
- From repo root: `mix typecheck`
- From repo root: `mix format`

### Task 4: Add unfollow and direction-safe unblock UI

Depends on Task 3.

Files:
- Modify: `mobile/src/profile/relationshipPresentation.ts`
- Modify: `mobile/src/profile/OtherUserProfileScreen.tsx`
- Modify: `mobile/src/profile/socialControlOperations.ts`
- Modify generated Relay files under `mobile/src/__generated__/**`
- Test: `mobile/tests/profile/relationshipPresentation.test.ts`
- Test: `mobile/tests/profile/OtherUserProfileScreen.test.tsx`

Acceptance criteria:
- [ ] Accepted relationships show `Unfollow`.
- [ ] Blocked profiles show `Unblock` only when `isBlockedByViewer` is true.
- [ ] Profiles where the viewer is blocked do not expose an unblock action.
- [ ] Successful unfollow and unblock refetch or update local relationship
      presentation in a tested way.

Focused verification:
- From `mobile/`:
  `bun test tests/profile/relationshipPresentation.test.ts tests/profile/OtherUserProfileScreen.test.tsx`
- From `mobile/`: `bun run relay`

## Final Verification

For the mobile-only first batch:
- From `mobile/`:
  `bun test tests/profile/relationshipPresentation.test.ts tests/profile/OtherUserProfileScreen.test.tsx`
- From `mobile/`: `bun run relay`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run typecheck:tests`
- From repo root: `git diff --check`

For the full reversible-controls batch, also run:
- From repo root:
  `mix test test/live_canvas/social_test.exs test/live_canvas_gql/social/social_mutations_test.exs`
- From repo root: `mix typecheck`

## Handoff

Tasks 1 and 2 can land without backend schema work. Tasks 3 and 4 should be
promoted explicitly when product wants reversible follow/block controls in the
same release window.

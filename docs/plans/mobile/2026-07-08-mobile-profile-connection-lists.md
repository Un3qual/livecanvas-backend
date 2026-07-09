# Mobile Profile Connection Lists Implementation Plan

Date: 2026-07-08
Owner lane: mobile
Status: implemented on `codex/execute-mobile-product-gaps`

## Executor Brief

Add dedicated paginated followers, following, and pending follow-request screens
from mobile profile previews. Reuse existing Relay profile/social contracts,
keep routes thin, and keep pagination state in tested helpers.

This plan is not the active mobile lane batch until `docs/plans/mobile/NOW.md`
selects it.

## Context

- Viewer and other-user profile surfaces already show relationship previews.
- The follow-request UX exists in smaller preview form but does not provide a
  full paginated destination.
- Route params should carry opaque Relay IDs. Do not decode global IDs in the
  client.
- Connection lists must preserve privacy behavior: hidden or unavailable
  relationships render empty/limited states instead of explanatory leaks.

## Tasks

### Task 1: Audit contract and add route param helpers

Files:
- Create: `mobile/src/profile/profileRouteParams.ts`
- Test: `mobile/tests/profile/profileRouteParams.test.ts`
- Read-only audit: `mobile/schema.graphql`
- Read-only audit: relevant profile/social GraphQL resolver tests

Acceptance criteria:
- [x] Confirm the schema exposes enough data for viewer followers, viewer
      following, other-user followers, other-user following, and viewer pending
      follow requests.
- [x] Add helpers to read an optional opaque profile ID route param.
- [x] Add tests for missing, single, and array route param values.
- [x] Record any backend contract gap in this plan before implementation if the
      audit finds one.

Focused verification:
- From `mobile/`: `bun test tests/profile/profileRouteParams.test.ts`

### Task 2: Add shared connection pagination helpers and operations

Files:
- Create: `mobile/src/profile/profileConnectionPagination.ts`
- Create: `mobile/src/profile/profileConnectionOperations.ts`
- Modify generated Relay files under `mobile/src/__generated__/**`
- Test: `mobile/tests/profile/profileConnectionPagination.test.ts`

Acceptance criteria:
- [x] Add helpers for reading `pageInfo`, appending nodes, and deduplicating by
      opaque `id`.
- [x] Add operations for viewer followers and following.
- [x] Add operations for other-user followers and following.
- [x] Add operations for viewer pending follow requests with accept and decline
      mutations.
- [x] Keep operation naming specific enough for generated Relay artifacts to be
      obvious in diffs.

Focused verification:
- From `mobile/`: `bun test tests/profile/profileConnectionPagination.test.ts`
- From `mobile/`: `bun run relay`

### Task 3: Add followers and following list screens

Files:
- Create: `mobile/src/profile/ProfileConnectionListScreen.tsx`
- Create: `mobile/app/(app)/profile/followers.tsx`
- Create: `mobile/app/(app)/profile/following.tsx`
- Create: `mobile/app/(app)/profiles/[id]/followers.tsx`
- Create: `mobile/app/(app)/profiles/[id]/following.tsx`
- Test: `mobile/tests/profile/ProfileConnectionListScreen.test.tsx`

Acceptance criteria:
- [x] Viewer routes render the viewer followers and following connections.
- [x] Other-profile routes render the target profile connections when the
      backend allows them.
- [x] Rows navigate to profile detail using opaque IDs.
- [x] `Load more` uses cursor pagination and disables while in flight.
- [x] Empty and unavailable states do not leak private relationship detail.

Focused verification:
- From `mobile/`: `bun test tests/profile/ProfileConnectionListScreen.test.tsx`

### Task 4: Add pending follow requests screen

Files:
- Create: `mobile/src/profile/PendingFollowRequestsScreen.tsx`
- Create: `mobile/app/(app)/profile/requests.tsx`
- Test: `mobile/tests/profile/PendingFollowRequestsScreen.test.tsx`

Acceptance criteria:
- [x] The screen renders pending follow requests with requester summary rows.
- [x] Accept and decline actions reuse existing GraphQL mutations.
- [x] Only one row action is active per requester at a time.
- [x] Successful accept or decline removes or refreshes the row in a tested way.
- [x] Errors remain row-local and retryable.
- [x] Pagination continues to work after row actions.

Focused verification:
- From `mobile/`: `bun test tests/profile/PendingFollowRequestsScreen.test.tsx`
- From `mobile/`: `bun run relay`

### Task 5: Link profile previews to full lists

Files:
- Modify: `mobile/src/profile/ViewerProfileScreen.tsx`
- Modify: `mobile/src/profile/OtherUserProfileScreen.tsx`
- Modify if needed: `mobile/src/profile/ProfileCards.tsx`
- Test: relevant viewer and other-profile screen tests

Acceptance criteria:
- [x] Viewer profile preview actions route to `/profile/followers`,
      `/profile/following`, and `/profile/requests`.
- [x] Other-profile preview actions route to `/profiles/[id]/followers` and
      `/profiles/[id]/following`.
- [x] Existing compact previews remain small and scannable.
- [x] Hidden counts or unavailable lists do not gain new visible disclosure.

## Evidence

- Schema audit confirmed existing mobile GraphQL coverage for viewer followers,
  viewer following, other-user followers/following through `node(id:)`, viewer
  pending follow requests, and accept/decline follow-request mutations. No
  backend contract gap was found.
- `bun test tests/profile/profileRouteParams.test.ts tests/profile/profileConnectionPagination.test.ts` -> 3 pass.
- `pnpm exec jest --config ./jest.config.js tests/profile/ProfileConnectionListScreen.rntl.tsx --runInBand` -> 3 pass.
- `pnpm exec jest --config ./jest.config.js tests/profile/PendingFollowRequestsScreen.rntl.tsx --runInBand` -> 3 pass.
- `pnpm exec jest --config ./jest.config.js tests/profile/ProfilePreviewLinks.rntl.tsx --runInBand` -> 2 pass.
- `bun run relay` -> completed.
- `bun run typecheck` -> passed.
- `bun run typecheck:tests` -> passed.

Note: component coverage uses the existing Jest/RNTL `*.rntl.tsx` convention.

Focused verification:
- From `mobile/`: run the focused viewer and other-profile screen tests touched
  by the links.

## Final Verification

- From `mobile/`:
  `bun test tests/profile/profileRouteParams.test.ts tests/profile/profileConnectionPagination.test.ts`
- From `mobile/`:
  `bun test tests/profile/ProfileConnectionListScreen.test.tsx tests/profile/PendingFollowRequestsScreen.test.tsx`
- From `mobile/`: run focused viewer and other-profile screen tests touched by
  Task 5.
- From `mobile/`: `bun run relay`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run typecheck:tests`
- From `mobile/`: `bun run test:quality`
- From repo root: `git diff --check`

## Handoff

If Task 1 finds a backend contract gap, stop and promote that gap before wiring
UI against assumptions. Follow-up product work can add search, sorting, and
bulk request management after the paginated screens are stable.

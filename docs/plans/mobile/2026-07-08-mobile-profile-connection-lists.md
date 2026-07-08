# Mobile Profile Connection Lists Implementation Plan

Date: 2026-07-08
Owner lane: mobile
Status: draft ready for review

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
- [ ] Confirm the schema exposes enough data for viewer followers, viewer
      following, other-user followers, other-user following, and viewer pending
      follow requests.
- [ ] Add helpers to read an optional opaque profile ID route param.
- [ ] Add tests for missing, single, and array route param values.
- [ ] Record any backend contract gap in this plan before implementation if the
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
- [ ] Add helpers for reading `pageInfo`, appending nodes, and deduplicating by
      opaque `id`.
- [ ] Add operations for viewer followers and following.
- [ ] Add operations for other-user followers and following.
- [ ] Add operations for viewer pending follow requests with accept and decline
      mutations.
- [ ] Keep operation naming specific enough for generated Relay artifacts to be
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
- [ ] Viewer routes render the viewer followers and following connections.
- [ ] Other-profile routes render the target profile connections when the
      backend allows them.
- [ ] Rows navigate to profile detail using opaque IDs.
- [ ] `Load more` uses cursor pagination and disables while in flight.
- [ ] Empty and unavailable states do not leak private relationship detail.

Focused verification:
- From `mobile/`: `bun test tests/profile/ProfileConnectionListScreen.test.tsx`

### Task 4: Add pending follow requests screen

Files:
- Create: `mobile/src/profile/PendingFollowRequestsScreen.tsx`
- Create: `mobile/app/(app)/profile/requests.tsx`
- Test: `mobile/tests/profile/PendingFollowRequestsScreen.test.tsx`

Acceptance criteria:
- [ ] The screen renders pending follow requests with requester summary rows.
- [ ] Accept and decline actions reuse existing GraphQL mutations.
- [ ] Only one row action is active per requester at a time.
- [ ] Successful accept or decline removes or refreshes the row in a tested way.
- [ ] Errors remain row-local and retryable.
- [ ] Pagination continues to work after row actions.

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
- [ ] Viewer profile preview actions route to `/profile/followers`,
      `/profile/following`, and `/profile/requests`.
- [ ] Other-profile preview actions route to `/profiles/[id]/followers` and
      `/profiles/[id]/following`.
- [ ] Existing compact previews remain small and scannable.
- [ ] Hidden counts or unavailable lists do not gain new visible disclosure.

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

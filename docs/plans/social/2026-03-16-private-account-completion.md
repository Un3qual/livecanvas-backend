# Private Account Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the missing GraphQL product surface for account privacy settings and pending follow-request management, including accept and decline flows.

**Architecture:** Reuse the existing `LC.Accounts` privacy API and extend `LC.Social` with viewer-owned follow-request query helpers so GraphQL can expose Relay-first inbox and mutation flows without pushing transport logic into the domain layer. Keep privacy behavior explicit at the GraphQL boundary: privacy mode is exposed on `User`, pending follow requests are viewer-scoped, and accepted `followers` / `following` connections become privacy-aware according to Social policy.

**Tech Stack:** Elixir, Phoenix, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Scope Decisions

- Include `privacyMode` on `User`.
- Include a viewer-scoped `updateViewerPrivacyMode` mutation.
- Include a viewer-scoped pending follow-request inbox.
- Include both accept and decline follow-request mutations.
- Make `followers` and `following` privacy-aware.
- Keep node/refetch behavior Relay-first and ownership-safe.

## Progress

- [x] Task 1: Add GraphQL privacy-mode read/write support
- [x] Task 2: Add Social query/mutation helpers for pending follow requests
- [ ] Task 3: Expose Relay follow-request inbox and accept/decline mutations
- [ ] Task 4: Make followers/following privacy-aware and run verification

### Task 1: Add GraphQL Privacy-Mode Read/Write Support

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Test: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing query coverage for `viewer { privacyMode }` and `node(id: ...) { ... on User { privacyMode } }`
- [x] Step 2: Add failing mutation coverage for `updateViewerPrivacyMode(input: { privacyMode: ... })`
- [x] Step 3: Run focused Accounts GraphQL tests to verify RED
- [x] Step 4: Add `USER_PRIVACY_MODE` enum, `privacyMode` field on `User`, and viewer-scoped resolver wiring
- [x] Step 5: Re-run focused Accounts GraphQL tests to verify GREEN
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 1 behavior targets:**

- `privacyMode` is available on `viewer` and `User` node reads.
- `updateViewerPrivacyMode` uses the authenticated viewer only.
- Invalid privacy values fail through the normal GraphQL/schema contract rather than ad hoc transport checks.

Verification evidence (2026-03-16):

- `mix test test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs` -> RED first (`67 tests, 4 failures`) and GREEN after implementation (`67 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 2: Add Social Query/Mutation Helpers For Pending Follow Requests

**Files:**
- Modify: `lib/live_canvas/social.ex`
- Modify: `test/live_canvas/social_test.exs`
- Optionally modify: `test/support/fixtures/social_fixtures.ex`

**Task 2 Step Progress:**
- [x] Step 1: Add Social tests for deterministic pending inbound follow-request listing
- [x] Step 2: Add Social tests for viewer-owned fetch of a pending follow request by id
- [x] Step 3: Add Social tests for declining a pending follow request
- [x] Step 4: Implement `pending_follow_requests_query/1`, `get_pending_follow_request/2`, and `decline_follow_request/2`
- [x] Step 5: Run focused Social tests to verify the helper behavior
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 2 behavior targets:**

- Pending follow requests are queryable only for the acted-on user.
- Ordering is Relay-stable via `requested_at`, then `id`.
- Declining a request removes it without affecting unrelated accepted relationships.

Verification evidence (2026-03-16):

- `mix test test/live_canvas/social_test.exs` -> PASS (`8 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 3: Expose Relay Follow-Request Inbox And Accept/Decline Mutations

**Files:**
- Modify: `lib/live_canvas_gql/social/social_types.ex`
- Modify: `lib/live_canvas_gql/social/social_queries.ex`
- Modify: `lib/live_canvas_gql/social/social_mutations.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Test: `test/live_canvas_gql/social/social_queries_test.exs`
- Test: `test/live_canvas_gql/social/social_mutations_test.exs`
- Test: `test/live_canvas_gql/relay/node_queries_test.exs`

**Task 3 Step Progress:**
- [ ] Step 1: Add failing GraphQL tests for a viewer-scoped pending follow-request connection
- [ ] Step 2: Add failing GraphQL tests for follow-request node refetch ownership
- [ ] Step 3: Add failing GraphQL tests for `declineFollowRequest`
- [ ] Step 4: Run focused Social GraphQL tests to verify RED
- [ ] Step 5: Add Relay node/connection types for follow requests plus viewer-scoped query and mutation resolvers
- [ ] Step 6: Keep node resolution ownership-safe with explicit comments around the invariant
- [ ] Step 7: Re-run focused Social GraphQL tests to verify GREEN
- [ ] Step 8: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 3 behavior targets:**

- `viewerPendingFollowRequests` returns only pending requests owned by the authenticated viewer.
- `acceptFollowRequest` and `declineFollowRequest` operate on viewer-owned pending requests only.
- `node(id:)` for a follow request returns `nil` outside the owner scope.

### Task 4: Make Followers/Following Privacy-Aware And Run Verification

**Files:**
- Modify: `lib/live_canvas/social.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Test: `test/live_canvas/social_test.exs`
- Test: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify as needed: `docs/plans/social/2026-03-16-private-account-completion.md`

**Task 4 Step Progress:**
- [ ] Step 1: Add failing tests for private-account follower/following visibility behavior
- [ ] Step 2: Define viewer-aware access rules for the connection resolvers and verify RED
- [ ] Step 3: Implement privacy-aware connection access using Social policy helpers
- [ ] Step 4: Add regression coverage proving accepted relationships remain readable when policy allows them
- [ ] Step 5: Run focused Social/Accounts GraphQL suites to verify GREEN
- [ ] Step 6: Run final verification (`mix test` on touched suites, `mix compile`, `mix typecheck`)
- [ ] Step 7: Update checklist progress and commit milestone

**Task 4 behavior targets:**

- Private accounts do not expose `followers` / `following` to unauthorized viewers.
- Owners can still read their own graph.
- Public-account graph behavior remains unchanged.

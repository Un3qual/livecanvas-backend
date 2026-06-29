# Phase 2 Mobile GraphQL Contract Stabilization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize the mobile-facing GraphQL contract by viewer-scoping social read-state, removing legacy auth mutations, and publishing the supported contract snapshot.

**Architecture:** Keep the GraphQL layer adapter-thin: social read-state should derive the viewer from auth scope, not caller-supplied IDs, and schema cleanup should remove legacy entrypoints rather than rework domain behavior. Publish the resulting contract explicitly so mobile consumes one supported surface instead of inferring it from mixed schema history.

**Tech Stack:** Elixir, Phoenix, Absinthe Relay, ExUnit, Dialyzer

---

## Scope Decisions

- `relationshipState` and `isMuted` are authenticated viewer-scoped reads.
- Remove legacy auth mutations rather than merely deprecating them.
- Keep broader direct content/live read-policy changes out of this slice.
- Publish a mobile contract doc for the supported Phase 2 surface.

## Progress

- [x] Task 1: Viewer-scope the social read-state contract
- [x] Task 2: Remove legacy auth mutation entrypoints from the schema
- [x] Task 3: Publish the mobile contract snapshot and update roadmap tracking

### Task 1: Viewer-Scope The Social Read-State Contract

**Files:**
- Modify: `lib/live_canvas_gql/social/social_queries.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Test: `test/live_canvas_gql/social/social_queries_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests that remove `viewerId` and require authenticated viewer scope for `relationshipState` and `isMuted`
- [x] Step 2: Add failing tests for unauthenticated fallback behavior and invalid `creatorId` behavior
- [x] Step 3: Run focused Social query tests to verify RED
- [x] Step 4: Update schema inputs to accept only `creatorId`
- [x] Step 5: Update resolvers to derive the viewer from `current_scope.user`
- [x] Step 6: Preserve scalar fallback behavior (`NONE` / `false`) instead of top-level GraphQL errors
- [x] Step 7: Re-run focused Social query tests to verify GREEN
- [x] Step 8: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 1 behavior targets:**

- `relationshipState(creatorId:)` always describes the authenticated viewer’s relationship to the creator.
- `isMuted(creatorId:)` always describes whether the authenticated viewer muted the creator.
- Missing auth or invalid creator IDs resolve to stable scalar fallbacks.

Verification evidence (2026-03-16):

- `mix test test/live_canvas_gql/social/social_queries_test.exs` -> RED first (`8 tests, 6 failures`) and GREEN after implementation (`8 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 2: Remove Legacy Auth Mutation Entrypoints From The Schema

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Test: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Add failing schema/introspection tests that assert legacy auth mutations are absent from the schema
- [x] Step 2: Run focused Accounts GraphQL tests to verify RED
- [x] Step 3: Remove `loginWithPassword`, `requestMagicLinkLogin`, and `loginWithMagicLink` from the schema definition
- [x] Step 4: Keep generic auth entrypoint coverage green without reintroducing legacy transport shapes
- [x] Step 5: Re-run focused Accounts GraphQL tests to verify GREEN
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 2 behavior targets:**

- The supported auth entrypoint surface is `beginAuthChallenge`, `signUp`, `logIn`, `refreshAuthTokens`, and revoke/refresh lifecycle mutations already in scope.
- Removed legacy entrypoints are no longer discoverable via schema introspection.
- Removed field names no longer receive special auth-login rate-limit treatment once the schema no longer exposes them.

Verification evidence (2026-03-16):

- `mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs` -> RED first (`64 tests, 2 failures`) and GREEN after implementation (`64 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 3: Publish The Mobile Contract Snapshot And Update Roadmap Tracking

**Files:**
- Create: `docs/contracts/mobile-graphql-phase2.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/graphql/2026-03-16-phase2-mobile-contract-stabilization.md`

**Task 3 Step Progress:**
- [x] Step 1: Write the contract doc for the supported mobile GraphQL surface
- [x] Step 2: Update the roadmap to record delivered viewer-scoped social reads and auth-surface cleanup
- [x] Step 3: Update the plan index so active work reflects the new slices instead of stale completed entries
- [x] Step 4: Run final verification on touched GraphQL suites plus `mix compile` and `mix typecheck`
- [x] Step 5: Update checklist progress and commit milestone

**Task 3 contract targets:**

- Document the supported auth entrypoints and Relay expectations.
- Document viewer-scoped social read fields.
- Avoid carrying forward removed legacy auth mutation shapes in the client contract.
- Record the stabilized contract so mobile teams can integrate against one documented surface.

Verification evidence (2026-03-16):

- `mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs` -> PASS (`64 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

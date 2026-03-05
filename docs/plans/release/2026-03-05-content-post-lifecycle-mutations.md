# Content Post Lifecycle Mutations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining Phase 2 content lifecycle gap by adding viewer-scoped post edit/delete APIs and Relay mutations that mobile clients can safely consume.

**Architecture:** Keep ownership and validation in `LC.Content` so GraphQL remains adapter-thin. Reuse existing `Post` changeset validation, enforce viewer ownership via `author_id`, and preserve Relay contracts by accepting global IDs and returning Relay-friendly payloads.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto, Absinthe Relay, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-05)

Verified directly in `lib/`, `test/`, and active roadmap docs before selecting this batch:

1. **Viewer-scoped post update/delete boundary APIs:** **Missing**.
   - Evidence: `LC.Content` currently exposes post creation and post getters, but no owner-scoped update/delete entrypoints (`lib/live_canvas/content.ex`).
2. **Relay post lifecycle write mutations (`updatePost`, `deletePost`):** **Missing**.
   - Evidence: `LCGQL.Content.Mutations` currently only defines `createPost` and `requestMediaUpload` (`lib/live_canvas_gql/content/content_mutations.ex`).
3. **GraphQL coverage for post lifecycle writes:** **Missing**.
   - Evidence: current content mutation tests cover only `createPost` and `requestMediaUpload` (`test/live_canvas_gql/content/content_mutations_test.exs`).
4. **Roadmap alignment for Phase 2 content lifecycle operations:** **Pending follow-up**.
   - Evidence: release roadmap still calls out missing content lifecycle write paths as part of API contract stabilization (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).

## Why This Is The Next Batch

This is the highest-leverage unblocked Phase 2 scope: it adds core write behavior without schema churn, does not conflict with the explicit compliance hard-delete pause, and gives clients a stable viewer-scoped contract for post maintenance.

## Scope And Assumptions

- Keep mutations viewer-owned; never accept actor identity from clients.
- Restrict editable fields to launch-safe post fields (`body_text`, `visibility`).
- Keep deletion contract explicit and ownership-scoped.
- Preserve existing Relay global ID decode behavior and structured GraphQL error payloads.
- Add/maintain typespecs for public functions and run `mix typecheck` for touched typed modules.

## Progress

- [x] Task 1: Add viewer-scoped post update/delete APIs in `LC.Content`
- [ ] Task 2: Add Relay `updatePost` + `deletePost` mutations and resolver wiring
- [ ] Task 3: Run focused verification, update roadmap/index tracking, and finalize milestone

### Task 1: Content Boundary Post Lifecycle APIs

**Files:**
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas/content/post.ex`
- Modify: `test/live_canvas/content_test.exs`
- Modify: `docs/plans/release/2026-03-05-content-post-lifecycle-mutations.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing context tests for owner-scoped post update/delete success + non-owner/not-found behavior
- [x] Step 2: Run focused context tests to verify RED
- [x] Step 3: Implement minimal `update_user_post/3` and `delete_user_post/2` behavior in `LC.Content`
- [x] Step 4: Run focused context tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas/content_test.exs` -> RED first (`14 tests, 5 failures`, missing `update_user_post/3` and `delete_user_post/2`) and GREEN after implementation (`14 tests, 0 failures`)
- `mix compile && mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 2: Relay Post Lifecycle Mutations

**Files:**
- Modify: `lib/live_canvas_gql/content/content_mutations.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify: `docs/plans/release/2026-03-05-content-post-lifecycle-mutations.md`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing GraphQL tests for `updatePost`/`deletePost` success, unauthenticated, and invalid-id ownership errors
- [ ] Step 2: Run focused GraphQL tests to verify RED
- [ ] Step 3: Implement Relay mutation schema + resolver decode/ownership flow
- [ ] Step 4: Run focused GraphQL tests to verify GREEN
- [ ] Step 5: Run `mix test` on touched GraphQL slices + `mix typecheck`, update checklist progress, and commit milestone

### Task 3: Verification And Tracking Updates

**Files:**
- Modify: `docs/plans/release/2026-03-05-content-post-lifecycle-mutations.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`

**Task 3 Step Progress:**
- [ ] Step 1: Run final verification for touched slices (`mix compile`, focused `mix test`, `mix typecheck`)
- [ ] Step 2: Update roadmap + plan index to reflect delivered post lifecycle mutation scope and remaining follow-ups
- [ ] Step 3: Mark checklist completion and commit final milestone

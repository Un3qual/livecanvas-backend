# Post Reporting Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a viewer-scoped post reporting path so mobile clients can submit abuse reports for visible posts without exposing client-controlled moderation identity.

**Architecture:** Persist one `post_reports` row per reporter/post pair with server-owned reporter identity and Relay/global IDs at the GraphQL boundary. Keep report visibility reporter-owned for `node(id:)` refetch, re-apply post visibility before creating reports, and charge `reportPost` to the existing moderation-action rate-limit bucket.

**Tech Stack:** Elixir, Phoenix, Ecto, PostgreSQL, Absinthe Relay, ExUnit

---

## Scope Decisions

- Report creation is viewer-scoped; clients never supply `reporterId`.
- A viewer can report a post only if `Feed.get_visible_post/2` says the post is visible.
- Self-reporting returns a stable user error instead of creating a moderation row.
- Duplicate reports by the same viewer for the same post are idempotent and return the original report.
- Staff review workflow, report queues, notifications, and admin actions are out of scope for this first slice.

## Progress

- [x] Task 1: Add viewer-scoped post reporting persistence and GraphQL mutation
- [x] Task 2: Publish the post-reporting mobile contract and refresh lane tracking

### Task 1: Add Viewer-Scoped Post Reporting Persistence And GraphQL Mutation

**Files:**
- Create: `priv/repo/migrations/20260424120000_create_post_reports.exs`
- Create: `lib/live_canvas_schemas/content/post_report.ex`
- Create: `lib/live_canvas/content/post_report.ex`
- Modify: `lib/live_canvas_schemas/content.ex`
- Modify: `lib/live_canvas_schemas/content/post.ex`
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas_gql/content/content_mutations.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/content/content_types.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`
- Modify: `test/live_canvas/content_test.exs`
- Modify: `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing context, GraphQL mutation, Relay node, and rate-limit coverage
- [x] Step 2: Add the `post_reports` migration and schema with `bigint` primary key, `entropy_id` UUIDv7, reporter/post FKs, report reason/status enums, and a unique reporter/post constraint
- [x] Step 3: Implement `LC.Content.report_post/3` and `LC.Content.get_user_post_report/2`
- [x] Step 4: Expose `reportPost` and `PostReport` through GraphQL with viewer-scoped ID decoding and node refetch
- [x] Step 5: Classify `reportPost` as a moderation-action mutation for rate limiting
- [x] Step 6: Run focused verification

**Suggested verification commands:**

```bash
mix test test/live_canvas/content_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
mix compile
mix typecheck
```

Expected: PASS.

**Verification outcome (2026-04-24):**

- `mix test test/live_canvas/content_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs` -> PASS (`81 tests, 0 failures`).

### Task 2: Publish The Post-Reporting Mobile Contract And Refresh Lane Tracking

**Files:**
- Modify: `docs/contracts/mobile-graphql-phase2.md`
- Modify: `docs/plans/content/2026-04-24-post-reporting.md`
- Modify: `docs/plans/backend/NOW.md`

**Task 2 Step Progress:**
- [x] Step 1: Document `reportPost`, supported report reasons, idempotency, visibility rules, and stable user errors in the mobile GraphQL contract
- [x] Step 2: Run the focused post-reporting verification set from Task 1
- [x] Step 3: Update this checklist and advance `docs/plans/backend/NOW.md`
- [x] Step 4: Commit the verified contract/tracking slice

**Suggested verification command:**

```bash
mix test test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: PASS.

**Verification outcome (2026-04-24):**

- `mix test test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs` -> PASS (`40 tests, 0 failures`).

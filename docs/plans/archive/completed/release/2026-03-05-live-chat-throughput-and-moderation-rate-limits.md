# Live Chat Throughput And Moderation Action Rate Limits Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining roadmap gap for operational abuse controls by adding explicit chat-send throughput limits and moderation-action-specific mutation limits.

**Architecture:** Reuse the existing in-memory `LCWeb.RateLimiter` buckets and apply explicit limit keys at transport boundaries where abuse pressure appears (`LiveSessionChannel` chat sends and GraphQL moderation mutations). Keep response contracts stable (`rate_limited` / `RATE_LIMITED`) and preserve existing generic mutation limits as a fallback.

**Tech Stack:** Elixir 1.15, Phoenix Channels, Plug, Absinthe GraphQL, ETS, ExUnit

---

## Candidate Status Verification (2026-03-05)

Verified directly in `lib/`, `test/`, and active plans before selecting this batch:

1. **Multi-node partition/rejoin failover drills:** **Missing**.
   - Evidence: roadmap still tracks this as follow-up hardening (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`), and current distributed tests use fake RPC paths rather than real node partition/rejoin drills (`test/live_canvas/live/distributed_runtime_test.exs`, `test/live_canvas_web/channels/live_session_channel_test.exs`).
2. **Chat throughput and moderation operational limits:** **Partially implemented**.
   - Evidence: generic limiter keys exist for auth login, GraphQL mutations, and channel joins (`lib/live_canvas_web/rate_limiter.ex`), but `chat:send` has no limiter call (`lib/live_canvas_web/channels/live_session_channel.ex`) and moderation mutations only use the broad mutation bucket (`lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`).
3. **Retention policy implementation for chat/live participation tables:** **Policy decided but enforcement missing**.
   - Evidence: policy docs list retention windows (`docs/release/compliance-data-governance.md`), while sweep code currently enforces only infra families (`lib/live_canvas/infra/data_governance/retention.ex`) and tests do not cover `chat_messages`/`live_participants` retention.

## Why This Is The Next Batch

This slice directly addresses an active roadmap item with a bounded, low-risk transport-layer change that improves abuse resilience without schema churn. It is a safer immediate batch than multi-node partition drills and unblocks clearer runtime operational posture while keeping compliance hard-delete pause boundaries untouched.

## Scope And Assumptions

- Keep limits additive and configurable through existing `LCWeb.RateLimiter` config.
- Preserve current client-facing rate-limit contracts:
  - Channel: `%{reason: "rate_limited"}`
  - GraphQL: `429` + `{"errors":[{"message":"rate_limited","extensions":{"code":"RATE_LIMITED"}}]}`
- Keep implementation local to transport boundaries; no chat domain schema/migration changes.
- Do not touch compliance hard-delete paused work.

## Progress

- [x] Task 1: Add explicit `chat:send` throughput rate limiting in `LiveSessionChannel`
- [x] Task 2: Add moderation-action-specific GraphQL mutation rate limiting
- [x] Task 3: Run focused verification, update roadmap/index tracking, and finalize milestone

### Task 1: Chat Send Throughput Limits (Current Batch)

**Files:**
- Modify: `lib/live_canvas_web/rate_limiter.ex`
- Modify: `config/config.exs`
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/release/2026-03-05-live-chat-throughput-and-moderation-rate-limits.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing channel tests for `chat:send` limiter behavior and telemetry reason mapping
- [x] Step 2: Run focused channel tests to verify RED
- [x] Step 3: Implement `:chat_send` limiter key/config and channel enforcement path
- [x] Step 4: Run focused channel tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas_web/channels/live_session_channel_test.exs` -> RED first (`12 tests, 1 failure`) and GREEN after implementation (`12 tests, 0 failures`)
- `mix compile && mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 2: Moderation Mutation Limits

**Files:**
- Modify: `lib/live_canvas_web/rate_limiter.ex`
- Modify: `config/config.exs`
- Modify: `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`
- Modify: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`
- Modify: `docs/plans/release/2026-03-05-live-chat-throughput-and-moderation-rate-limits.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing GraphQL rate-limit tests for moderation mutation buckets
- [x] Step 2: Run focused GraphQL limiter tests to verify RED
- [x] Step 3: Implement `:moderation_action` bucket routing with fallback to generic mutation limits
- [x] Step 4: Run focused GraphQL limiter tests to verify GREEN
- [x] Step 5: Run `mix test test/live_canvas_gql/relay/graphql_rate_limit_test.exs` + `mix typecheck`, update checklist, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas_gql/relay/graphql_rate_limit_test.exs` -> RED first (`2 tests, 1 failure`) and GREEN after implementation (`2 tests, 0 failures`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 3: Verification And Tracking Updates

**Files:**
- Modify: `docs/plans/release/2026-03-05-live-chat-throughput-and-moderation-rate-limits.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`

**Task 3 Step Progress:**
- [x] Step 1: Run final verification for touched slices (`mix compile`, focused `mix test`, `mix typecheck`)
- [x] Step 2: Update roadmap and plans index to reflect delivered operational limits and remaining follow-ups
- [x] Step 3: Mark checklist completion and commit final milestone

Verification evidence (2026-03-05):

- `mix compile && mix test test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs && mix typecheck` -> PASS (`15 tests, 0 failures`; `Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

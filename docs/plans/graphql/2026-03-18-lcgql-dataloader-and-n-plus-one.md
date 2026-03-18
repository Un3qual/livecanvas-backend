# LCGQL Dataloader And N+1 Reduction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce request-scoped dataloader support in LCGQL and migrate the highest-fanout field resolvers so repeated child lookups collapse into batched queries without weakening viewer authorization.

**Architecture:** Build one dataloader instance per GraphQL request and expose it through Absinthe context so resolver modules can batch pure entity fetches. Keep authorization checks in resolvers and node fetchers; dataloader should only replace repeated data fetches, never visibility policy. Start with the child fields that currently fan out across user, media, and live-session lookups, then expand to any remaining resolver paths once the request-scoped loader is proven in tests.

**Tech Stack:** Elixir, Absinthe Relay, Dataloader, Ecto, ExUnit, Dialyzer

---

## Current State Verification (2026-03-18)

- `mix.exs` already declares `{:dataloader, "~> 2.0"}`, so the dependency is present even though the GraphQL layer is not using it yet.
- `lib/live_canvas_gql/context.ex` currently puts only `current_scope`, `auth_transport`, and `auth_error` into Absinthe context, so there is no request-scoped loader available to resolvers today.
- `lib/live_canvas_gql/accounts/account_types.ex` still has a commented `# field :user, non_null(:user), resolve: dataloader(User)` hint, which is the clearest sign that the intended loader integration has not landed.
- `lib/live_canvas_gql/content/content_resolver.ex`, `lib/live_canvas_gql/chat/chat_resolver.ex`, `lib/live_canvas_gql/feed/feed_resolver.ex`, and `lib/live_canvas_gql/social/social_resolver.ex` still call `Accounts.get_user!` or similar direct fetchers inside child resolvers, which creates the classic N+1 shape on list and edge fields.
- `lib/live_canvas_gql/schema.ex` still performs direct node fetches at the GraphQL boundary and then hands off to child resolvers, so the rollout has to preserve Relay refetch and viewer-scoped authorization while batching only the repeated leaf lookups.

## Scope Decisions

- Batch only pure data fetches through dataloader.
- Keep viewer authorization in resolver and node layers, especially for globally refetchable IDs and retained-history access.
- Migrate the highest-fanout child fields first rather than trying to rewrite every resolver at once.
- Prefer a small number of request-scoped sources over a source per field.

## Progress

- [ ] Task 1: Add request-scoped dataloader plumbing to the GraphQL context
- [ ] Task 2: Migrate the highest-fanout field resolvers to dataloader-backed fetches
- [ ] Task 3: Tighten remaining direct lookups and verify Relay/auth behavior

### Task 1: Add Request-Scoped Dataloader Plumbing To The GraphQL Context

**Files:**
- Create: `lib/live_canvas_gql/dataloader.ex`
- Modify: `lib/live_canvas_gql/context.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Test: `test/live_canvas_gql/relay/request_context_test.exs`
- Test: `test/live_canvas_gql/relay/node_queries_test.exs`

**Step 1: Write the failing tests**

- Add a request-context test that asserts every GraphQL request gets a fresh loader in Absinthe context.
- Add a node/query test that exercises a trivial request with two batched lookups and proves the loader is present during field resolution.
- Add a guard test that confirms auth scope remains alongside the loader context.

**Step 2: Run the focused tests to verify RED**

Run:

```bash
mix test test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: FAIL because the context does not yet inject a loader and no GraphQL middleware knows how to consume it.

**Step 3: Add the minimal loader plumbing**

- Introduce a small `LCGQL.Dataloader` helper that builds request-scoped sources from the existing boundary/repo modules.
- Wire the loader into `LCGQL.Context.call/2` so each Absinthe request gets a fresh instance.
- Update `LCGQL.Schema` only as needed to make the loader available to resolver middleware and child field resolution.
- Keep the auth scope payload unchanged so existing authorization checks still work.

**Step 4: Re-run the focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: PASS with the new loader present in request context and no regression in node refetch behavior.

**Step 5: Commit the milestone**

```bash
git add lib/live_canvas_gql/dataloader.ex lib/live_canvas_gql/context.ex lib/live_canvas_gql/schema.ex test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/relay/node_queries_test.exs docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md
git commit -m "feat: add request-scoped graphql dataloader"
```

**Task 1 behavior targets:**

- Every GraphQL request gets a fresh, request-scoped dataloader instance.
- Dataloader is available to child field resolvers without changing auth scope semantics.
- Relay node fetches still resolve through the existing boundary/auth checks.

### Task 2: Migrate The Highest-Fanout Field Resolvers To Dataloader-Backed Fetches

**Files:**
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `lib/live_canvas_gql/feed/feed_resolver.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Test: `test/live_canvas_gql/content/content_queries_test.exs`
- Test: `test/live_canvas_gql/chat/chat_queries_test.exs`
- Test: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Test: `test/live_canvas_gql/social/social_queries_test.exs`
- Test: `test/live_canvas_gql/accounts/account_queries_test.exs`

**Step 1: Write the failing tests**

- Add query-count coverage for the repeated user/media lookups that fan out from list responses.
- Target the hot child fields first: `Content.author`, `Chat.sender`, `Feed.host`, `Feed.recording_media_asset`, `Social.follow_request_follower`, and `Account.user_identity.user`.
- Keep the tests behavior-focused: assert fewer repeated lookups, not a specific internal batching implementation.

**Step 2: Run the focused GraphQL suites to verify RED**

Run:

```bash
mix test test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs
```

Expected: FAIL or show linear query growth because the child resolvers still issue direct fetches.

**Step 3: Convert the repeated child resolvers**

- Replace direct per-row fetches with loader-backed loads for the repeated user and asset lookups.
- Preserve fallback behavior for missing records by returning `nil` or an empty connection as the current API expects.
- Keep viewer-scoped checks in place for any field that currently revalidates retained-history or ownership visibility.
- Uncomment and migrate the `user_identity.user` field once the shared loader source is available.

**Step 4: Re-run the focused GraphQL suites to verify GREEN**

Run:

```bash
mix test test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs
```

Expected: PASS with flatter query counts for list and edge fields.

**Step 5: Commit the milestone**

```bash
git add lib/live_canvas_gql/content/content_resolver.ex lib/live_canvas_gql/chat/chat_resolver.ex lib/live_canvas_gql/feed/feed_resolver.ex lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/accounts/account_types.ex test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md
git commit -m "feat: batch graphql child field lookups"
```

**Task 2 behavior targets:**

- List and edge fields stop issuing one user lookup per row.
- `recordingMediaAsset` still re-applies retained-history authorization before following the foreign key.
- Missing rows and unauthorized access continue to resolve to the same API-visible fallbacks as before.

### Task 3: Tighten Remaining Direct Lookups And Verify Relay/Auth Behavior

**Files:**
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/feed/feed_resolver.ex`
- Modify: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify as needed: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Test: `test/live_canvas_gql/relay/node_queries_test.exs`
- Test: `test/live_canvas_gql/content/content_queries_test.exs`
- Test: `test/live_canvas_gql/chat/chat_queries_test.exs`
- Test: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Test: `test/live_canvas_gql/social/social_queries_test.exs`

**Step 1: Add the authorization regression tests**

- Add node and child-field tests that prove loader-backed lookups do not bypass viewer ownership or visibility checks.
- Exercise the paths that already have explicit auth gates, especially live-session refetch and retained-history access.

**Step 2: Clean up any residual direct fetches**

- Remove any remaining inline `Accounts.get_user!` or equivalent lookup that survived the first migration pass and is still reachable from repeated GraphQL field resolution.
- Keep direct one-off boundary fetches only where batching is not useful or where the code is intentionally a node boundary check.

**Step 3: Run the final verification**

Run:

```bash
mix compile
mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs
mix typecheck
```

Expected: PASS with no GraphQL auth regressions and no typed-code warnings.

**Step 4: Commit the milestone**

```bash
git add lib/live_canvas_gql/schema.ex lib/live_canvas_gql/feed/feed_resolver.ex lib/live_canvas_gql/chat/chat_resolver.ex lib/live_canvas_gql/content/content_resolver.ex lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md
git commit -m "feat: preserve graphql auth while batching lookups"
```

**Task 3 behavior targets:**

- Relay node refetch remains viewer-scoped where it already is today.
- Dataloader is purely an optimization layer for repeated fetches.
- The remaining direct lookups are intentionally limited and documented, not accidental leftovers.

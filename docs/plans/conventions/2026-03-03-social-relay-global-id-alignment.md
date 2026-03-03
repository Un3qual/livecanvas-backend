# Social GraphQL Relay Global ID Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining Relay-first migration work in the `Social` GraphQL surface by removing local ID parsing and requiring Relay global IDs for social reads and writes.

**Architecture:** Keep `LCGQL` adapter-thin and route all GraphQL ID decoding through `LCGQL.Relay`. Preserve `LC.Social` as the business boundary and avoid GraphQL-specific logic in contexts. Land the migration in additive slices: strict input decoding first, then payload shape and node/connection follow-ups.

**Tech Stack:** Elixir, Absinthe Relay (`:modern`), Ecto, ExUnit

---

## Progress Checklist

- [x] Task 1: Enforce Relay global ID decoding for Social query and mutation inputs.
- [ ] Task 2: Convert Social mutations to explicit Relay payload fields with structured errors.
- [ ] Task 3: Add Relay-native Social node/connection surfaces where product requirements need list pagination.
- [ ] Task 4: Run full GraphQL verification and close the conventions progress item.

### Task 1: Enforce Relay Global ID Decoding For Social Inputs

**Files:**
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`

**Step 1: Write failing Social GraphQL tests for global IDs**

- Update Social query/mutation tests to pass Relay global IDs (`Absinthe.Relay.Node.to_global_id/3`) instead of local integer IDs.
- Add a mutation regression test that passes a raw numeric string ID and asserts GraphQL returns an error.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs
```

Expected: FAIL because Social resolvers still use `Integer.parse/1` and local ID assumptions.

**Step 3: Implement strict Relay decoding in the Social resolver**

- Replace `parse_id/1` in `LCGQL.Social.Resolver` with `LCGQL.Relay.decode_global_id/3`.
- Require `:user` node type for all Social user ID inputs.
- Keep existing `relationship_state/3` fallback behavior (`:none`) for lookup failures so this slice does not widen product behavior.

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs
```

Expected: PASS, including numeric-ID rejection coverage.

**Step 5: Milestone verification and commit**

Run:

```bash
mix typecheck
```

Then commit:

```bash
git add docs/plans/conventions/2026-03-03-social-relay-global-id-alignment.md \
  lib/live_canvas_gql/social/social_resolver.ex \
  test/live_canvas_gql/social/social_queries_test.exs \
  test/live_canvas_gql/social/social_mutations_test.exs
git commit -m "feat: enforce relay global ids in social graphql"
```

### Task 2: Convert Social Mutations To Relay Payload Fields

**Files:**
- Modify: `lib/live_canvas_gql/social/social_mutations.ex`
- Modify: `lib/live_canvas_gql/social/social_types.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`

Add Relay `payload field` mutation declarations and structured error arrays while preserving existing mutation names.

### Task 3: Add Relay-Native Social Node/Connection Surfaces

**Files:**
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/social/social_types.ex`
- Modify: `lib/live_canvas/social.ex`
- Add/Modify: Social GraphQL query tests

If product/API needs paginated relationship lists, expose them as Relay connections with deterministic ordering.

### Task 4: Final Verification And Conventions Closeout

**Files:**
- Modify: `docs/architecture/conventions.md`
- Verify: `lib/live_canvas_gql/schema.ex`
- Verify: `lib/live_canvas_gql/social/*`
- Verify: `test/live_canvas_gql/social/*`

Run `mix test test/live_canvas_gql` and `mix typecheck`, then update conventions progress once all Relay-first criteria are satisfied.

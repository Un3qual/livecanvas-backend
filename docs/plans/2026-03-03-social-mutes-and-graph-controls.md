# Social Mutes And Graph Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the missing `Social` mute capability from the approved architecture by shipping persistence, context APIs, and Relay-compatible GraphQL surfaces for muting and unmuting users.

**Architecture:** Keep mutes directional (`muter -> muted`) and separate from hard visibility enforcement (`blocks`). `LC.Social` remains the boundary owner of relationship writes, `LCSchemas` remains schema-only, and GraphQL resolvers stay adapter-thin over context APIs with strict Relay global ID decoding.

**Tech Stack:** Elixir 1.15, Ecto, PostgreSQL, Absinthe Relay, ExUnit, Dialyzer

---

## Progress

- [x] Task 1: Add mute persistence and `LC.Social` boundary APIs
- [ ] Task 2: Expose mute status and mute/unmute mutations through GraphQL
- [ ] Task 3: Run full verification and close the plan

### Task 1: Add Mute Persistence And `LC.Social` Boundary APIs

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_create_social_mutes_table.exs`
- Create: `lib/live_canvas_schemas/social/mute.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Modify: `lib/live_canvas/social.ex`
- Modify: `test/live_canvas/social_test.exs`
- Modify: `test/support/fixtures/social_fixtures.ex`
- Modify: `docs/plans/2026-03-03-social-mutes-and-graph-controls.md`

**Task 1 Step Progress:**
- [x] Step 1: Write failing `Social` mute tests
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement minimal migration, schema, and context APIs
- [x] Step 4: Run test DB migration
- [x] Step 5: Run focused tests to verify GREEN
- [x] Step 6: Run typing checks for touched context code and commit

**Step 1: Write failing `Social` mute tests**

Add focused context tests that define the public contract:
- `mute_user/2` persists a directional mute row.
- `muted?/2` returns `true` only for the muter->muted direction.
- `unmute_user/2` removes the relationship and is idempotent when no row exists.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/social_test.exs --trace
```

Expected: FAIL with undefined function errors for the new mute APIs.

**Step 3: Implement minimal migration, schema, and context APIs**

Implement:
- Additive migration creating `mutes` with:
  - `bigint` PK
  - `entropy_id` UUIDv7 defaulted by Postgres (`uuidv7()`)
  - `muter_id` and `muted_id` references to `users`
  - `timestamps(type: :utc_datetime_usec)`
  - indexes on both FK columns and unique index on `[:muter_id, :muted_id]`
- `LCSchemas.Social.Mute` schema with typed struct fields.
- `LC.Social` APIs:
  - `mute_user/2`
  - `unmute_user/2`
  - `muted?/2`

Implementation notes:
- Keep writes coordinated in `LC.Social`; keep schema modules data-only.
- Add concise comments where query intent is non-obvious (especially directional checks and idempotent deletes).

**Step 4: Run test DB migration**

Run:

```bash
MIX_ENV=test mix ecto.migrate
```

Expected: migration applies cleanly with no rollback warnings.

**Step 5: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/social_test.exs --trace
```

Expected: PASS for new mute tests and existing social behavior.

**Step 6: Run typing checks for touched context code and commit**

Run:

```bash
mix check.typespecs --strict
mix typecheck
```

Then commit:

```bash
git add priv/repo/migrations lib/live_canvas/social.ex lib/live_canvas_schemas.ex lib/live_canvas_schemas/social/mute.ex test/live_canvas/social_test.exs test/support/fixtures/social_fixtures.ex docs/plans/2026-03-03-social-mutes-and-graph-controls.md
git commit -m "feat: add social mute persistence and APIs"
```

### Task 2: Expose Mute Status And Mute/Unmute Mutations Through GraphQL

**Files:**
- Modify: `lib/live_canvas_gql/social/social_queries.ex`
- Modify: `lib/live_canvas_gql/social/social_mutations.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/social/social_types.ex`
- Modify: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`
- Modify: `docs/plans/2026-03-03-social-mutes-and-graph-controls.md`

**Task 2 Step Progress:**
- [ ] Step 1: Write failing GraphQL tests for mute query and mutations
- [ ] Step 2: Run focused GraphQL tests to verify RED
- [ ] Step 3: Implement resolver and schema wiring with Relay ID decoding
- [ ] Step 4: Run focused GraphQL tests to verify GREEN
- [ ] Step 5: Commit

**Step 1: Write failing GraphQL tests for mute query and mutations**

Add coverage for:
- `isMuted(viewerId:, creatorId:)` query returning `true` when viewer muted creator.
- `muteUser` mutation returning `successful: true` with empty errors.
- `unmuteUser` mutation returning `successful: true` and clearing mute status.
- invalid non-global IDs return structured `errors` fields.

**Step 2: Run focused GraphQL tests to verify RED**

Run:

```bash
mix test test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs --trace
```

Expected: FAIL because schema fields/resolver functions are not implemented yet.

**Step 3: Implement resolver and schema wiring with Relay ID decoding**

Implement:
- Query field:
  - `is_muted(viewer_id:, creator_id:) :: boolean`
- Mutations:
  - `mute_user`
  - `unmute_user`
- Resolver wrappers that decode global IDs through existing relay helpers and delegate to `LC.Social`.
- Structured error payloads matching existing social mutation shape.

**Step 4: Run focused GraphQL tests to verify GREEN**

Run:

```bash
mix test test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs --trace
```

Expected: PASS with no regressions in existing social query/mutation behavior.

**Step 5: Commit**

```bash
git add lib/live_canvas_gql/social/social_queries.ex lib/live_canvas_gql/social/social_mutations.ex lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/social/social_types.ex test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs docs/plans/2026-03-03-social-mutes-and-graph-controls.md
git commit -m "feat: add graphql social mute controls"
```

### Task 3: Final Verification And Plan Closeout

**Files:**
- Modify: `docs/plans/2026-03-03-social-mutes-and-graph-controls.md`
- Verify: `lib/live_canvas/social.ex`
- Verify: `lib/live_canvas_schemas/social/mute.ex`
- Verify: `lib/live_canvas_gql/social/social_queries.ex`
- Verify: `lib/live_canvas_gql/social/social_mutations.ex`
- Verify: `lib/live_canvas_gql/social/social_resolver.ex`

**Task 3 Step Progress:**
- [ ] Step 1: Mark all completed checklist items in this plan file
- [ ] Step 2: Run required verification suite
- [ ] Step 3: Commit final plan state with related code/test changes

**Step 2: Run required verification suite**

Run:

```bash
mix compile
mix test test/live_canvas/social_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs --trace
mix check.typespecs --strict
mix typecheck
mix precommit
```

Expected: PASS.

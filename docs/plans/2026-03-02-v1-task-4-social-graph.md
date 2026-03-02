# V1 Task 4 Social Graph Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the first `Social` slice for follows, follow requests, and blocks, starting with the missing account privacy state required by the approved architecture.

**Architecture:** `LiveCanvas.Accounts` still owns account-level privacy state on `users`, while `LiveCanvas.Social` should own relationship writes and visibility checks. This plan refines the older Task 4 outline by matching the current boundary rules: keep Ecto schemas under `LiveCanvasSchemas`, keep pure relationship decisions in an internal module, and keep Absinthe adapters thin over the `Social` boundary.

**Tech Stack:** Elixir 1.15+, Ecto, Absinthe, ExUnit, PostgreSQL, `boundary`

---

## Progress

- [x] Task 1: Add the Accounts-owned privacy mode prerequisite
- [x] Task 2: Add the `Social` persistence, policy, and boundary APIs
- [ ] Task 3: Add the GraphQL `Social` query and mutation surface
- [ ] Task 4: Run final verification and review

### Task 1: Add The Accounts-Owned Privacy Mode Prerequisite

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_add_user_privacy_mode_to_users.exs`
- Create: `lib/live_canvas_schemas/accounts/user_privacy_mode.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Modify: `lib/live_canvas_schemas/accounts/user.ex`
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`

**Step 1: Write the failing tests**

Add coverage that proves `Accounts` owns and persists privacy mode before any `Social` logic exists:

```elixir
test "update_user_privacy_mode/2 persists private visibility" do
  user = user_fixture()

  assert {:ok, updated_user} = Accounts.update_user_privacy_mode(user, :private)
  assert updated_user.privacy_mode == :private
  assert Accounts.get_user!(user.id).privacy_mode == :private
end

test "user_fixture/1 can build a public account" do
  user = user_fixture(privacy_mode: :public)

  assert user.privacy_mode == :public
end
```

**Step 2: Run test to verify it fails**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: FAIL because `users.privacy_mode`, `UserPrivacyMode`, and the new `Accounts` API do not exist yet.

**Step 3: Write the minimal implementation**

- Add a two-value `UserPrivacyMode` enum and a migration that adds `users.privacy_mode` with a default of `:private`
- Expose the enum from `LiveCanvasSchemas`
- Add `field :privacy_mode, LiveCanvasSchemas.Accounts.UserPrivacyMode, default: :private` to `LiveCanvasSchemas.Accounts.User`
- Add `UserChanges.privacy_changeset/2`
- Add `Accounts.update_user_privacy_mode/2` as the public boundary API
- Extend `user_fixture/1` so tests can request `privacy_mode: :public` without direct repo writes

Minimal shape:

```elixir
def update_user_privacy_mode(user, privacy_mode) do
  user
  |> UserChanges.privacy_changeset(%{privacy_mode: privacy_mode})
  |> Repo.update()
end
```

**Step 4: Run test database migration**

Run: `MIX_ENV=test mix ecto.migrate`

Expected: the new `user_privacy_mode` type and `users.privacy_mode` column apply cleanly in the test database.

**Step 5: Run test to verify it passes**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: PASS for the new privacy-mode coverage and the existing account suite.

**Step 6: Commit**

```bash
git add priv/repo/migrations lib/live_canvas_schemas.ex lib/live_canvas_schemas/accounts/user_privacy_mode.ex lib/live_canvas_schemas/accounts/user.ex lib/live_canvas/accounts/user_changes.ex lib/live_canvas/accounts.ex test/live_canvas/accounts_test.exs test/support/fixtures/accounts_fixtures.ex
git commit -m "feat: add account privacy mode"
```

### Task 2: Add The `Social` Persistence, Policy, And Boundary APIs

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_create_social_graph_tables.exs`
- Create: `lib/live_canvas/social.ex`
- Create: `lib/live_canvas/social/relationship_policy.ex`
- Create: `lib/live_canvas_schemas/social.ex`
- Create: `lib/live_canvas_schemas/social/follow.ex`
- Create: `lib/live_canvas_schemas/social/block.ex`
- Create: `lib/live_canvas_schemas/social/follow_state.ex`
- Modify: `lib/live_canvas.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Create: `test/live_canvas/social/relationship_policy_test.exs`
- Create: `test/live_canvas/social_test.exs`
- Create: `test/support/fixtures/social_fixtures.ex`

**Step 1: Write the failing tests**

Add one pure test file for relationship decisions and one integration-style context test file:

```elixir
test "public accounts auto-accept follows" do
  assert %{state: :accepted, accepted_at: %DateTime{}} =
           RelationshipPolicy.follow_decision(%{
             follower_id: 1,
             followed_id: 2,
             followed_privacy_mode: :public,
             blocked?: false,
             now: DateTime.utc_now()
           })
end

test "private accounts start as requested" do
  follower = user_fixture()
  followed = user_fixture(privacy_mode: :private)

  assert {:ok, follow} = Social.follow_user(follower, followed)
  assert follow.state == :requested
end

test "blocking overrides follow visibility" do
  viewer = user_fixture()
  creator = user_fixture(privacy_mode: :public)

  {:ok, _follow} = Social.follow_user(viewer, creator)
  {:ok, _block} = Social.block_user(creator, viewer)

  assert :blocked = Social.relationship_state(viewer, creator)
  refute Social.can_view_user?(viewer, creator)
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/social/relationship_policy_test.exs test/live_canvas/social_test.exs --trace`

Expected: FAIL because the `Social` boundary, schemas, fixtures, and migration do not exist yet.

**Step 3: Write the minimal implementation**

- Add `FollowState` as a two-value enum: `:requested` and `:accepted`
- Create `follows` with `follower_id`, `followed_id`, `state`, `requested_at`, `accepted_at`, and a unique index on `[:follower_id, :followed_id]`
- Create `blocks` with `blocker_id`, `blocked_id`, and a unique index on `[:blocker_id, :blocked_id]`
- Keep Ecto schemas in `LiveCanvasSchemas.Social.*`
- Export `Social` from `LiveCanvas`, and add `SocialFixtures` to the test-only exports list
- Export the new `LiveCanvasSchemas.Social.*` modules from `LiveCanvasSchemas`
- Keep pure decisions in `LiveCanvas.Social.RelationshipPolicy`
- Implement a thin `LiveCanvas.Social` boundary with:
  - `follow_user/2`
  - `accept_follow_request/2`
  - `block_user/2`
  - `relationship_state/2`
  - `can_view_user?/2`
- Add `SocialFixtures` helpers that call the public boundary APIs instead of inserting rows directly

Minimal boundary shape:

```elixir
defmodule LiveCanvas.Social do
  use Boundary, deps: [LiveCanvas.Infra, LiveCanvasSchemas]

  alias LiveCanvas.Infra.Repo
  alias LiveCanvas.Social.RelationshipPolicy

  def follow_user(follower, followed), do: ...
  def accept_follow_request(follow, acting_user), do: ...
  def block_user(actor, blocked_user), do: ...
  def relationship_state(viewer, creator), do: ...
  def can_view_user?(viewer, creator), do: relationship_state(viewer, creator) in [:accepted, :public]
end
```

**Step 4: Run test database migration**

Run: `MIX_ENV=test mix ecto.migrate`

Expected: the `follow_state` type plus `follows` and `blocks` tables apply cleanly in the test database.

**Step 5: Run tests to verify they pass**

Run: `mix test test/live_canvas/social/relationship_policy_test.exs test/live_canvas/social_test.exs --trace`

Expected: PASS for public/private follow rules, follow-request state, and block precedence.

**Step 6: Commit**

```bash
git add priv/repo/migrations lib/live_canvas.ex lib/live_canvas/social.ex lib/live_canvas/social/relationship_policy.ex lib/live_canvas_schemas.ex lib/live_canvas_schemas/social.ex lib/live_canvas_schemas/social test/live_canvas/social test/support/fixtures/social_fixtures.ex
git commit -m "feat: add social graph context"
```

**Refactor And Review Gate**

- Confirm `LiveCanvas.Social` coordinates repo work only and does not absorb the policy rules.
- Confirm `RelationshipPolicy` stays transport-agnostic and repo-free.
- Confirm `LiveCanvasWeb` and `LiveCanvasGQL` still depend on `LiveCanvas` boundary modules only.

### Task 3: Add The GraphQL `Social` Query And Mutation Surface

**Files:**
- Create: `lib/live_canvas_gql/social/social_types.ex`
- Create: `lib/live_canvas_gql/social/social_queries.ex`
- Create: `lib/live_canvas_gql/social/social_mutations.ex`
- Create: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Create: `test/live_canvas_gql/social/social_queries_test.exs`
- Create: `test/live_canvas_gql/social/social_mutations_test.exs`

**Step 1: Write the failing tests**

Add thin adapter tests that prove Absinthe delegates to `LiveCanvas.Social`:

```elixir
test "followUser returns requested for a private account" do
  follower = user_fixture()
  followed = user_fixture(privacy_mode: :private)

  mutation = """
  mutation($followerId: ID!, $followedId: ID!) {
    followUser(input: {followerId: $followerId, followedId: $followedId}) {
      state
    }
  }
  """

  assert {:ok, %{data: %{"followUser" => %{"state" => "REQUESTED"}}}} =
           Absinthe.run(mutation, LiveCanvasGQL.Schema,
             variables: %{"followerId" => follower.id, "followedId" => followed.id}
           )
end

test "relationshipState reports blocked" do
  viewer = user_fixture()
  creator = user_fixture()

  query = """
  query($viewerId: ID!, $creatorId: ID!) {
    relationshipState(viewerId: $viewerId, creatorId: $creatorId)
  }
  """

  assert {:ok, %{data: %{"relationshipState" => "BLOCKED"}}} =
           Absinthe.run(query, LiveCanvasGQL.Schema,
             variables: %{"viewerId" => viewer.id, "creatorId" => creator.id}
           )
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs --trace`

Expected: FAIL because the `Social` GraphQL modules and schema imports do not exist yet.

**Step 3: Write the minimal implementation**

- Add `LiveCanvasGQL.Social.Types` with:
  - a `:relationship_state` enum
  - a `:follow_state` enum
  - payload/input objects for follow, accept, and block mutations
- Add `LiveCanvasGQL.Social.Resolver` as thin wrappers over `LiveCanvas.Social`
- Add `LiveCanvasGQL.Social.Queries` for `relationshipState`
- Add `LiveCanvasGQL.Social.Mutations` for:
  - `followUser`
  - `acceptFollowRequest`
  - `blockUser`
- Import the new query and mutation fields into `LiveCanvasGQL.Schema`

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs --trace`

Expected: PASS for the new GraphQL relationship surface.

**Step 5: Commit**

```bash
git add lib/live_canvas_gql/schema.ex lib/live_canvas_gql/social test/live_canvas_gql/social
git commit -m "feat: add graphql social APIs"
```

### Task 4: Final Verification And Review

**Files:**
- Verify: `lib/live_canvas.ex`
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas/accounts/user_changes.ex`
- Verify: `lib/live_canvas/social.ex`
- Verify: `lib/live_canvas/social/relationship_policy.ex`
- Verify: `lib/live_canvas_schemas.ex`
- Verify: `lib/live_canvas_schemas/accounts/user.ex`
- Verify: `lib/live_canvas_schemas/accounts/user_privacy_mode.ex`
- Verify: `lib/live_canvas_schemas/social.ex`
- Verify: `lib/live_canvas_schemas/social/follow.ex`
- Verify: `lib/live_canvas_schemas/social/block.ex`
- Verify: `lib/live_canvas_schemas/social/follow_state.ex`
- Verify: `lib/live_canvas_gql/schema.ex`
- Verify: `lib/live_canvas_gql/social/social_types.ex`
- Verify: `lib/live_canvas_gql/social/social_queries.ex`
- Verify: `lib/live_canvas_gql/social/social_mutations.ex`
- Verify: `lib/live_canvas_gql/social/social_resolver.ex`
- Verify: `test/live_canvas/accounts_test.exs`
- Verify: `test/live_canvas/social/relationship_policy_test.exs`
- Verify: `test/live_canvas/social_test.exs`
- Verify: `test/live_canvas_gql/social/social_queries_test.exs`
- Verify: `test/live_canvas_gql/social/social_mutations_test.exs`
- Verify: `test/support/fixtures/accounts_fixtures.ex`
- Verify: `test/support/fixtures/social_fixtures.ex`

**Step 1: Run formatting**

Run: `mix format lib/live_canvas.ex lib/live_canvas/accounts.ex lib/live_canvas/accounts/user_changes.ex lib/live_canvas/social.ex lib/live_canvas/social/relationship_policy.ex lib/live_canvas_schemas.ex lib/live_canvas_schemas/accounts/user.ex lib/live_canvas_schemas/accounts/user_privacy_mode.ex lib/live_canvas_schemas/social.ex lib/live_canvas_schemas/social/follow.ex lib/live_canvas_schemas/social/block.ex lib/live_canvas_schemas/social/follow_state.ex lib/live_canvas_gql/schema.ex lib/live_canvas_gql/social/social_types.ex lib/live_canvas_gql/social/social_queries.ex lib/live_canvas_gql/social/social_mutations.ex lib/live_canvas_gql/social/social_resolver.ex test/live_canvas/accounts_test.exs test/live_canvas/social/relationship_policy_test.exs test/live_canvas/social_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/support/fixtures/accounts_fixtures.ex test/support/fixtures/social_fixtures.ex`

Expected: formatting completes cleanly.

**Step 2: Run focused verification**

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas/social/relationship_policy_test.exs test/live_canvas/social_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs --trace`

Expected: PASS for the privacy prerequisite, core `Social` slice, and GraphQL adapters.

**Step 3: Run compile verification**

Run: `mix compile`

Expected: PASS with `boundary` checks still clean after exporting `Social` and the new schema modules.

**Step 4: Review the architecture fit**

Confirm all of the following before moving to `Content`:
- `users` owns privacy mode, not `Social`
- schema modules live under `LiveCanvasSchemas`
- `Social` owns relationship rules and visibility checks
- GraphQL remains adapter-thin and boundary-only

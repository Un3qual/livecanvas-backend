# ReadPolicy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate relationship facts and viewer-visibility decisions under `LC.ReadPolicy` in a PR stacked on the completed directional privacy branch.

**Architecture:** Add an internal `LC.ReadPolicy.Relationships` data-access module and keep action-specific public decisions/query scopes on the `LC.ReadPolicy` facade. `LC.Social` retains relationship mutations and persistence but no longer owns read-policy semantics; GraphQL only adapts IDs, pagination, and established error contracts.

**Tech Stack:** Elixir, Ecto, Boundary, Absinthe Relay, ExUnit.

## Global Constraints

- Create `codex/read-policy-redesign` from the pushed `codex/directional-block-privacy` head.
- Open the stacked PR against `codex/directional-block-privacy`, not `main`.
- Preserve all GraphQL/mobile behavior and query counts from PR #116.
- Preserve directional profile resolution and symmetric content/chat/live visibility.
- Do not introduce a policy DSL, persistence migration, LetMe migration, or compatibility wrappers without a current caller.
- Add typespecs for every public function and run `mix typecheck` and `mix boundary.spec`.

---

## File Structure

- `lib/live_canvas/read_policy/relationships.ex`: internal Ecto reads for block, mute, follow state, and blocking-ID sets.
- `lib/live_canvas/read_policy.ex`: public action-specific decisions and composable query scopes.
- `lib/live_canvas/social.ex`: social mutations and public/social-graph queries only.
- GraphQL schema/resolvers: call `ReadPolicy` decisions and explicit Social query names.
- `test/live_canvas/read_policy_test.exs`: direct policy/fact/query-scope characterization.
- Existing Social/GraphQL/integration tests: prove compatibility during caller migration.

---

### Task 1: Characterize Relationship Facts and Introduce the Internal Module

**Files:**
- Create: `test/live_canvas/read_policy_test.exs`
- Create: `lib/live_canvas/read_policy/relationships.ex`
- Modify: `lib/live_canvas/read_policy.ex`

**Interfaces:**
- Internal: `Relationships.blocked_by?/2`, `blocked_between?/2`, `muted?/2`, `follow_state/2`, `blocking_owner_ids/2`.
- Public facade: `viewer_blocked_by_owner?/2`, `blocked_between?/2`, `viewer_muted_owner?/2`, `viewer_can_view_relationship_graph?/3`, and `blocking_owner_ids/2`.

- [ ] **Step 1: Create and verify the stacked branch**

```bash
git switch -c codex/read-policy-redesign
git merge-base --is-ancestor origin/codex/directional-block-privacy HEAD
```

Expected: the new branch is based on the pushed PR #116 head and the ancestry check exits 0.

- [ ] **Step 2: Write failing direct policy tests**

Cover both block directions, symmetric block state, mute direction, accepted/requested/no follow state through `relationship_state/3`, relationship-graph visibility that deliberately ignores mute state, and batched blocker IDs:

```elixir
assert ReadPolicy.viewer_blocked_by_owner?(viewer, owner)
refute ReadPolicy.viewer_blocked_by_owner?(owner, viewer)
assert ReadPolicy.blocked_between?(viewer, owner)
assert ReadPolicy.blocking_owner_ids(viewer, [owner.id, visible.id]) == MapSet.new([owner.id])
assert ReadPolicy.viewer_can_view_relationship_graph?(viewer, muted_public_owner, :public)
```

- [ ] **Step 3: Run the policy test and verify RED**

Run: `mix test test/live_canvas/read_policy_test.exs`

Expected: compilation failures for the new facade functions.

- [ ] **Step 4: Move relationship Ecto reads behind the facade**

Implement `LC.ReadPolicy.Relationships` with `@moduledoc false`, `Repo.exists?` block/mute reads, one `Repo.all` blocking-ID query, and the existing follow-state query. Delegate through typed facade functions. Change `relationship_state/3` and `viewer_can_read_owner?/3` to consume those facade facts rather than private duplicate queries.

Use explicit names and user structs at public boundaries:

```elixir
def viewer_blocked_by_owner?(%User{} = viewer, %User{} = owner),
  do: Relationships.blocked_by?(viewer, owner)

def blocked_between?(%User{} = left, %User{} = right),
  do: Relationships.blocked_between?(left, right)
```

- [ ] **Step 5: Run the policy and existing Social tests**

Run:

```bash
mix test test/live_canvas/read_policy_test.exs test/live_canvas/social_test.exs
```

Expected: PASS with unchanged relationship-state semantics.

- [ ] **Step 6: Commit the policy-facts milestone**

```bash
git add lib/live_canvas/read_policy.ex lib/live_canvas/read_policy/relationships.ex test/live_canvas/read_policy_test.exs
git commit -m "refactor: centralize relationship policy facts"
```

---

### Task 2: Add Directional Query Scopes and Rename Social Graph Queries

**Files:**
- Modify: `test/live_canvas/read_policy_test.exs`
- Modify: `test/live_canvas/social_test.exs`
- Modify: `test/live_canvas/dev/seed_data_test.exs`
- Modify: `lib/live_canvas/read_policy.ex`
- Modify: `lib/live_canvas/social.ex`

**Interfaces:**
- Produces: `ReadPolicy.exclude_owners_blocking_viewer(queryable, viewer, owner_key)`.
- Produces: `Social.public_follower_users_query/1`, `viewer_follower_users_query/2`, `public_following_users_query/1`, `viewer_following_users_query/2`.

- [ ] **Step 1: Write failing scope and explicit-name tests**

Build a root `User` query and a `Follow` query and assert the scope removes only owners who blocked the viewer. Update Social tests to call the four explicit query names. Update the seed-data test to call `public_following_users_query/1`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
mix test test/live_canvas/read_policy_test.exs test/live_canvas/social_test.exs test/live_canvas/dev/seed_data_test.exs
```

Expected: undefined-function failures for the scope and explicit Social query names.

- [ ] **Step 3: Implement the directional scope and migrate Social queries**

Add a named `:read_policy_directional_block` join using the existing resource-binding helper:

```elixir
def exclude_owners_blocking_viewer(queryable, %User{id: viewer_id}, owner_key) do
  queryable
  |> with_resource_binding()
  |> join(:left, [read_policy_resource: resource], block in Block,
    as: :read_policy_directional_block,
    on:
      block.blocker_id == field(resource, ^owner_key) and
        block.blocked_id == ^viewer_id
  )
  |> where([read_policy_directional_block: block], is_nil(block.id))
end
```

Rename the public Social graph query functions, remove the `:social_user` coupling, and compose viewer queries with `owner_key: :id`. Replace the inline pending-request block joins with the same ReadPolicy scope using `owner_key: :follower_id`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 2 command again.

Expected: PASS with explicit public/viewer APIs and one directional scope implementation.

- [ ] **Step 5: Commit the query-scope milestone**

```bash
git add lib/live_canvas/read_policy.ex lib/live_canvas/social.ex test/live_canvas/read_policy_test.exs test/live_canvas/social_test.exs test/live_canvas/dev/seed_data_test.exs
git commit -m "refactor: centralize directional visibility scopes"
```

---

### Task 3: Migrate GraphQL and Remove Social-Owned Read Policy

**Files:**
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/contact_resolver.ex`
- Modify: `lib/live_canvas/social.ex`
- Modify: `test/live_canvas/social_test.exs`
- Modify: `test/live_canvas_gql/accounts/contact_resolver_test.exs`
- Modify: `test/live_canvas_gql/accounts/contact_queries_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`
- Modify: `test/integration/feed_visibility_flow_test.exs`

**Interfaces:**
- Consumes: `ReadPolicy.viewer_blocked_by_owner?/2`, `viewer_can_read_owner?/3`, `viewer_muted_owner?/2`, and `blocking_owner_ids/2`.
- Removes: `Social.blocked_by?/2`, `user_ids_blocking_viewer/2`, `muted?/2`, `relationship_state/2`, `can_view_user?/2`, and old ambiguous graph-query names.

- [ ] **Step 1: Update tests to the final policy API and verify RED**

Change direct policy assertions from `Social` to `ReadPolicy`; keep mutation persistence assertions on `Social`. Update GraphQL query tests only where helpers are called directly. Run the focused suite and confirm undefined/obsolete API failures before production migration.

- [ ] **Step 2: Migrate production callers**

Use `ReadPolicy.viewer_blocked_by_owner?` in user-node and visible-target lookup, `ReadPolicy.relationship_state`/`viewer_muted_owner?` in social reads, `ReadPolicy.viewer_can_view_relationship_graph?` in graph authorization, explicit Social query names in connection resolvers, and `ReadPolicy.blocking_owner_ids` in contact projection. Keep `viewer_can_read_owner?/3` for content/chat/live reads where viewer mutes are part of visibility; do not substitute it for relationship-graph policy.

Delete the now-unused Social policy wrappers and private block query. Keep GraphQL missing-user error normalization unchanged.

- [ ] **Step 3: Run the complete privacy and related authorization suites**

Run:

```bash
mix test test/live_canvas/read_policy_test.exs test/live_canvas/social_test.exs test/live_canvas_gql/accounts/contact_resolver_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/integration/feed_visibility_flow_test.exs test/live_canvas/chat_test.exs test/live_canvas/feed_test.exs
```

Expected: PASS with identical public responses and query-count assertions.

- [ ] **Step 4: Commit the caller migration**

```bash
git add lib test
git commit -m "refactor: route visibility through read policy"
```

---

### Task 4: Verify and Publish the Stacked PR

**Files:**
- Modify: redesign spec/plan status and backend lane pointer with final evidence.

- [ ] **Step 1: Run repository quality gates**

Run:

```bash
mix format --check-formatted lib/live_canvas/read_policy.ex lib/live_canvas/read_policy/relationships.ex lib/live_canvas/social.ex lib/live_canvas_gql/schema.ex lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/accounts/contact_resolver.ex test/live_canvas/read_policy_test.exs test/live_canvas/social_test.exs test/live_canvas/dev/seed_data_test.exs test/live_canvas_gql/accounts/contact_resolver_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/integration/feed_visibility_flow_test.exs
mix compile --warnings-as-errors
mix typecheck
mix boundary.spec
mix slop.changed
git diff --check
```

Expected: all affected checks pass and no obsolete Social policy calls remain (`rg` returns no matches for the removed APIs).

- [ ] **Step 2: Commit closure evidence**

Mark the redesign spec and plan complete, record exact command results, and leave unrelated baseline advisories unchanged.

```bash
git add docs
git commit -m "docs: close read policy redesign"
```

- [ ] **Step 3: Push and create the stacked PR**

```bash
git push -u origin codex/read-policy-redesign
```

Open a non-draft PR titled `Centralize viewer visibility in ReadPolicy` with base `codex/directional-block-privacy`. Confirm the PR head matches local HEAD, its base is the privacy branch, and its diff excludes PR #116 commits.

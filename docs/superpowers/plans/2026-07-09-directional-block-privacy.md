# Directional Block Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a user who blocked the authenticated viewer observationally indistinguishable from a missing account across GraphQL profile, social-control, discovery, contact, and mobile surfaces.

**Architecture:** Add one direction-safe `LC.Social.blocked_by?/2` policy and reuse it at every public user projection. Keep symmetric block checks for content/chat authorization, while GraphQL normalizes target-blocked-viewer reads and writes to existing missing-user behavior and filters user-bearing projections in batches.

**Tech Stack:** Elixir, Ecto, Absinthe Relay, ExUnit, React Native, Expo Router, Relay, Jest/RNTL.

## Global Constraints

- `Social.blocked_by?(viewer, target)` means the target blocked the viewer.
- A hidden target and a missing target must return identical public read values and social-mutation error fields/messages.
- A target blocked only by the viewer remains resolvable and may return `BLOCKED`.
- Keep content, live-session, and chat block authorization symmetric.
- Do not add unblock, unfollow, schema enum, persistence migration, or staff-moderation changes.
- Add typespecs for public functions and run `mix typecheck`.
- Keep mobile tests under `mobile/tests/**`.

---

## File Structure

- `lib/live_canvas/social.ex`: owns the directional block predicate, batch user filtering, and block-aware social queries.
- `lib/live_canvas_gql/schema.ex`: enforces directional hiding for Relay `User` and contact-match node refetches.
- `lib/live_canvas_gql/social/social_resolver.ex`: normalizes social reads/writes and passes viewers into connection queries.
- `lib/live_canvas_gql/accounts/contact_resolver.ex`: filters every contact-match projection through the authenticated viewer.
- `test/live_canvas/social_test.exs`: proves direction and query-level filtering.
- `test/live_canvas_gql/relay/node_queries_test.exs`: proves user/contact Relay node privacy.
- `test/live_canvas_gql/social/social_queries_test.exs`: proves profile-state and social-connection privacy.
- `test/live_canvas_gql/social/social_mutations_test.exs`: proves mutation indistinguishability and no side effects.
- `test/live_canvas_gql/accounts/contact_queries_test.exs`: proves contact discovery filtering.
- `test/live_canvas_gql/accounts/account_mutations_test.exs`: proves contact upsert filtering.
- `mobile/tests/profile/OtherUserProfileScreen.rntl.tsx`: proves null nodes use the generic unavailable screen.
- Lane `NOW.md` files and dashboard: record activation and closure with verification evidence.

---

### Task 1: Add Directional Social Policy and Query Filtering

**Files:**
- Modify: `test/live_canvas/social_test.exs`
- Modify: `lib/live_canvas/social.ex`

**Interfaces:**
- Produces: `Social.blocked_by?(viewer, target) :: boolean()`.
- Produces: `Social.reject_users_blocking_viewer(viewer, users) :: [User.t()]` preserving input order.
- Produces: viewer-aware `follower_users_query/2` and `following_users_query/2`.
- Changes: pending-request list/refetch queries omit requesters who blocked their owner.

- [ ] **Step 1: Write failing directional and query tests**

Add focused tests equivalent to:

```elixir
test "blocked_by?/2 only reports the target-to-viewer direction" do
  viewer = user_fixture()
  target = user_fixture()

  assert {:ok, _block} = Social.block_user(target, viewer)
  assert Social.blocked_by?(viewer, target)
  refute Social.blocked_by?(target, viewer)
end

test "viewer-aware user projections omit users who blocked the viewer" do
  viewer = user_fixture()
  owner = user_fixture(privacy_mode: :public)
  visible = user_fixture()
  hidden = user_fixture()

  assert {:ok, _follow} = Social.follow_user(visible, owner)
  assert {:ok, _follow} = Social.follow_user(hidden, owner)
  assert {:ok, _block} = Social.block_user(hidden, viewer)

  users = owner |> Social.follower_users_query(viewer) |> Social.run_query()
  assert Enum.map(users, & &1.id) == [visible.id]
  assert Social.reject_users_blocking_viewer(viewer, [hidden, visible]) == [visible]
end
```

Extend pending-request tests so a requester who blocks the followed user is absent from both `pending_follow_requests_query/1` and `get_pending_follow_request/2`, while another request remains.

- [ ] **Step 2: Run the tests and verify RED**

Run: `mix test test/live_canvas/social_test.exs`

Expected: compilation failures for the new public functions or assertions showing blocking users remain in projections.

- [ ] **Step 3: Implement the minimal directional policy**

Add public typed helpers with this contract:

```elixir
@spec blocked_by?(User.t(), User.t()) :: boolean()
def blocked_by?(%User{id: blocked_id}, %User{id: blocker_id}) do
  Repo.exists?(
    from block in Block,
      where: block.blocker_id == ^blocker_id and block.blocked_id == ^blocked_id
  )
end

@spec reject_users_blocking_viewer(User.t(), [User.t()]) :: [User.t()]
def reject_users_blocking_viewer(%User{id: viewer_id}, users) when is_list(users) do
  user_ids = Enum.map(users, & &1.id)

  blocking_ids =
    from(block in Block,
      where: block.blocked_id == ^viewer_id and block.blocker_id in ^user_ids,
      select: block.blocker_id
    )
    |> Repo.all()
    |> MapSet.new()

  Enum.reject(users, &MapSet.member?(blocking_ids, &1.id))
end
```

Use directional left joins for `follower_users_query(user, viewer)`, `following_users_query(user, viewer)`, `pending_follow_requests_query/1`, and `get_pending_follow_request/2`. Only exclude rows where the candidate user is the blocker and the authenticated owner/viewer is blocked.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `mix test test/live_canvas/social_test.exs`

Expected: PASS with directionality, visible controls, and stable ordering preserved.

- [ ] **Step 5: Commit the domain milestone**

```bash
git add lib/live_canvas/social.ex test/live_canvas/social_test.exs
git commit -m "fix: add directional block visibility policy"
```

---

### Task 2: Hide Profile Reads and Normalize Social State

**Files:**
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`

**Interfaces:**
- Consumes: `Social.blocked_by?/2` from Task 1.
- Produces: hidden user Relay nodes return `nil`; hidden `relationshipState`/`isMuted` return `NONE`/`false`.

- [ ] **Step 1: Write failing GraphQL profile tests**

Add a Relay-node test in which `target` blocks `viewer`; query `node(id:)` as `viewer` and assert `node: nil`. Add the control where `viewer` blocks `target` and assert the target node is still returned.

Change the relationship-state regression to assert:

```elixir
assert {:ok, %{data: %{"relationshipState" => "NONE"}}} =
         Absinthe.run(query, LCGQL.Schema,
           variables: %{"creatorId" => creator_id},
           context: context
         )
```

Add an `isMuted` case where the viewer muted the target before the target blocks the viewer and assert `false`, matching a missing target.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs`

Expected: the user node remains non-null and `relationshipState` remains `BLOCKED` before implementation.

- [ ] **Step 3: Pass resolution into user-node lookup**

Change the user node branch to call `fetch_user_node(id, resolution)`. After loading the user, use `Resolution.viewer/1`; return `nil` only when an authenticated viewer is `Social.blocked_by?/2` the target. Preserve unauthenticated and viewer-owned-block lookups.

- [ ] **Step 4: Normalize relationship and mute reads**

Add a private resolver helper with the exact behavior:

```elixir
defp fetch_visible_user(user_id, field, viewer) do
  with {:ok, user} <- fetch_user(user_id, field),
       false <- Social.blocked_by?(viewer, user) do
    {:ok, user}
  else
    true -> {:error, {field, :not_found}}
    {:error, _reason} = error -> error
  end
end
```

Use it in `relationship_state/3` and `is_muted/3`. Their existing fallback values become indistinguishable from missing users.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs`

Expected: PASS for target-blocked-viewer hiding and viewer-owned-block compatibility.

- [ ] **Step 6: Commit the profile-read milestone**

```bash
git add lib/live_canvas_gql/schema.ex lib/live_canvas_gql/social/social_resolver.ex test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs
git commit -m "fix: hide blockers from profile reads"
```

---

### Task 3: Close Social Mutation Block Oracles

**Files:**
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`

**Interfaces:**
- Consumes: `fetch_visible_user/3` from Task 2.
- Produces: all user-targeted social mutations return the existing target-field `not_found` payload when the target blocked the actor.

- [ ] **Step 1: Write failing mutation regressions**

For follow, accept, decline, block, mute, and unmute, create a valid target, let that target block the authenticated actor, invoke the mutation, and assert the same payload shape used for a deleted/missing target:

```elixir
%{"errors" => [%{"field" => target_field, "message" => "not_found"}]}
```

For write mutations, assert the attempted reciprocal block/mute/follow row was not created. Preserve positive tests for visible targets.

- [ ] **Step 2: Run mutation tests and verify RED**

Run: `mix test test/live_canvas_gql/social/social_mutations_test.exs`

Expected: follow exposes `blocked`; block/mute can succeed; accept/decline can act on the hidden requester.

- [ ] **Step 3: Enforce visible-target lookup before every write**

Use `fetch_visible_user(target_id, target_field, actor)` in `follow_user/3`, `accept_follow_request/3`, `decline_follow_request/3`, and `run_error_only_user_action/4`. Keep unauthenticated and invalid-ID handling unchanged.

The direction check must run before `Social.follow_user/2`, `block_user/2`, `mute_user/2`, `unmute_user/2`, or pending-request mutation lookup.

- [ ] **Step 4: Run mutation tests and verify GREEN**

Run: `mix test test/live_canvas_gql/social/social_mutations_test.exs`

Expected: PASS; hidden and missing targets share exact error fields/messages and no write occurs.

- [ ] **Step 5: Commit the mutation milestone**

```bash
git add lib/live_canvas_gql/social/social_resolver.ex test/live_canvas_gql/social/social_mutations_test.exs
git commit -m "fix: close social mutation block oracles"
```

---

### Task 4: Filter Social and Contact Discovery Projections

**Files:**
- Modify: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `test/live_canvas_gql/accounts/contact_queries_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/contact_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`

**Interfaces:**
- Consumes: viewer-aware Social queries and `reject_users_blocking_viewer/2` from Task 1.
- Produces: no authenticated connection, request, or contact projection contains a user who blocked the viewer.

- [ ] **Step 1: Write failing discovery tests**

Add tests proving:

- the viewer's own followers/following connections omit a connected user who blocked them while retaining a visible connection;
- `viewerPendingFollowRequests` and follow-request Relay node refetch omit a requester who blocked the request owner;
- contact-match list, upsert payload, and Relay node refetch return `matchedUsers: []` for a matched user who blocked the viewer while retaining visible matches.

- [ ] **Step 2: Run discovery tests and verify RED**

Run:

```bash
mix test test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs
```

Expected: hidden users remain present in at least the connection/contact projections.

- [ ] **Step 3: Pass authenticated viewers into social connection queries**

In `followers/3` and `following/3`, resolve the viewer once. For authenticated allowed reads, call the Task 1 two-argument query. Preserve public unauthenticated connection behavior with the one-argument query. `viewer_pending_follow_requests/3` and follow-request node refetch rely on Task 1's filtered queries.

- [ ] **Step 4: Filter every contact-match projection**

Change `ContactResolver.contact_match_node/2` to accept the viewer and project:

```elixir
matched_users:
  Social.reject_users_blocking_viewer(viewer, contact_match.matched_users)
```

Use the viewer-aware function in contact list queries, contact upsert payloads, and schema contact-match node refetch. Keep the existing scalar projection helper private or explicitly test its new arity.

- [ ] **Step 5: Run discovery tests and verify GREEN**

Run the Task 4 command again.

Expected: PASS with visible controls and pagination shapes unchanged.

- [ ] **Step 6: Commit the discovery milestone**

```bash
git add lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/accounts/contact_resolver.ex lib/live_canvas_gql/schema.ex test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs
git commit -m "fix: filter blockers from user discovery"
```

---

### Task 5: Prove Mobile Behavior, Close Lanes, and Verify

**Files:**
- Modify: `mobile/tests/profile/OtherUserProfileScreen.rntl.tsx`
- Modify: `mobile/tests/profile/ProfilePreviewLinks.rntl.tsx`
- Modify if Relay output changes: `mobile/src/__generated__/OtherUserProfileScreenQuery.graphql.ts`
- Modify: `docs/plans/backend/NOW.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/NOW.md`

**Interfaces:**
- Consumes: hidden user nodes are `null` from Task 2.
- Produces: mobile shows exactly the generic missing-profile state for hidden profiles.

- [ ] **Step 1: Write/update the mobile regression**

Set profile query data to:

```typescript
mockQueryData = {
  isMuted: false,
  node: null,
  relationshipState: 'NONE',
  viewer: { id: 'viewer-id' },
};
```

Assert `This profile is unavailable.` is on screen and that `LiveCanvas user`, privacy labels, relationship text, mute/block controls, live-session actions, and connection links are absent. Replace the old mocked `BLOCKED` user-node test because that response is no longer a valid backend contract for target-blocked-viewer.

- [ ] **Step 2: Run mobile tests and verify GREEN**

From `mobile/`, run:

```bash
bun run test:jest -- tests/profile/OtherUserProfileScreen.rntl.tsx tests/profile/ProfilePreviewLinks.rntl.tsx --runInBand
```

Expected: PASS without production UI changes; the existing null-node branch already renders the correct generic state.

- [ ] **Step 3: Run formatters and generated-contract checks**

Run:

```bash
mix format lib/live_canvas/social.ex lib/live_canvas_gql/schema.ex lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/accounts/contact_resolver.ex test/live_canvas/social_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs
cd mobile && bun run relay
```

Expected: formatter succeeds and Relay output is unchanged unless the query text intentionally changed.

- [ ] **Step 4: Run ordered security and repository verification**

Run, in order:

```bash
mix test test/live_canvas/social_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs
mix typecheck
cd mobile && bun run typecheck && bun run typecheck:tests && bun run lint && bun run test:bun && bun run test:jest -- --runInBand
git diff --check
```

Expected: all commands pass with no warnings or generated drift.

- [ ] **Step 5: Update lane pointers with closure evidence**

Mark the backend and mobile privacy batch complete, cite this plan, record the commands actually run, and return the top-level dashboard to no selected batch. Do not mark deferred unblock/unfollow work complete.

- [ ] **Step 6: Commit the final verified milestone**

```bash
git add mobile/tests/profile/OtherUserProfileScreen.rntl.tsx mobile/tests/profile/ProfilePreviewLinks.rntl.tsx mobile/src/__generated__/OtherUserProfileScreenQuery.graphql.ts docs/plans/backend/NOW.md docs/plans/mobile/NOW.md docs/plans/NOW.md
git commit -m "test: prove blocked profile indistinguishability"
```

- [ ] **Step 7: Perform final diff/security review and publish**

Confirm the final diff contains no unrelated changes, a target who blocks the viewer no longer reproduces the oracle, a viewer-owned block remains visible, and all relevant checks passed. Create a `codex/` branch if needed, push it, and open a non-draft PR unless repository state requires the Codex app handoff.

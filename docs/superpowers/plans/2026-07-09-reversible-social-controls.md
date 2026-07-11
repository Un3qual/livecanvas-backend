# Reversible Social Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direction-safe, idempotent unfollow and unblock contracts and expose tested Unfollow/Unblock actions on other-user mobile profiles.

**Status:** Complete on 2026-07-09. Batch 2 remains planning-only.

**Architecture:** `LC.Social` owns directional follow/block deletion and the outbound-block predicate. GraphQL exposes error-only Relay mutations plus a viewer-derived `isBlockedByViewer` query; mobile combines that direction-safe boolean with the existing effective `relationshipState`, then reuses the current guarded mutation pipeline and route-keyed refresh behavior.

**Tech Stack:** Elixir, Ecto, Absinthe Relay, ExUnit, Expo React Native, TypeScript, React Relay, Bun, Jest/RNTL.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`, Batch 1.
- Existing source plan: `docs/plans/mobile/2026-07-08-mobile-social-controls.md`, Tasks 3-4.
- Durable reads and writes remain Relay-first; global IDs and cursors stay opaque on mobile.
- GraphQL derives the actor from `current_scope` and never accepts a viewer ID.
- `isBlockedByViewer` reports only the authenticated viewer's outbound block; it never reports an inbound block.
- Unfollow and unblock are idempotent and delete only the actor-to-target row.
- Unblocking does not delete or recreate follow rows. The refreshed effective relationship may therefore be `ACCEPTED`, `REQUESTED`, `PUBLIC`, `NONE`, or generically unavailable.
- Invalid global IDs, missing target rows, and unauthorized actions with
  structurally valid inputs return payload errors; schema validation still
  enforces required inputs.
- Public backend functions receive typespecs and typed backend changes run `mix typecheck`.
- Mobile tests stay under `mobile/tests/**`; no tests are added under `mobile/src/**`.
- Do not add a migration, new table, raw foreign-key API, or general inbound-block field.

---

## Executor Brief

Start with Task 1 only. Backend Tasks 1-2 establish and export the contract;
mobile Tasks 3-4 consume it; Task 5 runs the complete gates and closes both
lane pointers. Keep each task in its own milestone commit and do not begin the
next task until the current task's focused verification passes. The immediate
write scope is `lib/live_canvas/social.ex` plus
`test/live_canvas/social_test.exs`; no mobile file is touched before Task 2
exports `mobile/schema.graphql`.

---

## File Structure

### Backend domain and GraphQL

- Modify `lib/live_canvas/social.ex`: directional unfollow, unblock, and outbound-block predicate.
- Modify `lib/live_canvas_gql/social/social_resolver.ex`: viewer-scoped mutation and query resolvers.
- Modify `lib/live_canvas_gql/social/social_mutations.ex`: Relay `unfollowUser` and `unblockUser` payloads.
- Modify `lib/live_canvas_gql/social/social_queries.ex`: `isBlockedByViewer(creatorId:)`.
- Modify `test/live_canvas/social_test.exs`: directional/idempotent domain coverage.
- Modify `test/live_canvas_gql/social/social_mutations_test.exs`: Relay mutation and error coverage.
- Modify `test/live_canvas_gql/social/social_queries_test.exs`: outbound-versus-inbound privacy matrix.
- Modify `mobile/schema.graphql`: exported backend schema consumed by Relay.

### Mobile presentation and integration

- Modify `mobile/src/profile/relationshipPresentation.ts`: Unfollow/Unblock action model and safe blocked copy.
- Modify `mobile/src/profile/socialControlOperations.ts`: Relay mutation documents.
- Modify `mobile/src/profile/other/otherUserProfileRouteState.ts`: profile-keyed partial relationship override.
- Modify `mobile/src/profile/other/OtherUserProfileScreen.tsx`: query field, mutation hooks, guarded submissions, and confirmed refresh behavior.
- Modify generated files under `mobile/src/__generated__/**`: Relay artifacts only.
- Modify `mobile/tests/profile/relationshipPresentation.test.ts`: pure action matrix.
- Modify `mobile/tests/profile/OtherUserProfileScreen.test.ts`: route override helper coverage.
- Modify `mobile/tests/profile/OtherUserProfileScreen.rntl.tsx`: mutation, privacy, duplicate-tap, and UI integration coverage.

### Planning closure

- Modify `docs/plans/NOW.md`, `docs/plans/backend/NOW.md`, `docs/plans/mobile/NOW.md`, `docs/plans/mobile/TRACK.md`, and `docs/plans/INDEX.md` only at final batch closure.
- Modify `docs/plans/mobile/2026-07-08-mobile-social-controls.md` to mark Tasks 3-4 complete only after final verification.

---

### Task 1: Add Directional Domain Operations

**Files:**
- Modify: `lib/live_canvas/social.ex:17-136`
- Test: `test/live_canvas/social_test.exs:27-60`

**Interfaces:**
- Consumes: `%LCSchemas.Accounts.User{}` actor and target structs.
- Produces: `LC.Social.unfollow_user/2 :: :ok`, `LC.Social.unblock_user/2 :: :ok`, and `LC.Social.blocked_by_viewer?/2 :: boolean()`.

- [x] **Step 1: Write failing directional and idempotency tests**

Add this describe block after the existing mute-control tests:

```elixir
describe "reversible relationship controls" do
  test "unfollow_user/2 removes only the viewer's directional follow and is idempotent" do
    viewer = user_fixture(privacy_mode: :public)
    creator = user_fixture(privacy_mode: :public)

    assert {:ok, _viewer_follow} = Social.follow_user(viewer, creator)
    assert {:ok, _reverse_follow} = Social.follow_user(creator, viewer)
    assert Social.relationship_state(viewer, creator) == :accepted
    assert Social.relationship_state(creator, viewer) == :accepted

    assert :ok = Social.unfollow_user(viewer, creator)
    assert Social.relationship_state(viewer, creator) == :public
    assert Social.relationship_state(creator, viewer) == :accepted

    assert :ok = Social.unfollow_user(viewer, creator)
    assert Social.relationship_state(viewer, creator) == :public
  end

  test "unblock_user/2 removes only the viewer's outbound block and is idempotent" do
    viewer = user_fixture(privacy_mode: :public)
    creator = user_fixture(privacy_mode: :public)

    assert {:ok, _outbound_block} = Social.block_user(viewer, creator)
    assert {:ok, _inbound_block} = Social.block_user(creator, viewer)
    assert Social.blocked_by_viewer?(viewer, creator)
    assert Social.blocked_by_viewer?(creator, viewer)

    assert :ok = Social.unblock_user(viewer, creator)
    refute Social.blocked_by_viewer?(viewer, creator)
    assert Social.blocked_by_viewer?(creator, viewer)
    assert Social.relationship_state(viewer, creator) == :blocked

    assert :ok = Social.unblock_user(viewer, creator)
    refute Social.blocked_by_viewer?(viewer, creator)
  end
end
```

- [x] **Step 2: Run the focused domain tests and verify the new tests fail**

Run:

```bash
mix test test/live_canvas/social_test.exs
```

Expected: FAIL because `LC.Social.unfollow_user/2`, `unblock_user/2`, and `blocked_by_viewer?/2` are undefined.

- [x] **Step 3: Implement the minimal directional operations**

Add result types beside the current mute result types:

```elixir
@type unfollow_result :: :ok
@type unblock_result :: :ok
```

Add these public functions after `block_user/2` and before mute controls:

```elixir
@doc """
Removes the authenticated follower's directional relationship to a user.
"""
@spec unfollow_user(User.t(), User.t()) :: unfollow_result()
def unfollow_user(%User{id: follower_id}, %User{id: followed_id}) do
  from(follow in Follow,
    where: follow.follower_id == ^follower_id and follow.followed_id == ^followed_id
  )
  |> Repo.delete_all()

  :ok
end

@doc """
Removes the authenticated blocker's directional block of a user.
"""
@spec unblock_user(User.t(), User.t()) :: unblock_result()
def unblock_user(%User{id: blocker_id}, %User{id: blocked_id}) do
  from(block in Block,
    where: block.blocker_id == ^blocker_id and block.blocked_id == ^blocked_id
  )
  |> Repo.delete_all()

  :ok
end

@doc """
Returns whether the viewer has an outbound block against the target user.
"""
@spec blocked_by_viewer?(User.t(), User.t()) :: boolean()
def blocked_by_viewer?(%User{id: blocker_id}, %User{id: blocked_id}) do
  Repo.exists?(
    from block in Block,
      where: block.blocker_id == ^blocker_id and block.blocked_id == ^blocked_id
  )
end
```

Do not reuse `blocked_between?/2`; that helper is intentionally bidirectional and would leak inbound block state.

- [x] **Step 4: Format and rerun the focused domain tests**

Run:

```bash
mix format lib/live_canvas/social.ex test/live_canvas/social_test.exs
mix test test/live_canvas/social_test.exs
```

Expected: PASS with zero failures.

- [x] **Step 5: Commit the domain milestone**

```bash
git add lib/live_canvas/social.ex test/live_canvas/social_test.exs
git commit -m "feat: add reversible social domain controls"
```

Execution evidence (2026-07-09):

- RED: `mix test test/live_canvas/social_test.exs` -> 13 tests, 2 failures for
  undefined `unfollow_user/2`, `unblock_user/2`, and `blocked_by_viewer?/2`.
- GREEN: the same command -> 13 tests, 0 failures.

---

### Task 2: Expose The Relay GraphQL Contract

**Files:**
- Modify: `lib/live_canvas_gql/social/social_resolver.ex:6-144`
- Modify: `lib/live_canvas_gql/social/social_mutations.ex:46-81`
- Modify: `lib/live_canvas_gql/social/social_queries.ex:7-25`
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`
- Modify: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify: `mobile/schema.graphql`

**Interfaces:**
- Consumes: Task 1's `Social.unfollow_user/2`, `Social.unblock_user/2`, and `Social.blocked_by_viewer?/2`.
- Produces: Relay mutations `unfollowUser(input: {followedId})`, `unblockUser(input: {blockedId})`, and query `isBlockedByViewer(creatorId:) -> Boolean!`.

- [x] **Step 1: Write failing mutation tests**

Add these describe blocks to `social_mutations_test.exs`:

```elixir
describe "unfollowUser" do
  test "uses the authenticated viewer, preserves the reverse follow, and is idempotent" do
    viewer = user_fixture(privacy_mode: :public)
    followed = user_fixture(privacy_mode: :public)
    context = %{current_scope: Accounts.scope_for_user(viewer)}
    followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

    assert {:ok, _follow} = Social.follow_user(viewer, followed)
    assert {:ok, _reverse_follow} = Social.follow_user(followed, viewer)

    mutation = """
    mutation($followedId: ID!) {
      unfollowUser(input: {followedId: $followedId}) {
        errors { field message }
      }
    }
    """

    for _attempt <- 1..2 do
      assert {:ok, %{data: %{"unfollowUser" => %{"errors" => []}}}} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"followedId" => followed_id},
                 context: context
               )
    end

    assert Social.relationship_state(viewer, followed) == :public
    assert Social.relationship_state(followed, viewer) == :accepted
  end

  test "returns a field error for an invalid followedId and an auth error without scope" do
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    mutation = """
    mutation($followedId: ID!) {
      unfollowUser(input: {followedId: $followedId}) {
        errors { field message }
      }
    }
    """

    assert {:ok,
            %{data: %{"unfollowUser" => %{"errors" => [%{"field" => "followedId"}]}}}} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"followedId" => "123"},
               context: context
             )

    followed = user_fixture()
    followed_id = Absinthe.Relay.Node.to_global_id(:user, followed.id, LCGQL.Schema)

    assert {:ok,
            %{
              data: %{
                "unfollowUser" => %{
                  "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema, variables: %{"followedId" => followed_id})
  end
end

describe "unblockUser" do
  test "removes only the viewer's outbound block and is idempotent" do
    viewer = user_fixture()
    blocked = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}
    blocked_id = Absinthe.Relay.Node.to_global_id(:user, blocked.id, LCGQL.Schema)

    assert {:ok, _outbound_block} = Social.block_user(viewer, blocked)
    assert {:ok, _inbound_block} = Social.block_user(blocked, viewer)

    mutation = """
    mutation($blockedId: ID!) {
      unblockUser(input: {blockedId: $blockedId}) {
        errors { field message }
      }
    }
    """

    for _attempt <- 1..2 do
      assert {:ok, %{data: %{"unblockUser" => %{"errors" => []}}}} =
               Absinthe.run(mutation, LCGQL.Schema,
                 variables: %{"blockedId" => blocked_id},
                 context: context
               )
    end

    refute Social.blocked_by_viewer?(viewer, blocked)
    assert Social.blocked_by_viewer?(blocked, viewer)
  end

  test "returns a field error for invalid blockedId and unauthenticated without scope" do
    viewer = user_fixture()
    blocked = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}
    blocked_id = Absinthe.Relay.Node.to_global_id(:user, blocked.id, LCGQL.Schema)

    mutation = """
    mutation($blockedId: ID!) {
      unblockUser(input: {blockedId: $blockedId}) {
        errors { field message }
      }
    }
    """

    assert {:ok,
            %{data: %{"unblockUser" => %{"errors" => [%{"field" => "blockedId"}]}}}} =
             Absinthe.run(mutation, LCGQL.Schema,
               variables: %{"blockedId" => "123"},
               context: context
             )

    assert {:ok,
            %{
              data: %{
                "unblockUser" => %{
                  "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                }
              }
            }} =
             Absinthe.run(mutation, LCGQL.Schema, variables: %{"blockedId" => blocked_id})
  end
end
```

Extend the schema-cleanup assertion:

```elixir
refute schema_sdl =~ "UnfollowUserPayload {\n  successful: Boolean!"
refute schema_sdl =~ "UnblockUserPayload {\n  successful: Boolean!"
```

- [x] **Step 2: Write the failing direction-safe query tests**

Add this block to `social_queries_test.exs`:

```elixir
describe "isBlockedByViewer" do
  test "reports only the authenticated viewer's outbound block" do
    viewer = user_fixture()
    outbound_target = user_fixture()
    inbound_blocker = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    assert {:ok, _block} = Social.block_user(viewer, outbound_target)
    assert {:ok, _reverse_block} = Social.block_user(inbound_blocker, viewer)

    query = """
    query($outboundId: ID!, $inboundId: ID!) {
      outbound: isBlockedByViewer(creatorId: $outboundId)
      inbound: isBlockedByViewer(creatorId: $inboundId)
    }
    """

    variables = %{
      "outboundId" => Absinthe.Relay.Node.to_global_id(:user, outbound_target.id, LCGQL.Schema),
      "inboundId" => Absinthe.Relay.Node.to_global_id(:user, inbound_blocker.id, LCGQL.Schema)
    }

    assert {:ok, %{data: %{"outbound" => true, "inbound" => false}}} =
             Absinthe.run(query, LCGQL.Schema, variables: variables, context: context)
  end

  test "returns false without authentication and for invalid IDs" do
    creator = user_fixture()
    creator_id = Absinthe.Relay.Node.to_global_id(:user, creator.id, LCGQL.Schema)
    viewer = user_fixture()
    context = %{current_scope: Accounts.scope_for_user(viewer)}

    query = """
    query($creatorId: ID!) {
      isBlockedByViewer(creatorId: $creatorId)
    }
    """

    assert {:ok, %{data: %{"isBlockedByViewer" => false}}} =
             Absinthe.run(query, LCGQL.Schema, variables: %{"creatorId" => creator_id})

    assert {:ok, %{data: %{"isBlockedByViewer" => false}}} =
             Absinthe.run(query, LCGQL.Schema,
               variables: %{"creatorId" => "123"},
               context: context
             )
  end
end
```

- [x] **Step 3: Run the focused GraphQL tests and verify they fail**

Run:

```bash
mix test test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs
```

Expected: FAIL because the fields do not exist in the schema.

- [x] **Step 4: Add the resolver functions**

Add mutation resolvers beside the current block/mute resolvers:

```elixir
@spec unfollow_user(any(), %{followed_id: term()}, any()) ::
        {:ok, error_only_result_payload()}
def unfollow_user(_parent, args, resolution) do
  error_only_user_action(args, resolution, :followed_id, &Social.unfollow_user/2)
end

@spec unblock_user(any(), %{blocked_id: term()}, any()) ::
        {:ok, error_only_result_payload()}
def unblock_user(_parent, args, resolution) do
  error_only_user_action(args, resolution, :blocked_id, &Social.unblock_user/2)
end
```

Add the viewer-derived query resolver after `is_muted/3`:

```elixir
@spec is_blocked_by_viewer(any(), %{creator_id: term()}, Absinthe.Resolution.t()) ::
        {:ok, boolean()}
def is_blocked_by_viewer(_parent, %{creator_id: creator_id}, resolution) do
  with {:ok, viewer} <- Resolution.viewer(resolution),
       {:ok, creator} <- fetch_user(creator_id, :creator_id) do
    {:ok, Social.blocked_by_viewer?(viewer, creator)}
  else
    _ -> {:ok, false}
  end
end
```

- [x] **Step 5: Add the schema fields**

Add to `social_mutations.ex`:

```elixir
payload field :unfollow_user do
  input do
    field :followed_id, non_null(:id)
  end

  output do
    field :errors, non_null(list_of(non_null(:user_error)))
  end

  resolve(&Resolver.unfollow_user/3)
end

payload field :unblock_user do
  input do
    field :blocked_id, non_null(:id)
  end

  output do
    field :errors, non_null(list_of(non_null(:user_error)))
  end

  resolve(&Resolver.unblock_user/3)
end
```

Add to `social_queries.ex` after `is_muted`:

```elixir
field :is_blocked_by_viewer, non_null(:boolean) do
  arg(:creator_id, non_null(:id))

  resolve(&Resolver.is_blocked_by_viewer/3)
end
```

- [x] **Step 6: Format and run the complete focused backend suite**

Run:

```bash
mix format lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/social/social_mutations.ex lib/live_canvas_gql/social/social_queries.ex test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs
mix test test/live_canvas/social_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs
mix typecheck
```

Expected: all tests pass with zero failures and typecheck exits zero.

- [x] **Step 7: Export the schema and verify the exact public contract**

Run from the repository root:

```bash
mix absinthe.schema.sdl --schema LCGQL.Schema mobile/schema.graphql
rg -n "isBlockedByViewer|unfollowUser|unblockUser|input UnfollowUserInput|input UnblockUserInput" mobile/schema.graphql
```

Expected: the query, both mutations, and both Relay input types appear. Confirm there is no inbound-block query and no `successful` payload field.

- [x] **Step 8: Commit the GraphQL contract milestone**

```bash
git add lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/social/social_mutations.ex lib/live_canvas_gql/social/social_queries.ex test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs mobile/schema.graphql
git commit -m "feat: expose reversible social GraphQL contracts"
```

Execution evidence (2026-07-09):

- RED: focused GraphQL suite -> 36 tests, 6 failures for absent
  `unfollowUser`, `unblockUser`, and `isBlockedByViewer` fields.
- GREEN: backend domain/GraphQL suite -> 49 tests, 0 failures.
- `mix typecheck` -> 0 errors.
- Schema export succeeded; `mobile/schema.graphql` contains the query, both
  mutations, and both Relay input types.

---

### Task 3: Add Mobile Presentation And Relay Operations

**Files:**
- Modify: `mobile/src/profile/relationshipPresentation.ts`
- Modify: `mobile/src/profile/socialControlOperations.ts`
- Modify: `mobile/src/profile/other/OtherUserProfileScreen.tsx` only to pass a
  temporary explicit `isBlockedByViewer: false` until Task 4 wires the query.
- Modify: `mobile/tests/profile/relationshipPresentation.test.ts`
- Modify generated files under: `mobile/src/__generated__/**`

**Interfaces:**
- Consumes: Task 2's Relay schema fields.
- Produces: `RelationshipActionKind` values `unfollow` and `unblock`, direction-aware `describeRelationshipState`, and Relay mutation documents.

- [x] **Step 1: Write the failing pure presentation tests**

Update every existing `describeRelationshipState` call to pass `isBlockedByViewer: false`, then replace the accepted and blocked tests with:

```typescript
test('offers unfollow for an accepted outbound relationship', () => {
  expect(
    describeRelationshipState({
      isBlockedByViewer: false,
      isMuted: false,
      state: 'ACCEPTED',
    }),
  ).toEqual({
    actionLabel: null,
    canFollow: false,
    label: 'Following',
    socialActions: [
      { destructive: false, kind: 'unfollow', label: 'Unfollow' },
      { destructive: false, kind: 'mute', label: 'Mute' },
      { destructive: true, kind: 'block', label: 'Block' },
    ],
    status: 'You follow this profile.',
  });
});

test('offers unblock only for the viewer outbound block direction', () => {
  expect(
    describeRelationshipState({
      isBlockedByViewer: true,
      isMuted: false,
      state: 'BLOCKED',
    }),
  ).toEqual({
    actionLabel: null,
    canFollow: false,
    label: 'Blocked',
    socialActions: [
      { destructive: false, kind: 'unblock', label: 'Unblock' },
    ],
    status: 'You blocked this profile.',
  });

  expect(
    describeRelationshipState({
      isBlockedByViewer: false,
      isMuted: false,
      state: 'BLOCKED',
    }),
  ).toEqual({
    actionLabel: null,
    canFollow: false,
    label: 'Unavailable',
    socialActions: [],
    status: 'This profile is not available.',
  });
});
```

- [x] **Step 2: Run the pure tests and verify they fail**

Run from `mobile/`:

```bash
bun test tests/profile/relationshipPresentation.test.ts
```

Expected: FAIL because the direction flag and new actions are not implemented.

- [x] **Step 3: Implement the direction-aware presentation model**

Expand the action type:

```typescript
export type RelationshipActionKind =
  | 'block'
  | 'follow'
  | 'mute'
  | 'unblock'
  | 'unfollow'
  | 'unmute';
```

Require `isBlockedByViewer` in `describeRelationshipState` and pass it to the action helper:

```typescript
export function describeRelationshipState({
  isBlockedByViewer,
  isMuted,
  isSelf = false,
  state,
}: {
  isBlockedByViewer: boolean;
  isMuted: boolean;
  isSelf?: boolean;
  state: RelationshipState;
}): RelationshipDescription {
  if (isSelf) {
    return {
      actionLabel: null,
      canFollow: false,
      label: 'Your profile',
      socialActions: [],
      status: 'This is your profile.',
    };
  }

  const socialActions = relationshipSocialActions({
    isBlocked: state === 'BLOCKED',
    isBlockedByViewer,
    isFollowing: state === 'ACCEPTED',
    isMuted,
  });

  switch (state) {
    case 'PUBLIC':
      return {
        actionLabel: 'Follow',
        canFollow: true,
        label: 'Public profile',
        socialActions,
        status: 'You can follow this profile.',
      };

    case 'NONE':
      return {
        actionLabel: 'Request follow',
        canFollow: true,
        label: 'Not following',
        socialActions,
        status: 'Send a follow request to see protected activity.',
      };

    case 'REQUESTED':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Request pending',
        socialActions,
        status: 'Your follow request is waiting for approval.',
      };

    case 'ACCEPTED':
      return {
        actionLabel: null,
        canFollow: false,
        label: 'Following',
        socialActions,
        status: isMuted
          ? 'You follow this profile. Notifications are muted.'
          : 'You follow this profile.',
      };

    case 'BLOCKED':
      return isBlockedByViewer
        ? {
            actionLabel: null,
            canFollow: false,
            label: 'Blocked',
            socialActions,
            status: 'You blocked this profile.',
          }
        : {
            actionLabel: null,
            canFollow: false,
            label: 'Unavailable',
            socialActions: [],
            status: 'This profile is not available.',
          };

    case '%future added value':
      return unavailableRelationshipDescription;

    default:
      return unavailableRelationshipDescription;
  }
}
```

Replace `relationshipSocialActions` with:

```typescript
function relationshipSocialActions({
  isBlocked,
  isBlockedByViewer,
  isFollowing,
  isMuted,
}: {
  isBlocked: boolean;
  isBlockedByViewer: boolean;
  isFollowing: boolean;
  isMuted: boolean;
}): ReadonlyArray<RelationshipAction> {
  if (isBlocked) {
    return isBlockedByViewer
      ? [{ destructive: false, kind: 'unblock', label: 'Unblock' }]
      : [];
  }

  return [
    ...(isFollowing
      ? [{ destructive: false, kind: 'unfollow', label: 'Unfollow' } as const]
      : []),
    {
      destructive: false,
      kind: isMuted ? 'unmute' : 'mute',
      label: isMuted ? 'Unmute' : 'Mute',
    },
    { destructive: true, kind: 'block', label: 'Block' },
  ];
}
```

- [x] **Step 4: Add Relay mutation documents**

Append to `socialControlOperations.ts`:

```typescript
export const socialControlUnfollowUserMutation = graphql`
  mutation socialControlOperationsUnfollowUserMutation(
    $input: UnfollowUserInput!
  ) {
    unfollowUser(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;

export const socialControlUnblockUserMutation = graphql`
  mutation socialControlOperationsUnblockUserMutation(
    $input: UnblockUserInput!
  ) {
    unblockUser(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;
```

- [x] **Step 5: Generate Relay artifacts and rerun the pure tests**

Run from `mobile/`:

```bash
bun run relay
bun test tests/profile/relationshipPresentation.test.ts
bun run typecheck
```

Expected: Relay generates both new mutation artifacts; the pure tests and typecheck pass.

- [x] **Step 6: Commit the presentation/operation milestone**

```bash
git add mobile/src/profile/relationshipPresentation.ts mobile/src/profile/socialControlOperations.ts mobile/src/profile/other/OtherUserProfileScreen.tsx mobile/src/__generated__ mobile/tests/profile/relationshipPresentation.test.ts
git commit -m "feat(mobile): model reversible social actions"
```

Execution evidence (2026-07-09):

- RED: pure presentation suite -> 7 tests, 2 failures for missing Unfollow and
  direction-safe Unblock actions.
- Relay initially failed because sandboxed Watchman could not update its state
  directory; the exact command succeeded outside the sandbox and generated the
  two mutation artifacts.
- The first typecheck correctly caught that the existing screen did not yet
  supply the newly required direction flag. Task 3 keeps the type strict and
  passes explicit `false`; Task 4 replaces it with the GraphQL value.
- GREEN: pure presentation suite -> 7 tests, 0 failures; existing profile RNTL
  suite -> 5 tests, 0 failures; `bun run typecheck` -> passed.

---

### Task 4: Wire Unfollow And Unblock Into Other-User Profiles

**Files:**
- Modify: `mobile/src/profile/other/otherUserProfileRouteState.ts`
- Modify: `mobile/src/profile/other/OtherUserProfileScreen.tsx`
- Modify: `mobile/tests/profile/OtherUserProfileScreen.test.ts`
- Modify: `mobile/tests/profile/OtherUserProfileScreen.rntl.tsx`
- Modify: `mobile/src/__generated__/OtherUserProfileScreenQuery.graphql.ts`

**Interfaces:**
- Consumes: Task 3's action kinds and mutation documents.
- Produces: profile-keyed partial overrides and guarded, viewer-safe Unfollow/Unblock UI behavior.

- [x] **Step 1: Write failing route-override helper tests**

Replace the state helper test's override assertions with:

```typescript
test('uses partial relationship overrides only for the active profile id', () => {
  const override = {
    isBlockedByViewer: false,
    profileId: 'profile-1',
    state: null,
  } as const;

  expect(selectActiveRelationshipViewOverride(override, 'profile-1')).toEqual(
    override,
  );
  expect(
    selectActiveRelationshipViewOverride(override, 'profile-2'),
  ).toBeNull();
});
```

- [x] **Step 2: Write failing RNTL integration tests**

Add `mockUnfollowCommit` and `mockUnblockCommit` to the existing mutation mocks. Route them by operation name exactly as the mute/block commits are routed. Add `isBlockedByViewer` to `profileQueryData` and its input.

Add these tests:

```typescript
test('unfollows with the opaque Relay ID and blocks a same-tick second action', async () => {
  const user = userEvent.setup();
  mockQueryData = profileQueryData({
    isBlockedByViewer: false,
    isMuted: false,
    relationshipState: 'ACCEPTED',
  });

  await render(<OtherUserProfileScreen id="opaque-profile-id" />);

  const unfollow = screen.getByRole('button', { name: 'Unfollow' });
  const staleMute = screen.getByRole('button', { name: 'Mute' });
  await fireEvent.press(unfollow);
  await fireEvent.press(staleMute);

  expect(mockUnfollowCommit).toHaveBeenCalledTimes(1);
  expect(mockUnfollowCommit.mock.calls[0]?.[0].variables).toEqual({
    input: { followedId: 'opaque-profile-id' },
  });
  expect(mockMuteCommit).not.toHaveBeenCalled();

  await completeMutation(mockUnfollowCommit, {
    unfollowUser: { errors: [] },
  });

  expect(screen.getByText('You can follow this profile.')).toBeOnTheScreen();
});

test('ignores an unfollow completion after navigation changes the profile id', async () => {
  const user = userEvent.setup();
  mockQueryData = profileQueryData({
    isBlockedByViewer: false,
    isMuted: false,
    profileId: 'profile-1',
    relationshipState: 'ACCEPTED',
  });

  const view = await render(<OtherUserProfileScreen id="profile-1" />);
  await user.press(screen.getByRole('button', { name: 'Unfollow' }));

  mockQueryData = profileQueryData({
    isBlockedByViewer: false,
    isMuted: false,
    profileId: 'profile-2',
    relationshipState: 'ACCEPTED',
  });
  view.rerender(<OtherUserProfileScreen id="profile-2" />);

  await completeMutation(mockUnfollowCommit, {
    unfollowUser: { errors: [] },
  });

  expect(screen.getByText('You follow this profile.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unfollow' })).toBeOnTheScreen();
});

test('shows unblock only for an outbound block and submits the opaque Relay ID', async () => {
  const user = userEvent.setup();
  mockQueryData = profileQueryData({
    isBlockedByViewer: true,
    isMuted: false,
    relationshipState: 'BLOCKED',
  });

  await render(<OtherUserProfileScreen id="opaque-profile-id" />);
  await user.press(screen.getByRole('button', { name: 'Unblock' }));

  expect(mockUnblockCommit).toHaveBeenCalledTimes(1);
  expect(mockUnblockCommit.mock.calls[0]?.[0].variables).toEqual({
    input: { blockedId: 'opaque-profile-id' },
  });

  await completeMutation(mockUnblockCommit, {
    unblockUser: { errors: [] },
  });

  expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull();
  expect(screen.getByText('This profile is not available.')).toBeOnTheScreen();
});

test('does not expose unblock for an inbound-only block', async () => {
  mockQueryData = profileQueryData({
    isBlockedByViewer: false,
    isMuted: false,
    relationshipState: 'BLOCKED',
  });

  await render(<OtherUserProfileScreen id="opaque-profile-id" />);

  expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull();
  expect(screen.getByText('This profile is not available.')).toBeOnTheScreen();
});

test('keeps unblock payload errors local and retryable', async () => {
  const user = userEvent.setup();
  mockQueryData = profileQueryData({
    isBlockedByViewer: true,
    isMuted: false,
    relationshipState: 'BLOCKED',
  });

  await render(<OtherUserProfileScreen id="opaque-profile-id" />);
  await user.press(screen.getByRole('button', { name: 'Unblock' }));
  await completeMutation(mockUnblockCommit, {
    unblockUser: {
      errors: [{ field: 'blockedId', message: 'not_found' }],
    },
  });

  expect(screen.getByText('blockedId: not_found')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Unblock' }));
  expect(mockUnblockCommit).toHaveBeenCalledTimes(2);
});
```

Update the existing block test to expect the confirmation copy `Block this profile? You can unblock it later.` and, after success, `You blocked this profile.` plus an enabled `Unblock` action. Update `profileQueryData` to accept `profileId` with default `opaque-profile-id`, return that value as `node.id`, and return the required `isBlockedByViewer` field:

```typescript
function profileQueryData({
  isBlockedByViewer,
  isMuted,
  profileId = 'opaque-profile-id',
  relationshipState,
}: {
  isBlockedByViewer: boolean;
  isMuted: boolean;
  profileId?: string;
  relationshipState: string;
}) {
  return {
    isBlockedByViewer,
    isMuted,
    node: {
      __typename: 'User',
      currentLiveSession: null,
      followers: connection([]),
      following: connection([]),
      id: profileId,
      privacyMode: 'PUBLIC',
    },
    relationshipState,
    viewer: { id: 'viewer-id' },
  };
}
```

Pass `isBlockedByViewer: false` at every existing helper call that represents an ordinary profile.

- [x] **Step 3: Run the focused tests and verify they fail**

Run from `mobile/`:

```bash
bun test tests/profile/OtherUserProfileScreen.test.ts tests/profile/relationshipPresentation.test.ts
pnpm exec jest --config ./jest.config.js tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand
```

Expected: FAIL because the query field, partial override, mutation hooks, and handlers are absent.

- [x] **Step 4: Implement the profile-keyed partial override**

Replace `RelationshipStateOverride` with:

```typescript
import type { RelationshipState } from '../relationshipPresentation';

export type RelationshipViewOverride = {
  readonly isBlockedByViewer: boolean | null;
  readonly profileId: string;
  readonly state: RelationshipState | null;
};

export function otherUserProfileScreenResetKey(
  profileId: string,
  queryRetryKey: number,
): string {
  return `${profileId}:${queryRetryKey}`;
}

export function selectActiveRelationshipViewOverride(
  override: RelationshipViewOverride | null,
  profileId: string,
): RelationshipViewOverride | null {
  return override?.profileId === profileId ? override : null;
}
```

The nullable fields are deliberate: after unblock, the client knows the outbound block is gone but must refetch the effective relationship instead of guessing whether a follow row or inbound block remains.

- [x] **Step 5: Extend the profile query and mutation hooks**

Add to `OtherUserProfileScreenQuery` beside `isMuted`:

```graphql
isBlockedByViewer(creatorId: $id)
```

Import both mutation documents and generated types. Add hooks:

```typescript
const [commitUnfollowUser, isUnfollowUserMutationInFlight] =
  useMutation<socialControlOperationsUnfollowUserMutation>(
    socialControlUnfollowUserMutation,
  );
const [commitUnblockUser, isUnblockUserMutationInFlight] =
  useMutation<socialControlOperationsUnblockUserMutation>(
    socialControlUnblockUserMutation,
  );
```

Include both in `isRelationshipActionInFlight`.

- [x] **Step 6: Apply the active partial override to presentation**

Rename the parent state to `relationshipViewOverride`. Pass the active object to the content component. The parent success callback must retain the current-profile guard:

```typescript
const handleRelationshipMutationSuccess = (
  profileId: string,
  override: Omit<RelationshipViewOverride, 'profileId'>,
) => {
  if (currentProfileIdRef.current !== profileId) {
    return;
  }

  setRelationshipViewOverride({ profileId, ...override });
  retryQuery();
};
```

Inside `OtherUserProfileContent`, derive presentation values as:

```typescript
const relationshipState =
  relationshipViewOverride?.state ?? data.relationshipState;
const isBlockedByViewer =
  relationshipViewOverride?.isBlockedByViewer ?? data.isBlockedByViewer;
const isMuted = isMutedOverride ?? data.isMuted;
const relationship = describeRelationshipState({
  isBlockedByViewer,
  isMuted,
  isSelf: data.viewer?.id === user.id,
  state: relationshipState,
});
```

On successful follow, call:

```typescript
onRelationshipMutationSuccess(id, {
  isBlockedByViewer: false,
  state: result.follow.state,
});
```

- [x] **Step 7: Wire unfollow and unblock through the guarded action switch**

Add cases to `commitSocialControl`:

```typescript
case 'unfollow':
  commitUnfollowUser({
    variables: { input: { followedId: user.id } },
    onCompleted: (payload) => {
      completeSocialControl('unfollow', payload.unfollowUser);
    },
    onError: failSocialControl,
  });
  return;

case 'unblock':
  commitUnblockUser({
    variables: { input: { blockedId: user.id } },
    onCompleted: (payload) => {
      completeSocialControl('unblock', payload.unblockUser);
    },
    onError: failSocialControl,
  });
  return;
```

Extend `completeSocialControl` after mute/unmute handling:

```typescript
if (action === 'unfollow') {
  onRelationshipMutationSuccess(id, {
    isBlockedByViewer: false,
    state: user.privacyMode === 'PUBLIC' ? 'PUBLIC' : 'NONE',
  });
  return;
}

if (action === 'unblock') {
  onRelationshipMutationSuccess(id, {
    isBlockedByViewer: false,
    state: null,
  });
  return;
}

onRelationshipMutationSuccess(id, {
  isBlockedByViewer: true,
  state: 'BLOCKED',
});
```

Change the block confirmation copy to:

```tsx
<Text style={[styles.bodyText, { color: theme.colors.text }]}>
  Block this profile? You can unblock it later.
</Text>
```

In the actual source, put the text on its own indented line as shown; JSX collapses that formatting to the exact sentence asserted by the test.

- [x] **Step 8: Regenerate Relay and run focused verification**

Run from `mobile/`:

```bash
bun run relay
bun test tests/profile/OtherUserProfileScreen.test.ts tests/profile/relationshipPresentation.test.ts
pnpm exec jest --config ./jest.config.js tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand
bun run typecheck
bun run typecheck:tests
```

Expected: Relay generates the updated query artifact; all focused tests and both typechecks pass.

- [x] **Step 9: Commit the mobile integration milestone**

```bash
git add mobile/src/profile/other/otherUserProfileRouteState.ts mobile/src/profile/other/OtherUserProfileScreen.tsx mobile/src/__generated__ mobile/tests/profile/OtherUserProfileScreen.test.ts mobile/tests/profile/OtherUserProfileScreen.rntl.tsx
git commit -m "feat(mobile): add unfollow and unblock controls"
```

Execution evidence (2026-07-09):

- RED: the route helper suite failed because
  `selectActiveRelationshipViewOverride` was not exported; the RNTL suite
  passed 5 existing tests and failed 5 new behavior assertions for absent
  Unfollow/Unblock wiring and old block copy.
- Relay regenerated 48 reader, 44 normalization, and 44 operation documents.
- The route-change test exposed that this RNTL version returns an asynchronous
  `rerender`; awaiting it removed overlapping `act()` scopes without changing
  production behavior.
- GREEN: the pure route/presentation suites passed 9 tests; the profile RNTL
  suite passed 11 tests, including a review-added A -> B -> A stale-completion
  regression; `bun run typecheck` and `bun run typecheck:tests` both passed.

---

### Task 5: Run Final Gates And Close Batch 1

**Files:**
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/backend/NOW.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: `docs/plans/mobile/2026-07-08-mobile-social-controls.md`
- Modify: `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`

**Interfaces:**
- Consumes: verified Task 1-4 implementation and commits.
- Produces: closed backend/mobile Batch 1 pointers and a coordinator next action to plan Batch 2, Profile Content Surfaces.

- [x] **Step 1: Run the final backend gates**

Run from repository root:

```bash
mix format --check-formatted
mix test test/live_canvas/social_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs
mix typecheck
mix absinthe.schema.sdl --schema LCGQL.Schema mobile/schema.graphql
```

Expected: formatting, tests, typecheck, and schema export all exit zero.

Execution note: the repository-wide formatter check reports seven
pre-existing, untouched files outside this batch. The same check scoped to all
Batch 1 Elixir files passes; the remaining backend commands pass unchanged.

- [x] **Step 2: Run the final mobile gates**

Run from `mobile/`:

```bash
bun run relay
bun test tests/profile/relationshipPresentation.test.ts tests/profile/OtherUserProfileScreen.test.ts
pnpm exec jest --config ./jest.config.js tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand
bun run test:quality
```

Expected: Relay completes without an unexpected diff and every focused/full quality command exits zero.

- [x] **Step 3: Record closure in the source and lane documents**

Make these exact state changes after Step 1-2 pass:

- Mark Tasks 3-4 complete in `docs/plans/mobile/2026-07-08-mobile-social-controls.md` and add the commands above under Evidence.
- Set backend `NOW.md` status to `reversible social-control contract complete`, with the focused backend commands under Verification.
- Set mobile `NOW.md` status to `reversible social controls complete`, with Relay and mobile commands under Verification.
- Set coordinator `NOW.md` status to `Batch 1 complete; Batch 2 planning next` and name `Profile Content Surfaces` as the next coordinator planning action, not an executable batch.
- Update `TRACK.md` and `INDEX.md` so Batch 1 is complete and Batches 2-5 remain queued in the approved design.
- Check every completed checkbox in this implementation plan and record only commands that actually passed.

- [x] **Step 4: Verify documentation and patch hygiene**

Run from repository root:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; status lists only the intended implementation, generated, test, and planning files.

- [x] **Step 5: Commit the lane-closure milestone**

```bash
git add docs/plans/NOW.md docs/plans/backend/NOW.md docs/plans/mobile/NOW.md docs/plans/mobile/TRACK.md docs/plans/INDEX.md docs/plans/mobile/2026-07-08-mobile-social-controls.md docs/superpowers/plans/2026-07-09-reversible-social-controls.md
git commit -m "docs: close reversible social controls batch"
```

Do not activate Batch 2 implementation until its own written design/plan is approved and promoted.

Execution evidence (2026-07-09):

- Batch-scoped Elixir formatting passed. Repository-wide formatting remains
  blocked only by seven pre-existing, untouched files outside this batch.
- Backend focused suite: 49 tests, 0 failures; `mix typecheck`: 0 errors;
  schema export passed with no resulting diff.
- Relay regenerated 48 reader, 44 normalization, and 44 operation documents
  with no resulting diff.
- Mobile focused suites: 9 pure tests and 11 RNTL tests, all passing.
- Full mobile quality: both typechecks and zero-warning lint passed; 457 Bun
  tests and 87 Jest tests passed.

---

## Execution Handoff

Batch 1 is complete. Do not reopen this implementation plan or broaden it into
profile content, media upload, chat controls, contact invitations, native
address-book access, or release QA. The next coordinator action is to create
and approve the Batch 2 Profile Content Surfaces implementation plan.

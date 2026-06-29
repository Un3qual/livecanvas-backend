# Relay-First GraphQL Migration Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `LiveCanvasGQL` from "Relay macros with non-Relay behavior" to a real Relay-first API: refetchable nodes, opaque global IDs for all public ID lookups, connection-based pagination, and mutation payloads that return typed data instead of a bare success flag.

**Architecture:** Keep the GraphQL layer adapter-thin. `LiveCanvasGQL` should own schema-level concerns (request context, node resolution, ID decoding, connection assembly, payload shaping), while `LiveCanvas.Accounts` remains the source of truth for fetching and mutating account data. Stage the rollout in two phases: first land additive compatibility changes (`viewer` can resolve from context, global IDs are accepted, payloads grow richer fields while legacy fields still exist), then do one explicit cleanup commit that removes `viewer(userId: ...)`, raw database ID fallback, and the temporary `successful` payload field.

**Tech Stack:** Elixir 1.15+, Phoenix, Plug, Absinthe, Absinthe Relay (`:modern`), Ecto, ExUnit

---

## Current State Snapshot

- `lib/live_canvas_gql/schema.ex` already uses `Absinthe.Relay.Schema`, but the root query does not expose `node(id: ID!)`, and `node interface` currently resolves every struct to `nil`.
- `lib/live_canvas_gql/accounts/account_queries.ex` exposes `viewer(userId: ID!)`, so the primary read path still expects a caller-supplied database identifier.
- `lib/live_canvas_gql/accounts/account_resolver.ex` still uses `Integer.parse/1` in `parse_id/1`.
- `lib/live_canvas_gql/accounts/account_types.ex` declares `connection(node_type: :user)` but no query or object field actually returns a Relay connection.
- `lib/live_canvas_gql/accounts/account_mutations.ex` returns `successful_payload`, which is not enough for Relay clients to update the store.
- `lib/live_canvas_gql/router.ex` forwards straight into `Absinthe.Plug`, so GraphQL requests never receive the logged-in user scope that the HTML stack already builds.
- The only current GraphQL tests are `test/live_canvas_gql/accounts/account_queries_test.exs` and `test/live_canvas_gql/accounts/account_mutations_test.exs`; both cover the legacy contracts, not actual Relay behavior.

## Staging Order

1. Land Tasks 1 through 4 in order. Those tasks are intentionally additive: they keep existing clients working while introducing the real Relay surface.
2. Leave the compatibility branches in place for one client cutover window: `viewer` still accepts `userId`, ID decoding still tolerates legacy raw IDs, and mutation payloads still expose `successful`.
3. Run Task 5 only after callers have moved to authenticated `viewer`, `node(id:)`, Relay global IDs, and typed mutation payload fields.
4. Do not fold Task 5 into the earlier commits. The breaking cleanup should stay isolated so it can be reverted independently if a client was missed.

## Progress Checklist

- [x] Task 1: Add authenticated GraphQL context and a non-breaking `viewer` transition.
- [x] Task 2: Add real node resolution and Relay ID decoding.
- [x] Task 3: Replace the first list field with a real Relay connection.
- [x] Task 4: Convert mutations to Relay payloads without breaking clients immediately.
- [x] Task 5: Remove the legacy compatibility branches in one explicit breaking change.
- [x] Task 6: Final verification.

### Task 1: Add Authenticated GraphQL Context And A Non-Breaking `viewer` Transition

**Files:**
- Create: `lib/live_canvas_gql/context.ex`
- Create: `test/live_canvas_gql/relay/request_context_test.exs`
- Modify: `lib/live_canvas_gql/router.ex`
- Modify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Test: `test/live_canvas_gql/accounts/account_queries_test.exs`

**Step 1: Write the failing request-context test**

Add an HTTP-level test that proves `viewer` can resolve from the logged-in session without a caller-supplied ID:

```elixir
defmodule LiveCanvasGQL.Relay.RequestContextTest do
  use LiveCanvasWeb.ConnCase

  import LiveCanvas.AccountsFixtures

  test "viewer resolves from the logged-in session when userId is omitted", %{conn: conn} do
    user = user_fixture()

    query = """
    query {
      viewer {
        email
      }
    }
    """

    conn = conn |> log_in_user(user) |> post("/graphql", %{query: query})

    assert %{"data" => %{"viewer" => %{"email" => ^user.email}}} = json_response(conn, 200)
  end
end
```

This should fail today because `viewer` still requires `userId`, and the GraphQL router does not inject any `current_scope` into Absinthe context.

**Step 2: Run the test to verify it fails**

Run: `mix test test/live_canvas_gql/relay/request_context_test.exs --trace`

Expected: FAIL with a schema validation error about the missing `userId` argument, or a `nil` viewer because no GraphQL context is present yet.

**Step 3: Write the minimal compatibility implementation**

- Create `LiveCanvasGQL.Context` as a small plug that:
  - calls `fetch_session/1`
  - reads `:user_token`
  - uses `LiveCanvas.Accounts.get_user_by_session_token/1`
  - converts the result into `Accounts.scope_for_user(user)` or `Accounts.empty_scope()`
  - passes `%{current_scope: scope}` into `Absinthe.Plug.put_options/2`
- Plug `LiveCanvasGQL.Context` inside `lib/live_canvas_gql/router.ex` before the `forward "/graphql"` and `forward "/graphiql"` handlers run.
- Change `viewer` in `lib/live_canvas_gql/accounts/account_queries.ex` from `arg :user_id, non_null(:id)` to `arg :user_id, :id` so the field becomes additive instead of a flag-day rename.
- Update `LiveCanvasGQL.Accounts.Resolver.viewer/3` so:
  - when `user_id` is omitted, it returns `resolution.context.current_scope.user`
  - when `user_id` is present, it keeps the current legacy lookup path for now (Task 2 replaces that path with real Relay decoding)

**Step 4: Run the request and legacy query tests to verify green**

Run: `mix test test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: PASS. The new request-context test should go green, and the existing legacy `viewer(userId: ...)` test should still pass unchanged.

**Step 5: Commit**

```bash
git add lib/live_canvas_gql/context.ex lib/live_canvas_gql/router.ex lib/live_canvas_gql/accounts/account_queries.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/accounts/account_queries_test.exs
git commit -m "feat: add graphql viewer request context"
```

### Task 2: Add Real Node Resolution And Relay ID Decoding

**Files:**
- Create: `lib/live_canvas_gql/relay.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Create: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`

**Step 1: Write the failing node and global-ID tests**

Add tests that prove the schema supports Relay node refetching and accepts opaque IDs:

```elixir
test "node(id:) refetches a user from a relay global id" do
  user = user_fixture()
  user_id = Absinthe.Relay.Node.to_global_id(:user, user.id, LiveCanvasGQL.Schema)

  query = """
  query($id: ID!) {
    node(id: $id) {
      id
      ... on User {
        email
      }
    }
  }
  """

  assert {:ok, %{data: %{"node" => %{"id" => ^user_id, "email" => ^user.email}}}} =
           Absinthe.run(query, LiveCanvasGQL.Schema, variables: %{"id" => user_id})
end
```

Update the existing `viewer(userId: ...)` test to pass a Relay global ID instead of a raw integer and assert that `viewer { id }` returns the same opaque ID.

**Step 2: Run the tests to verify they fail**

Run: `mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: FAIL because the schema does not expose `node`, `resolve_type` returns `nil`, and `viewer` still expects a local database ID format.

**Step 3: Write the minimal Relay plumbing**

- Create `LiveCanvasGQL.Relay` to centralize ID decoding. It should:
  - call `Absinthe.Relay.Node.from_global_id/2`
  - verify the decoded node type matches the expected type
  - return the decoded raw source ID
  - during the compatibility window only, fall back to `Ecto.Type.cast(:id, value)` instead of `Integer.parse/1` so existing numeric callers still work without ad hoc parsing
- Delete `parse_id/1` from `LiveCanvasGQL.Accounts.Resolver` and route all ID lookups through the new helper.
- Add `node field` to the root query in `lib/live_canvas_gql/schema.ex`.
- Replace the `node interface` stub in `lib/live_canvas_gql/schema.ex` with real type resolution for at least:
  - `%LiveCanvasSchemas.Accounts.User{} -> :user`
  - `%LiveCanvasSchemas.Accounts.UserIdentity{} -> :user_identity`
- Add a small `LiveCanvas.Accounts.get_user_identity!/1` helper if you keep `:user_identity` as a node type so `node(id:)` can refetch it later without leaking `Repo.get!/2` into the schema module.
- Convert `node object(:token)` in `lib/live_canvas_gql/accounts/account_types.ex` to a plain `object :token`. Tokens are secret-bearing payload data, not safe globally-refetchable nodes.

**Step 4: Run the node and query tests to verify green**

Run: `mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: PASS. `node(id:)` should refetch the user, and `viewer(userId: ...)` should now accept a Relay global ID while still tolerating the old numeric form during the compatibility window.

**Step 5: Commit**

```bash
git add lib/live_canvas_gql/relay.ex lib/live_canvas/accounts.ex lib/live_canvas_gql/schema.ex lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs
git commit -m "feat: add graphql relay node plumbing"
```

### Task 3: Replace The First List Field With A Real Relay Connection

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`

**Step 1: Write the failing pagination test**

Use the existing `User.user_identities` association as the first real connection field:

```elixir
test "viewer.userIdentities returns edges, cursors, and pageInfo" do
  user = user_fixture()
  first_identity = attach_user_identity(user, :google_provider, "google-1")
  second_identity = attach_user_identity(user, :apple_provider, "apple-1")

  query = """
  query($first: Int!, $after: String) {
    viewer {
      userIdentities(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
  """

  context = %{current_scope: LiveCanvas.Accounts.scope_for_user(user)}

  assert {:ok, %{data: %{"viewer" => %{"userIdentities" => first_page}}}} =
           Absinthe.run(query, LiveCanvasGQL.Schema, variables: %{"first" => 1}, context: context)

  assert [%{"node" => %{"id" => _}}] = first_page["edges"]
  assert first_page["pageInfo"]["hasNextPage"] == true
  assert is_binary(first_page["pageInfo"]["endCursor"])

  assert {:ok, %{data: %{"viewer" => %{"userIdentities" => second_page}}}} =
           Absinthe.run(
             query,
             LiveCanvasGQL.Schema,
             variables: %{"first" => 1, "after" => first_page["pageInfo"]["endCursor"]},
             context: context
           )

  assert [%{"node" => %{"id" => _}}] = second_page["edges"]
  assert second_page["pageInfo"]["hasNextPage"] == false
end
```

**Step 2: Run the query test file to verify it fails**

Run: `mix test test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: FAIL because `userIdentities` is not a connection field yet.

**Step 3: Write the minimal connection implementation**

- Add `LiveCanvas.Accounts.user_identities_query/1` that returns an `Ecto.Query` for a user's identities with a deterministic sort:
  - `order_by: [asc: inserted_at, asc: id]`
  - no GraphQL-specific code in the context
- In `lib/live_canvas_gql/accounts/account_types.ex`:
  - add `connection(node_type: :user_identity)`
  - replace the commented-out list field with a real `connection field :user_identities, node_type: :user_identity, paginate: :forward`
- In `LiveCanvasGQL.Accounts.Resolver`, resolve that field with `Absinthe.Relay.Connection.from_query/3` (or `/4`) so pagination stays database-backed instead of materializing the full list in memory.
- Keep the first connection scoped to authenticated `viewer`. Do not add a top-level `users` connection in this migration; that is a separate product/API decision.

**Step 4: Run the query tests to verify green**

Run: `mix test test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: PASS. The connection should return `edges`, opaque cursors, and correct `pageInfo` across at least two pages.

**Step 5: Commit**

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/accounts/account_queries_test.exs
git commit -m "feat: add graphql user identity connection"
```

### Task 4: Convert Mutations To Relay Payloads Without Breaking Clients Immediately

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Step 1: Write the failing payload tests**

Expand the current mutation tests so the existing field names return typed payloads instead of only a boolean:

```elixir
test "registerWithEmail returns the created user and no errors" do
  mutation = """
  mutation {
    registerWithEmail(input: {email: "user@example.com"}) {
      user {
        id
        email
      }
      errors {
        field
        message
      }
      successful
    }
  }
  """

  assert {:ok, %{data: %{"registerWithEmail" => %{
           "user" => %{"id" => user_id, "email" => "user@example.com"},
           "errors" => [],
           "successful" => true
         }}}} = Absinthe.run(mutation, LiveCanvasGQL.Schema)

  assert is_binary(user_id)
end
```

Also change `attachUserPhoneNumber` to pass a Relay global `userId`, and add a duplicate-email failure case that asserts `errors` is populated.

**Step 2: Run the mutation tests to verify they fail**

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs --trace`

Expected: FAIL because the payload only exposes `successful`, and the mutation resolver still assumes a local `userId`.

**Step 3: Write the minimal Relay mutation implementation**

- Change `lib/live_canvas_gql/accounts/account_mutations.ex` to use `Absinthe.Relay.Schema.Notation, :modern`.
- Replace the plain `field` definitions with `payload field` blocks so the schema keeps the same mutation names but gains explicit Relay-style input/output types.
- Inline the `input do` and `output do` definitions in the mutation module and add a reusable `:user_error` object in `lib/live_canvas_gql/accounts/account_types.ex`.
- Keep `successful` in the output temporarily so old clients do not break during the cutover window.
- Return real payload data from the resolvers:
  - `register_with_email` returns `%{user: user, errors: [], successful: true}` on success
  - `attach_user_phone_number` returns `%{user: refreshed_user, errors: [], successful: true}` on success
  - validation failures return `%{user: nil, errors: [...], successful: false}`
- Use `LiveCanvasGQL.Relay` for `user_id` decoding; do not add any new raw integer parsing.
- Remove `:successful_payload`, `:register_with_email_input`, and `:attach_user_phone_number_input` after the new payload-based definitions compile cleanly.

**Step 4: Run the mutation tests to verify green**

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs --trace`

Expected: PASS. Both mutations should return typed payloads, and `attachUserPhoneNumber` should work with a Relay global `userId`.

**Step 5: Commit**

```bash
git add lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/accounts/account_mutations_test.exs
git commit -m "feat: return relay graphql mutation payloads"
```

### Task 5: Remove The Legacy Compatibility Branches In One Explicit Breaking Change

**Files:**
- Modify: `lib/live_canvas_gql/relay.ex`
- Modify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `test/live_canvas_gql/relay/request_context_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Step 1: Write the failing cleanup tests**

Lock in the end-state schema before deleting compatibility code:

```elixir
test "schema no longer exposes viewer(userId: ...)" do
  schema_sdl = Absinthe.Schema.to_sdl(LiveCanvasGQL.Schema)

  refute schema_sdl =~ "viewer(userId:"
end

test "schema no longer exposes the temporary successful field" do
  schema_sdl = Absinthe.Schema.to_sdl(LiveCanvasGQL.Schema)

  refute schema_sdl =~ "successful: Boolean!"
end
```

Add one negative test that passes a raw numeric ID (not a Relay global ID) and asserts GraphQL returns an input error for `node(id:)` or `attachUserPhoneNumber`.

**Step 2: Run the cleanup-focused test files to verify they fail**

Run: `mix test test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs --trace`

Expected: FAIL because the compatibility branches are still in place.

**Step 3: Remove the compatibility code**

- Delete the legacy raw-ID fallback from `LiveCanvasGQL.Relay`; after this task, every public GraphQL ID must be a real Relay global ID.
- Remove `arg :user_id` from `viewer` entirely so `viewer` becomes authenticated-context-only.
- Delete the now-dead resolver branches that allowed `viewer(userId: ...)`.
- Remove the temporary `successful` output field from the mutation payloads and stop returning it from resolvers.
- Update field descriptions/docstrings so the supported read entry points are now:
  - authenticated `viewer`
  - `node(id:)`
  - connection fields for collections

**Step 4: Run the cleanup tests to verify green**

Run: `mix test test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs --trace`

Expected: PASS. The schema should now be strict Relay-only for IDs and payload shapes.

**Step 5: Commit**

```bash
git add lib/live_canvas_gql/relay.ex lib/live_canvas_gql/accounts/account_queries.ex lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/accounts/account_mutations.ex test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs
git commit -m "refactor: drop graphql legacy relay shims"
```

### Task 6: Final Verification

**Files:**
- Verify: `lib/live_canvas_gql/context.ex`
- Verify: `lib/live_canvas_gql/relay.ex`
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas_gql/schema.ex`
- Verify: `lib/live_canvas_gql/router.ex`
- Verify: `lib/live_canvas_gql/accounts/account_types.ex`
- Verify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Verify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Verify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Verify: `test/live_canvas_gql/relay/request_context_test.exs`
- Verify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Verify: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Verify: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Step 1: Run formatting**

Run: `mix format lib/live_canvas_gql/context.ex lib/live_canvas_gql/relay.ex lib/live_canvas/accounts.ex lib/live_canvas_gql/schema.ex lib/live_canvas_gql/router.ex lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/accounts/account_queries.ex lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs`

Expected: formatting completes cleanly.

**Step 2: Run the focused GraphQL suite**

Run: `mix test test/live_canvas_gql --trace`

Expected: PASS for the request-context, node, query, connection, and mutation coverage.

**Step 3: Run a clean test compile**

Run: `MIX_ENV=test mix compile --force`

Expected: PASS with no warnings introduced by the new Relay plumbing.

## Preserve These Invariants

- Every public GraphQL `ID` must be a Relay global ID. Do not reintroduce direct database IDs or `Integer.parse/1` in resolvers.
- `viewer` is an authenticated-context field, not a by-ID lookup. If a caller needs to fetch by ID, that must go through `node(id:)`.
- Only safe, actually-refetchable resources should remain `node object`s. Keep secret-bearing payload types like `:token` as plain objects unless a secure refetch story exists.
- User-facing collections should be exposed as Relay connections with deterministic ordering. Do not add new `list_of(...)` pagination fields for the API surface.
- Mutation payloads should return typed data (`user`, connection edges, structured `errors`) so Relay clients can reconcile the store. A bare boolean is not an acceptable final shape.
- If a future task expands `UserIdentity` fields beyond `id`, add explicit resolvers for internal fields such as `provider_uid` and `*_provider` values instead of relying on implicit field-name matching.

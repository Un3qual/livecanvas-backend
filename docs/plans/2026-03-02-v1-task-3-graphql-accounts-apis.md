# V1 Task 3 GraphQL Accounts APIs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current GraphQL account stubs with thin, real resolver wiring for the normalized `Accounts` API surface landed during V1 Task 2.

**Architecture:** Keep Absinthe adapter-thin. `LiveCanvasGQL` should expose inputs and payloads that normalize GraphQL request shapes, then delegate straight into `LiveCanvas.Accounts`. The current schema only exposes a stub `auth_token_valid` query and a stub `apple_authenticate` mutation, so the main work is to add resolver modules, real account query/mutation fields, and tests that exercise the `Accounts` boundary instead of placeholder responses.

**Tech Stack:** Elixir 1.15+, Absinthe, Absinthe Relay, ExUnit

---

## Progress

- [x] Step 1: Add failing GraphQL mutation tests for account registration and write-side APIs
- [x] Step 2: Add failing GraphQL query tests for viewer/account lookups
- [x] Step 3: Implement minimal resolver modules and schema wiring
- [x] Step 4: Replace or retire stubbed account GraphQL fields
- [x] Step 5: Run focused GraphQL tests to verify green

### Task 1: Add GraphQL Mutation Coverage For The Current Accounts Surface

**Files:**
- Create: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`

- [x] Step 1: Write the failing tests

Add mutations that exercise the real `Accounts` boundary:

```elixir
test "registerWithEmail creates a user" do
  mutation = """
  mutation {
    registerWithEmail(input: {email: "user@example.com"}) {
      successful
    }
  }
  """

  assert {:ok, %{data: %{"registerWithEmail" => %{"successful" => true}}}} =
           Absinthe.run(mutation, LiveCanvasGQL.Schema)
end

test "attachUserPhoneNumber normalizes and persists a phone" do
  user = user_fixture()

  mutation = """
  mutation($userId: ID!) {
    attachUserPhoneNumber(input: {userId: $userId, phoneNumber: "(650) 253-0000"}) {
      successful
    }
  }
  """

  assert {:ok, %{data: %{"attachUserPhoneNumber" => %{"successful" => true}}}} =
           Absinthe.run(mutation, LiveCanvasGQL.Schema, variables: %{"userId" => user.id})
end
```

- [x] Step 2: Run tests to verify they fail

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs --trace`

Expected: FAIL because the schema does not expose these fields yet.

- [x] Step 3: Write minimal implementation

- Add input objects and payload types for the new mutations
- Replace the stub-only `apple_authenticate` emphasis with real account mutations
- Keep the mutation module declarative; delegate all logic to a resolver module

- [x] Step 4: Run tests to verify they pass

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs --trace`

Expected: PASS for the real account mutations.

- [x] Step 5: Commit

```bash
git add lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_types.ex test/live_canvas_gql/accounts/account_mutations_test.exs
git commit -m "feat: add graphql account mutations"
```

### Task 2: Add Query Fields And A Resolver Module

**Files:**
- Create: `lib/live_canvas_gql/accounts/account_queries.ex`
- Create: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Create: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`

- [x] Step 1: Write the failing tests

Add query coverage for a thin read adapter:

```elixir
test "viewer returns the requested user by id" do
  user = user_fixture()

  query = """
  query($userId: ID!) {
    viewer(userId: $userId) {
      email
    }
  }
  """

  assert {:ok, %{data: %{"viewer" => %{"email" => user.email}}}} =
           Absinthe.run(query, LiveCanvasGQL.Schema, variables: %{"userId" => user.id})
end
```

- [x] Step 2: Run tests to verify they fail

Run: `mix test test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: FAIL because the schema and resolver modules do not exist yet.

- [x] Step 3: Write minimal implementation

- Create `LiveCanvasGQL.Accounts.Resolver` with thin wrappers over `Accounts`
- Create `LiveCanvasGQL.Accounts.Queries` to define `viewer` and any minimal token validation/read fields still needed
- Import the query fields into `LiveCanvasGQL.Schema`

- [x] Step 4: Run tests to verify they pass

Run: `mix test test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: PASS for the new account query surface.

- [x] Step 5: Commit

```bash
git add lib/live_canvas_gql/schema.ex lib/live_canvas_gql/accounts/account_queries.ex lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/accounts/account_types.ex test/live_canvas_gql/accounts/account_queries_test.exs
git commit -m "feat: add graphql account queries"
```

### Task 3: Replace The Remaining Stubbed GraphQL Paths

**Files:**
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`

- [x] Step 1: Write the failing regression tests

Add assertions that the current placeholders are gone or explicitly marked legacy:

```elixir
test "appleAuthenticate is either deprecated or removed from the active account flow" do
  schema_sdl = Absinthe.Schema.to_sdl(LiveCanvasGQL.Schema)
  refute schema_sdl =~ "appleAuthenticate"
end
```

- [x] Step 2: Run tests to verify they fail

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: FAIL while the placeholder field is still wired.

- [x] Step 3: Write minimal implementation

- Remove the stub `apple_authenticate` mutation or mark it explicitly deprecated and isolate it from the new account flow
- Remove the fake `auth_token_valid` implementation if a real boundary-backed equivalent is introduced
- Keep only boundary-backed resolver paths in the active schema

- [x] Step 4: Run tests to verify they pass

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: PASS for the non-stubbed schema.

- [x] Step 5: Commit

```bash
git add lib/live_canvas_gql/schema.ex lib/live_canvas_gql/accounts/account_mutations.ex test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/account_queries_test.exs
git commit -m "refactor: remove graphql account stubs"
```

### Task 4: Final Verification

**Files:**
- Verify: `lib/live_canvas_gql/schema.ex`
- Verify: `lib/live_canvas_gql/accounts/account_types.ex`
- Verify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Verify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Verify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Verify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Verify: `test/live_canvas_gql/accounts/account_queries_test.exs`

- [x] Step 1: Run formatting

Run: `mix format lib/live_canvas_gql/schema.ex lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_queries.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/account_queries_test.exs`

Expected: formatting completes cleanly.

- [x] Step 2: Run focused verification

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/account_queries_test.exs --trace`

Expected: PASS for the V1 Task 3 GraphQL surface.

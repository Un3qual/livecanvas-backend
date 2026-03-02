# Accounts API First Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add explicit `Accounts` entry points for normalized email registration and token issuance on top of the already-refactored schema/token model.

**Architecture:** Keep the existing normalized account persistence and token serialization logic. Add thin public wrappers in `LiveCanvas.Accounts`, expose the minimum token builder needed from `LiveCanvas.Accounts.Tokens`, and prove the behavior with focused ExUnit coverage without removing the legacy auth entry points yet.

**Tech Stack:** Elixir 1.15+, Ecto, ExUnit

---

## Progress

- [x] Step 1: Add failing tests for `register_user_with_email/1`
- [x] Step 2: Add failing tests for `issue_user_token/3`
- [x] Step 3: Run focused tests to verify the new expectations fail first
- [x] Step 4: Implement the minimal Accounts and Tokens APIs
- [x] Step 5: Run focused tests to verify the new expectations pass

### Task 1: Add Explicit Accounts Entry Points

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`
- Create: `test/live_canvas/accounts/user_token_test.exs`

**Step 1: Write the failing registration test**

Add a focused test that proves `register_user_with_email/1` creates a normalized
email row plus a verified join:

```elixir
test "register_user_with_email creates a verified normalized email join" do
  email = "USER@example.com"

  assert {:ok, user} = Accounts.register_user_with_email(%{email: email})

  user = Repo.preload(user, user_email_addresses: :email_address)
  [join] = user.user_email_addresses

  assert join.verified_at
  assert join.email_address.normalized_email == "user@example.com"
end
```

**Step 2: Write the failing token issuance test**

Add a focused token API test:

```elixir
test "issue_user_token stores only the secret hash" do
  user = user_fixture()

  assert {:ok, %{token: token, user_token: persisted}} =
           Accounts.issue_user_token(user, :access_token)

  assert is_binary(token)
  assert persisted.secret_hash != token
  assert persisted.context == :access_token
end
```

**Step 3: Run the focused tests and verify RED**

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs --trace`

Expected: FAIL because the new public APIs do not exist yet.

**Step 4: Write the minimal implementation**

- Add `Accounts.register_user_with_email/1` as a thin wrapper around the
  existing normalized registration flow, but mark the created join verified.
- Add `Accounts.issue_user_token/3` to persist and return a token payload.
- Expose a public token builder helper in `LiveCanvas.Accounts.Tokens` so the
  boundary module can issue tokens without duplicating serialization logic.
- Update fixtures only if a helper can reuse the new API cleanly.

**Step 5: Run the focused tests and verify GREEN**

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs --trace`

Expected: PASS for the new slice without regressing existing account tests.

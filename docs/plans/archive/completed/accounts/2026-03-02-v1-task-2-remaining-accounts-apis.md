# V1 Task 2 Remaining Accounts APIs Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the remaining `Accounts` boundary work for V1 Task 2 by exposing the last write-side and token-facing APIs through explicit normalized-credential entry points instead of low-level helpers.

**Architecture:** The current baseline already includes `register_user_with_email/1`, `issue_user_token/3`, `get_user_by_email/1`, `get_user_by_phone/1`, `get_user_by_identity/2`, `attach_user_phone_number/3`, `register_user_identity/4`, and a shared `PhoneNumbers` normalization helper. The remaining work is to make email attachment and token issuance/verification equally explicit, then route notifier-facing account flows through those public APIs so adapters stop depending on low-level token internals.

**Tech Stack:** Elixir 1.15+, Ecto, ExUnit, Swoosh

---

## Progress

- [x] Step 1: Add failing tests for an explicit email attachment API
- [x] Step 2: Add failing tests for public token issuance wrappers
- [x] Step 3: Add failing tests for notifier-facing delivery wrappers using the new token APIs
- [x] Step 4: Implement the minimal remaining `Accounts` boundary APIs
- [x] Step 5: Run focused tests to verify the new surface is green

### Task Checklist

- [x] Task 1: Add a public email attachment boundary API
- [x] Task 2: Add public token issue and verification wrappers
- [x] Task 3: Rewire notifier-facing flows through public APIs
- [x] Task 4: Final verification

### Task 1: Add A Public Email Attachment Boundary API

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`

**Step 1: Write the failing test**

Add coverage for a new `attach_user_email_address/3` API:

```elixir
test "attach_user_email_address/3 downcases and persists a verified join" do
  user = user_fixture()

  assert {:ok, join} =
           Accounts.attach_user_email_address(user, "NEW@Example.com", verified_at: DateTime.utc_now())

  assert join.user_id == user.id

  user = Accounts.get_user!(user.id) |> Repo.preload(user_email_addresses: :email_address)
  assert Enum.any?(user.user_email_addresses, &(&1.email_address.normalized_email == "new@example.com"))
end
```

**Step 2: Run test to verify it fails**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: FAIL because `attach_user_email_address/3` does not exist yet.

**Step 3: Write minimal implementation**

- Add `attach_user_email_address/3` as a public wrapper around the existing private email insert logic
- Normalize to lowercase before uniqueness checks
- Return the persisted join row preloaded with `:email_address`

**Step 4: Run test to verify it passes**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: PASS for the new email attachment coverage.

**Step 5: Commit**

```bash
git add lib/live_canvas/accounts.ex test/live_canvas/accounts_test.exs test/support/fixtures/accounts_fixtures.ex
git commit -m "feat: add explicit email attachment API"
```

### Task 2: Add Public Token Issue And Verification Wrappers

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `test/live_canvas/accounts/user_token_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`

**Step 1: Write the failing tests**

Add focused tests for public wrappers that hide raw context details from adapters:

```elixir
test "issue_access_token/2 persists an access token payload" do
  user = user_fixture()

  assert {:ok, %{token: token, user_token: persisted}} = Accounts.issue_access_token(user)
  assert is_binary(token)
  assert persisted.context == :access_token
end

test "issue_magic_link_token/1 uses the email magic link context" do
  user = user_fixture()

  assert {:ok, %{user_token: persisted}} = Accounts.issue_magic_link_token(user)
  assert persisted.context == :email_magic_link_token
  assert persisted.sent_to == user.email
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/accounts/user_token_test.exs --trace`

Expected: FAIL because the wrapper functions do not exist yet.

**Step 3: Write minimal implementation**

- Add `issue_access_token/2`, `issue_magic_link_token/1`, and `issue_email_verification_token/1`
- Implement them as thin wrappers over `issue_user_token/3` and the existing token context rules
- Keep `Tokens` responsible for serialization and secret hashing only

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/accounts/user_token_test.exs --trace`

Expected: PASS for the new wrappers and existing token tests.

**Step 5: Commit**

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex test/live_canvas/accounts/user_token_test.exs test/support/fixtures/accounts_fixtures.ex
git commit -m "feat: add public accounts token wrappers"
```

### Task 3: Rewire Notifier-Facing Flows Through Public APIs

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/user_notifier.ex`
- Modify: `test/live_canvas/accounts_test.exs`

**Step 1: Write the failing regression tests**

Add coverage that the delivery helpers still emit valid tokens while relying on the new public wrappers:

```elixir
test "deliver_login_instructions/2 uses the public magic link token wrapper" do
  user = user_fixture()

  token =
    extract_user_token(fn url ->
      Accounts.deliver_login_instructions(user, url)
    end)

  assert {:ok, %{id: id}} = Tokens.decode_serialized_value(token)
  assert user_token = Repo.get_by(UserToken, id: id)
  assert user_token.context == :email_magic_link_token
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: FAIL once the tests assert the new wrapper usage and APIs are still missing.

**Step 3: Write minimal implementation**

- Change delivery helpers in `Accounts` to call the new public token wrappers instead of `Tokens.build_*` directly
- Keep `UserNotifier` transport-only
- Do not move token policy into the mailer layer

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs --trace`

Expected: PASS for the notifier and token paths together.

**Step 5: Commit**

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas/accounts/user_notifier.ex test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs
git commit -m "refactor: route account delivery through public APIs"
```

### Task 4: Final Verification

**Files:**
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas/accounts/tokens.ex`
- Verify: `lib/live_canvas/accounts/user_notifier.ex`
- Verify: `test/live_canvas/accounts_test.exs`
- Verify: `test/live_canvas/accounts/user_token_test.exs`

**Step 1: Run formatting**

Run: `mix format lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex lib/live_canvas/accounts/user_notifier.ex test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs test/support/fixtures/accounts_fixtures.ex`

Expected: formatting completes cleanly.

**Step 2: Run focused verification**

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs --trace`

Expected: PASS for the remaining Task 2 scope.

# Accounts API Lookup Slice Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add explicit `Accounts` lookup helpers for normalized phone numbers and external identities.

**Architecture:** Keep the existing normalized account schema model and mirror the existing email getter shape. Add small fixture helpers that create phone-number joins and user identities directly, then implement thin query wrappers in `LiveCanvas.Accounts` that return the owning user or `nil`.

**Tech Stack:** Elixir 1.15+, Ecto, ExUnit

---

## Progress

- [x] Step 1: Add failing tests for `get_user_by_phone/1`
- [x] Step 2: Add failing tests for `get_user_by_identity/2`
- [x] Step 3: Add fixture helpers for phone numbers and identities
- [x] Step 4: Run focused tests to verify the new expectations fail first
- [x] Step 5: Implement the minimal lookup queries in `LiveCanvas.Accounts`
- [x] Step 6: Run focused tests to verify the new expectations pass

### Task 1: Add Explicit Lookup Helpers

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`

**Step 1: Write the failing phone lookup tests**

Add tests that prove the lookup returns the owning user for an existing
normalized E.164 phone number and `nil` when no match exists:

```elixir
test "returns the user if the phone exists" do
  user = user_fixture()
  attach_phone_number(user, "+15551234567")

  assert %User{id: ^user.id} = Accounts.get_user_by_phone("+15551234567")
end
```

**Step 2: Write the failing identity lookup tests**

Add tests that prove the lookup returns the owning user for an active identity
and ignores revoked rows:

```elixir
test "returns the user if the active identity exists" do
  user = user_fixture()
  attach_user_identity(user, :google_provider, "google-user-1")

  assert %User{id: ^user.id} =
           Accounts.get_user_by_identity(:google_provider, "google-user-1")
end
```

**Step 3: Add focused fixture helpers**

Add test helpers that insert:
- a `phone_numbers` row plus `user_phone_numbers` join
- a `user_identities` row with a binary `provider_uid`

**Step 4: Run the focused tests and verify RED**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: FAIL because the new public lookup APIs do not exist yet.

**Step 5: Write the minimal implementation**

- Add `Accounts.get_user_by_phone/1`
- Add `Accounts.get_user_by_identity/2`
- Reuse the existing `put_primary_email/1` hydration so returned users match
  the current email getter contract
- Filter identity lookups to active (`revoked_at` is `nil`) rows only

**Step 6: Run the focused tests and verify GREEN**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: PASS for the new lookup coverage and the existing account tests.

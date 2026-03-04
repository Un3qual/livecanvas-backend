# Accounts Write APIs Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add explicit write-side `Accounts` APIs for attaching normalized phone numbers and registering external identities on existing users.

**Architecture:** Keep `LiveCanvas.Accounts` as the effectful boundary API and reuse the new phone normalization helper before any phone insert. Implement thin context functions that persist normalized phone join rows and `user_identities`, then update test fixture helpers to call those public APIs instead of writing directly.

**Tech Stack:** Elixir 1.15+, Ecto, ExUnit

---

## Progress

- [x] Step 1: Add failing tests for `attach_user_phone_number/3`
- [x] Step 2: Add failing tests for `register_user_identity/4`
- [x] Step 3: Run focused tests to verify RED
- [x] Step 4: Implement the minimal write-side APIs
- [x] Step 5: Route fixtures through the new public APIs
- [x] Step 6: Run focused tests to verify GREEN

### Task 1: Add Phone And Identity Write APIs

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`

**Step 1: Write the failing phone attachment tests**

Cover:
- attaching a formatted US phone number stores an E.164 normalized row
- invalid phone input returns `{:error, :invalid_phone_number}`

**Step 2: Write the failing identity registration tests**

Cover:
- registering an identity persists the expected provider/provider UID data
- the new row is immediately discoverable through `get_user_by_identity/2`

**Step 3: Verify RED**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: FAIL because the write-side APIs do not exist yet.

**Step 4: Implement the minimal APIs**

- Add `attach_user_phone_number/3`
- Add `register_user_identity/4`
- Reuse `normalize_phone_number/1` before any phone insert

**Step 5: Update fixtures**

Make the existing test helpers call the new public `Accounts` functions instead
of inserting phone joins or identities directly.

**Step 6: Verify GREEN**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: PASS for the new write-side coverage and existing account tests.

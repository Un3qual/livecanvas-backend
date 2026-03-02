# Phone Number Normalization Subagent Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `ex_phone_number` and route all current phone-number lookup and insert paths through one shared validation/normalization helper before any database comparison or insert.

**Architecture:** Keep phone parsing out of schemas. Add a small internal `LiveCanvas.Accounts.PhoneNumbers` helper that wraps `ExPhoneNumber.parse/2`, `ExPhoneNumber.is_valid_number/1`, and `ExPhoneNumber.format/2` to return normalized E.164 strings or an error. Use that helper in `Accounts.get_user_by_phone/1` and in the existing phone insert fixture helper so current reads and writes converge on one normalization path before the later write-side APIs are added.

**Tech Stack:** Elixir 1.15+, Ecto, ExUnit, `ex_phone_number`

---

## Progress

- [x] Step 1: Add the `ex_phone_number` dependency to `mix.exs`
- [x] Step 2: Add failing unit tests for the normalization helper
- [x] Step 3: Add failing integration coverage proving lookup normalizes input
- [x] Step 4: Implement `LiveCanvas.Accounts.PhoneNumbers`
- [x] Step 5: Use the helper before lookup and before insert
- [x] Step 6: Run focused tests and confirm green

### Task 1: Normalize Phone Numbers Before Lookup Or Insert

**Files:**
- Modify: `mix.exs`
- Create: `lib/live_canvas/accounts/phone_numbers.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/support/fixtures/accounts_fixtures.ex`
- Create: `test/live_canvas/accounts/phone_numbers_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`

**Step 1: Write the failing pure tests first**

Add unit tests for:
- a valid US-formatted number normalizing to E.164
- an invalid number returning an error

Use a realistic valid number such as `6502530000`, not placeholder `555` test data.

**Step 2: Write the failing integration test**

Update `get_user_by_phone/1` coverage so:
- the inserted helper accepts a raw formatted number like `(650) 253-0000`
- lookup accepts another formatted representation like `+1 650-253-0000`
- the user is still found because both paths normalize to the same E.164 value

**Step 3: Verify RED**

Run: `mix test test/live_canvas/accounts/phone_numbers_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: FAIL because the helper module does not exist yet and lookup still compares raw strings.

**Step 4: Implement the minimal helper**

Add:

```elixir
defmodule LiveCanvas.Accounts.PhoneNumbers do
  @default_region "US"

  def normalize(raw_phone_number) when is_binary(raw_phone_number) do
    with {:ok, phone_number} <- ExPhoneNumber.parse(raw_phone_number, @default_region),
         true <- ExPhoneNumber.is_valid_number(phone_number),
         {:ok, normalized} <- ExPhoneNumber.format(phone_number, :e164) do
      {:ok, normalized}
    else
      _ -> {:error, :invalid_phone_number}
    end
  end
end
```

**Step 5: Integrate the helper**

- `Accounts.get_user_by_phone/1` should normalize first and return `nil` if normalization fails
- `attach_phone_number/3` in fixtures should normalize before insert so tests exercise the same path future write APIs will use

**Step 6: Verify GREEN**

Run: `mix deps.get`
Run: `mix test test/live_canvas/accounts/phone_numbers_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: PASS with normalized lookup behavior.

## Subagent Handoff

Implementer should follow strict TDD for this task only, keep the helper intentionally small, and avoid adding write-side phone registration APIs yet. Once this task is green, stop and hand control back for the next V1 Task 2 slice.

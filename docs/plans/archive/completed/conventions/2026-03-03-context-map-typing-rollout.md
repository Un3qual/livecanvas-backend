# Context Map Typing Rollout Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove plain `map()` usage from context-facing specs by replacing it with typed maps and explicit shape aliases, without changing runtime behavior.

**Architecture:** Keep this as a typing-only refactor. Introduce small, reusable map-shape types in context modules, then update public specs to consume those aliases. Preserve current function signatures unless a parameter split is clearly safer and non-breaking. Keep context boundaries as the source of shape contracts.

**Tech Stack:** Elixir 1.15, Ecto, ExUnit, Dialyzer, custom `mix check.typespecs`

---

## Progress

- [x] Task 1: Replace plain `map()` in `LiveCanvas.Accounts` public specs
- [x] Task 2: Replace plain `map()` in `LiveCanvas.Accounts.UserChanges`
- [x] Task 3: Replace plain `map()` in `LiveCanvas.Social.RelationshipPolicy`
- [x] Task 4: Run full typing and regression verification

### Task 1: Replace Plain `map()` in `LiveCanvas.Accounts`

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Test: `test/live_canvas/accounts_test.exs`
- Test: `test/live_canvas/accounts/user_token_test.exs`

**Step 1: Add narrow attribute-map aliases in the context module**

Add internal type aliases near existing result aliases, for example:

- `@type registration_attrs :: %{required(:email) => String.t(), optional(:password) => String.t()}`
- `@type email_change_attrs :: %{optional(:email) => String.t()}`
- `@type password_change_attrs :: %{optional(:password) => String.t(), optional(:password_confirmation) => String.t()}`

Keep aliases minimal and aligned with currently consumed keys only.

**Step 2: Replace `map()` in affected public specs**

Update these specs to consume typed aliases instead of plain `map()`:

- `register_user/1`
- `register_user_with_email/1`
- `registration_changeset/2`
- `change_user_email/3`
- `change_user_password/3`
- `update_user_password/2`

Do not change implementation behavior in this step.

**Step 3: Run focused context tests**

Run:

```bash
mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs --trace
```

Expected: PASS.

**Step 4: Run strict typing gate for this slice**

Run:

```bash
mix check.typespecs --strict --manifest priv/quality/typespec_targets.txt
mix typecheck
```

Expected: PASS.

### Task 2: Replace Plain `map()` in `LiveCanvas.Accounts.UserChanges`

**Files:**
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Test: `test/live_canvas/accounts_test.exs`

**Step 1: Add module-local attrs shape aliases**

Add typed aliases for each changeset input, for example:

- `email_attrs` (optional `:email`)
- `privacy_attrs` (optional `:privacy_mode`)
- `password_attrs` (optional password fields)

Prefer optional keys because these APIs intentionally validate missing fields at runtime.

**Step 2: Update public specs to remove `map()`**

Update:

- `email_changeset/3`
- `privacy_changeset/2`
- `password_changeset/3`

to use the new typed aliases.

**Step 3: Run focused regression**

Run:

```bash
mix test test/live_canvas/accounts_test.exs --trace
```

Expected: PASS.

### Task 3: Replace Plain `map()` in `LiveCanvas.Social.RelationshipPolicy`

**Files:**
- Modify: `lib/live_canvas/social/relationship_policy.ex`
- Test: `test/live_canvas/social/relationship_policy_test.exs`
- Test: `test/live_canvas/social_test.exs`

**Step 1: Introduce an explicit input map type**

Add:

- `follow_decision_input` as a typed map with required keys:
  - `:blocked?`
  - `:followed_privacy_mode`
  - `:now`
  - plus IDs currently passed by `LiveCanvas.Social.follow_user/2` where needed

Use concrete types (`boolean()`, `DateTime.t()`, union for privacy mode).

**Step 2: Update `follow_decision/1` spec to use typed input**

Replace the plain `map()` argument type in `follow_decision/1`.

**Step 3: Run focused social tests**

Run:

```bash
mix test test/live_canvas/social/relationship_policy_test.exs test/live_canvas/social_test.exs --trace
```

Expected: PASS.

### Task 4: Final Verification And Commit

**Files:**
- Modify: `docs/plans/conventions/2026-03-03-context-map-typing-rollout.md`
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas/accounts/user_changes.ex`
- Verify: `lib/live_canvas/social/relationship_policy.ex`

**Step 1: Mark progress checkboxes**

Update task checkboxes in this plan as each task is completed.

**Step 2: Run full required verification**

Run:

```bash
mix test test/live_canvas --trace
mix check.typespecs --strict --manifest priv/quality/typespec_targets.txt
mix typecheck
mix precommit
```

Expected: PASS.

**Step 3: Commit**

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas/accounts/user_changes.ex lib/live_canvas/social/relationship_policy.ex docs/plans/conventions/2026-03-03-context-map-typing-rollout.md
git commit -m "chore: replace plain map types in context specs"
```

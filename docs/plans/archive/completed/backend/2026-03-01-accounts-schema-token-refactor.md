# Accounts Schema And Token Refactor Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the in-progress Accounts persistence refactor so schema modules sit under an Accounts schema namespace, timestamps use microseconds everywhere, tokens use enum-backed contexts plus explicit serialization helpers, and lookup paths validate secrets by token id instead of querying by secret hash.

**Architecture:** Keep `LiveCanvasSchemas` as the schema-only top-level boundary, but move account-specific schemas under `LiveCanvasSchemas.Accounts.*` and re-export those nested modules. Update the auth boundary so token serialization/validation lives in `LiveCanvas.Accounts.Tokens`, with transport-visible token strings decoded into `%{id, raw_secret}` before database lookup and secret verification. Apply the schema changes coherently across migrations, schemas, fixtures, and tests in one pass to avoid intermediate broken states.

**Tech Stack:** Elixir 1.15+, Phoenix 1.8, Ecto, PostgreSQL, ExUnit, `ecto_enum`

---

### Task 1: Add Failing Schema, Config, And Token API Tests

**Files:**
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`
- Modify: `test/live_canvas_web/controllers/user_session_controller_test.exs`
- Modify: `test/live_canvas_web/user_auth_test.exs`

**Step 1: Write failing tests for the new schema namespace and token fields**

- Assert account schemas are under `LiveCanvasSchemas.Accounts.*`
- Assert `UserToken` has `:raw_secret` and `:serialized_value` virtual fields, no `:token`
- Assert `User` and `UserContactEntry` expose has-many-through relationships to normalized emails/phones

**Step 2: Run focused tests to verify they fail**

Run: `mix test test/live_canvas/accounts_test.exs --trace`
Expected: FAIL on missing schema modules/associations/fields.

### Task 2: Update Dependencies, Config, And Schema Module Layout

**Files:**
- Modify: `mix.exs`
- Modify: `config/config.exs`
- Modify: `lib/live_canvas_schemas.ex`
- Create: `lib/live_canvas_schemas/accounts/*.ex`
- Remove/replace references to `lib/live_canvas_schemas/*.ex`

**Step 1: Add `ecto_enum` and switch the default generator timestamp type**

- Add `{:ecto_enum, "~> 1.4"}` to deps
- Change `config :live_canvas, generators: [timestamp_type: :utc_datetime_usec]`

**Step 2: Move account schemas under `LiveCanvasSchemas.Accounts.*`**

- Re-home `User`, `UserToken`, `EmailAddress`, `PhoneNumber`, join rows, identities, contact entries
- Update `LiveCanvasSchemas` exports to nested modules only
- Add through associations for users and contact entries

**Step 3: Run compile to verify module moves and boundary exports**

Run: `mix compile`
Expected: compile succeeds or reports only downstream reference fixes still in progress.

### Task 3: Rewrite The Migration For The New Persistence Shape

**Files:**
- Modify: `priv/repo/migrations/20260215031653_create_users_auth_tables.exs`
- Modify: `priv/repo/migrations/20260302000000_rebuild_accounts_identity_tables.exs`

**Step 1: Update all timestamps to `:utc_datetime_usec`**

- Change every `timestamps(...)` and datetime field that should be microsecond-precision

**Step 2: Apply column/type changes**

- `user_contact_entries.contact_client_id` -> `:binary`
- `user_identities.provider_uid` -> `:binary, null: false`
- `users_tokens` gets enum-backed `context`, new virtual serialization handled in code, and `id`-based lookup support

**Step 3: Use proper Ecto partial index syntax**

- Replace quoted SQL `where:` strings with Ecto fragments/keyword syntax where supported

**Step 4: Run migration-backed focused tests**

Run: `mix test test/live_canvas/accounts_test.exs --trace`
Expected: schema-shape tests progress; older API assumptions may still fail until token/context logic is updated.

### Task 4: Refactor Token Serialization, Lookup, And Context APIs

**Files:**
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Modify: `test/support/fixtures/accounts_fixtures.ex`
- Modify: `test/live_canvas/accounts_test.exs`

**Step 1: Write failing tests for token encode/decode and id-based lookup**

- Token strings decode into token id + secret
- Lookups fetch by id, then validate the secret in Elixir
- `context` uses the enum values:
  `email_verification_token | email_mfa_token | email_magic_link_token | email_one_time_code_token | phone_verification_token | phone_mfa_token | phone_magic_link_token | phone_one_time_code_token | access_token | refresh_token`

**Step 2: Implement minimal token serialization helpers**

- Add dedicated encode/decode functions
- Rename virtual `:token` to `:raw_secret`
- Add virtual `:serialized_value, :string`
- Mark secret/password fields `redact: true`

**Step 3: Update Accounts callers to use the new token API**

- Token issue, magic link delivery, token verification, token deletion, and fixtures all use encoded token strings and id-based validation

**Step 4: Run focused auth tests**

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas_web/user_auth_test.exs test/live_canvas_web/controllers/user_session_controller_test.exs --trace`
Expected: PASS for the updated token behavior and reveal any remaining legacy email-path failures.

### Task 5: Introduce Enum Types For Token Contexts And Identity Providers

**Files:**
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_identity.ex`
- Modify: `priv/repo/migrations/20260302000000_rebuild_accounts_identity_tables.exs`

**Step 1: Define `ecto_enum` enums for token contexts and providers**

- Token contexts:
  `email_verification_token`, `email_mfa_token`, `email_magic_link_token`, `email_one_time_code_token`, `phone_verification_token`, `phone_mfa_token`, `phone_magic_link_token`, `phone_one_time_code_token`, `access_token`, `refresh_token`
- Providers:
  `apple_provider`, `google_provider`, `passkey_provider`, `snap_provider`, `instagram_provider`

**Step 2: Update schemas and migration columns to use enum types**

- Replace raw strings for `:context` and `:provider`
- Keep all call sites using atoms or centralized mapping helpers

**Step 3: Run compile and focused tests**

Run: `mix compile`
Run: `mix test test/live_canvas/accounts_test.exs --trace`
Expected: PASS for enum-backed schema behavior.

### Task 6: Final Verification

**Files:**
- Verify: `mix.exs`
- Verify: `config/config.exs`
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas/accounts/tokens.ex`
- Verify: `lib/live_canvas_schemas.ex`
- Verify: `lib/live_canvas_schemas/accounts/*.ex`
- Verify: `priv/repo/migrations/*.exs`

**Step 1: Run formatting**

Run: `mix format mix.exs config/config.exs lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex lib/live_canvas/accounts/user_changes.ex lib/live_canvas_schemas.ex lib/live_canvas_schemas/accounts/*.ex priv/repo/migrations/*.exs test/live_canvas/accounts_test.exs test/support/fixtures/accounts_fixtures.ex test/live_canvas_web/user_auth_test.exs test/live_canvas_web/controllers/user_session_controller_test.exs`
Expected: files are formatted cleanly.

**Step 2: Run compile and targeted tests**

Run: `mix compile`
Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas_web/user_auth_test.exs test/live_canvas_web/controllers/user_session_controller_test.exs --trace`
Expected: PASS for the updated scope.

**Step 3: Commit**

```bash
git add mix.exs config/config.exs lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex lib/live_canvas/accounts/user_changes.ex lib/live_canvas_schemas.ex lib/live_canvas_schemas/accounts priv/repo/migrations test/live_canvas/accounts_test.exs test/support/fixtures/accounts_fixtures.ex test/live_canvas_web/user_auth_test.exs test/live_canvas_web/controllers/user_session_controller_test.exs docs/plans/2026-03-01-accounts-schema-token-refactor.md
git commit -m "refactor: align accounts schemas and token model"
```

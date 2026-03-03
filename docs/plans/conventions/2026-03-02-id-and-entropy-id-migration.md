# ID And Entropy ID Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt the default identifier convention without re-keying existing relations: keep bigint `id` primary keys for normal relational tables, add a Postgres-generated `entropy_id` (`uuidv7`) to those tables, and preserve explicit UUID-primary-key exceptions such as the current `users_tokens` table.

**Architecture:** Treat this as a forward-only, additive migration. The existing `id` PK/FK graph stays intact, so no joins, scopes, or foreign keys need to move off bigint IDs in this pass; instead, each normal relational table gets a new `entropy_id` column that is backfilled, indexed, and defaulted in Postgres. Centralize the schema defaults in a shared Ecto macro so relational tables consistently expose `entropy_id`, while UUID-primary-key exception tables opt into a separate macro that keeps them UUID-based but moves generation to Postgres `uuidv7()`.

**Tech Stack:** Elixir 1.15+, Phoenix 1.8, Ecto 3.13, PostgreSQL 18 (`postgis/postgis:18-3.6-alpine`), ExUnit

---

## Current State Snapshot

- `config/config.exs` already standardizes `:utc_datetime_usec`.
- The current relational account tables created by `priv/repo/migrations/20260215031653_create_users_auth_tables.exs` and `priv/repo/migrations/20260302000000_rebuild_accounts_identity_tables.exs` all use Ecto's default integer `id`, which already maps to the intended bigint-style surrogate key.
- `lib/live_canvas_schemas/accounts/*.ex` currently use `use Ecto.Schema` directly, so there is no shared ID macro and no `entropy_id` field on any relational schema.
- `lib/live_canvas_schemas/accounts/user_token.ex` is the lone exception today: it uses `@primary_key {:id, :binary_id, autogenerate: false}` and the backing `users_tokens.id` column is a UUID.
- `lib/live_canvas/accounts/tokens.ex` still generates token IDs in Elixir with `Ecto.UUID.generate()`, then serializes the token before insert.
- `priv/repo/migrations/20260302000000_rebuild_accounts_identity_tables.exs` installs `pgcrypto` and uses `gen_random_uuid()` for new `users_tokens.id` values.

## Locked Decisions

- Do not rewrite old migrations that have already defined the live schema shape. Add new forward migrations instead.
- Do not replace or rebuild the current bigint `id` primary keys. They are already the internal relational keys and should remain the FK target everywhere in this rollout.
- Do not move existing foreign keys from `*_id` bigint columns to `entropy_id`. `entropy_id` is additive in this plan.
- Use native Postgres `uuidv7()` for all new database-generated UUIDs. The checked-in Docker image is PostgreSQL 18, so prefer the built-in function over extension-managed UUID generators.
- Do not add `uuid-ossp`. Leave the existing `pgcrypto` install alone for backward compatibility with earlier migrations, but stop depending on it for new ID defaults.
- Do not rewrite existing `users_tokens.id` values from UUIDv4 to UUIDv7. In-flight session and magic-link tokens embed that UUID, so changing stored IDs would invalidate live tokens.
- Keep `users_tokens` as the explicit UUID-primary-key exception in this pass. Do not rename the table as part of this migration.
- Do not switch route params, GraphQL IDs, scope config, or public lookup APIs from `id` to `entropy_id` in the same branch. Land the storage convention first, then do any API exposure as a separate follow-up.

## Rollout Sequence

1. Add schema-level tests and shared schema macros first so the Ecto layer has one explicit convention.
2. Ship the additive database migrations next: add/backfill `entropy_id`, then add unique indexes and `NOT NULL`.
3. Update the token write path after the database default exists so `users_tokens` can rely on Postgres-generated UUIDv7 values.
4. Deploy with mixed historical token UUIDs allowed. Old UUIDv4 token rows expire naturally; only newly inserted token rows need UUIDv7.
5. Keep all internal joins and lookups on bigint `id` in this rollout. Any later move to user-facing `entropy_id` lookups belongs in a separate plan.

### Task 1: Add Shared Schema Defaults And Lock The Convention With Tests

**Files:**
- Create: `lib/live_canvas_schemas/schema.ex`
- Modify: `lib/live_canvas_schemas/accounts/email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_identity.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry_email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry_phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token.ex`
- Create: `test/live_canvas_schemas/id_conventions_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`

**Task 1 Step Progress**
- [x] Step 1: Write the failing schema-shape tests
- [x] Step 2: Run the focused tests to verify they fail
- [x] Step 3: Implement the shared schema macros and convert the schemas
- [x] Step 4: Run compile and the focused tests
- [x] Step 5: Commit

**Step 1: Write the failing schema-shape tests**

- In `test/live_canvas_schemas/id_conventions_test.exs`, add direct schema assertions for one representative relational table (`User`) and one join table (`UserEmailAddress`):
  - `__schema__(:type, :id)` stays `:id`
  - `:entropy_id` is present on relational schemas
  - `:entropy_id` is absent from `UserToken`
- In `test/live_canvas/accounts_test.exs`, replace the current "UUID primary key" wording with assertions that `UserToken` keeps a UUID primary key while normal relational schemas expose `entropy_id`.
- Add one insert-path assertion that a freshly inserted relational row comes back with a populated `entropy_id` after reload.

**Step 2: Run the focused tests to verify they fail**

Run: `mix test test/live_canvas_schemas/id_conventions_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: FAIL because the shared schema helper does not exist yet and no relational schema defines `:entropy_id`.

**Step 3: Implement the shared schema macros and convert the schemas**

- In `lib/live_canvas_schemas/schema.ex`, define two `__using__/1` modes:
  - `:relational`: `use Ecto.Schema`, `@primary_key {:id, :id, autogenerate: true}`, `@foreign_key_type :id`, `@timestamps_opts [type: :utc_datetime_usec]`
  - `:uuid_primary_key`: `use Ecto.Schema`, `@primary_key {:id, :binary_id, autogenerate: false, read_after_writes: true}`, `@foreign_key_type :id`, `@timestamps_opts [type: :utc_datetime_usec]`
- Convert every relational schema listed above to `use LiveCanvasSchemas.Schema, :relational`.
- Add `field :entropy_id, Ecto.UUID, read_after_writes: true` near the top of every relational schema. Keep the field database-generated only: do not add any Elixir-side `autogenerate`.
- Convert `lib/live_canvas_schemas/accounts/user_token.ex` to `use LiveCanvasSchemas.Schema, :uuid_primary_key` and keep it as the UUID-only exception table with no `entropy_id`.

**Step 4: Run compile and the focused tests**

Run: `mix compile`

Run: `mix test test/live_canvas_schemas/id_conventions_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: partial progress. The schema-shape assertions should PASS, while the database-backed insert assertion should still FAIL until the new migration in Task 2 adds the `entropy_id` column and default.

**Step 5: Commit**

```bash
git add lib/live_canvas_schemas/schema.ex lib/live_canvas_schemas/accounts/email_address.ex lib/live_canvas_schemas/accounts/phone_number.ex lib/live_canvas_schemas/accounts/user.ex lib/live_canvas_schemas/accounts/user_email_address.ex lib/live_canvas_schemas/accounts/user_phone_number.ex lib/live_canvas_schemas/accounts/user_identity.ex lib/live_canvas_schemas/accounts/user_contact_entry.ex lib/live_canvas_schemas/accounts/user_contact_entry_email_address.ex lib/live_canvas_schemas/accounts/user_contact_entry_phone_number.ex lib/live_canvas_schemas/accounts/user_token.ex test/live_canvas_schemas/id_conventions_test.exs test/live_canvas/accounts_test.exs
git commit -m "refactor: add schema id conventions"
```

### Task 2: Add The Forward Migration That Backfills Entropy IDs

**Files:**
- Create: `priv/repo/migrations/20260302230000_add_entropy_ids_to_existing_relational_tables.exs`
- Modify: `test/live_canvas_schemas/id_conventions_test.exs`

**Task 2 Step Progress**
- [x] Step 1: Expand the failing tests around database-generated values
- [x] Step 2: Rebuild the test database and confirm the new assertions fail
- [x] Step 3: Implement the additive migration
- [x] Step 4: Rebuild the test database and rerun the focused test
- [x] Step 5: Commit

**Step 1: Expand the failing tests around database-generated values**

- In `test/live_canvas_schemas/id_conventions_test.exs`, insert representative rows for:
  - `User`
  - `EmailAddress`
  - `UserContactEntry`
- Assert each inserted row has a non-nil `entropy_id` after insert or reload.
- Add one explicit assertion that `UserToken` inserts still succeed without supplying `id`, because Postgres should own UUID generation for that table too.

**Step 2: Rebuild the test database and confirm the new assertions fail**

Run: `MIX_ENV=test mix ecto.drop --quiet`

Run: `MIX_ENV=test mix ecto.create --quiet`

Run: `MIX_ENV=test mix ecto.migrate --quiet`

Run: `mix test test/live_canvas_schemas/id_conventions_test.exs --trace`

Expected: FAIL for the relational assertions because none of the current tables have an `entropy_id` column yet. The `UserToken` insert should still pass, proving the UUID exception already uses a database default before it is upgraded to `uuidv7()`.

**Step 3: Implement the additive migration**

- Start the migration with a fail-fast guard that calls `uuidv7()` (or a small `DO $$ ... $$` guard) so non-PostgreSQL-18 environments fail clearly instead of silently drifting.
- Add nullable `:entropy_id, :uuid` columns to every existing relational table with bigint IDs:
  - `users`
  - `email_addresses`
  - `phone_numbers`
  - `user_email_addresses`
  - `user_phone_numbers`
  - `user_identities`
  - `user_contact_entries`
  - `user_contact_entry_email_addresses`
  - `user_contact_entry_phone_numbers`
- Backfill each table with `UPDATE <table> SET entropy_id = uuidv7() WHERE entropy_id IS NULL`.
- Set the default for every new relational `entropy_id` column to `uuidv7()` after the backfill completes.
- Change `users_tokens.id` to `ALTER COLUMN id SET DEFAULT uuidv7()`.
- Do not touch existing PKs, FKs, or composite unique indexes in this migration.

**Step 4: Rebuild the test database and rerun the focused test**

Run: `MIX_ENV=test mix ecto.drop --quiet`

Run: `MIX_ENV=test mix ecto.create --quiet`

Run: `MIX_ENV=test mix ecto.migrate --quiet`

Run: `mix test test/live_canvas_schemas/id_conventions_test.exs --trace`

Expected: PASS. Representative relational rows now receive `entropy_id`, and `UserToken` inserts still work without an application-generated `id`.

**Step 5: Commit**

```bash
git add priv/repo/migrations/20260302230000_add_entropy_ids_to_existing_relational_tables.exs test/live_canvas_schemas/id_conventions_test.exs
git commit -m "feat: backfill entropy ids"
```

### Task 3: Finalize Uniqueness, Indexing, And Nullability

**Files:**
- Create: `priv/repo/migrations/20260302231000_finalize_entropy_id_indexes.exs`
- Modify: `test/live_canvas_schemas/id_conventions_test.exs`

**Step 1: Add the failing uniqueness assertion**

- In `test/live_canvas_schemas/id_conventions_test.exs`, insert one `EmailAddress`, then attempt a second insert with the same explicit `entropy_id`.
- Assert the second insert raises `Ecto.ConstraintError` or returns a unique-constraint changeset once the unique index exists.
- Keep this to one representative table; if `EmailAddress.entropy_id` is protected, the migration pattern is correct for the other relational tables too.

**Step 2: Run the focused test to verify it fails**

Run: `mix test test/live_canvas_schemas/id_conventions_test.exs --trace`

Expected: FAIL because there is no unique index on `email_addresses.entropy_id` yet.

**Step 3: Implement the index and constraint migration**

- Mark the migration with `@disable_ddl_transaction true` because the unique indexes should be created concurrently.
- Create a unique index on `:entropy_id` for every relational table listed in Task 2 using explicit names, for example `:users_entropy_id_index`.
- Create those indexes with `concurrently: true`.
- After the indexes exist, set every relational `entropy_id` column to `NOT NULL`.
- Keep all existing FK indexes and join-table composite indexes untouched.

**Step 4: Rebuild the test database, verify rollback, and rerun the focused test**

Run: `MIX_ENV=test mix ecto.drop --quiet`

Run: `MIX_ENV=test mix ecto.create --quiet`

Run: `MIX_ENV=test mix ecto.migrate --quiet`

Run: `MIX_ENV=test mix ecto.rollback --step 2`

Run: `MIX_ENV=test mix ecto.migrate --quiet`

Run: `mix test test/live_canvas_schemas/id_conventions_test.exs --trace`

Expected: PASS. The schema can migrate forward from scratch, roll back both new migrations, migrate forward again, and enforce uniqueness on `entropy_id`.

**Step 5: Commit**

```bash
git add priv/repo/migrations/20260302231000_finalize_entropy_id_indexes.exs test/live_canvas_schemas/id_conventions_test.exs
git commit -m "feat: enforce entropy id constraints"
```

### Task 4: Move Token ID Generation Fully Into Postgres

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token.ex`
- Modify: `test/live_canvas/accounts/user_token_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`

**Step 1: Write the failing token-path tests**

- In `test/live_canvas/accounts/user_token_test.exs`, assert that `Accounts.issue_access_token/1` returns:
  - a persisted `%UserToken{}` with a non-nil `id`
  - a serialized token whose decoded `id` exactly matches `persisted.id`
- In `test/live_canvas/accounts_test.exs`, keep the existing transport-format assertions, but make the expectation explicit that the ID segment is database-generated.
- Update any fixture helper that inserts a `UserToken` manually so the test no longer needs to assign `id: Ecto.UUID.generate()` just to create a row.

**Step 2: Run the focused token tests to verify they fail**

Run: `mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: FAIL once the tests stop relying on Elixir-generated UUIDs, because `Tokens.build_token/3` still serializes the token before the row is inserted.

**Step 3: Implement the minimal token write-path change**

- In `lib/live_canvas/accounts/tokens.ex`, stop calling `Ecto.UUID.generate()` inside `build_token/3`.
- Change `build_token/3` so it returns the raw secret plus an insertable `%UserToken{}` payload without a precomputed serialized token string.
- In `lib/live_canvas/accounts.ex`, move `Tokens.encode_serialized_value/2` to after `Repo.insert/1` succeeds in both:
  - `issue_user_token/3`
  - `generate_user_session_token/1`
- Rely on the `read_after_writes: true` UUID primary-key definition from Task 1 so the inserted token row comes back with the database-generated UUIDv7 `id`.
- Keep `Tokens.decode_serialized_value/1` unchanged except for any documentation updates; the transport format remains `"<uuid>.<secret>"`.

**Step 4: Run the focused token tests**

Run: `mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: PASS. Token rows persist with Postgres-generated UUIDv7 IDs, and the serialized token string still round-trips through the existing decoder.

**Step 5: Commit**

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex lib/live_canvas_schemas/accounts/user_token.ex test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs test/support/fixtures/accounts_fixtures.ex
git commit -m "refactor: use db generated token ids"
```

### Task 5: Document The Completed Convention And Run Full Verification

**Files:**
- Modify: `docs/architecture/conventions.md`
- Verify: `config/config.exs`
- Verify: `docker-compose.yml`
- Verify: `lib/live_canvas_schemas/schema.ex`
- Verify: `lib/live_canvas_schemas/accounts/*.ex`
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas/accounts/tokens.ex`
- Verify: `priv/repo/migrations/20260302230000_add_entropy_ids_to_existing_relational_tables.exs`
- Verify: `priv/repo/migrations/20260302231000_finalize_entropy_id_indexes.exs`
- Verify: `test/live_canvas_schemas/id_conventions_test.exs`
- Verify: `test/live_canvas/accounts_test.exs`
- Verify: `test/live_canvas/accounts/user_token_test.exs`

**Step 1: Update the convention document only after the code is green**

- Flip the "Existing relational tables still need the `bigint` plus `entropy_id` migration" checkbox in `docs/architecture/conventions.md`.
- Clarify that `users_tokens` remains the UUID exception and that old UUIDv4 token rows are expected until they expire.

**Step 2: Run formatting**

Run: `mix format lib/live_canvas_schemas/schema.ex lib/live_canvas_schemas/accounts/*.ex lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex priv/repo/migrations/20260302230000_add_entropy_ids_to_existing_relational_tables.exs priv/repo/migrations/20260302231000_finalize_entropy_id_indexes.exs test/live_canvas_schemas/id_conventions_test.exs test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs test/support/fixtures/accounts_fixtures.ex docs/architecture/conventions.md`

Expected: no diff after formatting reruns.

**Step 3: Run compile, migration, and focused test verification**

Run: `mix compile`

Run: `MIX_ENV=test mix ecto.drop --quiet`

Run: `MIX_ENV=test mix ecto.create --quiet`

Run: `MIX_ENV=test mix ecto.migrate --quiet`

Run: `mix test test/live_canvas_schemas/id_conventions_test.exs test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: PASS for compile, migrations, and the targeted schema/token regression suite.

**Step 4: Run the repository verification pass**

Run: `mix precommit`

Expected: PASS. This confirms compile, formatting, tests, and the existing local precommit checks all still hold after the convention change.

**Step 5: Commit**

```bash
git add docs/architecture/conventions.md lib/live_canvas_schemas/schema.ex lib/live_canvas_schemas/accounts lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex priv/repo/migrations/20260302230000_add_entropy_ids_to_existing_relational_tables.exs priv/repo/migrations/20260302231000_finalize_entropy_id_indexes.exs test/live_canvas_schemas/id_conventions_test.exs test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs test/support/fixtures/accounts_fixtures.ex
git commit -m "feat: adopt entropy id schema convention"
```

## Final Verification Checklist

Before calling the work complete, run these commands in order:

1. `mix format lib/live_canvas_schemas/schema.ex lib/live_canvas_schemas/accounts/*.ex lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex priv/repo/migrations/20260302230000_add_entropy_ids_to_existing_relational_tables.exs priv/repo/migrations/20260302231000_finalize_entropy_id_indexes.exs test/live_canvas_schemas/id_conventions_test.exs test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs test/support/fixtures/accounts_fixtures.ex docs/architecture/conventions.md`
2. `mix compile`
3. `MIX_ENV=test mix ecto.drop --quiet`
4. `MIX_ENV=test mix ecto.create --quiet`
5. `MIX_ENV=test mix ecto.migrate --quiet`
6. `MIX_ENV=test mix ecto.rollback --step 2`
7. `MIX_ENV=test mix ecto.migrate --quiet`
8. `mix test test/live_canvas_schemas/id_conventions_test.exs test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace`
9. `mix precommit`

Expected final result:

- all relational schemas expose bigint `id` plus database-generated `entropy_id`
- `users_tokens` remains UUID-primary-key only, but new rows get Postgres-generated UUIDv7 values
- existing FK relationships and internal lookups still use bigint `id`
- the two new migrations run cleanly forward, roll back cleanly, and rerun cleanly
- the focused schema/token regression suite passes before the broader precommit pass

## Follow-Up Explicitly Out Of Scope

- Replacing route params, GraphQL node IDs, or public API identifiers with `entropy_id`
- Re-keying foreign keys away from bigint `id`
- Renaming `users_tokens` to `user_tokens`
- Cleaning up the historical `pgcrypto` extension from older migrations

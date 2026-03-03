# Accounts Contact Matching And Invites Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the first executable slice of the deferred contact-matching and invite workflow by shipping contact import plus deterministic account matching APIs, then layering Relay-first GraphQL and invite delivery wrappers.

**Architecture:** Keep contact ingestion and matching owned by `LC.Accounts` so persistence and normalization stay in one boundary. Add deterministic read models that return matched users per imported contact entry, then expose that model through Relay connections and nodes. Build invite delivery as a thin wrapper over token issuance/notifier seams so later SMS/email provider work can evolve without changing context contracts.

**Tech Stack:** Elixir 1.15, Ecto, PostgreSQL, Absinthe Relay, ExUnit, Dialyzer

---

## Progress

- [x] Task 1: Add `Accounts` contact import and matching APIs
- [x] Task 2: Expose contact matches through Relay-first GraphQL
- [x] Task 3: Add invite issuance and notifier wrappers
- [x] Task 4: Run final verification and integration checks

### Task 1: Add `Accounts` Contact Import And Matching APIs

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`
- Verify: `lib/live_canvas_schemas/accounts/user_contact_entry.ex`
- Verify: `lib/live_canvas_schemas/accounts/user_contact_entry_email_address.ex`
- Verify: `lib/live_canvas_schemas/accounts/user_contact_entry_phone_number.ex`

**Task 1 Step Progress:**
- [x] Step 1: Write failing contact import and match tests
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement minimal Accounts APIs
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run typing gate for touched context code and commit

**Step 1: Write failing contact import and match tests**

Add context tests that define the intended public boundary behavior:
- `upsert_user_contact_entry/2` inserts a contact row, normalizes identifiers, and attaches email/phone joins.
- Re-running `upsert_user_contact_entry/2` for the same `contact_client_id` updates the entry instead of creating duplicates.
- `list_user_contact_matches/1` returns deterministic per-contact match records and excludes self-matches.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/accounts_test.exs --trace
```

Expected: FAIL with undefined function errors for the new Accounts APIs.

**Step 3: Implement minimal Accounts APIs**

In `LC.Accounts` add:
- Typed input/result aliases for contact import and matching payloads.
- `upsert_user_contact_entry/2` with transaction-based upsert by `{user_id, contact_client_id}`.
- Normalization helpers for email and phone lists.
- Join-table synchronization helpers for `user_contact_entry_email_addresses` and `user_contact_entry_phone_numbers`.
- `list_user_contact_matches/1` that returns `%{contact_entry: ..., matched_users: [...]}` in stable order.

Keep non-obvious query/merge logic commented and keep schema modules schema-only.

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/accounts_test.exs --trace
```

Expected: PASS for new and existing `Accounts` tests.

**Step 5: Run typing gate for touched context code and commit**

Run:

```bash
mix check.typespecs --strict
mix typecheck
```

Then commit:

```bash
git add lib/live_canvas/accounts.ex test/live_canvas/accounts_test.exs test/support/fixtures/accounts_fixtures.ex docs/plans/2026-03-03-accounts-contact-matching-and-invites.md
git commit -m "feat: add accounts contact import and matching apis"
```

### Task 2: Expose Contact Matches Through Relay-First GraphQL

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Create: `test/live_canvas_gql/accounts/contact_queries_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Write failing GraphQL query tests
- [x] Step 2: Run focused GraphQL tests to verify RED
- [x] Step 3: Implement minimal Relay schema and resolver wiring
- [x] Step 4: Run focused GraphQL tests to verify GREEN
- [x] Step 5: Commit

**Step 1: Write failing GraphQL query tests**

Add GraphQL tests for authenticated `viewerContactMatches(first:, after:)` connection behavior:
- Returns edges with stable cursors and `node` payloads.
- Decodes Relay user IDs and only returns authorized viewer-owned entries.
- Exposes matched users as Relay nodes.

**Step 2: Run focused GraphQL tests to verify RED**

Run:

```bash
mix test test/live_canvas_gql/accounts/contact_queries_test.exs --trace
```

Expected: FAIL because schema fields/resolvers do not exist yet.

**Step 3: Implement minimal Relay schema and resolver wiring**

Add:
- `contact_match` Relay node/object type.
- `viewer_contact_matches` connection field under authenticated account queries.
- Resolver that reads from `Accounts.list_user_contact_matches/1` and uses `Absinthe.Relay.Connection.from_list/2`.

Keep resolver logic thin and context-driven.

**Step 4: Run focused GraphQL tests to verify GREEN**

Run:

```bash
mix test test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs --trace
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/live_canvas_gql/accounts/account_queries.ex lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/schema.ex test/live_canvas_gql/accounts/contact_queries_test.exs docs/plans/2026-03-03-accounts-contact-matching-and-invites.md
git commit -m "feat: add relay viewer contact match query"
```

### Task 3: Add Invite Issuance And Notifier Wrappers

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/user_notifier.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token_context.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Create: `priv/repo/migrations/TIMESTAMP_add_contact_invite_token_context.exs`
- Modify: `test/live_canvas/accounts/user_token_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`

**Task 3 Step Progress:**
- [x] Step 1: Write failing invite token and delivery tests
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Add token context and minimal wrapper implementation
- [x] Step 4: Run focused verification
- [x] Step 5: Commit

**Step 1: Write failing invite token and delivery tests**

Add tests that assert:
- `issue_contact_invite_token/2` persists a token with a dedicated context.
- `deliver_contact_invite_instructions/3` routes through the public token wrapper and notifier.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace
```

Expected: FAIL for unknown token context/wrapper functions.

**Step 3: Add token context and minimal wrapper implementation**

Implement:
- Additive enum migration for `contact_invite_token`.
- Context enum updates in schema type modules.
- Accounts wrappers and notifier call path.

Keep persisted token hashing unchanged (SHA3) and keep UUIDv7 token PK behavior untouched.

**Step 4: Run focused verification**

Run:

```bash
mix ecto.migrate
mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace
mix typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas/accounts/tokens.ex lib/live_canvas/accounts/user_notifier.ex lib/live_canvas_schemas/accounts/user_token_context.ex lib/live_canvas_schemas/accounts.ex priv/repo/migrations/*_add_contact_invite_token_context.exs test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs docs/plans/2026-03-03-accounts-contact-matching-and-invites.md
git commit -m "feat: add contact invite token and delivery wrapper"
```

### Task 4: Final Verification And Integration Checks

**Files:**
- Modify: `docs/plans/2026-03-03-accounts-contact-matching-and-invites.md`
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Verify: `lib/live_canvas_gql/accounts/account_types.ex`
- Verify: `lib/live_canvas_gql/accounts/account_resolver.ex`

**Step 1: Mark checklist progress in this plan file**

Update each task checkbox as it reaches fully green and committed status.

**Task 4 Step Progress:**
- [x] Step 1: Mark checklist progress in this plan file
- [x] Step 2: Run required verification
- [x] Step 3: Commit final plan state with related code/test changes (no docs-only commit)

**Step 2: Run required verification**

Run:

```bash
mix compile
mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs --trace
mix check.typespecs --strict
mix typecheck
mix precommit
```

Expected: PASS.

**Step 3: Commit final plan state**

Commit together with the Task 3 implementation files so checklist updates are not a standalone docs-only change.

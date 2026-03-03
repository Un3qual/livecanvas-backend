# Accounts Contact GraphQL Write Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the next contact-matching/invite architecture slice by adding Relay-complete contact-match node lookups and viewer-scoped GraphQL mutations for contact upsert plus invite delivery.

**Architecture:** Keep `LC.Accounts` as the owner of contact import and invite issuance; GraphQL remains adapter-thin and Relay-first. Add a bounded Accounts read helper for a single contact-match node to support `node(id:)` refetch while enforcing viewer ownership. Then layer authenticated viewer-scoped mutations that call existing Accounts APIs (`upsert_user_contact_entry/2`, `deliver_contact_invite_instructions/3`) without introducing GraphQL logic into the context.

**Tech Stack:** Elixir 1.15, Ecto, PostgreSQL, Absinthe Relay, ExUnit, Dialyzer

---

## Progress

- [x] Task 1: Add Relay `node(id:)` support for `contact_match`
- [ ] Task 2: Add `upsertViewerContactEntry` Relay mutation
- [ ] Task 3: Add `deliverViewerContactInvite` Relay mutation
- [ ] Task 4: Run final verification and close the plan

### Task 1: Add Relay `node(id:)` Support For `contact_match`

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `docs/plans/2026-03-03-accounts-contact-graphql-write-slice.md`

**Task 1 Step Progress:**
- [x] Step 1: Write failing Relay node test for `contact_match`
- [x] Step 2: Run focused Relay tests to verify RED
- [x] Step 3: Implement minimal Accounts + schema support for viewer-owned contact match node lookup
- [x] Step 4: Run focused Relay tests to verify GREEN
- [x] Step 5: Commit Task 1 milestone

**Step 1: Write failing Relay node test for `contact_match`**

In `test/live_canvas_gql/relay/node_queries_test.exs`, add coverage that:
- creates a viewer, a matched user, and a contact entry via `Accounts.upsert_user_contact_entry/2`
- builds a `contact_match` global ID
- queries `node(id:)` with a `... on ContactMatch` fragment and asserts `contactName` + `matchedUsers`
- asserts unauthorized access (no context or wrong viewer) returns `node: null`

**Step 2: Run focused Relay tests to verify RED**

Run:

```bash
mix test test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: FAIL because `LCGQL.Schema` does not currently fetch `:contact_match` nodes.

**Step 3: Implement minimal Accounts + schema support for viewer-owned contact match node lookup**

Implement:
- `LC.Accounts.get_user_contact_match/2` that returns a single `%{contact_entry: ..., matched_users: [...]}` for a viewer-owned contact entry id, or `nil` when missing.
- `LCGQL.Schema` node resolver branch for `%{type: :contact_match, id: id}` that:
  - requires authenticated `current_scope.user`
  - calls the new Accounts helper
  - returns `{:ok, nil}` when unauthorized or missing.

Implementation notes:
- Keep matching logic DRY by reusing existing contact preload and match helpers.
- Add concise comments only where ownership checks or node-boundary behavior may be non-obvious.
- Add public typespecs for new context function(s).

**Step 4: Run focused Relay tests to verify GREEN**

Run:

```bash
mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs
```

Expected: PASS.

**Step 5: Commit Task 1 milestone**

Run:

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas_gql/schema.ex test/live_canvas_gql/relay/node_queries_test.exs docs/plans/2026-03-03-accounts-contact-graphql-write-slice.md
git commit -m "feat: add relay contact match node lookup"
```

### Task 2: Add `upsertViewerContactEntry` Relay Mutation

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `docs/plans/2026-03-03-accounts-contact-graphql-write-slice.md`

**Task 2 Step Progress:**
- [ ] Step 1: Write failing mutation tests for viewer-scoped contact upsert
- [ ] Step 2: Run focused GraphQL mutation tests to verify RED
- [ ] Step 3: Implement minimal mutation input decoding and Accounts delegation
- [ ] Step 4: Run focused GraphQL tests to verify GREEN
- [ ] Step 5: Commit Task 2 milestone

**Step 1: Write failing mutation tests for viewer-scoped contact upsert**

Add GraphQL tests that define mutation behavior:
- authenticated viewer can upsert by `contactClientId` and receives Relay `contactMatch` node payload
- rerunning mutation with same `contactClientId` updates fields (idempotent upsert)
- invalid birthday/phone/email inputs return structured `errors`
- unauthenticated execution returns structured auth error and no node

**Step 2: Run focused GraphQL mutation tests to verify RED**

Run:

```bash
mix test test/live_canvas_gql/accounts/account_mutations_test.exs
```

Expected: FAIL because mutation does not exist yet.

**Step 3: Implement minimal mutation input decoding and Accounts delegation**

Implement:
- Relay payload mutation `upsert_viewer_contact_entry`
- input object with `contact_client_id`, optional `contact_name`, optional `birthday`, `emails`, `phone_numbers`
- resolver path that reads authenticated viewer from `current_scope`, calls `Accounts.upsert_user_contact_entry/2`, and returns `contactMatch` + `errors`
- formatting for known Accounts errors (`invalid_contact_client_id`, `invalid_birthday`, `invalid_phone_number`, `invalid_email_list`) into GraphQL field errors

**Step 4: Run focused GraphQL tests to verify GREEN**

Run:

```bash
mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs
```

Expected: PASS.

**Step 5: Commit Task 2 milestone**

```bash
git add lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/accounts/account_types.ex test/live_canvas_gql/accounts/account_mutations_test.exs docs/plans/2026-03-03-accounts-contact-graphql-write-slice.md
git commit -m "feat: add viewer contact upsert mutation"
```

### Task 3: Add `deliverViewerContactInvite` Relay Mutation

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `docs/plans/2026-03-03-accounts-contact-graphql-write-slice.md`

**Task 3 Step Progress:**
- [ ] Step 1: Write failing mutation tests for invite delivery
- [ ] Step 2: Run focused tests to verify RED
- [ ] Step 3: Implement minimal mutation wrapper using existing Accounts notifier path
- [ ] Step 4: Run focused tests to verify GREEN
- [ ] Step 5: Commit Task 3 milestone

**Step 1: Write failing mutation tests for invite delivery**

Add GraphQL tests that verify:
- authenticated viewer can request invite delivery to a recipient email
- mutation returns `successful: true` and empty `errors`
- invalid recipient values surface structured errors
- unauthenticated requests return `successful: false` with auth error

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas/accounts_test.exs
```

Expected: FAIL because the mutation/resolver branch does not exist.

**Step 3: Implement minimal mutation wrapper using existing Accounts notifier path**

Implement:
- Relay payload mutation `deliver_viewer_contact_invite`
- resolver that delegates to `Accounts.deliver_contact_invite_instructions/3`
- use a deterministic URL builder function at the GraphQL boundary (placeholder host path from app config or a stable fallback) without embedding transport-specific logic in Accounts
- map failure modes into consistent GraphQL `errors` list

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas/accounts_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs
```

Expected: PASS.

**Step 5: Commit Task 3 milestone**

```bash
git add lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas/accounts_test.exs docs/plans/2026-03-03-accounts-contact-graphql-write-slice.md
git commit -m "feat: add viewer contact invite mutation"
```

### Task 4: Final Verification And Plan Closeout

**Files:**
- Modify: `docs/plans/2026-03-03-accounts-contact-graphql-write-slice.md`
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Verify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Verify: `lib/live_canvas_gql/schema.ex`

**Task 4 Step Progress:**
- [ ] Step 1: Mark all completed checklist items in this plan file
- [ ] Step 2: Run required verification suite
- [ ] Step 3: Commit final plan state with related code/test changes

**Step 2: Run required verification suite**

Run:

```bash
mix compile
mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas/accounts_test.exs
mix check.typespecs --strict
mix typecheck
mix precommit
```

Expected: PASS.

**Step 3: Commit final plan state with related implementation files**

Do not create a docs-only progress commit; include checklist updates with the final code/testing batch.

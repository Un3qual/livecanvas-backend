# Relay Mutation Payload Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the remaining temporary GraphQL `successful` boolean payload fields so Accounts and Social mutations fully align with Relay-style typed payloads and structured errors.

**Architecture:** Keep GraphQL adapter behavior thin and deterministic: mutation success/failure should be represented through payload data (`errors` and typed objects), not an auxiliary boolean flag. Apply the cleanup in one focused breaking-change slice that updates schema definitions, resolver payload shapes, and tests together so the API contract stays coherent.

**Tech Stack:** Elixir 1.15+, Absinthe Relay (`:modern`), ExUnit

---

## Status Verification Snapshot (2026-03-03)

- Verified complete in code:
  - `viewer` no longer accepts `userId` (`lib/live_canvas_gql/accounts/account_queries.ex`).
  - Relay global ID decoding is strict (no raw-ID fallback) (`lib/live_canvas_gql/relay.ex`).
  - `registerWithEmail` and `attachUserPhoneNumber` payloads no longer expose `successful` (`test/live_canvas_gql/accounts/account_mutations_test.exs` schema cleanup assertions).
- Verified incomplete in code:
  - `deliverViewerContactInvite` still exposes `successful`.
  - `blockUser`, `muteUser`, and `unmuteUser` still expose `successful`.
  - `object :successful_payload` still exists as dead legacy type.

## Progress Checklist

- [x] Task 1: Add failing cleanup assertions for remaining `successful` fields
- [x] Task 2: Remove `successful` from Accounts and Social mutation payload contracts
- [x] Task 3: Run focused verification, update checklist, and commit the milestone

### Task 1: Add Failing Cleanup Assertions For Remaining `successful` Fields

**Files:**
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`

**Step 1: Add failing schema cleanup assertions in Accounts mutation tests**

- Extend the existing `describe "schema cleanup"` block to assert that SDL no longer includes:
  - `DeliverViewerContactInvitePayload.successful: Boolean!`

**Step 2: Add failing schema cleanup assertions in Social mutation tests**

- Add a schema cleanup test that asserts SDL no longer includes:
  - `BlockUserPayload.successful: Boolean!`
  - `MuteUserPayload.successful: Boolean!`
  - `UnmuteUserPayload.successful: Boolean!`

**Step 3: Run focused mutation tests to verify RED**

Run:
- `mix test test/live_canvas_gql/accounts/account_mutations_test.exs`
- `mix test test/live_canvas_gql/social/social_mutations_test.exs`

Expected: FAIL on the new SDL assertions while `successful` fields are still present.

### Task 2: Remove `successful` From Accounts And Social Mutation Payload Contracts

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/social/social_mutations.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`

**Step 1: Remove schema-level `successful` output fields**

- Delete `field :successful, non_null(:boolean)` from:
  - `deliver_viewer_contact_invite` payload output
  - `block_user` payload output
  - `mute_user` payload output
  - `unmute_user` payload output
- Delete unused `object :successful_payload` from `account_types.ex`.

**Step 2: Update resolver payload shapes**

- In Accounts invite delivery resolver:
  - Success payload: `%{errors: []}`
  - Failure payloads: `%{errors: [error]}`
- In Social block/mute/unmute resolvers:
  - Success payload: `%{errors: []}`
  - Failure payloads: `%{errors: [error]}`
- Update associated typespecs to match the new payload maps.

**Step 3: Update mutation tests to match the new contract**

- Remove `successful` from GraphQL selection sets.
- Assert success via `errors == []`.
- Keep side-effect assertions (`Social.muted?/2`, delivery expectations) intact.

**Step 4: Run focused mutation tests to verify GREEN**

Run:
- `mix test test/live_canvas_gql/accounts/account_mutations_test.exs`
- `mix test test/live_canvas_gql/social/social_mutations_test.exs`

Expected: PASS with no `successful` payload usage.

### Task 3: Final Verification And Milestone Commit

**Files:**
- Modify: `docs/plans/conventions/2026-03-03-relay-mutation-payload-cleanup.md`
- Verify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Verify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Verify: `lib/live_canvas_gql/accounts/account_types.ex`
- Verify: `lib/live_canvas_gql/social/social_mutations.ex`
- Verify: `lib/live_canvas_gql/social/social_resolver.ex`
- Verify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Verify: `test/live_canvas_gql/social/social_mutations_test.exs`

**Step 1: Run formatting**

Run:
- `mix format lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/social/social_mutations.ex lib/live_canvas_gql/social/social_resolver.ex test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/social/social_mutations_test.exs docs/plans/conventions/2026-03-03-relay-mutation-payload-cleanup.md`

Expected: clean formatting.

**Step 2: Run focused verification plus typing**

Run:
- `mix test test/live_canvas_gql/accounts/account_mutations_test.exs`
- `mix test test/live_canvas_gql/social/social_mutations_test.exs`
- `mix typecheck`

Expected: PASS.

**Step 3: Mark checklist items complete in this plan file**

- Mark Tasks 1-3 complete once all related code/tests/verification are complete.

**Step 4: Commit the milestone**

```bash
git add docs/plans/conventions/2026-03-03-relay-mutation-payload-cleanup.md lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/social/social_mutations.ex lib/live_canvas_gql/social/social_resolver.ex test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/social/social_mutations_test.exs
git commit -m "refactor: remove legacy successful relay payload fields"
```

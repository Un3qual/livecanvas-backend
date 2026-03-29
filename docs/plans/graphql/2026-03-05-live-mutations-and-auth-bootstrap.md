# GraphQL Live Mutations And Auth Bootstrap Implementation Plan

**Goal:** Deliver missing GraphQL product APIs for live session lifecycle mutations and first-party auth bootstrap flows for API-only clients.

**Architecture:** Extend the existing GraphQL boundary using viewer-scoped Relay payload mutations that map directly into current `LC.Live` and `LC.Accounts` domain APIs. Keep transport-layer behavior explicit at resolver boundaries (ID decoding, ownership checks, and error contract mapping) while leaving core auth/live state transitions in context modules.

**Tech Stack:** Elixir, Phoenix, Absinthe Relay, Ecto, ExUnit

---

## Scope Decisions

- Include live-session mutations: start, go-live, join, leave, end.
- Include auth bootstrap mutations: password login, magic-link request, magic-link consume.
- Keep existing `issueViewerAuthTokens`, refresh, and revoke flows unchanged.

## Progress Checklist

- [x] Task 1: Add Relay live-session lifecycle mutation surface (start/go-live/join/leave/end)
- [x] Task 2: Add Relay auth bootstrap mutation surface (password login + magic-link request/consume)
- [x] Task 3: Run verification, update plan/index tracking, and commit milestone

## Task 1: Live Session Lifecycle Mutations

**Files:**
- Create: `lib/live_canvas_gql/live/live_mutations.ex`
- Create: `lib/live_canvas_gql/live/live_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Test: `test/live_canvas_gql/live/live_mutations_test.exs`

**Step 1: Write failing GraphQL mutation tests for live lifecycle behavior**
- Add coverage for:
  - viewer-scoped `startLiveSession` success + unauthenticated failure
  - host-only `goLiveSession` and `endLiveSession` ownership checks
  - viewer `joinLiveSession` and `leaveLiveSession` success
  - invalid/non-live-session Relay IDs returning structured errors

- [x] Step 1 complete

**Step 2: Run focused live GraphQL tests to verify RED**
- Run: `mix test test/live_canvas_gql/live/live_mutations_test.exs`
- Expect: failure due to missing mutation fields/resolver wiring.

- [x] Step 2 complete

**Step 3: Implement live mutation schema + resolver wiring**
- Add `LCGQL.Live.Mutations` payload fields under `:live_mutations`.
- Add `LCGQL.Live.Resolver` with:
  - viewer extraction/auth guardrails
  - Relay `live_session` ID decode helper usage
  - host ownership checks for go-live/end
  - structured mutation error mapping (`unauthenticated`, `invalid_id`, `invalid_type`, `not_found`, `not_authorized`, `ended`)
- Import live mutation types/fields in `LCGQL.Schema`.
- Add non-obvious comments around ownership/error invariants.

- [x] Step 3 complete

**Step 4: Re-run focused live GraphQL tests to verify GREEN**
- Run: `mix test test/live_canvas_gql/live/live_mutations_test.exs`

- [x] Step 4 complete

**Step 5: Run compile + type checks for touched code**
- Run: `mix compile`
- Run: `mix typecheck`

- [x] Step 5 complete

## Task 2: Auth Bootstrap Mutations

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Step 1: Write failing GraphQL tests for auth bootstrap flows**
- Add tests for:
  - `loginWithPassword` issuing access+refresh tokens on valid credentials
  - `loginWithPassword` returning deterministic invalid-credential errors
  - `requestMagicLinkLogin` returning a non-enumerating response and issuing tokens only for existing users
  - `loginWithMagicLink` issuing access+refresh tokens and consuming one-time token
  - `loginWithMagicLink` invalid token error contract

- [x] Step 1 complete

**Step 2: Run focused auth mutation tests to verify RED**
- Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs`
- Expect: failures for missing mutation fields/resolvers.

- [x] Step 2 complete

**Step 3: Implement auth bootstrap mutation schema + resolver behavior**
- Add payload fields to `LCGQL.Accounts.Mutations`:
  - `login_with_password`
  - `request_magic_link_login`
  - `login_with_magic_link`
- Extend `LCGQL.Accounts.Resolver` to:
  - authenticate password via `Accounts.get_user_by_email_and_password/2`
  - issue access/refresh via existing `Accounts.issue_access_token/1` + `Accounts.issue_refresh_token/1`
  - issue magic-link delivery via `Accounts.deliver_login_instructions/2` with deterministic URL helper
  - consume magic-link tokens via `Accounts.login_user_by_magic_link/1`
  - map domain outcomes to stable GraphQL error payloads.

- [x] Step 3 complete

**Step 4: Re-run focused auth mutation tests to verify GREEN**
- Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs`

- [x] Step 4 complete

**Step 5: Run compile + type checks for touched code**
- Run: `mix compile`
- Run: `mix typecheck`

- [x] Step 5 complete

## Task 3: Verification And Tracking

**Files:**
- Modify: `docs/plans/graphql/2026-03-05-live-mutations-and-auth-bootstrap.md`
- Modify: `docs/plans/README.md`

**Step 1: Run final verification for touched slices**
- Run: `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs`
- Run: `mix precommit`

- [x] Step 1 complete

**Step 2: Update plan/index status**
- Mark completed checklist items in this plan.
- Update `docs/plans/README.md` active/recent status if needed.

- [x] Step 2 complete

**Step 3: Commit milestone**
- Commit code + tests + related plan/index updates together.

- [x] Step 3 complete

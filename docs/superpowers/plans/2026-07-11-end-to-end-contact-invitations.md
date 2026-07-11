# End-To-End Contact Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a viewer email an unmatched contact a working HTTPS invitation that safely returns through app authentication and records a one-time, recipient-bound conversion.

**Architecture:** Accounts owns opaque SHA3-hashed invite-token validation and transactional consumption. A public Phoenix landing route exposes only a generic valid/invalid state and an explicit LiveCanvas deep link; authenticated Relay consumption verifies that the viewer owns the token's verified normalized recipient email, writes a minimal conversion record, and deletes the token. Mobile preserves the token through sign-in/sign-up and exposes delivery state only after the route contract is configured.

**Tech Stack:** Elixir, Ecto/PostgreSQL, Phoenix, Absinthe Relay, ExUnit, Expo Router, React Native, TypeScript, React Relay, Bun, Jest/RNTL.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`, Batch 5.
- Execute only after Live-Chat Message Controls closes and this plan is promoted through the lane `NOW.md` files.
- Contact invite tokens expire exactly 7 days after `inserted_at`.
- Persist only SHA3-256 token hashes; never persist or log raw secrets.
- Public failures use one generic state for malformed, unknown, expired, consumed, recipient-mismatched, and tampered tokens.
- Consumption requires an authenticated viewer with a verified email whose normalized value equals `users_tokens.sent_to`.
- Consumption records conversion only. It never follows users, reveals inviter email, imports contacts, or changes profile visibility.
- The emailed link uses a configured HTTPS origin and stable `/invites/:token` path. No placeholder origin is permitted.
- Relay IDs and auth return routes remain opaque and allowlisted.
- Mobile tests stay under `mobile/tests/**`; public backend functions require typespecs and typed changes run `mix typecheck`.

---

## Executor Brief

Implement and prove the token lifecycle before enabling mobile delivery. The
conversion table is deliberately minimal: token identity, inviter, recipient
user, and consumption time. The public controller never consumes or exposes
token metadata. Mobile consumption occurs only after authentication and uses
the existing allowlisted `returnTo` mechanism.

## File Structure

- Persistence: a relational conversion schema under `LCSchemas.Accounts` plus one migration.
- Token lifecycle: `LC.Accounts.Tokens` validates serialized context/hash/expiry; `LC.Accounts` owns lookup and transactional consumption.
- Public landing: `LCWeb.ContactInviteController` and focused HTML template.
- GraphQL: Accounts contact mutation exposes authenticated consumption and configured delivery URLs.
- Mobile routing: `/invite?token=...` plus allowlisted auth return handling.
- Mobile contact UI: existing delivery mutation gains explicit row-level sent/retry/terminal states.

### Task 1: Add Recipient-Bound One-Time Consumption

**Files:**
- Create: `priv/repo/migrations/20260711120000_create_contact_invite_conversions.exs`
- Create: `lib/live_canvas_schemas/accounts/contact_invite_conversion.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts/user_token_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`

**Interfaces:**
- Produces: `Tokens.valid_contact_invite_token?/2`, `Accounts.contact_invite_status/1`, and `Accounts.consume_contact_invite/2`.
- `contact_invite_status/1` returns only `:valid | :invalid`.
- `consume_contact_invite/2` returns `{:ok, ContactInviteConversion.t()} | {:error, :invalid_contact_invite}`.

- [ ] Create `contact_invite_conversions` with bigint `id`, database-generated UUIDv7 `entropy_id`, UUID `invite_token_id`, nullable `inviter_id`, nullable `recipient_user_id`, `consumed_at :utc_datetime_usec`, and `:utc_datetime_usec` timestamps.
- [ ] Add unique indexes for `entropy_id` and `invite_token_id`; use `on_delete: :nilify_all` for both user references so deletion cannot make consumption reusable.
- [ ] Add the schema table-contract summary and typespecs. Do not store recipient email or raw token material in the conversion row.
- [ ] Add 7-day `valid_contact_invite_token?/2` validation requiring secure hash match and exact `:contact_invite_token` context.
- [ ] Implement public status lookup as a read-only, generic result. It must not return inviter, recipient, token ID, or expiry.
- [ ] Implement transactional consumption with `FOR UPDATE`: decode, lock, validate context/hash/expiry, require a verified normalized viewer email equal to `sent_to`, insert the conversion, then delete the token before commit.
- [ ] Cover valid status, malformed/tampered/wrong-context/expired/consumed status, verified recipient success, unverified or different recipient rejection, repeat consumption, and two concurrent consumers yielding exactly one conversion.
- [ ] Run `MIX_ENV=test mix ecto.reset`, `mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs`, `mix typecheck`, and focused formatting; commit with `feat: consume contact invites once`.

### Task 2: Add The HTTPS Landing Route And Configured Delivery Origin

**Files:**
- Modify: `config/config.exs`
- Modify: `config/runtime.exs`
- Modify: `config/test.exs`
- Modify: `lib/live_canvas_gql/accounts/contact_resolver.ex`
- Modify: `lib/live_canvas_web/router.ex`
- Create: `lib/live_canvas_web/controllers/contact_invite_controller.ex`
- Create: `lib/live_canvas_web/controllers/contact_invite_html.ex`
- Create: `lib/live_canvas_web/controllers/contact_invite_html/show.html.heex`
- Create: `test/live_canvas_web/controllers/contact_invite_controller_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Interfaces:**
- Consumes: `Accounts.contact_invite_status/1` and configured `:public_app_origin`.
- Produces: `GET /invites/:token` and `livecanvas-mobile://invite?token=...` on the valid landing state.

- [ ] Configure `:public_app_origin` with a local/test default and require `LIVE_CANVAS_PUBLIC_ORIGIN` in production. Validate it is an absolute `https` URI with a host and no query/fragment.
- [ ] Replace `https://livecanvas.invalid` construction with `<public_app_origin>/invites/<percent-encoded-token>`; keep URL construction at the GraphQL boundary and never include inviter/recipient values.
- [ ] Add the public `GET /invites/:token` route outside authenticated browser pipelines. The controller calls only `contact_invite_status/1` and assigns `:valid` or `:invalid`.
- [ ] Render valid invitations with neutral copy and one explicit `livecanvas-mobile://invite?token=<encoded-token>` action. Render every invalid state with the same generic expired-or-invalid copy and no deep link.
- [ ] Add `Cache-Control: no-store` and a restrictive referrer policy so token URLs are not cached or forwarded as referrers.
- [ ] Test valid landing, malformed/tampered/expired/consumed generic landing, no inviter/recipient leakage, configured HTTPS delivery URL, and startup failure for an invalid production origin.
- [ ] Run the focused controller, account mutation, and Accounts tests plus `mix typecheck`; commit with `feat: add contact invite landing route`.

### Task 3: Expose Authenticated Relay Consumption

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/contact_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `mobile/schema.graphql`

**Interfaces:**
- Produces: `consumeContactInvite(input: {token}) { consumed errors {field message} }`.
- Consumed by: Task 4.

- [ ] Add a Relay payload mutation with non-null token input, non-null boolean `consumed`, and standard `UserError` output.
- [ ] Resolve through `Accounts.consume_contact_invite/2` using only `resolution.context.current_scope.user`; never accept a viewer/recipient ID from input.
- [ ] Return `consumed: true` only for the committed conversion. Map malformed, expired, consumed, tampered, wrong-recipient, and unknown tokens to one `invalid_contact_invite` payload error.
- [ ] Return the existing unauthenticated payload shape without performing token lookup.
- [ ] Cover success, all generic failure variants, repeat consumption, wrong verified account, and unauthenticated access in GraphQL tests.
- [ ] Confirm the existing generic GraphQL mutation rate limit covers delivery and consumption; add a focused rate-limit test without creating a token-specific bypass.
- [ ] Refresh `mobile/schema.graphql`, run the focused backend tests and `mix typecheck`, and commit with `feat: expose contact invite consumption`.

### Task 4: Preserve Invite Routing Through Authentication

**Files:**
- Modify: `mobile/src/config/runtime.ts`
- Create: `mobile/src/contacts/contactInviteState.ts`
- Create: `mobile/src/contacts/contactInviteOperations.ts`
- Create: `mobile/src/contacts/ContactInviteScreen.tsx`
- Create: `mobile/app/invite.tsx`
- Modify: `mobile/tests/config/runtime.test.ts`
- Create: `mobile/tests/contacts/contactInviteState.test.ts`
- Create: `mobile/tests/contacts/ContactInviteScreen.rntl.tsx`
- Generate: `mobile/src/__generated__/contactInviteOperationsConsumeMutation.graphql.ts`

**Interfaces:**
- Produces: allowlisted `/invite?token=...` parsing, `contactInviteConsumeMutation`, `ContactInviteState`, and `ContactInviteScreen`.
- Consumed by: Task 5 delivery/readback tests.

- [ ] Add `/invite` to known routes and authenticated return-to routes. Preserve exactly one nonblank token query value; reject arrays, missing tokens, malformed decoding, and arbitrary nested return targets.
- [ ] Normalize both `livecanvas-mobile://invite?token=...` and HTTPS `/invites/:token` startup URLs to `/invite?token=...` without logging the token.
- [ ] When unauthenticated, show neutral invitation copy with Sign in and Create account actions built through `authRouteHref(..., '/invite?token=...')`.
- [ ] After successful password or provider authentication, return to the allowlisted invite route and commit `consumeContactInvite` once. Already authenticated viewers consume from the same screen.
- [ ] Render exactly `checking`, `requires_auth`, `consuming`, `consumed`, `invalid`, and `retryable_error` states; invalid payloads do not disclose recipient mismatch or token history.
- [ ] Guard duplicate commits and stale callbacks by attempt ID, and clear the token from navigation after success so a refresh cannot re-submit it.
- [ ] Run `cd mobile && bun run relay`, focused runtime/state/screen tests, `bun run typecheck`, and `bun run typecheck:tests`; commit with `feat: consume contact invites in mobile`.

### Task 5: Enable Contact-Row Invite Delivery

**Files:**
- Modify: `mobile/src/contacts/ContactDiscoveryScreen.tsx`
- Modify: `mobile/src/contacts/contactDiscoveryState.ts`
- Modify: `mobile/tests/contacts/ContactDiscoveryScreen.rntl.tsx`
- Modify: `mobile/tests/contacts/contactDiscoveryState.test.ts`

**Interfaces:**
- Consumes: existing `contactDiscoveryDeliverInviteMutation` and the deployed/configured landing contract.
- Produces: explicit unmatched-contact invitation states.

- [ ] Show Send invite only for an unmatched row with a normalized `inviteRecipient`; matched rows continue to expose profile navigation only.
- [ ] Track per-recipient `idle`, `sending`, `sent`, `retryable_error`, and `terminal_invalid_recipient` states with a same-tick duplicate guard.
- [ ] Map successful delivery to Sent, transport/delivery failures to Retry, and invalid-recipient payloads to a terminal viewer-safe state. Do not display the emailed token or URL.
- [ ] Preserve pagination/search rows across delivery responses and ignore stale completion after a row is replaced or becomes matched.
- [ ] Replace the existing "hides invite delivery" test with delivery success, duplicate tap, retry, invalid recipient, matched-row suppression, and stale-row completion coverage.
- [ ] Run all focused contact/invite tests, then `cd mobile && bun run test:quality` and root `git diff --check`; commit with `feat: enable contact invite delivery`.

## Completion And Handoff

- Close Batch 5 only after migrations, backend tests/typecheck, public route tests, Relay generation, and the full mobile quality gate pass.
- After closure, update the coordinator and lane pointers to state that all five product batches are complete and resume `docs/plans/mobile/2026-06-25-release-candidate-checklist.md` as the next explicit gate.
- Do not add automatic relationships, native address-book import, bulk upload, or store-distribution work to this batch.

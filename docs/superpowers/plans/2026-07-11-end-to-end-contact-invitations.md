# End-To-End Contact Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a viewer email an unmatched contact a working HTTPS invitation that safely returns through app authentication and records a one-time, recipient-bound conversion.

**Architecture:** Accounts owns opaque SHA3-hashed invite-token validation and transactional consumption. Emailed HTTPS links keep the raw token in a URL fragment, so it is never sent to Phoenix, proxies, request telemetry, or referrers; a neutral public landing page uses a static client asset to translate that fragment into an explicit LiveCanvas deep link. Authenticated Relay consumption requires the viewer to own the normalized recipient email. A matching verified email consumes directly; for password sign-up, possession of the recipient-bound email token atomically verifies only that matching email and confirms the account before recording conversion and deleting the token. Mobile preserves the token through sign-in/sign-up and exposes delivery state only after the route contract is configured.

**Tech Stack:** Elixir, Ecto/PostgreSQL, Phoenix, Absinthe Relay, ExUnit, Expo Router, React Native, TypeScript, React Relay, Bun, Jest/RNTL.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`, Batch 5.
- Execute only after Live-Chat Message Controls closes and this plan is promoted through the lane `NOW.md` files.
- Contact invite tokens expire exactly 7 days after `inserted_at`.
- In backend/database persistence, store only SHA3-256 token hashes. Mobile may retain the raw token only in the Task 4 fixed-slot SecureStore handoff for at most one hour; never place it in ordinary app storage or logs.
- Public failures use one generic state for malformed, unknown, expired, consumed, recipient-mismatched, and tampered tokens.
- Consumption requires an authenticated viewer who owns an email whose normalized value equals `users_tokens.sent_to`. The email must already be verified, or the locked recipient-bound invite token itself must atomically verify that exact email and confirm a password-created account before conversion; the token cannot verify any different email.
- Consumption records conversion only. It never follows users, reveals inviter email, imports contacts, or changes profile visibility.
- The emailed link uses a configured HTTPS origin and stable `/invites#token=<encoded-token>` URL. The raw token must never appear in a server-visible path, query string, log, telemetry event, or referrer. No placeholder origin is permitted.
- Do not add a legacy `/invites/:token` route. The pre-feature URL uses the non-routable `livecanvas.invalid` placeholder, no landing route exists, and mobile invite delivery is hidden; revoke those unusable pre-cutover tokens before enabling the real delivery surface instead of reintroducing secrets in request paths.
- Relay IDs and auth return routes remain opaque and allowlisted.
- Mobile tests stay under `mobile/tests/**`; public backend functions require typespecs and typed changes run `mix typecheck`.

---

## Executor Brief

Implement and prove the token lifecycle before enabling mobile delivery. The
conversion table is deliberately minimal: token identity, inviter, recipient
user, and consumption time. The public controller never receives, consumes, or
exposes token metadata. Mobile consumption occurs only after authentication and uses
the existing allowlisted `returnTo` mechanism.

## File Structure

- Persistence: a relational conversion schema under `LCSchemas.Accounts` plus one migration.
- Token lifecycle: `LC.Accounts.Tokens` validates serialized context/hash/expiry; `LC.Accounts` owns transactional consumption.
- Public landing: `LCWeb.ContactInviteController`, focused HTML template, and a static fragment-to-deep-link asset.
- GraphQL: Accounts contact mutation exposes authenticated consumption and configured delivery URLs.
- Mobile routing: raw-token deep links are pre-routing bootstrap inputs only; navigable and auth-return routes use `/invite?handoff=<opaque-id>` exclusively.
- Mobile contact UI: existing delivery mutation gains explicit row-level sent/retry/terminal states.

### Task 1: Add Recipient-Bound One-Time Consumption

**Files:**
- Create: `priv/repo/migrations/20260711120000_create_contact_invite_conversions.exs`
- Modify: `lib/live_canvas_schemas.ex`
- Create: `lib/live_canvas_schemas/accounts/contact_invite_conversion.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts/user_token_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`

**Interfaces:**
- Produces: `Tokens.valid_contact_invite_token?/2` and `Accounts.consume_contact_invite/2`.
- `consume_contact_invite/2` returns `{:ok, ContactInviteConversion.t()} | {:error, :invalid_contact_invite}`.

- [ ] Create `contact_invite_conversions` with bigint `id`, database-generated UUIDv7 `entropy_id`, UUID `invite_token_id`, nullable `inviter_id`, nullable `recipient_user_id`, `consumed_at :utc_datetime_usec`, and `:utc_datetime_usec` timestamps.
- [ ] Add unique indexes for `entropy_id` and `invite_token_id`; use `on_delete: :nilify_all` for both user references so deletion cannot make consumption reusable.
- [ ] Add the schema table-contract summary and typespecs, and export `Accounts.ContactInviteConversion` from the top-level `LCSchemas` Boundary so Accounts aliases and return types remain legal. Do not store recipient email or raw token material in the conversion row.
- [ ] Add 7-day `valid_contact_invite_token?/2` validation requiring secure hash match and exact `:contact_invite_token` context.
- [ ] In the conversion-table migration, delete pre-cutover `users_tokens` rows in the `:contact_invite_token` context. They were issued only with the non-routable placeholder URL and must not remain as ghost-valid credentials after the fragment contract launches.
- [ ] Implement transactional consumption with `FOR UPDATE`: decode, lock, validate context/hash/expiry, and find a viewer-owned normalized email equal to `sent_to`. Accept an already verified join directly. When the exact matching join is unverified, treat possession of this recipient-bound email token as proof for only that address: set the join's `verified_at` and the password-created user's `confirmed_at` in the same transaction before inserting the conversion and deleting the token. Never verify a nonmatching email or commit partial verification if conversion fails.
- [ ] Cover malformed/tampered/wrong-context/expired/consumed rejection, verified recipient success, password-sign-up success that atomically verifies only the matching join and confirms the user, different-recipient rejection without verification changes, repeat consumption, rollback safety, and two concurrent consumers yielding exactly one verification/conversion.
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
- Modify: `assets/js/app.js`
- Create: `assets/js/contact_invite_landing.js`
- Create: `assets/js/contact_invite_landing.test.js`
- Create: `test/live_canvas_web/controllers/contact_invite_controller_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Interfaces:**
- Consumes: configured `:public_app_origin` only.
- Produces: `GET /invites` and client-side `livecanvas-mobile://invite?token=...` without transmitting the token to the server.

- [ ] Configure `:public_app_origin` with a local/test default and require `LIVE_CANVAS_PUBLIC_ORIGIN` in production. Validate it is an absolute `https` URI with a host, no query/fragment, and no path other than empty or `/`; normalize away one trailing slash before use.
- [ ] Replace `https://livecanvas.invalid` construction with `<normalized-public-app-origin>/invites#token=<percent-encoded-token>`; keep URL construction at the GraphQL boundary and never include inviter/recipient values. Test both `https://host` and `https://host/` configuration values produce exactly `https://host/invites#...` with one path separator.
- [ ] Add the public `GET /invites` route outside authenticated browser pipelines. The controller renders the same neutral page for every request and never accepts or looks up a token.
- [ ] Add a pure, unit-tested fragment parser and import its guarded landing-page initializer from `assets/js/app.js`. It reads exactly one nonblank `token` value from `window.location.hash`, sets the explicit `livecanvas-mobile://invite?token=<encoded-token>` action, and otherwise leaves the page in one generic invalid-or-expired state. Do not interpolate the fragment into server-rendered HTML.
- [ ] Add `Cache-Control: no-store`, a restrictive content security policy, and a no-referrer policy. After constructing the app link, clear the fragment with `history.replaceState` so screenshots and copied browser URLs do not retain the token.
- [ ] Test that generated delivery URLs place the token only in `URI.fragment`, while the controller route, endpoint telemetry path, response body, and referrer policy contain no raw token. Test the pure fragment parser for valid, missing, duplicated, and malformed token fragments.
- [ ] Test configured HTTPS delivery URLs use the fragment contract and that invalid production origins fail startup.
- [ ] Run the pure landing parser suite explicitly with `bun test assets/js/contact_invite_landing.test.js`; `mix assets.build` does not execute JavaScript tests.
- [ ] Run the focused controller, account mutation, and Accounts tests plus `mix assets.build` and `mix typecheck`; commit with `feat: add contact invite landing route`.

### Task 3: Expose Authenticated Relay Consumption

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/contact_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`
- Modify: `mobile/schema.graphql`

**Interfaces:**
- Produces: `consumeContactInvite(input: {token}) { consumed errors {field message} }`.
- Consumed by: Task 4.

- [ ] Add a Relay payload mutation with non-null token input, non-null boolean `consumed`, and standard `UserError` output.
- [ ] Resolve through `Accounts.consume_contact_invite/2` using only `resolution.context.current_scope.user`; never accept a viewer/recipient ID from input.
- [ ] Return `consumed: true` only for the committed conversion. Map malformed, expired, consumed, tampered, wrong-recipient, and unknown tokens to one `invalid_contact_invite` payload error.
- [ ] Return the existing unauthenticated payload shape without performing token lookup.
- [ ] Cover success, password-created unverified recipient success with committed email/account verification, all generic failure variants, repeat consumption, wrong account, and unauthenticated access in GraphQL tests.
- [ ] Prove both `deliverViewerContactInvite` and `consumeContactInvite` fall through the existing `:graphql_mutation` bucket: with its test limit set to one, the second request for each mutation returns the structured 429 response. Do not register either as auth/moderation traffic or add an unthrottled token-specific branch.
- [ ] Refresh `mobile/schema.graphql`, run the focused backend tests and `mix typecheck`, and commit with `feat: expose contact invite consumption`.

### Task 4: Preserve Invite Routing Through Authentication

**Files:**
- Modify: `mobile/src/config/runtime.ts`
- Create: `mobile/src/contacts/contactInviteHandoff.ts`
- Create: `mobile/src/contacts/contactInviteState.ts`
- Create: `mobile/src/contacts/contactInviteOperations.ts`
- Create: `mobile/src/contacts/ContactInviteScreen.tsx`
- Create: `mobile/app/invite.tsx`
- Modify: `mobile/tests/config/runtime.test.ts`
- Create: `mobile/tests/contacts/contactInviteHandoff.test.ts`
- Create: `mobile/tests/contacts/contactInviteState.test.ts`
- Create: `mobile/tests/contacts/ContactInviteScreen.rntl.tsx`
- Generate: `mobile/src/__generated__/contactInviteOperationsConsumeMutation.graphql.ts`

**Interfaces:**
- Produces: one-time `/invite?handoff=<opaque-id>` routing backed by protected pending-invite storage, `contactInviteConsumeMutation`, `ContactInviteState`, and `ContactInviteScreen`.
- Consumed by: Task 5 delivery/readback tests.

- [ ] Add a protected pending-invite handoff backed by the existing Expo SecureStore dependency. Keep one fixed-slot record `{handoffId, token, expiresAt}`; generate `handoffId` with `Crypto.randomUUID()`, expire it after one hour, replace any older pending invite, and expose injected store/load/clear functions for tests. Never log or return the raw token from this module.
- [ ] In async startup bootstrap, accept exactly one nonblank token from `livecanvas-mobile://invite?token=...` or the allowlisted HTTPS `/invites#token=...` fragment, persist it before routing, and replace it with `/invite?handoff=<opaque-id>`. Do not retain the raw invite URL or token in `StartupSnapshot.initialUrl`, `initialHref`, navigation state, telemetry, or error text; storage failure falls back to the generic invalid state.
- [ ] Add `/invite` to known routes and authenticated return-to routes, but allow only one nonblank opaque `handoff` value. Reject token-bearing return targets, arrays, missing values, malformed decoding, and arbitrary nested return targets. Keep `mobile/app/invite.tsx` outside the authenticated route group.
- [ ] Make `/invite?handoff=...` an explicit public exception in `resolveLandingHrefForAuth`: a signed-out startup invite must land on the neutral invite screen instead of being rewritten to `/sign-in`, while every other protected initial route keeps the existing auth redirect. Test signed-out deep-link and HTTPS-fragment bootstrap, redaction of the raw token from the snapshot, normal protected-route redirect, expired/mismatched handoff, malformed invite fallback, and opening invite B after invite A so a stale `/invite?handoff=A` route cannot clear or consume B before `/invite?handoff=B` succeeds.
- [ ] When unauthenticated, show neutral invitation copy with Sign in and Create account actions built through `authRouteHref(..., '/invite?handoff=...')`; auth return URLs must contain only the opaque handoff ID.
- [ ] After successful password or provider authentication, return to the allowlisted handoff route, resolve the raw token from SecureStore only at consumption time, and commit `consumeContactInvite` once. Password sign-up keeps the protected record until this commit so the backend can atomically verify the matching new email; already authenticated viewers consume from the same screen.
- [ ] Render exactly `checking`, `requires_auth`, `consuming`, `consumed`, `invalid`, and `retryable_error` states; invalid payloads do not disclose recipient mismatch or token history.
- [ ] Guard duplicate commits and stale callbacks by attempt ID. Clear the fixed slot after success or terminal invalidity only when the stored `handoffId` still matches the route being consumed; a route mismatch renders that stale route invalid but must leave a newer stored handoff untouched. A stored record that is itself expired may be cleared regardless of the requested handoff. Retain a matching unexpired record only across retryable transport errors, so refresh cannot re-submit a consumed token.
- [ ] Run the pure runtime, handoff, and state suites with `cd mobile && bun test tests/config/runtime.test.ts tests/contacts/contactInviteHandoff.test.ts tests/contacts/contactInviteState.test.ts`.
- [ ] Run the invite screen suite through its configured Jest runner with `cd mobile && bun run test:jest -- --runTestsByPath tests/contacts/ContactInviteScreen.rntl.tsx`; do not pass `.rntl.tsx` files to Bun test filters.
- [ ] Run `cd mobile && bun run relay`, `bun run typecheck`, and `bun run typecheck:tests`; commit with `feat: consume contact invites in mobile`.

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
- After closure, hand back to the coordinator. The coordinator owns the explicitly assigned shared-doc update to mark all five product batches complete in the dashboard and lane pointers, then resumes `docs/plans/mobile/2026-06-25-release-candidate-checklist.md` as the next gate.
- Do not add automatic relationships, native address-book import, bulk upload, or store-distribution work to this batch.

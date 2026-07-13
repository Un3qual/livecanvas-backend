# Contact Invite Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the authorization, transactional, release-config, secret-routing, and maintainability defects found in the contact invitation review.

**Architecture:** `LC.Accounts` authorizes delivery from a viewer-owned contact entry and versions fragment-era credentials. Mobile treats the backend payload taxonomy explicitly and uses Expo-inlineable configuration. The public landing route receives a dedicated minimal bundle.

**Tech Stack:** Elixir, Ecto/PostgreSQL, Absinthe Relay, ExUnit, Expo Router, TypeScript, React Relay, Jest/RNTL, Bun, esbuild.

## Global Constraints

- Keep raw invite tokens out of server-visible URLs, navigation state, logs, and ordinary mobile storage.
- Re-apply viewer ownership in the Accounts domain; Relay IDs are opaque inputs, not authorization.
- Use SHA3 token hashing and `:utc_datetime_usec` timestamps.
- Keep mobile tests under `mobile/tests/**`.
- Add typespecs for public functions and run `mix typecheck` for typed changes.
- Commit at the backend and mobile/asset milestones, then push only after full verification.

---

### Task 1: Authorize Delivery And Version Credentials

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token_context.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/contact_resolver.ex`
- Modify: `priv/repo/migrations/20260711120000_create_contact_invite_conversions.exs`
- Test: `test/live_canvas/accounts_test.exs`
- Test: `test/live_canvas/accounts/user_token_test.exs`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Test: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`

**Interfaces:**
- `deliverViewerContactInvite(input: {contactMatchId: ID!})`
- `Accounts.deliver_contact_invite_instructions/3` receives a local contact-entry ID and derives the recipient.
- Newly issued tokens use `:contact_invite_fragment_token`; consumption rejects `:contact_invite_token`.

- [x] Add failing GraphQL tests proving an owned unmatched contact succeeds while arbitrary, foreign, self-owned, and newly matched rows create neither token nor email.
- [x] Add failing token tests proving legacy-context credentials are rejected and fragment-context credentials are accepted.
- [x] Change the Relay input to `contact_match_id`, decode it as `:contact_match`, and move the ownership/match/recipient decision into `LC.Accounts`.
- [x] Add `contact_invite_fragment_token` to the PostgreSQL enum migration and schema enum; issue and validate only that context.
- [x] Add indexes on `inviter_id` and `recipient_user_id` in the conversion migration.
- [x] Run the focused Accounts, token, mutation, and rate-limit tests; run `mix format` and commit.

### Task 2: Lock Ownership And Exercise Real Concurrency

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Create: `test/integration/accounts/contact_invite_concurrency_test.exs`

**Interfaces:**
- `viewer_contact_invite_email_join/2` returns the matching row under `FOR UPDATE`.
- Integration workers own different unsandboxed PostgreSQL connections and synchronize before consumption.

- [x] Add a failing query-capture test requiring `FOR UPDATE` on the ownership lookup.
- [x] Add a failing integration test that records distinct `pg_backend_pid()` values and proves two consumers receive one conversion.
- [x] Lock the matching ownership join for the remainder of the consumption transaction.
- [x] Replace the shared-connection task test with the integration test and scope all conversion assertions by token ID.
- [x] Run both focused tests and commit with the Task 1 milestone if they remain one coherent backend change.

### Task 3: Harden Release Origins

**Files:**
- Modify: `config/runtime.exs`
- Modify: `test/live_canvas_web/controllers/contact_invite_controller_test.exs`
- Modify: `mobile/src/config/environment.ts`
- Modify: `mobile/tests/config/environment.test.ts`
- Create: `mobile/tests/config/environmentBundling.test.js`

**Interfaces:**
- Production backend and mobile origins require valid HTTPS origins with ports in `1..65535` and no trailing DNS dot.
- `readProcessEnvironment()` contains direct `process.env.EXPO_PUBLIC_*` member reads.

- [x] Add failing backend tests for port `99999` and `.invalid.` hosts.
- [x] Add failing mobile tests for missing production origin and a Babel transform that must route the static key through Expo's virtual environment module.
- [x] Tighten backend origin predicates without introducing a second config abstraction.
- [x] Replace dynamic `globalThis.process` access with direct Expo-inlineable reads and allow localhost fallback only outside production.
- [x] Run focused backend/mobile config tests and commit with the appropriate backend/mobile milestone.

### Task 4: Fail Closed And Preserve Retryable Handoffs

**Files:**
- Modify: `mobile/src/contacts/contactInviteLink.ts`
- Modify: `mobile/src/contacts/ContactInviteScreen.tsx`
- Test: `mobile/tests/contacts/contactInviteNativeIntent.test.ts`
- Test: `mobile/tests/contacts/ContactInviteScreen.rntl.tsx`

**Interfaces:**
- Invite-shaped malformed HTTPS paths return `/invite` and never preserve their input URL.
- Consumption result is `consumed | invalid | requires_auth`; unknown payload errors reject into the retryable path.

- [x] Add failing routing tests for trailing-slash, nested, and encoded invite paths containing raw tokens.
- [x] Add failing screen tests proving `unauthenticated` and unknown errors retain the handoff while only `invalid_contact_invite` clears it.
- [x] Broaden candidate recognition while keeping exact route acceptance strict.
- [x] Map backend error codes explicitly and preserve the existing attempt-ID stale-callback guarantees.
- [x] Run focused Bun and Jest suites, generate Relay artifacts after the delivery input change, and commit.

### Task 5: Isolate The Landing Bundle And Verify The Branch

**Files:**
- Modify: `config/config.exs`
- Modify: `assets/js/app.js`
- Create: `assets/js/contact_invite_landing_entry.js`
- Modify: `lib/live_canvas_web/controllers/contact_invite_html/show.html.heex`
- Test: `test/live_canvas_web/controllers/contact_invite_controller_test.exs`

**Interfaces:**
- `/assets/js/contact_invite_landing_entry.js` initializes the public landing page without Phoenix or LiveView.

- [x] Add a failing controller assertion that the landing page references only the dedicated entry bundle and has no CSRF meta tag.
- [x] Build both JavaScript entry points, remove landing initialization from `app.js`, and update the template.
- [x] Run landing parser/controller tests and `mix assets.build`.
- [x] Run the deterministic branch gates: 1,013 backend tests, warnings-as-errors compilation, focused formatting, `mix typecheck`, `mix check.typespecs`, mobile `test:quality`, Relay generation, landing parser and asset builds, and `git diff --check`.
- [x] Attempt the aggregate quality gates and record repository-level limitations: `mix precommit` reaches a pre-existing global ExDNA budget failure (6 clones against 5, all outside this change); `mix slop.changed` reports no changed-code Credo issues before its Reachability pass stalls without output and is stopped after a bounded wait.
- [x] Re-read this plan and the remediation spec, update their checkboxes, commit the final verified milestone, and push the branch.

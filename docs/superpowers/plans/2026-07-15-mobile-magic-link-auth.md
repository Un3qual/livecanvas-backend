# Mobile Magic-Link Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver request, secure email handoff, GraphQL redemption, and session
entry for mobile magic-link sign-in and sign-up.

**Architecture:** The backend delivers a token only in the fragment of a
configured HTTPS landing URL. A minimal landing asset opens the app, whose
native-intent boundary moves `{purpose, token}` into a dedicated SecureStore
handoff before routing. The existing unauthenticated auth client requests and
redeems challenges; `AuthProvider` remains the only auth-token persistence
owner.

**Tech Stack:** Elixir/Phoenix, Absinthe GraphQL, Expo SDK 55, React Native,
Expo Router, SecureStore, pnpm, Vitest, Jest/RNTL.

## Global Constraints

- Raw magic-link tokens may exist only in an email fragment, the landing
  script's transient memory, SecureStore, and the GraphQL request body.
- Use `LIVE_CANVAS_PUBLIC_ORIGIN`; never restore the `.invalid` placeholder.
- Keep sign-in delivery enumeration-safe and retain backend sign-up
  `EMAIL_TAKEN` behavior.
- Reject malformed, duplicate, wrong-origin, credentialed, port-mismatched, and
  encoded-lookalike link shapes without a SecureStore write.
- Keep tests under `mobile/tests/**`; do not mark operator/device QA complete.

---

### Task 1: Fragment-Only Backend Delivery And Landing

**Files:**
- Modify: `lib/live_canvas_gql/accounts/auth_resolver.ex`
- Modify: `lib/live_canvas_web/router.ex`
- Modify: `config/config.exs`
- Create: `lib/live_canvas_web/controllers/magic_link_controller.ex`
- Create: `lib/live_canvas_web/controllers/magic_link_html.ex`
- Create: `lib/live_canvas_web/controllers/magic_link_html/show.html.heex`
- Create: `assets/js/magic_link_landing.js`
- Create: `assets/js/magic_link_landing_entry.js`
- Create: `assets/js/magic_link_landing.test.js`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Test: `test/live_canvas_web/controllers/magic_link_controller_test.exs`

**Interfaces:**
- Produces exact HTTPS paths `/auth/magic-link/sign-in#token=...` and
  `/auth/magic-link/sign-up#token=...`.
- Landing produces `livecanvas-mobile://magic-link/<purpose>?token=...` only
  after parsing one nonblank token from the fragment.

- [ ] Add failing resolver tests that capture delivered URLs, parse them with
  `URI.new!/1`, and prove the configured origin/purpose path is correct while
  `query == nil` and the raw token exists only in `fragment`.
- [ ] Add failing controller and JavaScript tests for both purpose paths,
  hardened no-store/CSP/no-referrer headers, valid single-token fragments,
  duplicated/malformed fragments, fragment clearing, and generic invalid copy.
- [ ] Implement `magic_link_url/2`, the two explicit public routes, neutral
  landing controller/template, and dedicated asset entry. Build URLs as:

  ```elixir
  "#{Application.fetch_env!(:live_canvas, :public_app_origin)}/auth/magic-link/#{purpose_path}#token=#{URI.encode_www_form(token)}"
  ```

- [ ] Run `node --test assets/js/magic_link_landing.test.js` and focused
  resolver/controller tests; verify the new tests pass without session or
  GraphQL-context plugs on the landing routes.
- [ ] Commit `feat: deliver mobile magic links securely`.

### Task 2: Opaque Mobile Link Handoff

**Files:**
- Create: `mobile/src/auth/magicLink/magicLinkLink.ts`
- Create: `mobile/src/auth/magicLink/magicLinkHandoffCore.ts`
- Create: `mobile/src/auth/magicLink/magicLinkHandoff.ts`
- Create: `mobile/src/auth/magicLink/magicLinkNativeLink.ts`
- Modify: `mobile/app/+native-intent.ts`
- Modify: `mobile/src/config/runtime.ts`
- Test: `mobile/tests/auth/magicLinkLink.test.ts`
- Test: `mobile/tests/auth/magicLinkHandoff.test.ts`
- Test: `mobile/tests/auth/magicLinkNativeIntent.test.ts`
- Test: `mobile/tests/config/runtime.test.ts`

**Interfaces:**
- `parseMagicLink(path, publicAppOrigin)` returns `not_magic_link`, `invalid`,
  or `{status: 'valid', purpose: 'signIn' | 'signUp', token}`.
- `storeMagicLinkHandoff(payload)` returns only `{handoffId}`.
- `withMagicLinkHandoff(handoffId, callback)` never gives a mismatched or stale
  route access to a newer payload.

- [ ] Add failing pure parser tests for exact custom/HTTPS forms and every
  rejected authority, origin, path, parameter, encoding, and duplicate shape.
- [ ] Add failing handoff tests proving the fixed slot expires, replacement is
  serialized, a stale route cannot read/clear a newer payload, corrupt records
  are deleted, and returned route values never contain the token.
- [ ] Add failing native-intent/startup tests proving cold and warm links become
  `/magic-link?handoff=<opaque-id>`, recognizable failures become token-free
  `/magic-link`, and authenticated startup never exposes the raw URL snapshot.
- [ ] Implement the dedicated SecureStore boundary and compose it after the
  existing contact-invite native-intent handler; add `/magic-link` as an auth
  route that accepts exactly one opaque `handoff` parameter.
- [ ] Run the four focused Vitest suites and commit
  `feat: secure mobile magic-link handoff`.

### Task 3: Magic-Link Request Action

**Files:**
- Modify: `mobile/src/auth/authMutationClient.ts`
- Create: `mobile/src/auth/useMagicLinkAuth.ts`
- Modify: `mobile/src/auth/authEntryControllerReducer.ts`
- Modify: `mobile/src/auth/useAuthEntryController.ts`
- Modify: `mobile/src/auth/screens/AuthEntryScreen.tsx`
- Test: `mobile/tests/auth/authMutationClient.test.ts`
- Test: `mobile/tests/auth/authEntryControllerReducer.test.ts`
- Test: `mobile/tests/auth/AuthEntryScreen.rntl.tsx`

**Interfaces:**
- `requestMagicLinkAuthChallenge({apiBaseUrl, mode, email, fetchImpl})` returns
  `{ok: true}` or normalized auth errors.
- The controller exposes `submitMagicLink(email)`,
  `isMagicLinkSubmitting`, and neutral `magicLinkMessage` state.

- [ ] Add failing client tests for trimmed email, required-email validation,
  `MAGIC_LINK` plus `LOG_IN`/`SIGN_UP` variables, neutral dispatched false,
  payload errors, top-level errors, HTTP failure, and malformed responses.
- [ ] Add failing controller/screen tests for the correct action copy in each
  mode, busy admission, success copy, shared email-field errors, error clearing,
  and no password requirement for an email-link request.
- [ ] Extend the existing checked unauthenticated fetch client and controller;
  render one secondary action after an alternative-auth divider while keeping
  password and OAuth behavior unchanged.
- [ ] Run focused client/reducer/RNTL suites and commit
  `feat: request mobile magic links`.

### Task 4: Magic-Link Redemption And Session Entry

**Files:**
- Modify: `mobile/src/auth/authMutationClient.ts`
- Create: `mobile/src/auth/magicLink/MagicLinkScreen.tsx`
- Create: `mobile/src/auth/magicLink/magicLinkState.ts`
- Create: `mobile/app/(auth)/magic-link.tsx`
- Modify: `mobile/app/(auth)/_layout.tsx`
- Test: `mobile/tests/auth/magicLinkState.test.ts`
- Test: `mobile/tests/auth/MagicLinkScreen.rntl.tsx`
- Test: `mobile/tests/auth/authMutationClient.test.ts`

**Interfaces:**
- `redeemMagicLinkAuthMutation({apiBaseUrl, mode, token, fetchImpl})` returns the
  existing `AuthMutationResult` token pair or normalized errors.
- The screen clears the matching handoff only after definitive invalidity or
  successful `AuthProvider.signIn`; transport failures remain retryable.

- [ ] Add failing client tests proving stored purpose selects `logIn` or
  `signUp`, the token is sent only under `magicLink.token`, and invalid/expired
  payloads never fabricate auth tokens.
- [ ] Add failing state/RNTL tests for missing/mismatched/expired handoffs,
  successful sign-in and sign-up, retry after transport failure, route
  replacement, successful handoff cleanup, and an authenticated session being
  routed home without redemption.
- [ ] Implement the public auth route with generation-safe async completion,
  generic invalid copy, explicit retry, and session persistence through
  `AuthProvider.signIn`.
- [ ] Run focused auth suites and commit `feat: redeem mobile magic links`.

### Task 5: Lane Closure And Full Verification

**Files:**
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/backend/NOW.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: this plan

- [ ] Run backend format, asset tests, focused tests, `mix typecheck`, and the
  full backend test suite for the typed resolver/controller changes.
- [ ] From `mobile/`, run frozen installation, `pnpm relay`, focused auth tests,
  `pnpm test:quality`, and `nix flake check`.
- [ ] Run `git diff --check`, record exact evidence, return both lanes to
  operator/device QA, and leave manual email/device evidence unchecked.
- [ ] Commit `docs: close mobile magic-link batch`; do not push until the user
  explicitly requests it.

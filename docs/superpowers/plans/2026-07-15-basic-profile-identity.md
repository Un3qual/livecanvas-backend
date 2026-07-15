# Basic Profile Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional public display names and unique handles, viewer-scoped
editing, and consistent identity presentation across existing mobile surfaces.

**Architecture:** Nullable user columns preserve existing accounts. Accounts
owns canonicalization and validation; Relay exposes authorized public fields and
one viewer-scoped atomic mutation. Mobile uses one pure formatter plus one
generation-safe editor state boundary.

**Tech Stack:** Elixir/Phoenix, Ecto/PostgreSQL, Absinthe Relay, Expo SDK 55,
React Native, Relay, pnpm, Vitest, Jest/RNTL.

## Global Constraints

- Username is canonical lowercase ASCII, unique, 3-30 characters, starts and
  ends alphanumeric, and otherwise permits only underscores.
- Display name is trimmed, single-line Unicode, 1-50 characters, and rejects
  ASCII control characters.
- Existing users remain valid with both fields null; editing requires both.
- Use opaque Relay IDs for navigation. Do not add handle lookup or search.
- Reapply blocked-viewer policy in public identity child resolvers.
- Do not add avatars, bios, profile layout, notifications, or release QA claims.
- Keep mobile tests under `mobile/tests/**`; use pnpm/Node 26 only.

---

### Task 1: Persist And Validate Basic Identity

**Files:**
- Create: `priv/repo/migrations/20260715123000_add_basic_profile_identity_to_users.exs`
- Modify: `lib/live_canvas_schemas/accounts/user.ex`
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Test: `test/live_canvas/accounts_test.exs`

**Interfaces:**
- `UserChanges.profile_identity_changeset(user, attrs)` canonicalizes both
  fields and attaches database constraints.
- `Accounts.update_user_profile_identity(user, %{username: ..., display_name: ...})`
  returns the hydrated updated user or changeset.

- [x] Add failing Accounts tests for canonicalization, Unicode display names,
  malformed/blank/oversized fields, collision handling, repeat updates, and
  preservation of unrelated account state.
- [x] Add nullable columns, unique username index, and database checks matching
  the canonical format/length contracts; update the schema type and table
  contract summary.
- [x] Implement the typed changeset and Accounts boundary function; keep
  normalization pure and update both fields in one `Repo.update/1`.
- [x] Run migration reset, focused Accounts tests, formatting, warnings-as-errors
  compilation, and `mix typecheck`; commit `feat: persist basic profile identity`.

### Task 2: Expose The Viewer-Scoped Relay Contract

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/user_resolver.ex`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Test: `test/live_canvas_gql/accounts/user_resolver_test.exs`
- Test: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `mobile/schema.graphql`

**Interfaces:**
- Nullable `User.username` and `User.displayName` use child resolvers that hide
  values when the profile owner blocked the authenticated viewer.
- `updateViewerProfileIdentity(input: {username!, displayName!})` returns
  `{user, errors}` and accepts no user ID.

- [x] Add failing GraphQL tests for authenticated success, canonical output,
  field errors, uniqueness, unauthenticated access, repeat update stability,
  anonymous public reads, and blocked-viewer node resolution.
- [x] Add typed field resolvers and the viewer-scoped mutation, delegating all
  normalization/persistence to Accounts and existing mutation-error mapping.
- [x] Export `mobile/schema.graphql`, prove the exact public contract, run
  focused mutation/node tests plus formatting/compile/typecheck, and commit
  `feat: expose profile identity contract`.

### Task 3: Share Identity Presentation Across Mobile

**Files:**
- Modify: `mobile/src/profile/profilePresentation.ts`
- Modify user selections in `mobile/src/profile/{profileConnectionOperations.ts,viewer/ViewerProfileScreen.tsx,viewer/ViewerProfileSocialSections.tsx,other/OtherUserProfileScreen.tsx}`
- Modify: `mobile/src/content/{contentPostPresentation.ts,contentSurfaceOperations.ts}`
- Modify: `mobile/src/content/story/storyViewerOperations.ts`
- Modify: `mobile/src/feed/postComposerOperations.ts`
- Modify: `mobile/src/live/{discovery/LiveDiscoveryScreen.tsx,watch/liveSessionWatchOperations.ts}`
- Modify: `mobile/src/contacts/contactDiscoveryOperations.ts`
- Test: `mobile/tests/profile/profilePresentation.test.ts`
- Test: `mobile/tests/content/contentPostPresentation.test.ts`
- Test affected profile/content/live/contact RNTL suites.

**Interfaces:**
- `formatProfileIdentity({id, displayName, username, email})` prioritizes public
  identity, returns at most two stable initials, and retains legacy fallbacks.
- All rendered `User` authors/hosts/matches request `displayName` and `username`.

- [ ] Add failing pure tests for presentation priority, blank/null fallback,
  Unicode display names, multi-word initials, handle initials, and authorized
  email fallback; add representative RNTL expectations on profile, post, live,
  connection, and contact surfaces.
- [ ] Extend the pure identity input/formatter and every user-bearing Relay
  selection that feeds an existing rendered identity; do not create a second
  formatter or change route keys.
- [ ] Regenerate Relay, run the focused presentation/RNTL suites, both
  TypeScript checks, and lint; commit `feat: present public profile identity`.

### Task 4: Edit Identity From The Viewer Profile

**Files:**
- Create: `mobile/src/profile/profileIdentityState.ts`
- Create: `mobile/tests/profile/profileIdentityState.test.ts`
- Modify: `mobile/src/profile/viewer/ViewerProfileScreen.tsx`
- Test: `mobile/tests/profile/ViewerProfileScreen.rntl.tsx`

**Interfaces:**
- Pure validation mirrors backend handle/display-name rules.
- The reducer tracks input, one active attempt ID, field/general errors, and
  canonical success while ignoring stale completion.
- Relay operation `ViewerProfileScreenUpdateIdentityMutation` calls
  `updateViewerProfileIdentity`.

- [ ] Add failing state tests for prefill, edits, validation, admission,
  canonical success, username/display-name/general errors, retry, reset, and
  stale attempt rejection.
- [ ] Add failing RNTL tests for prefilled inputs, duplicate-press admission,
  local validation, canonical successful header update, edit preservation while
  saving, payload/transport errors, retry, and unmount safety.
- [ ] Implement the pure reducer/validation and a compact viewer-profile form;
  mutation callbacks must belong to the mounted attempt and successful values
  must update the visible header without a route refetch.
- [ ] Regenerate Relay, run focused state/RNTL suites, both TypeScript checks,
  and lint; commit `feat: edit viewer profile identity`.

### Task 5: Full Verification And Lane Closure

**Files:**
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/backend/NOW.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: this plan

- [ ] Run repository formatting, warnings-as-errors compilation, `mix
  typecheck`, focused identity tests, a clean migration reset, and full backend
  tests.
- [ ] From `mobile/`, run frozen pnpm installation, Relay generation, focused
  identity suites, `pnpm test:quality`, and `nix flake check`.
- [ ] Run `git diff --check`, record exact evidence, return lanes to
  operator/device QA, and leave physical/release evidence pending.
- [ ] Commit `docs: close basic profile identity batch`; do not push until the
  user explicitly requests it.

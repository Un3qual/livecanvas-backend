# Native Contact Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in device address-book import to the existing contact discovery
surface through a bounded, atomic, viewer-scoped GraphQL contract.

**Architecture:** A dynamically loaded `expo-contacts` adapter reads only the
minimum contact fields after an explicit user action. Pure mobile helpers
normalize and chunk the data; a generation-safe hook uploads chunks
sequentially through one bulk mutation and refreshes the existing Relay
connection after complete success. Backend single and bulk upserts share one
normalization/persistence path.

**Tech Stack:** Elixir/Phoenix, Ecto, Absinthe Relay, Expo SDK 55,
`expo-contacts`, React Native, Relay, pnpm, Vitest, Jest/RNTL.

## Global Constraints

- Request contact permission only from the explicit import action.
- Read only native contact ID, name, emails, and phone numbers.
- Never place raw contact data in routes, logs, SecureStore, or AsyncStorage.
- Accept 1-100 entries per GraphQL chunk; validate the whole chunk before one
  atomic transaction and reject duplicate client IDs.
- Preserve manual contact discovery and existing blocking/privacy projection.
- Treat import as idempotent upload/update, not continuous device mirroring.
- Keep tests under `mobile/tests/**`; leave physical-device evidence unchecked.

---

### Task 1: Atomic Bulk Contact Contract

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/contact_resolver.ex`
- Test: `test/live_canvas/accounts_test.exs`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Interfaces:**
- `Accounts.import_user_contact_entries(user, entries)` returns
  `{:ok, imported_count}` or one normalized validation/batch error.
- GraphQL `importViewerContactEntries(input: {entries: [...]})` returns
  `{importedCount, errors}` and never accepts a target user ID.

- [x] Add failing Accounts tests for an empty batch, 101 entries, duplicate
  `contactClientId`, observable all-or-none validation, stable idempotent
  updates, and exact imported count.
- [x] Refactor the existing single-entry path into shared pure normalization and
  transaction-local persistence functions; implement bulk validation before a
  single transaction without nesting per-entry transactions.
- [x] Add failing GraphQL tests for success, structured batch/input errors,
  unauthenticated access, repeat import stability, and viewer ownership.
- [x] Add `ViewerContactEntryInput`, the mutation payload, resolver mapping, and
  public typespecs; keep contact matching behind the existing refetch query.
- [x] Run focused Accounts/GraphQL tests, changed-file formatting, compilation,
  and `mix typecheck`; commit `feat: add bulk contact import contract`.

### Task 2: Minimal Native Contact Boundary

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Modify: `mobile/app.json`
- Create: `mobile/src/contacts/deviceContactImport.ts`
- Create: `mobile/src/contacts/deviceContactsNative.ts`
- Test: `mobile/tests/contacts/deviceContactImport.test.ts`
- Test: `mobile/tests/contacts/deviceContactsNative.test.ts`

**Interfaces:**
- `normalizeDeviceContacts(contacts)` produces GraphQL-ready entries in source
  order and drops contacts without usable identifiers.
- `chunkDeviceContactEntries(entries)` returns chunks of at most 100.
- `readDeviceContacts()` returns `granted`, `denied`, `unavailable`, or
  `failed`; only `granted` includes normalized entries.

- [x] Add `expo-contacts` through the pinned SDK/pnpm environment and configure
  neutral iOS/Android contacts permission copy.
- [x] Add failing pure tests for data minimization, ID/name normalization,
  email/phone deduplication, blank filtering, stable order, and 100-entry
  chunking.
- [x] Add failing adapter tests for module absence, permission denial, native
  read failure, and exact `Fields.Emails`/`Fields.PhoneNumbers` requests.
- [x] Implement the pure mapper and dynamic native adapter; do not import the
  native module at file evaluation time.
- [x] Run focused unit tests, both TypeScript checks, and lint; commit
  `feat: read device contacts safely`.

### Task 3: Sequential Import Workflow And Contact UI

**Files:**
- Modify: `mobile/src/contacts/contactDiscoveryOperations.ts`
- Create: `mobile/src/contacts/deviceContactImportState.ts`
- Create: `mobile/src/contacts/useDeviceContactImport.ts`
- Modify: `mobile/src/contacts/ContactDiscoveryScreen.tsx`
- Test: `mobile/tests/contacts/deviceContactImportState.test.ts`
- Test: `mobile/tests/contacts/ContactDiscoveryScreen.rntl.tsx`

**Interfaces:**
- Relay mutation `contactDiscoveryOperationsImportMutation` uploads one chunk.
- `useDeviceContactImport({onImported})` exposes `importContacts`,
  `isImporting`, `status`, `message`, and `openSettings`.

- [x] Add failing state tests for admission, progress, exact count, denied and
  unavailable states, retryable failure, success, and stale-attempt rejection.
- [x] Add failing RNTL tests for explicit permission timing, sequential chunks,
  stop-on-first-failure, retry/idempotency, refresh only after total success,
  settings action, disabled duplicate submission, and manual-entry regression.
- [x] Add the Relay mutation and implement a generation-safe hook that reads
  once, uploads chunks sequentially, verifies each returned count, and ignores
  completion from a replaced/unmounted attempt.
- [x] Add the import action, progress/result copy, and settings affordance to the
  current screen without replacing its manual form or connection pagination.
- [x] Regenerate Relay, run focused state/RNTL suites, both TypeScript checks,
  and lint; commit `feat: import device contacts`.

### Task 4: Full Verification And Lane Closure

**Files:**
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/backend/NOW.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: this plan

- [ ] Run repository-wide backend formatting, asset-independent compilation,
  `mix typecheck`, focused contact tests, and the full backend suite.
- [ ] From `mobile/`, run frozen pnpm installation, Relay generation, focused
  contact suites, `pnpm test:quality`, and `nix flake check`.
- [ ] Run `git diff --check`, record exact evidence, return both lanes to
  operator/device QA, and leave device permission evidence unchecked.
- [ ] Commit `docs: close native contact import batch`; do not push until the
  user explicitly requests it.

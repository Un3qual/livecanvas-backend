# Mobile Contact Discovery Implementation Plan

Date: 2026-07-08
Owner lane: mobile
Status: complete for discovery; invite delivery deferred pending a real landing route

## Executor Brief

Add a manual contact discovery surface where a signed-in viewer can enter one
email contact, see backend contact matches, and open matched profiles. Use the
existing contact GraphQL APIs and avoid native address-book access in this first
batch. Keep invite delivery hidden until its emailed URL has a real landing route.

The mobile lane selected and completed this batch. Review hardening persists a
viewer-owned invite recipient in the contact-match projection and virtualizes
the paginated result list.

## Context

- Existing backend contract includes `upsertViewerContactEntry`,
  `viewerContactMatches`, and `deliverViewerContactInvite`.
- The first UX should be manual email entry only. Do not add `expo-contacts`,
  phone numbers, birthdays, native permissions, or bulk uploads.
- Use deterministic `contactClientId` values shaped like
  `manual-email:<normalized-email>`.
- Preserve Relay IDs as opaque strings when routing to matched profiles.

## Tasks

### Task 1: Add contact discovery state helpers

Files:
- Create: `mobile/src/contacts/contactDiscoveryState.ts`
- Test: `mobile/tests/contacts/contactDiscoveryState.test.ts`

Acceptance criteria:
- [x] Normalize email input for validation and `contactClientId` generation.
- [x] Reject empty and invalid email input before committing mutations.
- [x] Build `upsertViewerContactEntry` input for one manual email contact and
      optional display name.
- [x] Map common payload errors to viewer-safe copy.
- [x] Keep invite-copy helpers separate from mutation wiring.

Focused verification:
- From `mobile/`: `bun test tests/contacts/contactDiscoveryState.test.ts`

### Task 2: Add Relay operations, route, and screen

Files:
- Create: `mobile/app/(app)/contacts.tsx`
- Create: `mobile/src/contacts/contactDiscoveryOperations.ts`
- Create: `mobile/src/contacts/ContactDiscoveryScreen.tsx`
- Modify generated Relay files under `mobile/src/__generated__/**`
- Test: `mobile/tests/contacts/ContactDiscoveryScreen.test.tsx`

Acceptance criteria:
- [x] `/contacts` queries `viewerContactMatches(first: 20)`.
- [x] Match rows include the contact name, matched users, and pagination data
      needed by the UI.
- [x] Manual email submission commits `upsertViewerContactEntry`.
- [x] A returned match can navigate to `/profiles/[id]` using the opaque Relay
      ID returned by GraphQL.
- [ ] A no-match row can commit `deliverViewerContactInvite`. Deferred because
      the current backend URL has no implemented invite landing route.
- [x] Duplicate contact submissions are guarded synchronously.
- [x] Empty, loading, and error states are covered by tests.

Focused verification:
- From `mobile/`: `bun test tests/contacts/ContactDiscoveryScreen.test.tsx`
- From `mobile/`: `bun run relay`

### Task 3: Add home entry point

Files:
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Test: `mobile/tests/feed/FeedHomeScreen.test.tsx`

Acceptance criteria:
- [x] The signed-in home surface exposes a compact `Find contacts` action.
- [x] Tapping the action routes to `/contacts`.
- [x] The new action does not displace create-post or profile navigation.

## Evidence

- `bun test tests/contacts/contactDiscoveryState.test.ts` -> 4 pass.
- `pnpm exec jest --config ./jest.config.js tests/contacts/ContactDiscoveryScreen.rntl.tsx --runInBand` -> 4 pass.
- `pnpm exec jest --config ./jest.config.js tests/feed/FeedHomeScreen.rntl.tsx --runInBand` -> 22 pass.
- `bun run relay` -> completed.
- `bun run typecheck` -> passed.
- `bun run typecheck:tests` -> passed.

Note: component coverage uses the existing Jest/RNTL `*.rntl.tsx` convention.

Focused verification:
- From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`

## Final Verification

- From `mobile/`: `bun test tests/contacts/contactDiscoveryState.test.ts`
- From `mobile/`: `bun test tests/contacts/ContactDiscoveryScreen.test.tsx`
- From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`
- From `mobile/`: `bun run relay`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run typecheck:tests`
- From `mobile/`: `bun run test:quality`
- From repo root: `git diff --check`

## Handoff

Native address-book import, contact permission prompts, bulk uploads, phone
contact matching, the invite landing route, and invite analytics should be
separate follow-up plans. This batch proves the backend contact-discovery
contract with the lowest PII surface first.

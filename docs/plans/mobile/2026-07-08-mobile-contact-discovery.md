# Mobile Contact Discovery Implementation Plan

Date: 2026-07-08
Owner lane: mobile
Status: draft ready for review

## Executor Brief

Add a manual contact discovery surface where a signed-in viewer can enter one
email contact, see backend contact matches, open matched profiles, or deliver an
invite when no match exists. Use the existing contact GraphQL APIs and avoid
native address-book access in this first batch.

This plan is not the active mobile lane batch until `docs/plans/mobile/NOW.md`
selects it.

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
- [ ] Normalize email input for validation and `contactClientId` generation.
- [ ] Reject empty and invalid email input before committing mutations.
- [ ] Build `upsertViewerContactEntry` input for one manual email contact and
      optional display name.
- [ ] Map common payload errors to viewer-safe copy.
- [ ] Keep invite-copy helpers separate from mutation wiring.

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
- [ ] `/contacts` queries `viewerContactMatches(first: 20)`.
- [ ] Match rows include the contact name, matched users, and pagination data
      needed by the UI.
- [ ] Manual email submission commits `upsertViewerContactEntry`.
- [ ] A returned match can navigate to `/profiles/[id]` using the opaque Relay
      ID returned by GraphQL.
- [ ] A no-match row can commit `deliverViewerContactInvite`.
- [ ] Duplicate submit and invite taps are guarded independently.
- [ ] Empty, loading, and error states are covered by tests.

Focused verification:
- From `mobile/`: `bun test tests/contacts/ContactDiscoveryScreen.test.tsx`
- From `mobile/`: `bun run relay`

### Task 3: Add home entry point

Files:
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Test: `mobile/tests/feed/FeedHomeScreen.test.tsx`

Acceptance criteria:
- [ ] The signed-in home surface exposes a compact `Find contacts` action.
- [ ] Tapping the action routes to `/contacts`.
- [ ] The new action does not displace create-post or profile navigation.

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
contact matching, and invite analytics should be separate follow-up plans. This
batch should prove the backend contact-discovery contract with the lowest PII
surface first.

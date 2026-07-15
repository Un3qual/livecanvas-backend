# Native Contact Import Design

Date: 2026-07-15
Status: approved
Owner: cross-lane coordinator

## Goal

Turn the existing manual contact-discovery surface into an opt-in device contact
import without exposing address-book data to navigation state or issuing one
GraphQL request per contact.

## Selected Approach

Use `expo-contacts` behind a feature-local native adapter and add one
viewer-scoped bulk GraphQL mutation. The mobile app requests permission only
after the user presses the import action, reads only contact ID, name, email,
and phone fields, normalizes the result, and uploads idempotent chunks. Each
successful chunk is atomic on the backend; a retry can safely repeat it because
`contactClientId` remains stable per device contact.

The alternatives are rejected for this batch:

- Client fan-out through `upsertViewerContactEntry` creates excessive requests
  and leaves ambiguous partial-failure state.
- Global people search requires a new public username/display-name contract;
  using account email would violate the current privacy model.
- Push notifications require provider and delivery-policy decisions outside the
  existing v1 contract.

## Backend Contract

Add `ViewerContactEntryInput` and `importViewerContactEntries`. A request accepts
1-100 entries and returns `importedCount` plus the standard mutation errors. The
resolver is authenticated and viewer-scoped. Accounts validates the entire
chunk before opening one transaction, rejects duplicate client IDs in the same
chunk, and commits every normalized entry or none.

The single-entry and bulk paths share normalization and persistence internals so
their email, phone, birthday, and identifier-join behavior cannot drift. The
bulk API does not return a large contact-match payload; mobile refetches the
existing Relay connection after all chunks complete. Existing visibility and
blocking policy remains authoritative on that query.

This is an import/update operation, not continuous mirroring. Contacts removed
from the device are not deleted from LiveCanvas in this batch.

## Mobile Boundary And Flow

The native adapter dynamically imports `expo-contacts` only when invoked. It
returns one of `granted`, `denied`, `unavailable`, or `failed`, with normalized
contact rows only for `granted`. It never reads addresses, notes, photos,
organizations, birthdays, or other fields.

Pure normalization:

- requires a nonblank native contact ID;
- prefixes it with `device:` for a stable source namespace;
- trims the display name;
- lowercases and deduplicates emails;
- trims and deduplicates phone numbers;
- drops contacts with neither an email nor a phone number;
- preserves source order and chunks at 100 entries.

The contact screen keeps manual entry intact and adds an explicit import action.
It serializes attempts, ignores completion from a replaced attempt, uploads
chunks sequentially, and refreshes `viewerContactMatches` only after the whole
attempt succeeds. Permission denial has actionable settings copy; unavailable,
read, transport, GraphQL, and partial-chunk failures remain retryable without
claiming later chunks were imported. Success reports the exact imported count.

## Safety And Error Handling

- Address-book access is never requested at startup.
- Raw contact data stays in component/native-adapter memory and GraphQL request
  bodies; it is not written to route params, logs, or local storage.
- Server batch size and duplicate-ID validation bound work and prevent
  last-write-wins ambiguity inside a request.
- Each chunk is atomic and idempotent; completed chunks may be safely retried.
- An unauthenticated response uses the existing sign-in-again presentation.
- Manual discovery remains usable when permission is denied or the native
  module is unavailable.

## Verification

Backend tests cover validation-before-write, atomic rollback, stable upsert,
batch bounds, duplicate IDs, unauthenticated access, and viewer-owned results.
Mobile pure tests cover data minimization, normalization, deduplication,
filtering, chunking, and state generations. RNTL tests cover permission states,
sequential chunk upload, partial failure, retry, refresh-on-complete, stale
completion, and manual-entry regression. Final gates are backend format,
typespecs/typecheck/full tests; frozen pnpm install, Relay, mobile quality and
Nix checks; and `git diff --check`. Physical permission/device evidence remains
unchecked.

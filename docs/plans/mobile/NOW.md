# Mobile Lane NOW

Last reviewed: 2026-07-09
Status: Batch 1 reversible social controls active; backend contract first

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume the explicitly promoted backend contract recorded in
  `docs/plans/backend/NOW.md`.
- Keep Relay IDs opaque and durable reads/writes Relay-first.

## Current Batch

- Approved design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Existing product plan:
  `docs/plans/mobile/2026-07-08-mobile-social-controls.md` (Tasks 3-4)
- Track: `docs/plans/mobile/TRACK.md`
- Current task: wait for source-plan Tasks 1-2 to export `unfollowUser`,
  `unblockUser`, and `isBlockedByViewer`; then execute Tasks 3-4.
- Write scope:
  - `mobile/src/profile/relationshipPresentation.ts`
  - `mobile/src/profile/socialControlOperations.ts`
  - `mobile/src/profile/other/**`
  - generated Relay artifacts under `mobile/src/__generated__/**`
  - focused tests under `mobile/tests/profile/**`
- Done condition: accepted outbound relationships expose Unfollow; only
  viewer-originated blocks expose Unblock; duplicate/cross-action taps and stale
  route completions are guarded; payload errors remain local and retryable.
- Verification:
  - From `mobile/`: `bun run relay`
  - From `mobile/`: `bun test tests/profile/relationshipPresentation.test.ts tests/profile/OtherUserProfileScreen.test.ts`
  - From `mobile/`: `pnpm exec jest --config ./jest.config.js tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand`
  - From `mobile/`: `bun run test:quality`
  - From repo root: `git diff --check`

## Deferred Scope

- Batches 2-5 in the approved design are queued but not executable yet.
- Native address-book import and bulk contact upload remain out of scope.
- Release-candidate manual device/account QA remains deferred until all five
  product batches close.

## Do This Now

Do not edit mobile code before the backend schema is exported. Once backend
Task 2 passes, begin source-plan Task 3 with failing pure presentation tests.

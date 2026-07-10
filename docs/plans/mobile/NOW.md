# Mobile Lane NOW

Last reviewed: 2026-07-09
Status: Batch 2 Profile Content Surfaces active; Task 5 profile previews next

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-09-profile-content-surfaces.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: Task 5; Tasks 1-4 are complete.
- Deliver universal content state, cards, controls, and sections; migrate Home;
  then add independent profile previews and shared paginated lists.
- Controls appear in previews and lists: edit/delete for owned posts/stories,
  report for non-owned posts/stories, and watch navigation for replays.
- Done condition: Home remains regression-green; viewer and visible other-user
  profiles show independently retryable previews plus stale-safe full lists.

## Verification

- From `mobile/`: `bun run relay`
- From `mobile/`: focused Bun and RNTL commands in Tasks 2-6
- From `mobile/`: `bun run test:quality`
- From repo root: `git diff --check`

## Deferred Scope

- Batches 3-5 remain queued and are not executable.
- Media publishing, content details, comments, reactions, replay management,
  native address-book import, and release-candidate QA remain out of scope.

## Next Action

Execute Task 5 with failing independent profile-preview query and UI tests.
Preserve each implementation-plan milestone commit.

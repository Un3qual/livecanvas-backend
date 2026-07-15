# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: release-depth Batch 3 app-lifecycle recovery active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Current scope: Batch 3 suspends transient viewer playback and realtime/chat
  resources while backgrounded, then refetches and reconnects once on resume.
- Write scope: `mobile/src/live/watch/**`, `mobile/tests/live/**`, and this lane
  pointer. Promote backend work only if a focused contract test fails.
- Done condition: app-state noise cannot duplicate recovery, backgrounding does
  not issue durable leave, and foreground recovery is generation-safe.
- Verification: focused app-state, playback, chat lifecycle, and watch-screen
  suites plus mobile typechecks, lint, and patch hygiene.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Next Action

Execute Batch 3. After its milestone commit, advance this pointer to Batch 4
post and story media rendering.

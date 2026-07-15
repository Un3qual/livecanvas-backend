# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: release-depth Batch 5 dedicated story viewer active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Current scope: Batch 5 adds an opaque-ID story route with previous/next/close
  navigation over the selected author's active story feed.
- Write scope: `mobile/app/(app)/stories/**`, `mobile/src/content/**`, affected
  feed/profile story entry points and tests, generated Relay artifacts, and this
  lane pointer. Promote backend work only if a focused contract test fails.
  pointer. Promote backend work only if a focused contract test fails.
- Done condition: feed/profile story cards open the viewer, opaque selection and
  boundaries remain stable across replacement data, and shared media rendering
  handles available/unavailable stories.
- Verification: Relay generation, focused story/feed/profile suites, mobile
  typechecks, lint, and patch hygiene.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Next Action

Execute Batch 5. After its milestone commit, close the five-batch lane and run
the full release-depth verification matrix.

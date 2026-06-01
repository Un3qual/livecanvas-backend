# Mobile Lane Execution

Last reviewed: 2026-06-01
Status: live discovery plus viewer watch flow plan ready for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md` unless explicitly assigned.

## Current Batch

- Track: `docs/plans/mobile/TRACK.md`
- Source: `docs/plans/mobile/2026-06-01-live-discovery-viewer-watch-flow.md`
- Plan: active for the next product slice after profiles/social basics.
- Batch: `Task 1: Add live-session presentation and navigation helpers`
- Why now: profiles/social basics are complete, and the next product-completeness slice is viewer entry into live sessions through discovery, profile entry, and direct session routes.

## Do This Now

- Execute `docs/plans/mobile/2026-06-01-live-discovery-viewer-watch-flow.md` Task 1.
- Preserve the mobile lane scope: own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or shared contract docs from the mobile lane.
- Keep Phoenix Channel and media playback implementation out of this batch; the current realtime contract requires a non-Relay integer topic ID that mobile does not receive through the durable GraphQL surface.

## Verification Scope

- Task 1 focused verification: `cd mobile && bun test src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts`.
- Later tasks define their own Relay compiler, TypeScript, and focused test verification.

## Next Up

- `docs/plans/mobile/2026-06-01-live-discovery-viewer-watch-flow.md` -> `Task 2: Build Relay-backed home live discovery`

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

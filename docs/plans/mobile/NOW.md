# Mobile Lane NOW

Last reviewed: 2026-06-27
Status: Task 4 complete; Task 5 ready

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-06-27-mobile-typescript-quality-readability.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: reduce manual TypeScript ceremony in live broadcast code by
  extracting shared media payload helpers, native WebRTC adapters, realtime
  normalizers, controller hooks, and test fixtures without behavior changes.
- Write scope:
  - `mobile/**`
  - `docs/plans/mobile/**`
- Done condition: live broadcast host/viewer flows preserve existing behavior
  while screens import feature-owned controller/data contracts instead of
  defining repeated generated-type, Phoenix payload, and WebRTC adapter shapes.
- Verification:
  - From `mobile/`: `bun run test:quality`
  - From `mobile/`: `bun test tests/auth tests/profile tests/config`
  - From `mobile/`: `bun run typecheck`
  - From repo root: `git diff --check`

## Do This Now

Execute Task 5 from
`docs/plans/mobile/2026-06-27-mobile-typescript-quality-readability.md`,
then commit that milestone before continuing.

## Guardrails

- Do not run remote or authenticated EAS build/submit commands from this local
  docs handoff.
- Do not expand the completed release-candidate checklist into implementation
  unless a launch blocker is reproduced and promoted.
- Do not change GraphQL schema shape in the quality gate alignment batch.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Split realtime event normalization into focused media, timeline, session-state,
and guard modules while keeping `normalizeLiveSessionRealtimeEvent` as the
public compatibility entrypoint.

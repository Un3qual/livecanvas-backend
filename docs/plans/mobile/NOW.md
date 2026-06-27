# Mobile Lane NOW

Last reviewed: 2026-06-27
Status: mobile frontend structure cleanup in progress

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-06-27-mobile-frontend-structure-cleanup.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: split oversized frontend files into nested feature folders and
  extract presentation modules without behavior changes.
- Write scope:
  - `mobile/**`
  - `docs/plans/mobile/**`
- Done condition: mobile app route files and largest source screens are split
  into nested feature modules for auth, profiles, live watch, and host
  preflight, while existing behavior and public imports remain intact.
- Verification:
  - From `mobile/`: `bun run test:quality`
  - From `mobile/`: `bun test tests/auth tests/profile tests/config`
  - From `mobile/`: `bun run typecheck`
  - From repo root: `git diff --check`

## Do This Now

Execute Task 1 through Task 5 from
`docs/plans/mobile/2026-06-27-mobile-frontend-structure-cleanup.md`.

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

Extract the shared auth entry screen, then move profile, live-watch, and host
preflight presentation into nested feature folders.

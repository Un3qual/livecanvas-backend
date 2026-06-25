# Mobile Lane NOW

Last reviewed: 2026-06-25
Status: beta readiness plan complete; ready for release-candidate execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Completed source plan:
  `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`
- Track: `docs/plans/mobile/TRACK.md`
- Completed task: Task 3 - release candidate checklist (complete on
  2026-06-25)
- Write scope:
  - `docs/plans/mobile/**`
- Done condition: mobile has a focused release-candidate checklist that
  separates launch blockers from deferred follow-up and covers manual
  device/simulator checks for auth, profiles, live discovery/watch, host
  preflight, media signaling, realtime chat, retained chat replay, app
  background/foreground recovery, and ended-session cleanup. Met on
  2026-06-25.
- Verification:
  - From repo root: `git diff --check`

## Task 3 Evidence

- Release-candidate checklist:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
- `git diff --check` exited 0 on 2026-06-25.
- No mobile app code, package, or config files changed.
- No remote or authenticated EAS build/submit commands were run.

## Do This Now

The testing, beta distribution, and release readiness plan is complete.
Execute release-candidate device QA from
`docs/plans/mobile/2026-06-25-release-candidate-checklist.md` when a beta
operator is ready. Promote a new implementation batch only if that checklist
finds a launch blocker.

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

Run local quality gates, then use the `preview` EAS profile for internal
release-candidate device QA. Use the `development` profile only for custom
development-client native-media debugging.

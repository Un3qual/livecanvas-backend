# Mobile Lane NOW

Last reviewed: 2026-06-04
Status: active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-06-04-chat-realtime-retained-history.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: chat realtime stream plus retained history
- Write scope:
  - `mobile/package.json`
  - `mobile/pnpm-lock.yaml`
  - `mobile/schema.graphql`
  - `mobile/src/live/**`
  - `mobile/src/realtime/**`
  - `docs/plans/mobile/**`
  - coordinator-assigned contract repair in `docs/contracts/mobile-graphql-chat-history.md`
    and `docs/contracts/mobile-live-session-graphql.md`

## Do This Now

Execute the five tasks in
`docs/plans/mobile/2026-06-04-chat-realtime-retained-history.md` with
subagent-driven TDD. Use `gpt-5.5` with `xhigh` reasoning for every subagent.

## Guardrails

- Do not add real mobile media publishing or viewer playback from this lane.
- Do not decode Relay IDs client-side.
- Backend live media runtime foundation is complete; keep true go-live behavior
  aligned with the backend media signaling contract.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Start Task 1: retained timeline history contract repair and mobile presentation
helpers.

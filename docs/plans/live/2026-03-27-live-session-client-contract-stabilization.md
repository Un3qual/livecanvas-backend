# Live Session Client Contract Stabilization Implementation Plan

**Goal:** Publish and lock the mobile-facing live-session GraphQL and Phoenix Channel contracts so the mobile app can build watch, join, and host flows against one documented backend surface.

**Architecture:** Keep the existing live-session behavior and authorization model intact, then turn the currently implicit contract in tests into explicit docs plus focused regression coverage. Freeze the durable GraphQL surface (`liveNow`, `LiveSession`, `User.currentLiveSession`, `User.replayFeed`, and the live mutations) separately from the ephemeral `live_session:<id>` channel topic so mobile can combine Relay-managed state with bounded realtime updates without reverse-engineering backend tests.

**Tech Stack:** Elixir 1.15, Phoenix Channels, Absinthe Relay, ExUnit, Markdown

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. The backend already exposes live-session GraphQL mutations and live-session Relay/read surfaces, but no published contract doc describes the supported mobile shape (`lib/live_canvas_gql/live/live_mutations.ex`, `lib/live_canvas_gql/live/live_resolver.ex`, `lib/live_canvas_gql/feed/feed_types.ex`, `lib/live_canvas_gql/feed/feed_queries.ex`, `test/live_canvas_gql/live/live_mutations_test.exs`, `test/live_canvas_gql/feed/feed_queries_test.exs`, `test/live_canvas_gql/relay/node_queries_test.exs`).
2. The `live_session:<id>` Phoenix Channel already returns a join ack and emits bounded `session:state`, `chat:message`, `chat:message_updated`, and `disconnect` events with client-safe join failure reasons, but there is no mobile contract doc for that transport (`lib/live_canvas_web/channels/live_session_channel.ex`, `test/live_canvas_web/channels/live_session_channel_test.exs`).
3. The mobile overview explicitly treats published backend contracts as the source of truth and already depends on existing contract docs for auth/social and retained chat history, which makes the missing live-session contract the next unblocked backend integration gap (`docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`, `docs/contracts/mobile-graphql-phase2.md`, `docs/contracts/mobile-graphql-chat-history.md`).
4. The completed live-session state/presence slice intentionally stabilized the channel payloads in code/tests, which makes a contract-publication pass lower risk than inventing new live behavior right now (`docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`).

## Scope Decisions

- Document the live-session surfaces that already exist; do not invent subscriptions, participant rosters, or new topic names in this slice.
- Keep the GraphQL contract focused on viewer-visible live reads/writes and host-owned lifecycle transitions.
- Keep the realtime contract focused on the existing `live_session:<id>` topic, join response, broadcast event names, payloads, and client-safe failure reasons.
- Preserve Relay/global-ID, viewer-scope, and IDOR-safe resolver behavior already enforced in code.
- Defer mobile-native media transport details and playback SDK choices; those belong to mobile planning, not this backend contract slice.

## Progress

- [ ] Task 1: Freeze the live-session GraphQL contract
- [ ] Task 2: Publish the live-session realtime channel contract
- [ ] Task 3: Verify the contract slice and refresh backend lane tracking

### Task 1: Freeze The Live-Session GraphQL Contract

**Files:**
- Create: `docs/contracts/mobile-live-session-graphql.md`
- Modify: `test/live_canvas_gql/live/live_mutations_test.exs`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify if contract drift is uncovered: `lib/live_canvas_gql/live/live_mutations.ex`
- Modify if contract drift is uncovered: `lib/live_canvas_gql/live/live_resolver.ex`
- Modify if contract drift is uncovered: `lib/live_canvas_gql/feed/feed_types.ex`
- Modify if contract drift is uncovered: `lib/live_canvas_gql/feed/feed_queries.ex`

**Task 1 Step Progress:**
- [ ] Step 1: Add failing GraphQL coverage that pins the supported mobile live surface in one place: `startLiveSession`, `goLiveSession`, `joinLiveSession`, `leaveLiveSession`, `endLiveSession(recordingMediaAssetId:)`, `liveNow`, `User.currentLiveSession`, `User.replayFeed`, and Relay `LiveSession` node reads
- [ ] Step 2: Write `docs/contracts/mobile-live-session-graphql.md` describing the supported inputs, payload fields, Relay ID requirements, viewer/host authorization semantics, and stable user-error outcomes
- [ ] Step 3: Reconcile any test/doc drift with the smallest GraphQL-layer change needed so the published contract matches the actual supported surface without changing `LC.Live` ownership boundaries
- [ ] Step 4: Run `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
- [ ] Step 5: Run `mix compile` and `mix typecheck`
- [ ] Step 6: Update checklist progress and commit the GraphQL-contract slice

**Task 1 behavior targets:**

- Mobile clients have one published GraphQL contract for live-session reads and lifecycle mutations.
- All live-session identifiers in the documented public surface remain Relay/global IDs rather than raw database IDs.
- Host-only lifecycle operations stay host-owned, viewer joins stay viewer-scoped, and unauthorized reads continue resolving through the existing safe fallbacks.
- Recording linkage through `endLiveSession` stays optional and host-owned.

**Suggested verification command:**

```bash
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: PASS.

### Task 2: Publish The Live-Session Realtime Channel Contract

**Files:**
- Create: `docs/contracts/mobile-live-session-realtime.md`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `test/live_canvas_gql/live/live_mutations_test.exs`
- Modify if contract drift is uncovered: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify if contract drift is uncovered: `lib/live_canvas_gql/live/live_resolver.ex`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing channel/integration coverage that pins the mobile-facing topic contract for join success payloads, `session:state`, `chat:message`, `chat:message_updated`, `disconnect`, and the documented join failure reasons
- [ ] Step 2: Write `docs/contracts/mobile-live-session-realtime.md` describing topic naming, join prerequisites, join ack shape, event payloads, event ordering guarantees that already exist, and client-safe failure reasons such as `session_unavailable`
- [ ] Step 3: Reconcile any doc/test drift with additive transport-only fixes while keeping participant rosters, remote owner-node names, and other internal runtime details out of the public contract
- [ ] Step 4: Run `mix test test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/live/live_mutations_test.exs`
- [ ] Step 5: Run `mix compile` and `mix typecheck`
- [ ] Step 6: Update checklist progress and commit the realtime-contract slice

**Task 2 behavior targets:**

- The `live_session:<id>` topic has one published contract for join ack and broadcast events.
- Session-state payloads stay bounded to aggregate data (`status`, `visibility`, `viewer_count`) rather than leaking participant identities.
- Remote runtime errors continue collapsing to client-safe reasons such as `session_unavailable`.
- End-of-session delivery stays reconcilable for mobile clients: terminal system event and terminal session state publish before disconnect closes already-joined viewers.

**Suggested verification command:**

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/live/live_mutations_test.exs
```

Expected: PASS.

### Task 3: Verify The Contract Slice And Refresh Backend Lane Tracking

**Files:**
- Modify: `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md`
- Modify: `docs/plans/backend/NOW.md`
- Coordinator follow-up only: `docs/plans/INDEX.md`
- Coordinator follow-up only: `docs/plans/NOW.md`

**Task 3 Step Progress:**
- [ ] Step 1: Run `mix compile`
- [ ] Step 2: Run `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`
- [ ] Step 3: Run `mix typecheck`
- [ ] Step 4: Update this checklist and `docs/plans/backend/NOW.md` to the next unblocked backend batch
- [ ] Step 5: Report required coordinator updates for shared dashboard/index docs without editing them from the backend lane
- [ ] Step 6: Commit the verified contract-stabilization milestone

**Task 3 behavior targets:**

- The new contract docs and focused tests stay green together.
- Backend lane tracking moves cleanly from planning back into execution.
- Shared dashboard/index docs receive an explicit repair note instead of silent drift.

**Suggested verification command:**

```bash
mix compile
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix typecheck
```

Expected: PASS.

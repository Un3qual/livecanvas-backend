# Live Channel Transport Contract Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the mobile live-session realtime contract so mobile clients can join live-session Phoenix Channels from Relay-fetched data and consume the current timeline-event channel surface.

**Architecture:** Keep durable reads and lifecycle mutations Relay-first, and keep Phoenix Channels as the ephemeral live-session state and chat/timeline transport. The backend will expose an opaque, viewer-authorized `channelTopic` on visible `LiveSession` nodes instead of requiring mobile to derive a topic from a Relay ID or decode backend integer IDs. The contract docs and mobile helpers will describe the current `timeline:*` channel events introduced by the backend timeline redesign.

**Tech Stack:** Elixir/Phoenix Channels, Absinthe Relay GraphQL, TypeScript, Relay Compiler, Bun unit tests.

---

## Current State Verification

Verified before drafting this plan:

1. `docs/plans/mobile/NOW.md` says live discovery plus durable viewer watch flow is complete and calls out the missing client-safe channel topic as the blocker for future Phoenix Channel work.
2. `docs/plans/mobile/TRACK.md` says host broadcast/native media planning should follow unless channel transport contract repair is prioritized first.
3. `docs/contracts/mobile-live-session-realtime.md` still documents the pre-redesign `chat:message` and `chat:message_updated` surface.
4. `lib/live_canvas_web/channels/live_session_channel.ex` currently accepts `live_session:<session_id>` topics, replies to `timeline:chat_message:send`, and broadcasts `timeline:event`, `timeline:event_updated`, and `timeline:event_removed` with Relay-normalized timeline event IDs.
5. `mobile/schema.graphql` exposes Relay `LiveSession` IDs and lifecycle mutations but no channel join topic.
6. `mobile/src/live/LiveSessionWatchScreen.tsx` joins and leaves durable participation through GraphQL only; it does not join Phoenix Channels.

## Scope Decisions

- Add a nullable `LiveSession.channelTopic` field for mobile clients. It re-applies viewer authorization in the child field resolver, returns the server-generated channel topic for viewer-authorized `STARTING` and `LIVE` sessions, and returns `null` for `ENDED`, unauthenticated, or unauthorized sessions.
- Treat `channelTopic` as an opaque transport string. Mobile code must not parse it, derive it from a Relay ID, or assume it will always contain the database integer.
- Keep channel authorization in the socket join path even though the topic came from an authorized GraphQL read; GraphQL topic disclosure and channel joining must both enforce authorization.
- Update the realtime contract to the current timeline event names and payload shapes.
- Add mobile pure helpers for validating a provided topic and normalizing timeline event payloads. Do not add socket connection lifecycle, media playback, media capture, or chat UI in this batch.
- Regenerate the mobile Relay schema and generated artifacts only for queries/mutations touched by this plan.

## File Structure

- `docs/contracts/mobile-live-session-graphql.md`: document `LiveSession.channelTopic`.
- `docs/contracts/mobile-live-session-realtime.md`: replace stale `chat:message` text with the current `timeline:*` event contract and opaque topic rule.
- `lib/live_canvas_gql/feed/feed_types.ex`: add the `channel_topic` field to `:live_session`.
- `lib/live_canvas_gql/live/live_resolver.ex`: expose a small public resolver for `LiveSession.channelTopic`.
- `test/live_canvas_gql/feed/feed_queries_test.exs`: cover `channelTopic` on `liveNow`.
- `test/live_canvas_gql/relay/node_queries_test.exs`: cover `channelTopic` on `node(id:)`.
- `test/live_canvas_gql/live/live_resolver_test.exs`: cover direct child-resolver authorization behavior, including unauthorized private/followers-only sessions.
- `test/live_canvas_gql/live/live_mutations_test.exs`: cover mutation payloads returning `channelTopic`.
- `test/live_canvas_web/channels/live_session_channel_test.exs`: keep the current timeline-event channel payload contract pinned.
- `mobile/schema.graphql`: refresh the local schema snapshot after backend GraphQL changes.
- `mobile/src/live/LiveSessionWatchScreen.tsx`: request `channelTopic` in the watch query so the generated artifact proves the field is mobile-visible.
- `mobile/src/live/LiveDiscoveryScreen.tsx`: request `channelTopic` for live discovery cards without displaying it.
- `mobile/src/live/liveSessionChannelTopic.ts`: normalize nullable channel topics for future channel consumers.
- `mobile/src/live/liveSessionChannelTopic.test.ts`: unit coverage for topic helper behavior.
- `mobile/src/live/liveSessionRealtimeEvents.ts`: normalize current timeline channel events into mobile-safe discriminated unions.
- `mobile/src/live/liveSessionRealtimeEvents.test.ts`: unit coverage for event normalization.
- `docs/plans/mobile/TRACK.md`: advance after implementation.
- `docs/plans/mobile/NOW.md`: track task progress and close the plan when complete.
- `docs/plans/NOW.md` and `docs/plans/INDEX.md`: coordinator repair only when the plan closes or is reprioritized.

## Progress

- [x] Task 1: Pin the repaired mobile realtime contract
- [ ] Task 2: Expose `LiveSession.channelTopic` through GraphQL
- [ ] Task 3: Refresh mobile Relay schema and request the topic
- [ ] Task 4: Add mobile topic and realtime-event helpers
- [ ] Task 5: Verify, close docs, and hand off to host broadcast planning

### Task 1: Pin The Repaired Mobile Realtime Contract

**Files:**
- Modify: `docs/contracts/mobile-live-session-realtime.md`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`

- [x] **Step 1: Update the realtime contract doc**

Replace the stale `chat:message` and `chat:message_updated` sections with these event sections:

````markdown
## `timeline:event`

The joined topic broadcasts `timeline:event` whenever a visible timeline event is created.

Stable payload shape:

```json
{
  "event": {
    "__typename": "ChatMessageEvent",
    "id": "Q2hhdE1lc3NhZ2VFdmVudDoxMjM=",
    "event_type": "chat_message_sent",
    "body": "hello",
    "actor_id": 456,
    "occurred_at": "2026-06-01T23:17:09Z",
    "edited": false,
    "edit_count": 0,
    "edited_at": null
  }
}
```

`event.id` is a Relay global ID when the event type has a mobile GraphQL node type. Clients must treat it as opaque.

## `timeline:event_updated`

The joined topic broadcasts `timeline:event_updated` when a visible timeline event changes in place, such as a chat-message edit or moderation state change. The payload uses the same `{"event": {...}}` envelope as `timeline:event`.

## `timeline:event_removed`

The joined topic broadcasts `timeline:event_removed` when a timeline event should be removed from the active client view.

Stable payload shape:

```json
{
  "removed_timeline_event_id": "Q2hhdE1lc3NhZ2VFdmVudDoxMjM="
}
```
````

Also update topic wording so clients join the `LiveSession.channelTopic` value returned by GraphQL and treat the topic as opaque.

Update the Disconnect Control section so it says:

```markdown
Mobile clients do not join these control topics directly. The client-observable contract is:

- `endLiveSession` publishes the terminal `timeline:event` lifecycle event first
- then publishes the terminal `session:state`
- only after those events does the server close already-joined viewers with `reason: "session_ended"`
- `leaveLiveSession` closes only the caller's joined channel with `reason: "viewer_left"`
```

- [x] **Step 2: Run the existing channel contract test**

Run:

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
```

Expected: PASS before implementation because the backend already emits the current `timeline:*` channel surface. If it fails, stop and investigate before changing GraphQL.

- [x] **Step 3: Add or tighten channel assertions**

In `test/live_canvas_web/channels/live_session_channel_test.exs`, ensure the existing `timeline:chat_message:send` test asserts all of these reply and broadcast keys:

```elixir
assert_reply ref, :ok, %{
  event: %{
    __typename: "ChatMessageEvent",
    event_type: "chat_message_sent",
    body: "hello",
    id: event_global_id,
    actor_id: actor_id,
    occurred_at: occurred_at,
    edited: false,
    edit_count: 0,
    edited_at: nil
  }
}

assert_receive %Phoenix.Socket.Message{
  topic: ^session_topic,
  event: "timeline:event",
  payload: %{
    event: %{
      __typename: "ChatMessageEvent",
      event_type: "chat_message_sent",
      body: "hello",
      id: ^event_global_id,
      actor_id: ^actor_id,
      occurred_at: ^occurred_at,
      edited: false,
      edit_count: 0,
      edited_at: nil
    }
  }
}
```

- [x] **Step 4: Re-run the channel contract test**

Run:

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
```

Expected: PASS.

- [x] **Step 5: Commit Task 1**

```bash
git add docs/contracts/mobile-live-session-realtime.md test/live_canvas_web/channels/live_session_channel_test.exs
git commit -m "docs: repair mobile live realtime contract"
```

### Task 2: Expose `LiveSession.channelTopic` Through GraphQL

**Files:**
- Modify: `docs/contracts/mobile-live-session-graphql.md`
- Modify: `lib/live_canvas_gql/feed/feed_types.ex`
- Modify: `lib/live_canvas_gql/live/live_resolver.ex`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Create: `test/live_canvas_gql/live/live_resolver_test.exs`
- Modify: `test/live_canvas_gql/live/live_mutations_test.exs`

- [ ] **Step 1: Document `channelTopic`**

In `docs/contracts/mobile-live-session-graphql.md`, add `channelTopic: String` to the supported `LiveSession` fields and add this field rule:

```markdown
- `channelTopic` is an opaque Phoenix Channel topic string for visible `STARTING` and `LIVE` sessions.
- `channelTopic` is `null` for `ENDED` sessions.
- Mobile clients must pass `channelTopic` to the Phoenix Channel client exactly as returned; they must not parse it or derive it from a Relay ID.
- Channel joins still re-apply viewer authorization and session-state checks.
```

- [ ] **Step 2: Write failing query coverage**

In `test/live_canvas_gql/feed/feed_queries_test.exs`, add `alias LCTransport.LiveSessionTopics` near the existing aliases, then add coverage that queries `channelTopic` from `liveNow`:

```elixir
test "live sessions expose an opaque channel topic for active sessions" do
  host = user_fixture(privacy_mode: :public)
  viewer = user_fixture()
  {:ok, session} = Live.start_live_session(host, %{visibility: :public})
  {:ok, live_session} = Live.mark_session_live(session)

  query = """
  query LiveNowWithChannelTopic {
    liveNow(first: 10) {
      edges {
        node {
          id
          channelTopic
        }
      }
    }
  }
  """

  assert {:ok,
          %{
            data: %{
              "liveNow" => %{
                "edges" => [
                  %{
                    "node" => %{
                      "id" => _relay_id,
                      "channelTopic" => channel_topic
                    }
                  }
                ]
              }
            }
          }} =
           Absinthe.run(query, LCGQL.Schema,
             context: %{current_scope: Accounts.scope_for_user(viewer)}
           )

  assert channel_topic == LiveSessionTopics.live_session_topic(live_session.id)
end

test "liveNow does not expose channel topics for non-visible followers-only sessions" do
  host = user_fixture()
  outsider = user_fixture()
  {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
  {:ok, _live_session} = Live.mark_session_live(session)

  query = """
  query HiddenLiveNowWithChannelTopic {
    liveNow(first: 10) {
      edges {
        node {
          id
          channelTopic
        }
      }
    }
  }
  """

  assert {:ok, %{data: %{"liveNow" => %{"edges" => []}}}} =
           Absinthe.run(query, LCGQL.Schema,
             context: %{current_scope: Accounts.scope_for_user(outsider)}
           )
end
```

In `test/live_canvas_gql/relay/node_queries_test.exs`, add coverage that queries `channelTopic` from `node(id:)`:

```elixir
test "ended live session node reads return a null channel topic" do
  host = user_fixture(privacy_mode: :public)
  context = %{current_scope: Accounts.scope_for_user(host)}

  {:ok, session} = Live.start_live_session(host, %{visibility: :public})
  {:ok, ended_session} = Live.end_live_session(session)
  relay_id = Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)

  query = """
  query EndedLiveSessionChannelTopic($id: ID!) {
    node(id: $id) {
      ... on LiveSession {
        id
        channelTopic
      }
    }
  }
  """

  assert {:ok,
          %{
            data: %{
              "node" => %{
                "id" => ^relay_id,
                "channelTopic" => nil
              }
            }
          }} =
           Absinthe.run(query, LCGQL.Schema,
             variables: %{"id" => relay_id},
             context: context
           )
end
```

- [ ] **Step 3: Write direct child-resolver authorization coverage**

Create `test/live_canvas_gql/live/live_resolver_test.exs`:

```elixir
defmodule LCGQL.Live.ResolverTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Live}
  alias LCGQL.Live.Resolver
  alias LCTransport.LiveSessionTopics

  describe "live_session_channel_topic/3" do
    test "returns an opaque topic for an authorized active viewer" do
      host = user_fixture()
      viewer = user_fixture()
      _follow = accepted_follow_fixture(viewer, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, live_session} = Live.mark_session_live(session)

      assert {:ok, topic} =
               Resolver.live_session_channel_topic(live_session, %{}, resolution_for(viewer))

      assert topic == LiveSessionTopics.live_session_topic(live_session.id)
    end

    test "returns nil for active sessions the viewer cannot join" do
      host = user_fixture()
      outsider = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, live_session} = Live.mark_session_live(session)

      assert {:ok, nil} =
               Resolver.live_session_channel_topic(live_session, %{}, resolution_for(outsider))
    end

    test "returns nil for ended sessions and missing viewer scope" do
      host = user_fixture(privacy_mode: :public)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, ended_session} = Live.end_live_session(session)

      assert {:ok, nil} =
               Resolver.live_session_channel_topic(ended_session, %{}, resolution_for(host))

      assert {:ok, nil} =
               Resolver.live_session_channel_topic(session, %{}, %Absinthe.Resolution{
                 context: %{}
               })
    end
  end

  defp resolution_for(viewer) do
    %Absinthe.Resolution{context: %{current_scope: Accounts.scope_for_user(viewer)}}
  end
end
```

- [ ] **Step 4: Write failing mutation payload coverage**

In `test/live_canvas_gql/live/live_mutations_test.exs`, extend the `startLiveSession`, `goLiveSession`, and `joinLiveSession` success selections to include `channelTopic`:

```graphql
liveSession {
  id
  status
  channelTopic
}
```

Assert that `channelTopic` equals `LiveSessionTopics.live_session_topic(session.id)` for returned `STARTING` and `LIVE` sessions.

- [ ] **Step 5: Run focused GraphQL tests and verify RED**

Run:

```bash
mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/live/live_resolver_test.exs test/live_canvas_gql/live/live_mutations_test.exs
```

Expected: FAIL with a GraphQL validation error that `channelTopic` does not exist on `LiveSession` and an undefined `Resolver.live_session_channel_topic/3` failure in the direct resolver test.

- [ ] **Step 6: Implement the resolver**

In `lib/live_canvas_gql/live/live_resolver.ex`, add:

```elixir
@spec live_session_channel_topic(map(), map(), Absinthe.Resolution.t()) ::
        {:ok, String.t() | nil}
def live_session_channel_topic(
      %{id: session_id, status: status} = live_session,
      _args,
      %Absinthe.Resolution{context: %{current_scope: %{user: %{id: user_id} = viewer}}}
    )
    when is_integer(session_id) and is_integer(user_id) and status in [:starting, :live] do
  case Chat.authorize_join(viewer, live_session) do
    :ok -> {:ok, LiveSessionTopics.live_session_topic(session_id)}
    {:error, _reason} -> {:ok, nil}
  end
end

def live_session_channel_topic(_live_session, _args, _resolution), do: {:ok, nil}
```

- [ ] **Step 7: Add the GraphQL field**

In `lib/live_canvas_gql/feed/feed_types.ex`, inside `object :live_session`, add:

```elixir
field :channel_topic, :string do
  resolve(&LCGQL.Live.Resolver.live_session_channel_topic/3)
end
```

- [ ] **Step 8: Run focused GraphQL tests**

Run:

```bash
mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/live/live_resolver_test.exs test/live_canvas_gql/live/live_mutations_test.exs
```

Expected: PASS.

- [ ] **Step 9: Run compile and typecheck**

Run:

```bash
mix compile
mix typecheck
```

Expected: both PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add docs/contracts/mobile-live-session-graphql.md lib/live_canvas_gql/feed/feed_types.ex lib/live_canvas_gql/live/live_resolver.ex test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/live/live_resolver_test.exs test/live_canvas_gql/live/live_mutations_test.exs
git commit -m "feat: expose live session channel topic"
```

### Task 3: Refresh Mobile Relay Schema And Request The Topic

**Files:**
- Modify: `mobile/schema.graphql`
- Modify: `mobile/src/live/LiveDiscoveryScreen.tsx`
- Modify: `mobile/src/live/LiveSessionWatchScreen.tsx`
- Modify generated Relay files under `mobile/src/live/__generated__/`

- [ ] **Step 1: Refresh the mobile schema snapshot**

Run:

```bash
mix absinthe.schema.sdl --schema LCGQL.Schema > mobile/schema.graphql
```

Expected schema addition:

```graphql
type LiveSession implements Node {
  id: ID!
  channelTopic: String
  status: LiveSessionStatus!
  visibility: LiveSessionVisibility!
  insertedAt: String!
  startedAt: String
  endedAt: String
  host: User!
  recordingMediaAsset: LiveSessionRecordingMediaAsset
}
```

- [ ] **Step 2: Request `channelTopic` in live discovery**

In `mobile/src/live/LiveDiscoveryScreen.tsx`, add `channelTopic` to the `LiveSession` selection used for `liveNow` cards:

```graphql
node {
  id
  channelTopic
  status
  visibility
  insertedAt
  startedAt
  endedAt
  host {
    id
    email
  }
}
```

- [ ] **Step 3: Request `channelTopic` in watch reads**

In `mobile/src/live/LiveSessionWatchScreen.tsx`, add `channelTopic` to the `LiveSession` selection:

```graphql
... on LiveSession {
  id
  channelTopic
  status
  visibility
  insertedAt
  startedAt
  endedAt
  host {
    id
    email
  }
  recordingMediaAsset {
    id
    processingState
    publicUrl
  }
}
```

- [ ] **Step 4: Run Relay compiler**

Run:

```bash
cd mobile
./node_modules/.bin/relay-compiler
```

Expected: PASS and generated artifacts include `channelTopic?: string | null`.

- [ ] **Step 5: Run mobile TypeScript**

Run:

```bash
cd mobile
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add mobile/schema.graphql mobile/src/live/LiveDiscoveryScreen.tsx mobile/src/live/LiveSessionWatchScreen.tsx mobile/src/live/__generated__
git commit -m "chore(mobile): request live channel topic"
```

### Task 4: Add Mobile Topic And Realtime-Event Helpers

**Files:**
- Create: `mobile/src/live/liveSessionChannelTopic.test.ts`
- Create: `mobile/src/live/liveSessionChannelTopic.ts`
- Create: `mobile/src/live/liveSessionRealtimeEvents.test.ts`
- Create: `mobile/src/live/liveSessionRealtimeEvents.ts`

- [ ] **Step 1: Write channel topic helper tests**

Create `mobile/src/live/liveSessionChannelTopic.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import { readJoinableLiveSessionChannelTopic } from './liveSessionChannelTopic';

describe('liveSessionChannelTopic', () => {
  test('returns the opaque topic for active sessions', () => {
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: 'live_session:123',
        status: 'LIVE',
      }),
    ).toBe('live_session:123');
  });

  test('does not expose a topic for ended sessions', () => {
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: 'live_session:123',
        status: 'ENDED',
      }),
    ).toBeNull();
  });

  test('rejects blank or missing topics', () => {
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: '   ',
        status: 'LIVE',
      }),
    ).toBeNull();
    expect(
      readJoinableLiveSessionChannelTopic({
        channelTopic: null,
        status: 'STARTING',
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Implement the channel topic helper**

Create `mobile/src/live/liveSessionChannelTopic.ts`:

```ts
import { canEnterLiveSession, normalizeLiveSessionStatus } from './liveSessionPresentation';

export type LiveSessionChannelTopicSource = {
  readonly channelTopic?: string | null;
  readonly status: string;
};

export function readJoinableLiveSessionChannelTopic(
  source: LiveSessionChannelTopicSource,
): string | null {
  const topic = source.channelTopic?.trim();

  if (!topic || !canEnterLiveSession(normalizeLiveSessionStatus(source.status))) {
    return null;
  }

  return topic;
}
```

- [ ] **Step 3: Write realtime event helper tests**

Create `mobile/src/live/liveSessionRealtimeEvents.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import { normalizeLiveSessionRealtimeEvent } from './liveSessionRealtimeEvents';

describe('liveSessionRealtimeEvents', () => {
  test('normalizes session state payloads', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('session:state', {
        session_state: {
          status: 'live',
          visibility: 'public',
          viewer_count: 12,
        },
      }),
    ).toEqual({
      kind: 'session_state',
      status: 'LIVE',
      visibility: 'PUBLIC',
      viewerCount: 12,
    });
  });

  test('normalizes timeline event payloads', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'ChatMessageEvent',
          id: 'event-id',
          event_type: 'chat_message_sent',
          body: 'hello',
          actor_id: 42,
          occurred_at: '2026-06-01T23:17:09Z',
          edited: false,
          edit_count: 0,
          edited_at: null,
        },
      }),
    ).toEqual({
      kind: 'timeline_event',
      event: {
        __typename: 'ChatMessageEvent',
        id: 'event-id',
        eventType: 'chat_message_sent',
        body: 'hello',
        actorId: 42,
        occurredAt: '2026-06-01T23:17:09Z',
        edited: false,
        editCount: 0,
        editedAt: null,
      },
    });
  });

  test('normalizes removed timeline event payloads', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event_removed', {
        removed_timeline_event_id: 'event-id',
      }),
    ).toEqual({
      kind: 'timeline_event_removed',
      removedTimelineEventId: 'event-id',
    });
  });

  test('accepts lifecycle timeline events with nullable chat fields', () => {
    expect(
      normalizeLiveSessionRealtimeEvent('timeline:event', {
        event: {
          __typename: 'LiveSessionStartedEvent',
          id: 'started-event-id',
          event_type: 'live_session_started',
          body: null,
          actor_id: 42,
          occurred_at: '2026-06-01T23:18:09Z',
          edited: null,
          edit_count: null,
          edited_at: null,
        },
      }),
    ).toEqual({
      kind: 'timeline_event',
      event: {
        __typename: 'LiveSessionStartedEvent',
        id: 'started-event-id',
        eventType: 'live_session_started',
        body: null,
        actorId: 42,
        occurredAt: '2026-06-01T23:18:09Z',
        edited: null,
        editCount: null,
        editedAt: null,
      },
    });
  });

  test('ignores malformed or unknown payloads', () => {
    expect(normalizeLiveSessionRealtimeEvent('session:state', {})).toBeNull();
    expect(normalizeLiveSessionRealtimeEvent('unknown:event', {})).toBeNull();
  });
});
```

- [ ] **Step 4: Implement realtime event normalization**

Create `mobile/src/live/liveSessionRealtimeEvents.ts`:

```ts
type JsonRecord = Record<string, unknown>;

export type LiveSessionTimelineEventPayload = {
  readonly __typename: string;
  readonly id: string;
  readonly eventType: string;
  readonly body: string | null;
  readonly actorId: number | null;
  readonly occurredAt: string;
  readonly edited: boolean | null;
  readonly editCount: number | null;
  readonly editedAt: string | null;
};

export type LiveSessionRealtimeEvent =
  | {
      readonly kind: 'session_state';
      readonly status: 'STARTING' | 'LIVE' | 'ENDED';
      readonly visibility: 'PUBLIC' | 'FOLLOWERS';
      readonly viewerCount: number;
    }
  | {
      readonly kind: 'timeline_event';
      readonly event: LiveSessionTimelineEventPayload;
    }
  | {
      readonly kind: 'timeline_event_updated';
      readonly event: LiveSessionTimelineEventPayload;
    }
  | {
      readonly kind: 'timeline_event_removed';
      readonly removedTimelineEventId: string;
    };

export function normalizeLiveSessionRealtimeEvent(
  eventName: string,
  payload: unknown,
): LiveSessionRealtimeEvent | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (eventName === 'session:state') {
    return normalizeSessionState(payload);
  }

  if (eventName === 'timeline:event' || eventName === 'timeline:event_updated') {
    const event = normalizeTimelineEvent(payload.event);
    if (!event) {
      return null;
    }

    return {
      kind: eventName === 'timeline:event' ? 'timeline_event' : 'timeline_event_updated',
      event,
    };
  }

  if (eventName === 'timeline:event_removed') {
    return typeof payload.removed_timeline_event_id === 'string'
      ? {
          kind: 'timeline_event_removed',
          removedTimelineEventId: payload.removed_timeline_event_id,
        }
      : null;
  }

  return null;
}

function normalizeSessionState(payload: JsonRecord): LiveSessionRealtimeEvent | null {
  const sessionState = payload.session_state;

  if (!isRecord(sessionState)) {
    return null;
  }

  const status = normalizeRealtimeStatus(sessionState.status);
  const visibility = normalizeRealtimeVisibility(sessionState.visibility);
  const viewerCount = sessionState.viewer_count;

  if (!status || !visibility || typeof viewerCount !== 'number') {
    return null;
  }

  return {
    kind: 'session_state',
    status,
    visibility,
    viewerCount,
  };
}

function normalizeTimelineEvent(value: unknown): LiveSessionTimelineEventPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.__typename !== 'string' ||
    typeof value.id !== 'string' ||
    typeof value.event_type !== 'string' ||
    typeof value.occurred_at !== 'string' ||
    !isNullableBoolean(value.edited) ||
    !isNullableNumber(value.edit_count)
  ) {
    return null;
  }

  return {
    __typename: value.__typename,
    id: value.id,
    eventType: value.event_type,
    body: typeof value.body === 'string' ? value.body : null,
    actorId: typeof value.actor_id === 'number' ? value.actor_id : null,
    occurredAt: value.occurred_at,
    edited: typeof value.edited === 'boolean' ? value.edited : null,
    editCount: typeof value.edit_count === 'number' ? value.edit_count : null,
    editedAt: typeof value.edited_at === 'string' ? value.edited_at : null,
  };
}

function normalizeRealtimeStatus(value: unknown): 'STARTING' | 'LIVE' | 'ENDED' | null {
  switch (value) {
    case 'starting':
      return 'STARTING';
    case 'live':
      return 'LIVE';
    case 'ended':
      return 'ENDED';
    default:
      return null;
  }
}

function normalizeRealtimeVisibility(value: unknown): 'PUBLIC' | 'FOLLOWERS' | null {
  switch (value) {
    case 'public':
      return 'PUBLIC';
    case 'followers':
      return 'FOLLOWERS';
    default:
      return null;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return typeof value === 'boolean' || value === null;
}

function isNullableNumber(value: unknown): value is number | null {
  return typeof value === 'number' || value === null;
}
```

- [ ] **Step 5: Run mobile helper tests**

Run:

```bash
cd mobile
bun test src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run mobile TypeScript**

Run:

```bash
cd mobile
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add mobile/src/live/liveSessionChannelTopic.test.ts mobile/src/live/liveSessionChannelTopic.ts mobile/src/live/liveSessionRealtimeEvents.test.ts mobile/src/live/liveSessionRealtimeEvents.ts
git commit -m "feat(mobile): add live realtime contract helpers"
```

### Task 5: Verify, Close Docs, And Hand Off To Host Broadcast Planning

**Files:**
- Modify: `docs/plans/mobile/2026-06-01-live-channel-transport-contract-repair.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/INDEX.md`

- [ ] **Step 1: Run backend verification**

Run:

```bash
mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/live/live_resolver_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix compile
mix typecheck
```

Expected: PASS.

- [ ] **Step 2: Run mobile verification**

Run:

```bash
cd mobile
bun test src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts
./node_modules/.bin/relay-compiler
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run contract stale-surface search**

Run:

```bash
rg -n "chat:message|chat:message_updated|removed_timeline_event_id|timeline:event|channelTopic" docs/contracts docs/plans/mobile mobile/src/live lib/live_canvas_web/channels test/live_canvas_web/channels
```

Expected: no stale `chat:message` or `chat:message_updated` hits outside archived historical plans; `timeline:event`, `removed_timeline_event_id`, and `channelTopic` hits should be current contract, test, helper, schema, or plan references.

- [ ] **Step 4: Run whitespace verification**

Run:

```bash
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Close the plan and advance pointers**

In this plan, mark all completed task checkboxes.

In `docs/plans/mobile/TRACK.md`, change:

```markdown
- Status: channel transport contract repair complete; host broadcast native capability and preflight planning is next
- Current detailed plan: none; next detailed plan should cover host broadcast native capability and preflight planning.
- Next lane batch: create the host broadcast native capability and preflight planning plan.
```

In `docs/plans/mobile/NOW.md`, change status to `channel transport contract repair complete` and set Next Up to host broadcast/native media planning.

In `docs/plans/NOW.md` and `docs/plans/INDEX.md`, update the mobile current batch to the host broadcast planning handoff only after the mobile lane docs are updated.

- [ ] **Step 6: Commit Task 5**

```bash
git add docs/plans/mobile/2026-06-01-live-channel-transport-contract-repair.md docs/plans/mobile/TRACK.md docs/plans/mobile/NOW.md docs/plans/NOW.md docs/plans/INDEX.md
git commit -m "docs: hand off to host broadcast planning"
```

## Final Verification Commands

Run this complete set before opening the PR:

```bash
mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/live/live_resolver_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix compile
mix typecheck
cd mobile
bun test src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts
./node_modules/.bin/relay-compiler
./node_modules/.bin/tsc --noEmit
cd ..
git diff --check
```

If the Nix daemon is unavailable, record the local-toolchain verification and the `/nix/var/nix/daemon-socket/socket: Connection refused` failure separately instead of treating Nix-wrapper failures as application failures.

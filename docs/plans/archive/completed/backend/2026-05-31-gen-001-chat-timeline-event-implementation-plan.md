# GEN-001 Chat Timeline/Event Object Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **Historical execution note:** This plan was implemented with `superpowers:subagent-driven-development`. All checklist items are complete; do not restart this plan unless the user explicitly reopens `GEN-001`.

**Goal:** Replace client-facing chat-message system events with first-class live-session timeline events backed by append-only facts and current projection tables.

**Architecture:** The database stores a narrow append-only timeline event envelope plus subtype tables for chat, edits, moderation, and future commercial events. Client history, GraphQL node refetch, and reconnect recovery read the current projection so removed messages are absent and edited messages appear once with the latest body. Realtime delivery uses timeline event/update/remove payloads that mirror the GraphQL concrete event types.

**Tech Stack:** Elixir, Phoenix Channels, Absinthe Relay, Ecto, PostgreSQL, LetMe-era authorization conventions through `LC.Chat` action functions.

---

## Source Material

- Locked design: `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- Backend conventions: `docs/architecture/conventions.md`
- Active lane pointer: `docs/plans/backend/NOW.md`
- Legacy implementation to replace:
  - `priv/repo/migrations/20260303023000_create_chat_tables.exs`
  - `priv/repo/migrations/20260317120000_add_chat_message_moderation_fields.exs`
  - `lib/live_canvas_schemas/chat.ex`
  - `lib/live_canvas_schemas/chat/chat_message.ex`
  - `lib/live_canvas/chat.ex`
  - `lib/live_canvas/chat/chat_message.ex`
  - `lib/live_canvas/chat/history.ex`
  - `lib/live_canvas/chat/system_events.ex`
  - `lib/live_canvas/chat/broadcasts.ex`
  - `lib/live_canvas_gql/chat/chat_types.ex`
  - `lib/live_canvas_gql/chat/chat_resolver.ex`
  - `lib/live_canvas_gql/chat/chat_mutations.ex`
  - `lib/live_canvas_gql/chat/system_event_projection.ex`
  - `lib/live_canvas_gql/feed/feed_types.ex`
  - `lib/live_canvas_gql/live/live_resolver.ex`
  - `lib/live_canvas_gql/schema.ex`
  - `lib/live_canvas_web/channels/live_session_channel.ex`
  - `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`

## File Structure

Create the new schema modules below. Keep table-contract moduledocs concise and aligned with `docs/architecture/conventions.md`.

- `priv/repo/migrations/20260531120000_create_live_session_timeline_events.exs`: creates timeline envelope, projection, chat subtype, edit subtype, moderation action, and moderation-event tables.
- `priv/repo/migrations/20260531123000_drop_legacy_chat_messages.exs`: drops legacy `chat_messages` after code no longer reads it.
- `lib/live_canvas_schemas/chat/live_session_timeline_event.ex`: envelope schema.
- `lib/live_canvas_schemas/chat/live_session_timeline_event_state.ex`: current projection state schema.
- `lib/live_canvas_schemas/chat/live_session_timeline_chat_message.ex`: immutable original chat-message fact schema.
- `lib/live_canvas_schemas/chat/live_session_timeline_chat_message_state.ex`: mutable current chat-message projection schema.
- `lib/live_canvas_schemas/chat/live_session_timeline_chat_message_edit.ex`: immutable edit fact schema.
- `lib/live_canvas_schemas/chat/live_session_moderation_action.ex`: durable moderation action schema.
- `lib/live_canvas_schemas/chat/live_session_timeline_moderation_event.ex`: moderation timeline subtype schema.
- `lib/live_canvas_schemas/chat.ex`: timeline event/state/action types.
- `lib/live_canvas_schemas.ex`: Boundary exports for new schema modules and removal of legacy `Chat.ChatMessage` export at the cleanup task.

Keep domain behavior under `LC.Chat` and focused private modules:

- `lib/live_canvas/chat.ex`: public authorization, mutation, history, node-refetch, and broadcast facade.
- `lib/live_canvas/chat/timeline_events.ex`: transaction orchestration for send, edit, remove, lifecycle insertions, and projection queries.
- `lib/live_canvas/chat/timeline_event_changes.ex`: changeset helpers and value normalization for timeline schemas.
- `lib/live_canvas/chat/timeline_projection.ex`: GraphQL/channel-facing projection maps with direct scalar fields.
- `lib/live_canvas/chat/timeline_broadcasts.ex`: Phoenix PubSub payloads and event names.

GraphQL stays in the existing chat namespace:

- `lib/live_canvas_gql/chat/chat_types.ex`: replace `ChatMessage` with `LiveSessionTimelineEvent` interface and concrete event node types.
- `lib/live_canvas_gql/chat/chat_resolver.ex`: replace chat-message resolvers with timeline event connection/node/mutation resolvers.
- `lib/live_canvas_gql/chat/chat_mutations.ex`: replace `removeLiveChatMessage`, add edit/remove timeline mutations.
- `lib/live_canvas_gql/feed/feed_types.ex`: replace `LiveSession.chatMessages` with `LiveSession.timelineEvents`.
- `lib/live_canvas_gql/live/live_resolver.ex`: emit lifecycle timeline events instead of system-event chat messages.
- `lib/live_canvas_gql/schema.ex`: update Relay node fetch and type resolution from `ChatMessage` to timeline event projections.

Update transport and operational edges:

- `lib/live_canvas_web/channels/live_session_channel.ex`: send chat through timeline APIs and broadcast `timeline:event`, `timeline:event_updated`, `timeline:event_removed`.
- `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`: rate-limit new mutation names.
- `lib/live_canvas/infra/data_governance/deletion.ex`: include timeline tables in account deletion logic.
- `lib/live_canvas/infra/data_governance/export.ex`: include timeline events in export output where chat messages were exported.
- `lib/live_canvas/infra/data_governance/retention.ex`: retain timeline event families instead of legacy `chat_messages`.
- `docs/architecture/conventions.md`: add durable timeline/projection convention after implementation is green.

## Contracts To Preserve

- Use `:utc_datetime_usec` in migrations and schemas.
- New relational tables use bigint primary keys plus database-generated UUIDv7 `entropy_id` where they have their own identity.
- Use text/check vocabularies for timeline event types, projection states, and moderation action types; do not use Postgres enums.
- GraphQL stays Relay-first. Timeline events must be globally refetchable only through authorization-aware lookup.
- Removed messages must be absent from history/reconnect projection by default.
- Edited messages must appear once in history/reconnect projection with latest body and edit metadata.
- Durable facts remain append-only. Only projection state/current-state rows mutate.
- Do not expose raw FK lookup paths through GraphQL node fetchers or child resolvers.

## Task 1: Add Timeline Tables And Schema Modules

**Files:**
- Create: `priv/repo/migrations/20260531120000_create_live_session_timeline_events.exs`
- Create: `lib/live_canvas_schemas/chat/live_session_timeline_event.ex`
- Create: `lib/live_canvas_schemas/chat/live_session_timeline_event_state.ex`
- Create: `lib/live_canvas_schemas/chat/live_session_timeline_chat_message.ex`
- Create: `lib/live_canvas_schemas/chat/live_session_timeline_chat_message_state.ex`
- Create: `lib/live_canvas_schemas/chat/live_session_timeline_chat_message_edit.ex`
- Create: `lib/live_canvas_schemas/chat/live_session_moderation_action.ex`
- Create: `lib/live_canvas_schemas/chat/live_session_timeline_moderation_event.ex`
- Modify: `lib/live_canvas_schemas/chat.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Test: `test/live_canvas_schemas/chat/timeline_event_schema_test.exs`

- [x] **Step 1: Write failing schema tests**

Add `test/live_canvas_schemas/chat/timeline_event_schema_test.exs`:

```elixir
defmodule LCSchemas.Chat.TimelineEventSchemaTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Live
  alias LCSchemas.Chat.{
    LiveSessionModerationAction,
    LiveSessionTimelineChatMessage,
    LiveSessionTimelineChatMessageEdit,
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState,
    LiveSessionTimelineModerationEvent
  }

  test "timeline schemas use utc microsecond timestamps and relational ids" do
    assert LiveSessionTimelineEvent.__schema__(:type, :occurred_at) == :utc_datetime_usec
    assert LiveSessionTimelineEvent.__schema__(:type, :inserted_at) == :utc_datetime_usec
    assert LiveSessionTimelineEvent.__schema__(:type, :updated_at) == :utc_datetime_usec
    assert LiveSessionTimelineEvent.__schema__(:type, :id) == :id
    assert LiveSessionTimelineEvent.__schema__(:type, :entropy_id) == Ecto.UUID

    assert LiveSessionTimelineEventState.__schema__(:type, :updated_at) == :utc_datetime_usec
    assert LiveSessionTimelineChatMessageState.__schema__(:type, :last_edited_at) ==
             :utc_datetime_usec
    assert LiveSessionModerationAction.__schema__(:type, :expires_at) == :utc_datetime_usec
  end

  test "chat message send, edit, and moderation rows persist with expected associations" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    event =
      Repo.insert!(%LiveSessionTimelineEvent{
        live_session_id: session.id,
        actor_user_id: viewer.id,
        event_type: :chat_message_sent,
        occurred_at: now,
        payload: %{}
      })

    Repo.insert!(%LiveSessionTimelineChatMessage{
      timeline_event_id: event.id,
      body: "hello",
      body_format: :plain
    })

    Repo.insert!(%LiveSessionTimelineChatMessageState{
      timeline_event_id: event.id,
      current_body: "hello",
      edit_count: 0,
      updated_at: now
    })

    Repo.insert!(%LiveSessionTimelineEventState{
      timeline_event_id: event.id,
      live_session_id: session.id,
      occurred_at: now,
      projection_state: :visible,
      updated_at: now
    })

    edit_event =
      Repo.insert!(%LiveSessionTimelineEvent{
        live_session_id: session.id,
        actor_user_id: viewer.id,
        target_event_id: event.id,
        event_type: :chat_message_edited,
        occurred_at: DateTime.add(now, 1, :second),
        payload: %{}
      })

    Repo.insert!(%LiveSessionTimelineChatMessageEdit{
      timeline_event_id: edit_event.id,
      target_event_id: event.id,
      previous_body: "hello",
      new_body: "hello!"
    })

    moderation_action =
      Repo.insert!(%LiveSessionModerationAction{
        live_session_id: session.id,
        action_type: :message_removed,
        actor_user_id: host.id,
        target_user_id: viewer.id,
        target_event_id: event.id
      })

    moderation_event =
      Repo.insert!(%LiveSessionTimelineEvent{
        live_session_id: session.id,
        actor_user_id: host.id,
        target_event_id: event.id,
        event_type: :chat_message_removed,
        occurred_at: DateTime.add(now, 2, :second),
        payload: %{}
      })

    Repo.insert!(%LiveSessionTimelineModerationEvent{
      timeline_event_id: moderation_event.id,
      moderation_action_id: moderation_action.id
    })

    assert Repo.get!(LiveSessionTimelineChatMessage, event.id).body == "hello"
    assert Repo.get!(LiveSessionTimelineChatMessageEdit, edit_event.id).new_body == "hello!"
    assert Repo.get!(LiveSessionTimelineModerationEvent, moderation_event.id).moderation_action_id ==
             moderation_action.id
  end
end
```

- [x] **Step 2: Run the schema tests and verify they fail**

Run:

```bash
mix test test/live_canvas_schemas/chat/timeline_event_schema_test.exs
```

Expected: compile failure because the timeline schema modules do not exist.

- [x] **Step 3: Create the migration**

Add `priv/repo/migrations/20260531120000_create_live_session_timeline_events.exs` with these table contracts:

```elixir
defmodule LiveCanvas.Repo.Migrations.CreateLiveSessionTimelineEvents do
  use Ecto.Migration

  def change do
    create table(:live_session_timeline_events) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :event_type, :text, null: false
      add :actor_user_id, references(:users, on_delete: :nilify_all)
      add :target_event_id, references(:live_session_timeline_events, on_delete: :nothing)
      add :occurred_at, :utc_datetime_usec, null: false
      add :idempotency_key, :text
      add :payload, :map, null: false, default: %{}

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:live_session_timeline_events, [:entropy_id])
    create unique_index(:live_session_timeline_events, [:id, :live_session_id])
    create index(:live_session_timeline_events, [:live_session_id])
    create index(:live_session_timeline_events, [:actor_user_id])
    create index(:live_session_timeline_events, [:target_event_id])
    create index(:live_session_timeline_events, [:live_session_id, :occurred_at, :id])

    create unique_index(
             :live_session_timeline_events,
             [:live_session_id, :event_type, :idempotency_key],
             where: "idempotency_key is not null"
           )

    create constraint(
             :live_session_timeline_events,
             :live_session_timeline_events_event_type_check,
             check:
               "event_type in ('chat_message_sent', 'chat_message_edited', 'chat_message_removed', 'live_session_started', 'live_session_ended')"
           )

    execute(
      """
      alter table live_session_timeline_events
      add constraint live_session_timeline_events_target_same_session_fk
      foreign key (target_event_id, live_session_id)
      references live_session_timeline_events(id, live_session_id)
      """,
      """
      alter table live_session_timeline_events
      drop constraint live_session_timeline_events_target_same_session_fk
      """
    )

    create table(:live_session_moderation_actions) do
      add :entropy_id, :uuid, null: false, default: fragment("uuidv7()")
      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :action_type, :text, null: false
      add :actor_user_id, references(:users, on_delete: :restrict), null: false
      add :target_user_id, references(:users, on_delete: :nilify_all)
      add :target_event_id, references(:live_session_timeline_events, on_delete: :nilify_all)
      add :reason_code, :text
      add :internal_note, :text
      add :expires_at, :utc_datetime_usec
      add :revoked_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:live_session_moderation_actions, [:entropy_id])
    create index(:live_session_moderation_actions, [:live_session_id])
    create index(:live_session_moderation_actions, [:actor_user_id])
    create index(:live_session_moderation_actions, [:target_user_id])
    create index(:live_session_moderation_actions, [:target_event_id])

    create index(
             :live_session_moderation_actions,
             [:live_session_id, :target_user_id, :action_type],
             where: "revoked_at is null"
           )

    create unique_index(
             :live_session_moderation_actions,
             [:target_event_id, :action_type],
             where: "revoked_at is null and action_type = 'message_removed'"
           )

    create constraint(
             :live_session_moderation_actions,
             :live_session_moderation_actions_action_type_check,
             check: "action_type in ('message_removed', 'user_muted', 'user_banned')"
           )

    create table(:live_session_timeline_event_states, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :live_session_id, references(:live_sessions, on_delete: :delete_all), null: false
      add :occurred_at, :utc_datetime_usec, null: false
      add :projection_state, :text, null: false

      add :superseded_by_event_id,
          references(:live_session_timeline_events, on_delete: :nilify_all)

      add :moderation_action_id, references(:live_session_moderation_actions, on_delete: :nilify_all)
      add :updated_at, :utc_datetime_usec, null: false
    end

    create index(
             :live_session_timeline_event_states,
             [:live_session_id, :occurred_at, :timeline_event_id],
             where: "projection_state in ('visible', 'redacted_placeholder')"
           )

    create index(:live_session_timeline_event_states, [:superseded_by_event_id])
    create index(:live_session_timeline_event_states, [:moderation_action_id])

    create constraint(
             :live_session_timeline_event_states,
             :live_session_timeline_event_states_projection_state_check,
             check: "projection_state in ('visible', 'hidden', 'redacted_placeholder', 'internal')"
           )

    create table(:live_session_timeline_chat_messages, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :body, :text, null: false
      add :body_format, :text, null: false, default: "plain"
    end

    create constraint(
             :live_session_timeline_chat_messages,
             :live_session_timeline_chat_messages_body_format_check,
             check: "body_format in ('plain')"
           )

    create table(:live_session_timeline_chat_message_states, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :current_body, :text
      add :edit_count, :bigint, null: false, default: 0

      add :last_edit_event_id,
          references(:live_session_timeline_events, on_delete: :nilify_all)

      add :last_edited_at, :utc_datetime_usec
      add :updated_at, :utc_datetime_usec, null: false
    end

    create index(:live_session_timeline_chat_message_states, [:last_edit_event_id])

    create constraint(
             :live_session_timeline_chat_message_states,
             :live_session_timeline_chat_message_states_edit_count_check,
             check: "edit_count >= 0"
           )

    create table(:live_session_timeline_chat_message_edits, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :target_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          null: false

      add :previous_body, :text, null: false
      add :new_body, :text, null: false
    end

    create index(:live_session_timeline_chat_message_edits, [:target_event_id, :timeline_event_id])

    create table(:live_session_timeline_moderation_events, primary_key: false) do
      add :timeline_event_id,
          references(:live_session_timeline_events, on_delete: :delete_all),
          primary_key: true

      add :moderation_action_id,
          references(:live_session_moderation_actions, on_delete: :delete_all),
          null: false
    end

    create unique_index(:live_session_timeline_moderation_events, [:moderation_action_id])
  end
end
```

- [x] **Step 4: Add schema modules and type vocabularies**

In `lib/live_canvas_schemas/chat.ex`, replace the legacy chat-message types with timeline types:

```elixir
@type timeline_event_type ::
        :chat_message_sent
        | :chat_message_edited
        | :chat_message_removed
        | :live_session_started
        | :live_session_ended

@type timeline_projection_state :: :visible | :hidden | :redacted_placeholder | :internal
@type chat_message_body_format :: :plain
@type moderation_action_type :: :message_removed | :user_muted | :user_banned
```

Each new schema module uses `use LCSchemas.Schema, :relational` except primary-key-by-FK subtype/state tables, which should set `@primary_key false` and `@foreign_key_type :id` before `schema`.

Example envelope schema:

```elixir
defmodule LCSchemas.Chat.LiveSessionTimelineEvent do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.User
  alias LCSchemas.Live.LiveSession

  @moduledoc """
  Schema for the `live_session_timeline_events` table.

  Table contract:
  - Append-only event envelope with bigint `id`, database-generated UUIDv7 `entropy_id`, and `:utc_datetime_usec` timestamps.
  - Deleting the live session cascades to its timeline facts.
  - Deleting an actor nilifies `actor_user_id`; immutable event history must not keep account rows alive.
  - `(live_session_id, occurred_at, id)` supports deterministic timeline keyset ordering.
  - `(target_event_id, live_session_id)` is constrained to target an event in the same live session.
  """

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          live_session_id: pos_integer() | nil,
          event_type: LCSchemas.Chat.timeline_event_type() | nil,
          actor_user_id: pos_integer() | nil,
          target_event_id: pos_integer() | nil,
          occurred_at: DateTime.t() | nil,
          idempotency_key: String.t() | nil,
          payload: map(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "live_session_timeline_events" do
    field :entropy_id, Ecto.UUID, read_after_writes: true

    field :event_type, Ecto.Enum,
      values: [
        :chat_message_sent,
        :chat_message_edited,
        :chat_message_removed,
        :live_session_started,
        :live_session_ended
      ]

    field :occurred_at, :utc_datetime_usec
    field :idempotency_key, :string
    field :payload, :map, default: %{}

    belongs_to :live_session, LiveSession
    belongs_to :actor, User, foreign_key: :actor_user_id
    belongs_to :target_event, __MODULE__, foreign_key: :target_event_id

    timestamps()
  end
end
```

Use the same pattern for subtype/state schemas. Add all new modules to `lib/live_canvas_schemas.ex` exports.

- [x] **Step 5: Run the schema tests and migration**

Run:

```bash
mix test test/live_canvas_schemas/chat/timeline_event_schema_test.exs
```

Expected: tests pass.

Run:

```bash
mix compile
```

Expected: compile passes with no warnings.

- [x] **Step 6: Commit Task 1**

```bash
git add priv/repo/migrations/20260531120000_create_live_session_timeline_events.exs lib/live_canvas_schemas/chat.ex lib/live_canvas_schemas.ex lib/live_canvas_schemas/chat/live_session_timeline_*.ex lib/live_canvas_schemas/chat/live_session_moderation_action.ex test/live_canvas_schemas/chat/timeline_event_schema_test.exs
git commit -m "feat: add live session timeline schemas"
```

## Task 2: Add Send And History Projection APIs

**Files:**
- Create: `lib/live_canvas/chat/timeline_event_changes.ex`
- Create: `lib/live_canvas/chat/timeline_projection.ex`
- Create: `lib/live_canvas/chat/timeline_events.ex`
- Modify: `lib/live_canvas/chat.ex`
- Test: `test/live_canvas/chat_timeline_test.exs`

- [x] **Step 1: Write failing send/history tests**

Create `test/live_canvas/chat_timeline_test.exs` with a new `describe "create_timeline_chat_message/3"` block:

```elixir
defmodule LC.ChatTimelineTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Live}
  alias LCSchemas.Chat.{
    LiveSessionTimelineChatMessage,
    LiveSessionTimelineChatMessageState,
    LiveSessionTimelineEvent,
    LiveSessionTimelineEventState
  }

  describe "create_timeline_chat_message/3" do
    test "persists an append-only chat event and visible current projection" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "hello"})

      assert event.event_type == :chat_message_sent
      assert event.live_session_id == session.id
      assert event.actor_user_id == sender.id
      assert event.body == "hello"
      assert event.edited == false
      assert event.edit_count == 0
      assert event.edited_at == nil

      assert %LiveSessionTimelineEvent{event_type: :chat_message_sent} =
               Repo.get!(LiveSessionTimelineEvent, event.id)

      assert %LiveSessionTimelineChatMessage{body: "hello"} =
               Repo.get!(LiveSessionTimelineChatMessage, event.id)

      assert %LiveSessionTimelineChatMessageState{current_body: "hello", edit_count: 0} =
               Repo.get!(LiveSessionTimelineChatMessageState, event.id)

      assert %LiveSessionTimelineEventState{projection_state: :visible} =
               Repo.get!(LiveSessionTimelineEventState, event.id)
    end

    test "history projection returns visible events in occurred_at and id order" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      {:ok, first} = Chat.create_timeline_chat_message(session, host, %{body: "first"})
      {:ok, second} = Chat.create_timeline_chat_message(session, viewer, %{body: "second"})

      assert :ok = Chat.authorize_history_access(viewer, session)

      assert [%{id: first_id, body: "first"}, %{id: second_id, body: "second"}] =
               session
               |> Chat.timeline_history_query()
               |> Chat.run_query()

      assert first_id == first.id
      assert second_id == second.id
    end

    test "keeps existing history visibility policy" do
      host = user_fixture()
      follower = user_fixture()
      outsider = user_fixture()
      _follow = accepted_follow_fixture(follower, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, _event} = Chat.create_timeline_chat_message(session, follower, %{body: "visible"})
      {:ok, ended_session} = Live.end_live_session(session)

      assert :ok = Chat.authorize_history_access(follower, ended_session)
      assert {:error, :not_authorized} = Chat.authorize_history_access(outsider, ended_session)
    end

    test "denies sends from suspended viewers" do
      host = user_fixture(privacy_mode: :public)
      sender = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, _sender} = Accounts.suspend_user(sender)

      assert {:error, :not_authorized} =
               Chat.create_timeline_chat_message(session, sender, %{body: "blocked"})
    end
  end
end
```

- [x] **Step 2: Run the new tests and verify they fail**

Run:

```bash
mix test test/live_canvas/chat_timeline_test.exs
```

Expected: compile failure because `Chat.create_timeline_chat_message/3` and `Chat.timeline_history_query/1` do not exist.

- [x] **Step 3: Implement projection and transaction modules**

Add a projection map contract in `LC.Chat.TimelineProjection`:

```elixir
@type t :: %{
        id: pos_integer(),
        entropy_id: Ecto.UUID.t(),
        live_session_id: pos_integer(),
        event_type: LCSchemas.Chat.timeline_event_type(),
        actor_user_id: pos_integer() | nil,
        actor: LCSchemas.Accounts.User.t() | nil,
        occurred_at: DateTime.t(),
        target_event_id: pos_integer() | nil,
        projection_state: LCSchemas.Chat.timeline_projection_state(),
        body: String.t() | nil,
        edited: boolean(),
        edit_count: non_neg_integer(),
        edited_at: DateTime.t() | nil
      }
```

Implement `LC.Chat.TimelineEvents.create_chat_message/4` as one `Repo.transaction/1`:

```elixir
Repo.transaction(fn ->
  now = now_utc()

  event =
    %LiveSessionTimelineEvent{}
    |> TimelineEventChanges.event_changeset(%{
      live_session_id: live_session.id,
      actor_user_id: sender.id,
      event_type: :chat_message_sent,
      occurred_at: now,
      payload: %{}
    })
    |> Repo.insert!()

  %LiveSessionTimelineChatMessage{}
  |> TimelineEventChanges.chat_message_changeset(%{
    timeline_event_id: event.id,
    body: body,
    body_format: :plain
  })
  |> Repo.insert!()

  %LiveSessionTimelineChatMessageState{}
  |> TimelineEventChanges.chat_message_state_changeset(%{
    timeline_event_id: event.id,
    current_body: body,
    edit_count: 0,
    updated_at: now
  })
  |> Repo.insert!()

  %LiveSessionTimelineEventState{}
  |> TimelineEventChanges.event_state_changeset(%{
    timeline_event_id: event.id,
    live_session_id: live_session.id,
    occurred_at: now,
    projection_state: :visible,
    updated_at: now
  })
  |> Repo.insert!()

  projection_for_event!(event.id)
end)
```

Implement `LC.Chat.TimelineEvents.history_query/1` as a projection query over `live_session_timeline_event_states`, not the raw event envelope:

```elixir
from(state in LiveSessionTimelineEventState,
  join: event in LiveSessionTimelineEvent,
  on: event.id == state.timeline_event_id,
  left_join: message_state in LiveSessionTimelineChatMessageState,
  on: message_state.timeline_event_id == event.id,
  left_join: actor in assoc(event, :actor),
  where:
    state.live_session_id == ^live_session_id and
      state.projection_state in [:visible, :redacted_placeholder],
  order_by: [asc: state.occurred_at, asc: state.timeline_event_id],
  select: %{
    id: event.id,
    entropy_id: event.entropy_id,
    live_session_id: event.live_session_id,
    event_type: event.event_type,
    actor_user_id: event.actor_user_id,
    actor: actor,
    occurred_at: event.occurred_at,
    target_event_id: event.target_event_id,
    projection_state: state.projection_state,
    body: message_state.current_body,
    edited: message_state.edit_count > 0,
    edit_count: message_state.edit_count,
    edited_at: message_state.last_edited_at
  }
)
```

Expose these public functions from `LC.Chat` with typespecs:

```elixir
@spec create_timeline_chat_message(LiveSession.t(), User.t(), map()) ::
        {:ok, TimelineProjection.t()} | {:error, Ecto.Changeset.t() | :not_authorized | :session_ended}

@spec timeline_history_query(LiveSession.t()) :: Ecto.Query.t()

@spec get_timeline_event(User.t(), integer()) :: TimelineProjection.t() | nil
```

Keep `authorize_join/2`, `authorize_history_access/2`, and `run_query/1` as the policy/query gates.

- [x] **Step 4: Run the focused tests**

Run:

```bash
mix test test/live_canvas/chat_timeline_test.exs
```

Expected: tests pass.

- [x] **Step 5: Commit Task 2**

```bash
git add lib/live_canvas/chat.ex lib/live_canvas/chat/timeline_event_changes.ex lib/live_canvas/chat/timeline_projection.ex lib/live_canvas/chat/timeline_events.ex test/live_canvas/chat_timeline_test.exs
git commit -m "feat: add timeline chat send projection"
```

## Task 3: Add Append-Only Chat Message Edits

**Files:**
- Modify: `lib/live_canvas/chat.ex`
- Modify: `lib/live_canvas/chat/timeline_events.ex`
- Modify: `lib/live_canvas/chat/timeline_event_changes.ex`
- Test: `test/live_canvas/chat_timeline_test.exs`

- [x] **Step 1: Write failing edit tests**

Add this `describe` block to `test/live_canvas/chat_timeline_test.exs`:

```elixir
describe "edit_timeline_chat_message/3" do
  test "records multiple edit facts and exposes one latest-body projection" do
    host = user_fixture(privacy_mode: :public)
    sender = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, original} = Chat.create_timeline_chat_message(session, sender, %{body: "helo world"})

    assert {:ok, first_edit} =
             Chat.edit_timeline_chat_message(original, sender, %{body: "hello world"})

    assert first_edit.id == original.id
    assert first_edit.body == "hello world"
    assert first_edit.edited == true
    assert first_edit.edit_count == 1
    assert is_struct(first_edit.edited_at, DateTime)

    assert {:ok, second_edit} =
             Chat.edit_timeline_chat_message(original, sender, %{body: "hello, world"})

    assert second_edit.id == original.id
    assert second_edit.body == "hello, world"
    assert second_edit.edit_count == 2

    assert [%{id: projected_id, body: "hello, world", edit_count: 2}] =
             session
             |> Chat.timeline_history_query()
             |> Chat.run_query()

    assert projected_id == original.id

    edit_events =
      from(event in LCSchemas.Chat.LiveSessionTimelineEvent,
        where:
          event.live_session_id == ^session.id and
            event.event_type == :chat_message_edited and
            event.target_event_id == ^original.id,
        order_by: [asc: event.occurred_at, asc: event.id]
      )
      |> Repo.all()

    assert length(edit_events) == 2
  end

  test "denies edits from non-senders" do
    host = user_fixture(privacy_mode: :public)
    sender = user_fixture()
    other = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, original} = Chat.create_timeline_chat_message(session, sender, %{body: "nope"})

    assert {:error, :not_authorized} =
             Chat.edit_timeline_chat_message(original, other, %{body: "stolen"})
  end
end
```

- [x] **Step 2: Run the edit tests and verify they fail**

Run:

```bash
mix test test/live_canvas/chat_timeline_test.exs
```

Expected: compile failure because `Chat.edit_timeline_chat_message/3` does not exist.

- [x] **Step 3: Implement edit transactions**

Add a public `LC.Chat.edit_timeline_chat_message/3` wrapper with this contract:

```elixir
@spec edit_timeline_chat_message(TimelineProjection.t() | map(), User.t(), map()) ::
        {:ok, TimelineProjection.t()}
        | {:error, Ecto.Changeset.t() | :not_authorized | :not_found | :hidden | :session_ended}
```

Implementation rules:

- Fetch the target event and state by `event.id`.
- Require target event type `:chat_message_sent`.
- Require `projection_state == :visible`.
- Require `target.actor_user_id == actor.id`.
- Reuse `authorize_join/2` so ended sessions reject edits.
- Lock `live_session_timeline_chat_message_states` with `FOR UPDATE`.
- Insert one `:chat_message_edited` envelope row targeting the original event.
- Insert one `live_session_timeline_chat_message_edits` row with `previous_body` and `new_body`.
- Update the original `live_session_timeline_chat_message_states` row with latest body, incremented `edit_count`, `last_edit_event_id`, `last_edited_at`, and `updated_at`.
- Return `projection_for_event!(original_event.id)`.

The locked-row query should be:

```elixir
from(state in LiveSessionTimelineChatMessageState,
  where: state.timeline_event_id == ^target_event_id,
  lock: "FOR UPDATE"
)
```

- [x] **Step 4: Run the edit tests**

Run:

```bash
mix test test/live_canvas/chat_timeline_test.exs
```

Expected: tests pass.

- [x] **Step 5: Commit Task 3**

```bash
git add lib/live_canvas/chat.ex lib/live_canvas/chat/timeline_events.ex lib/live_canvas/chat/timeline_event_changes.ex test/live_canvas/chat_timeline_test.exs
git commit -m "feat: add timeline chat edit projections"
```

## Task 4: Add Removal, Moderation Actions, And Lifecycle Timeline Events

**Files:**
- Modify: `lib/live_canvas/chat.ex`
- Modify: `lib/live_canvas/chat/timeline_events.ex`
- Modify: `lib/live_canvas/chat/timeline_event_changes.ex`
- Modify: `lib/live_canvas_gql/live/live_resolver.ex`
- Test: `test/live_canvas/chat_timeline_test.exs`
- Test: `test/live_canvas_gql/live/live_mutations_test.exs`

- [x] **Step 1: Write failing removal and lifecycle tests**

Add removal tests to `test/live_canvas/chat_timeline_test.exs`:

```elixir
describe "remove_timeline_chat_message/3" do
  test "hides the original message from future history and records internal removal fact" do
    host = user_fixture(privacy_mode: :public)
    sender = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, first} = Chat.create_timeline_chat_message(session, sender, %{body: "remove"})
    {:ok, _second} = Chat.create_timeline_chat_message(session, host, %{body: "keep"})

    assert {:ok, %{removed_event_id: removed_id, transitioned?: true}} =
             Chat.remove_timeline_chat_message(first, host, %{reason_code: "abuse"})

    assert removed_id == first.id

    assert [%{body: "keep"}] =
             session
             |> Chat.timeline_history_query()
             |> Chat.run_query()

    assert %{
             projection_state: :hidden,
             superseded_by_event_id: removal_event_id
           } =
             Repo.get!(LCSchemas.Chat.LiveSessionTimelineEventState, first.id)

    assert %LCSchemas.Chat.LiveSessionTimelineEvent{
             event_type: :chat_message_removed,
             target_event_id: ^removed_id
           } = Repo.get!(LCSchemas.Chat.LiveSessionTimelineEvent, removal_event_id)

    assert %LCSchemas.Chat.LiveSessionTimelineEventState{projection_state: :internal} =
             Repo.get!(LCSchemas.Chat.LiveSessionTimelineEventState, removal_event_id)
  end

  test "does not create another removal event for repeated removals" do
    host = user_fixture(privacy_mode: :public)
    sender = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "remove once"})

    assert {:ok, %{transitioned?: true}} = Chat.remove_timeline_chat_message(event, host, %{})
    assert {:ok, %{transitioned?: false}} = Chat.remove_timeline_chat_message(event, host, %{})

    assert 1 ==
             from(timeline_event in LCSchemas.Chat.LiveSessionTimelineEvent,
               where:
                 timeline_event.live_session_id == ^session.id and
                   timeline_event.event_type == :chat_message_removed
             )
             |> Repo.aggregate(:count)
  end

  test "denies removal by non-hosts" do
    host = user_fixture(privacy_mode: :public)
    sender = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    {:ok, event} = Chat.create_timeline_chat_message(session, sender, %{body: "keep"})

    assert {:error, :not_authorized} = Chat.remove_timeline_chat_message(event, sender, %{})
  end
end
```

Update live mutation tests so go-live and end-session expect `timeline:event` broadcasts with event types `live_session_started` and `live_session_ended`, not `chat:message` system events.

- [x] **Step 2: Run removal and lifecycle tests and verify they fail**

Run:

```bash
mix test test/live_canvas/chat_timeline_test.exs test/live_canvas_gql/live/live_mutations_test.exs
```

Expected: failures because removal/lifecycle timeline APIs and broadcasts are not implemented.

- [x] **Step 3: Implement message removal**

Add `LC.Chat.remove_timeline_chat_message/3`:

```elixir
@spec remove_timeline_chat_message(TimelineProjection.t() | map(), User.t(), map()) ::
        {:ok, %{removed_event_id: pos_integer(), transitioned?: boolean()}}
        | {:error, :not_authorized | :not_found | :not_chat_message}
```

Transaction rules:

- Lock the target `live_session_timeline_event_states` row with `FOR UPDATE`.
- Load the target event and live session.
- Require event type `:chat_message_sent`.
- Require actor is the live-session host and active.
- If target projection is already `:hidden`, return `transitioned?: false` and do not insert a new removal event.
- Insert `live_session_moderation_actions` with `action_type: :message_removed`, `actor_user_id`, `target_user_id`, `target_event_id`, and optional `reason_code` / `internal_note`.
- Insert `live_session_timeline_events` with `event_type: :chat_message_removed`, same live session, actor, target event, and current `occurred_at`.
- Insert `live_session_timeline_moderation_events`.
- Update original event state to `projection_state: :hidden`, `superseded_by_event_id`, `moderation_action_id`, and `updated_at`.
- Insert state for the removal event with `projection_state: :internal`.

- [x] **Step 4: Implement lifecycle timeline facts**

Replace `Chat.record_system_event/3` usage with:

```elixir
@spec record_lifecycle_timeline_event(
        LiveSession.t(),
        :live_session_started | :live_session_ended,
        actor: User.t()
      ) :: {:ok, TimelineProjection.t()} | {:error, :not_authorized | Ecto.Changeset.t()}
```

Mapping:

- `:session_live` legacy behavior becomes `:live_session_started`.
- `:session_ended` legacy behavior becomes `:live_session_ended`.
- Lifecycle events insert envelope rows and visible event-state rows only; they do not use chat-message subtype rows.

Update `LCGQL.Live.Resolver` helpers:

- Rename `maybe_emit_lifecycle_system_event/4` to `maybe_emit_lifecycle_timeline_event/4`.
- Replace `broadcast_system_event/1` with `broadcast_timeline_event/1`.
- Keep the existing race guard in `emit_matching_lifecycle_event?/2`.

- [x] **Step 5: Run focused tests**

Run:

```bash
mix test test/live_canvas/chat_timeline_test.exs test/live_canvas_gql/live/live_mutations_test.exs
```

Expected: tests pass.

- [x] **Step 6: Commit Task 4**

```bash
git add lib/live_canvas/chat.ex lib/live_canvas/chat/timeline_events.ex lib/live_canvas/chat/timeline_event_changes.ex lib/live_canvas_gql/live/live_resolver.ex test/live_canvas/chat_timeline_test.exs test/live_canvas_gql/live/live_mutations_test.exs
git commit -m "feat: add timeline moderation and lifecycle events"
```

## Task 5: Replace GraphQL Chat Messages With Timeline Events

**Files:**
- Modify: `lib/live_canvas_gql/chat/chat_types.ex`
- Modify: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `lib/live_canvas_gql/chat/chat_mutations.ex`
- Modify: `lib/live_canvas_gql/feed/feed_types.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`
- Test: `test/live_canvas_gql/chat/chat_queries_test.exs`
- Test: `test/live_canvas_gql/chat/chat_mutations_test.exs`
- Test: `test/live_canvas_gql/relay/node_queries_test.exs`
- Test: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`

- [x] **Step 1: Rewrite GraphQL query tests to the new public shape**

In `test/live_canvas_gql/chat/chat_queries_test.exs`, replace `chatMessages` queries with `timelineEvents` queries.

Use this query helper:

```elixir
defp timeline_events_query do
  """
  query(
    $id: ID!,
    $first: Int,
    $after: String,
    $last: Int,
    $before: String
  ) {
    node(id: $id) {
      ... on LiveSession {
        timelineEvents(first: $first, after: $after, last: $last, before: $before) {
          edges {
            cursor
            node {
              id
              eventType
              occurredAt
              actor {
                id
              }
              ... on ChatMessageEvent {
                body
                edited
                editCount
                editedAt
              }
            }
          }
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
        }
      }
    }
  }
  """
end
```

Add assertions that:

- normal chat messages return as `ChatMessageEvent`
- removed messages are absent from `timelineEvents`
- edited messages return once with the latest body and edit metadata
- lifecycle events return as `LiveSessionStartedEvent` / `LiveSessionEndedEvent`

- [x] **Step 2: Rewrite GraphQL mutation tests**

In `test/live_canvas_gql/chat/chat_mutations_test.exs`, replace `removeLiveChatMessage` with `removeLiveChatMessageEvent`:

```graphql
mutation($chatMessageEventId: ID!) {
  removeLiveChatMessageEvent(input: { chatMessageEventId: $chatMessageEventId }) {
    removedTimelineEventId
    errors {
      field
      message
    }
  }
}
```

Add edit mutation coverage:

```graphql
mutation($chatMessageEventId: ID!, $body: String!) {
  editLiveChatMessage(input: { chatMessageEventId: $chatMessageEventId, body: $body }) {
    chatMessageEvent {
      id
      body
      edited
      editCount
      editedAt
    }
    errors {
      field
      message
    }
  }
}
```

Expected mutation behavior:

- `editLiveChatMessage` accepts only a `ChatMessageEvent` global ID owned by the actor.
- `removeLiveChatMessageEvent` accepts only a `ChatMessageEvent` global ID and only from the live-session host.
- Removed events return `removedTimelineEventId`; they do not return a hidden event node.
- Invalid ID type maps to `MutationErrors.invalid_error("chatMessageEventId")`.

- [x] **Step 3: Run GraphQL tests and verify they fail**

Run:

```bash
mix test test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
```

Expected: failures because schema/resolvers still expose `ChatMessage` and old mutation names.

- [x] **Step 4: Implement GraphQL types and resolvers**

Replace the old chat type definitions with:

```elixir
connection(node_type: :live_session_timeline_event)

enum :live_session_timeline_event_type do
  value(:chat_message_sent)
  value(:live_session_started)
  value(:live_session_ended)
end

interface :live_session_timeline_event do
  field :id, non_null(:id)
  field :event_type, non_null(:live_session_timeline_event_type)
  field :occurred_at, non_null(:string)
  field :actor, :user

  resolve_type(&Resolver.timeline_event_type/2)
end

node object(:chat_message_event) do
  interface(:live_session_timeline_event)

  field :event_type, non_null(:live_session_timeline_event_type)
  field :occurred_at, non_null(:string)
  field :actor, :user
  field :body, non_null(:string)
  field :edited, non_null(:boolean)
  field :edit_count, non_null(:integer)
  field :edited_at, :string
end

node object(:live_session_started_event) do
  interface(:live_session_timeline_event)
  field :event_type, non_null(:live_session_timeline_event_type)
  field :occurred_at, non_null(:string)
  field :actor, :user
end

node object(:live_session_ended_event) do
  interface(:live_session_timeline_event)
  field :event_type, non_null(:live_session_timeline_event_type)
  field :occurred_at, non_null(:string)
  field :actor, :user
end
```

If Absinthe Relay cannot build a connection over an interface directly, use `connection(node_type: :chat_message_event)` only as a temporary compiler probe, then switch to explicit connection/edge objects named `:live_session_timeline_event_connection` and `:live_session_timeline_event_edge` so the public field remains `timelineEvents`.

Resolver rules:

- `timeline_events/3` uses `Chat.authorize_history_access/2`, `Chat.timeline_history_query/1`, and `Chat.run_query/1`.
- `timeline_event_type/2` maps `:chat_message_sent` to `:chat_message_event`, `:live_session_started` to `:live_session_started_event`, and `:live_session_ended` to `:live_session_ended_event`.
- Node refetch in `LCGQL.Schema` must decode concrete event IDs, call `Chat.get_timeline_event/2`, and return `nil` if the projection is hidden or unauthorized.
- Remove old `:chat_message` node fetch after all callers use event IDs.

- [x] **Step 5: Update mutation rate limits**

In `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`, replace `removeLiveChatMessage` with:

```elixir
"removeLiveChatMessageEvent"
"editLiveChatMessage"
```

Keep both under the existing moderation/chat mutation limit family if the plug uses a flat high-cost list.

- [x] **Step 6: Run focused GraphQL tests**

Run:

```bash
mix test test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
```

Expected: tests pass.

- [x] **Step 7: Commit Task 5**

```bash
git add lib/live_canvas_gql/chat/chat_types.ex lib/live_canvas_gql/chat/chat_resolver.ex lib/live_canvas_gql/chat/chat_mutations.ex lib/live_canvas_gql/feed/feed_types.ex lib/live_canvas_gql/schema.ex lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
git commit -m "feat: expose live session timeline events in GraphQL"
```

## Task 6: Replace Channel Broadcasts With Timeline Payloads

**Files:**
- Create: `lib/live_canvas/chat/timeline_broadcasts.ex`
- Modify: `lib/live_canvas/chat.ex`
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `lib/live_canvas_gql/live/live_resolver.ex`
- Test: `test/live_canvas_web/channels/live_session_channel_test.exs`

- [x] **Step 1: Rewrite channel tests to timeline events**

Update send tests to push the new command:

```elixir
ref = push(socket, "timeline:chat_message:send", %{"body" => "hello"})

assert_reply ref, :ok, %{
  event: %{
    __typename: "ChatMessageEvent",
    event_type: "chat_message_sent",
    body: "hello",
    id: event_id,
    actor_id: actor_id,
    occurred_at: occurred_at,
    edited: false,
    edit_count: 0,
    edited_at: nil
  }
}

assert_broadcast "timeline:event", %{
  event: %{
    __typename: "ChatMessageEvent",
    id: ^event_id,
    body: "hello"
  }
}
```

Update removal tests to expect:

```elixir
assert_receive %Phoenix.Socket.Message{
  topic: ^session_topic,
  event: "timeline:event_removed",
  payload: %{removed_timeline_event_id: ^event_id}
}

refute_receive %Phoenix.Socket.Message{
  topic: ^session_topic,
  event: "timeline:event",
  payload: %{event: %{event_type: "chat_message_removed"}}
}
```

Add edit delivery coverage:

```elixir
assert_receive %Phoenix.Socket.Message{
  topic: ^session_topic,
  event: "timeline:event_updated",
  payload: %{
    event: %{
      __typename: "ChatMessageEvent",
      id: ^event_id,
      body: "hello, world",
      edited: true,
      edit_count: 1
    }
  }
}
```

- [x] **Step 2: Run channel tests and verify they fail**

Run:

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
```

Expected: failures because channel code still uses `chat:send`, `chat:message`, and `chat:message_updated`.

- [x] **Step 3: Implement timeline broadcast payloads**

Add `LC.Chat.TimelineBroadcasts`:

```elixir
@type event_payload :: %{
        __typename: String.t(),
        id: pos_integer(),
        event_type: String.t(),
        occurred_at: String.t(),
        actor_id: pos_integer() | nil,
        body: String.t() | nil,
        edited: boolean() | nil,
        edit_count: non_neg_integer() | nil,
        edited_at: String.t() | nil
      }

@spec broadcast_event(TimelineProjection.t(), String.t()) :: :ok
@spec broadcast_event_update(TimelineProjection.t(), String.t()) :: :ok
@spec broadcast_event_removed(pos_integer(), String.t()) :: :ok
@spec event_payload(TimelineProjection.t()) :: event_payload()
```

Event names:

- newly visible events: `timeline:event` with `%{event: event_payload}`
- edited visible events: `timeline:event_updated` with `%{event: event_payload}`
- hidden events: `timeline:event_removed` with `%{removed_timeline_event_id: id}`

Payload type mapping:

- `:chat_message_sent` -> `"ChatMessageEvent"`
- `:live_session_started` -> `"LiveSessionStartedEvent"`
- `:live_session_ended` -> `"LiveSessionEndedEvent"`

- [x] **Step 4: Update channel command handling**

In `LCWeb.LiveSessionChannel`:

- Replace inbound `"chat:send"` with `"timeline:chat_message:send"`.
- Call `Chat.create_timeline_chat_message/3`.
- Reply with `%{event: Chat.timeline_event_payload(event)}`.
- Broadcast `"timeline:event"` through `Chat.broadcast_timeline_event/2`.
- Keep invalid body and rate-limit behavior aligned with existing `LiveSessionReasons.chat_send_error_reason/1`.

Do not add a channel-side edit command in this slice. GraphQL owns `editLiveChatMessage`, and successful GraphQL edits broadcast `timeline:event_updated` to joined channel clients.

- [x] **Step 5: Update GraphQL broadcast callers**

- `editLiveChatMessage` broadcasts `timeline:event_updated` only after the edit transaction commits.
- `removeLiveChatMessageEvent` broadcasts `timeline:event_removed` only when `transitioned? == true`.
- Lifecycle mutations broadcast `timeline:event` for `live_session_started` and `live_session_ended`.
- Repeated removals do not broadcast another remove event.

- [x] **Step 6: Run channel tests**

Run:

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
```

Expected: tests pass.

- [x] **Step 7: Commit Task 6**

```bash
git add lib/live_canvas/chat.ex lib/live_canvas/chat/timeline_broadcasts.ex lib/live_canvas_web/channels/live_session_channel.ex lib/live_canvas_gql/chat/chat_resolver.ex lib/live_canvas_gql/live/live_resolver.ex test/live_canvas_web/channels/live_session_channel_test.exs
git commit -m "feat: broadcast timeline events over live channels"
```

## Task 7: Remove Legacy ChatMessage/SystemEvent Coupling And Update Operational Edges

**Files:**
- Create: `priv/repo/migrations/20260531123000_drop_legacy_chat_messages.exs`
- Delete: `lib/live_canvas_schemas/chat/chat_message.ex`
- Delete: `lib/live_canvas/chat/chat_message.ex`
- Delete: `lib/live_canvas/chat/history.ex`
- Delete: `lib/live_canvas/chat/system_events.ex`
- Delete: `lib/live_canvas/chat/broadcasts.ex`
- Delete: `lib/live_canvas_gql/chat/system_event_projection.ex`
- Modify: `lib/live_canvas_schemas/chat.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Modify: `lib/live_canvas/chat.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas/infra/data_governance/deletion.ex`
- Modify: `lib/live_canvas/infra/data_governance/export.ex`
- Modify: `lib/live_canvas/infra/data_governance/retention.ex`
- Modify: `docs/architecture/conventions.md`
- Test: `test/live_canvas_schemas/chat/chat_message_test.exs`
- Test: `test/live_canvas/infra/data_governance_deletion_test.exs`
- Test: `test/live_canvas/infra/data_governance_export_test.exs`
- Test: `test/live_canvas/infra/data_governance_retention_test.exs`

- [x] **Step 1: Rewrite or remove legacy tests**

Delete `test/live_canvas_schemas/chat/chat_message_test.exs` after all schema behavior it covered is represented by `test/live_canvas_schemas/chat/timeline_event_schema_test.exs`.

Update data-governance tests so they refer to timeline tables instead of `chat_messages`.

Expected retained family names:

```elixir
[:auth_events, :async_jobs, :webhook_events, :live_session_timeline_events, :live_participants]
```

If user-facing exports previously included chat message rows, export timeline projections with keys:

```elixir
%{
  "type" => "chat_message",
  "event_id" => event.entropy_id,
  "live_session_id" => event.live_session_id,
  "body" => projection.body,
  "occurred_at" => DateTime.to_iso8601(event.occurred_at),
  "edited" => projection.edited,
  "edit_count" => projection.edit_count
}
```

- [x] **Step 2: Run cleanup tests and verify they fail**

Run:

```bash
mix test test/live_canvas_schemas/chat/timeline_event_schema_test.exs test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas/infra/data_governance_export_test.exs test/live_canvas/infra/data_governance_retention_test.exs
```

Expected: failures until the legacy schema/table references are removed.

- [x] **Step 3: Drop legacy chat table**

Add `priv/repo/migrations/20260531123000_drop_legacy_chat_messages.exs`:

```elixir
defmodule LiveCanvas.Repo.Migrations.DropLegacyChatMessages do
  use Ecto.Migration

  def change do
    drop table(:chat_messages)
  end
end
```

The app is unreleased, so this migration does not need to backfill legacy chat data. If local seed/dev flows still need sample chat history, update them to create timeline events through `LC.Chat`.

- [x] **Step 4: Remove old modules and exports**

Remove:

- `LCSchemas.Chat.ChatMessage`
- `LC.Chat.ChatMessage`
- `LC.Chat.History`
- `LC.Chat.SystemEvents`
- `LC.Chat.Broadcasts`
- `LCGQL.Chat.SystemEventProjection`

Update `LC.Chat` aliases and typespecs so no public function returns `ChatMessage.t()`.

Run:

```bash
rg -n "ChatMessage|chat_messages|system_event|chat:message|chat:message_updated|removeLiveChatMessage" lib test docs/architecture docs/plans/backend
```

Expected remaining hits are only historical plan references in `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md` and this implementation plan.

- [x] **Step 5: Add architecture convention**

Append this durable rule to `docs/architecture/conventions.md` under `Realtime Transport` or `GraphQL And Relay`:

```markdown
- Durable live-session history is modeled as first-class timeline events. Store append-only event facts separately from mutable projection state, expose history/replay from the current projection, and use timeline-oriented channel events rather than overloading chat-message rows for lifecycle or moderation events.
```

- [x] **Step 6: Run cleanup verification**

Run:

```bash
mix test test/live_canvas_schemas/chat/timeline_event_schema_test.exs test/live_canvas/chat_timeline_test.exs test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas/infra/data_governance_export_test.exs test/live_canvas/infra/data_governance_retention_test.exs
```

Expected: tests pass.

- [x] **Step 7: Commit Task 7**

```bash
git add priv/repo/migrations/20260531123000_drop_legacy_chat_messages.exs lib/live_canvas_schemas/chat.ex lib/live_canvas_schemas.ex lib/live_canvas/chat.ex lib/live_canvas/infra/data_governance/deletion.ex lib/live_canvas/infra/data_governance/export.ex lib/live_canvas/infra/data_governance/retention.ex docs/architecture/conventions.md test/live_canvas_schemas/chat/timeline_event_schema_test.exs test/live_canvas/chat_timeline_test.exs test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas/infra/data_governance_export_test.exs test/live_canvas/infra/data_governance_retention_test.exs
git add -u lib/live_canvas_schemas/chat/chat_message.ex lib/live_canvas/chat/chat_message.ex lib/live_canvas/chat/history.ex lib/live_canvas/chat/system_events.ex lib/live_canvas/chat/broadcasts.ex lib/live_canvas_gql/chat/system_event_projection.ex test/live_canvas_schemas/chat/chat_message_test.exs
git commit -m "refactor: remove legacy chat message history model"
```

## Task 8: Full Verification And Plan Closeout

**Files:**
- Modify: `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- Modify: `docs/plans/backend/NOW.md`
- Modify: `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
- Do not modify coordinator-owned shared docs in this closeout pass unless explicitly assigned: `docs/plans/NOW.md`, `docs/plans/INDEX.md`

- [x] **Step 1: Run focused verification**

Run:

```bash
mix test test/live_canvas/chat_timeline_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas/infra/data_governance_export_test.exs test/live_canvas/infra/data_governance_retention_test.exs
```

Expected: all listed tests pass.

- [x] **Step 2: Run compile and type checks**

Run:

```bash
mix compile
mix typecheck
```

Expected: both commands pass.

- [x] **Step 3: Run stale-surface search**

Run:

```bash
rg -n "ChatMessage|chat_messages|chat:message|chat:message_updated|system_event|removeLiveChatMessage|chatMessages" lib test docs/architecture docs/plans/backend
```

Expected: no implementation or current-test hits. Historical references may remain only in locked plan/design docs that explicitly describe the removed legacy model.

- [x] **Step 4: Update plan status**

In `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`, change status to implementation complete and add the verification commands from Steps 1-3.

In `docs/plans/backend/NOW.md`, move the backend lane to the next unblocked backend batch. If no backend implementation batch remains, say that explicitly in the backend lane doc.

Only update shared coordinator docs if the user has explicitly assigned coordinator repair for this pass.

- [x] **Step 5: Final commit**

```bash
git add docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md docs/plans/backend/NOW.md docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md
git commit -m "docs: close GEN-001 timeline redesign"
```

If shared coordinator docs were explicitly repaired in the same pass:

```bash
git add docs/plans/NOW.md docs/plans/INDEX.md
git commit --amend --no-edit
```

## Final Verification Record

Task 8 closeout verification on 2026-05-31:

- `mix test test/live_canvas/chat_timeline_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas/infra/data_governance_export_test.exs test/live_canvas/infra/data_governance_retention_test.exs` -> passed, 126 tests, 0 failures.
- `mix compile` -> passed.
- `mix typecheck` -> passed with `Total errors: 0, Skipped: 0, Unnecessary Skips: 0`.
- `git diff --check` -> passed.
- `rg -n "ChatMessage|chat_messages|chat:message|chat:message_updated|system_event|removeLiveChatMessage|chatMessages" lib test docs/architecture docs/plans/backend` -> remaining hits are current timeline names and locked plan/design history; no legacy current implementation/test surface was identified.
- `rg -n "\bChatMessage\b|\bchat_messages\b|chat:message(_updated)?\b|\bsystem_event\b|\bremoveLiveChatMessage\b|\bchatMessages\b" config lib test docs/architecture` -> no hits.

## Historical Execution Notes

These notes are retained for implementation audit history only. Task 8 is complete, and this section is not an active instruction to reopen `GEN-001`.

- Execute tasks in order. Later tasks intentionally delete or rename legacy API surfaces.
- Do not preserve `ChatMessage` GraphQL compatibility. The app is unreleased and the locked design allows breaking API changes.
- Prefer a focused failing test before each behavior change. The tests above name the behavior that must fail before implementation.
- Keep commits at task boundaries so bisecting the redesign remains possible.
- If Absinthe interface connection support blocks Task 5, solve that inside Task 5 by defining explicit `LiveSessionTimelineEventConnection` and `LiveSessionTimelineEventEdge` objects; do not weaken the public `timelineEvents` API.
- If PostgreSQL rejects a migration constraint form, replace only that constraint with explicit `execute/2` SQL and keep the same table/index/constraint names.

## Historical Approval Gate

This gate was satisfied before implementation. Future backend workers should not restart execution from this plan unless the user explicitly reopens `GEN-001`. The first implementation command after approval was:

```bash
mix test test/live_canvas_schemas/chat/timeline_event_schema_test.exs
```

Expected first result at the time: compile failure for missing timeline schema modules.

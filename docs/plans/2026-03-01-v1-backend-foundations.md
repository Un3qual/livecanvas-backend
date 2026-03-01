# LiveCanvas V1 Backend Foundations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first production-ready backend slice for LiveCanvas: multi-identity accounts, follower graph, content records, live session lifecycle, live chat, and feed retrieval on the existing Phoenix/Absinthe stack.

**Architecture:** Keep the existing app as a modular monolith. Extend the current Phoenix auth scaffold into a normalized multi-identity `Accounts` context first, then add `Social`, `Content`, `Live`, `Chat`, and `Feed` as explicit contexts with narrow APIs. Use PostgreSQL for durable state, Phoenix Channels / PubSub / Presence for realtime coordination, and Membrane integration points only after the session model and channel contracts are stable.

**Tech Stack:** Elixir 1.15+, Phoenix 1.8, Absinthe, Ecto, PostgreSQL, ExUnit, Phoenix Channels, Phoenix Presence, Membrane (later in this plan)

---

## Implementation Rules

- Work in small TDD loops: failing test, minimal implementation, passing test, commit.
- Keep the repo a modular monolith; do not introduce Redis, extra services, or billing/geo work.
- Land domain slices in this order: `Accounts` -> `Social` -> `Content` -> `Live` -> `Chat` -> `Feed`.
- Preserve backward progress with short commits after each green milestone.
- Prefer additive migrations over large destructive rewrites; if old auth tables must be reshaped, copy data forward in a dedicated migration.

### Task 1: Reshape `Accounts` Persistence For Multi-Identity Auth

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_rebuild_accounts_identity_tables.exs`
- Create: `lib/live_canvas/accounts/email_address.ex`
- Create: `lib/live_canvas/accounts/phone_number.ex`
- Create: `lib/live_canvas/accounts/user_email_address.ex`
- Create: `lib/live_canvas/accounts/user_phone_number.ex`
- Create: `lib/live_canvas/accounts/user_identity.ex`
- Create: `lib/live_canvas/accounts/user_contact_entry.ex`
- Create: `lib/live_canvas/accounts/user_contact_entry_email_address.ex`
- Create: `lib/live_canvas/accounts/user_contact_entry_phone_number.ex`
- Modify: `lib/live_canvas/accounts/user.ex`
- Modify: `lib/live_canvas/accounts/user_token.ex`
- Test: `test/live_canvas/accounts_test.exs`
- Test: `test/support/fixtures/accounts_fixtures.ex`

**Step 1: Write the failing schema and migration tests**

Add tests that assert the new account model exists and the old direct-email assumptions are gone.

```elixir
test "user owns emails through join rows" do
  user = user_fixture()
  assert [] = user |> Repo.preload(:user_email_addresses) |> Map.fetch!(:user_email_addresses)
end

test "user token stores secret_hash and UUID primary key" do
  token = %UserToken{}
  assert :binary == UserToken.__schema__(:type, :secret_hash)
  assert :binary_id == UserToken.__schema__(:type, :id)
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/accounts_test.exs -v`

Expected: FAIL because the associations and `secret_hash` field do not exist yet.

**Step 3: Write the minimal persistence layer**

Create the migration and schemas for normalized contacts, linked identities, contact imports, and the revised token model.

```elixir
create table(:email_addresses) do
  add :normalized_email, :citext, null: false
  timestamps(type: :utc_datetime)
end

create unique_index(:email_addresses, [:normalized_email])

create table(:user_identities) do
  add :user_id, references(:users, on_delete: :delete_all), null: false
  add :provider, :string, null: false
  add :provider_uid, :string
  add :provider_data, :map, null: false, default: %{}
  add :encrypted_tokens, :binary
  add :last_used_at, :utc_datetime
  add :revoked_at, :utc_datetime
  timestamps(type: :utc_datetime)
end

create unique_index(:user_identities, [:provider, :provider_uid])
```

Update `UserToken` to use a binary UUID primary key and `secret_hash`:

```elixir
@primary_key {:id, :binary_id, autogenerate: false}
schema "users_tokens" do
  field :secret_hash, :binary
  field :context, :string
  field :sent_to, :string
  field :authenticated_at, :utc_datetime
  belongs_to :user, LiveCanvas.Accounts.User
  timestamps(type: :utc_datetime, updated_at: false)
end
```

**Step 4: Run tests to verify the persistence layer passes**

Run: `mix test test/live_canvas/accounts_test.exs -v`

Expected: PASS for the new schema assertions; older direct-email tests will still fail until Task 2 updates the `Accounts` API.

**Step 5: Commit**

```bash
git add priv/repo/migrations lib/live_canvas/accounts test/live_canvas/accounts_test.exs test/support/fixtures/accounts_fixtures.ex
git commit -m "refactor: normalize account identity storage"
```

### Task 2: Rewrite `Accounts` APIs Around Normalized Credentials

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/user.ex`
- Modify: `lib/live_canvas/accounts/user_token.ex`
- Modify: `lib/live_canvas/accounts/user_notifier.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/support/fixtures/accounts_fixtures.ex`
- Create: `test/live_canvas/accounts/user_token_test.exs`

**Step 1: Write the failing API tests**

Replace direct-email registration assumptions with tests around normalized email/phone joins and token contexts.

```elixir
test "register_user_with_email creates email address and verified join row" do
  {:ok, user} = Accounts.register_user_with_email(%{email: "USER@example.com"})
  user = Repo.preload(user, [user_email_addresses: :email_address])
  [join] = user.user_email_addresses
  assert join.verified_at
  assert join.email_address.normalized_email == "user@example.com"
end

test "issue_session_token stores only a secret hash" do
  %{token: raw_token, user_token: persisted} = Accounts.issue_user_token(user_fixture(), :session)
  assert is_binary(raw_token)
  assert persisted.secret_hash != raw_token
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs -v`

Expected: FAIL because the new APIs and token helpers do not exist.

**Step 3: Write the minimal `Accounts` API**

Add explicit entry points and stop treating `users.email` as the account identifier.

```elixir
def register_user_with_email(attrs) do
  Repo.transact(fn ->
    with {:ok, user} <- Repo.insert(User.registration_changeset(%User{}, attrs)),
         {:ok, _join} <- attach_email_address(user, attrs[:email], verified?: true) do
      {:ok, user}
    end
  end)
end

def issue_user_token(user, context, attrs \\ %{}) do
  {raw_secret, token_struct} = UserToken.build_token(user, context, attrs)
  {:ok, persisted} = Repo.insert(token_struct)
  %{token: raw_secret, user_token: persisted}
end
```

Add explicit lookup helpers:

```elixir
def get_user_by_email(email), do: ...
def get_user_by_phone(phone_number), do: ...
def get_user_by_identity(provider, provider_uid), do: ...
```

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/user_token_test.exs -v`

Expected: PASS, including token hashing and normalized email behavior.

**Step 5: Commit**

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas/accounts/user.ex lib/live_canvas/accounts/user_token.ex lib/live_canvas/accounts/user_notifier.ex test/live_canvas/accounts
git commit -m "feat: add normalized accounts auth APIs"
```

### Task 3: Expose Multi-Identity Account Flows Through GraphQL

**Files:**
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Create: `lib/live_canvas_gql/accounts/account_queries.ex`
- Create: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Create: `test/live_canvas_gql/accounts/account_mutations_test.exs`

**Step 1: Write the failing GraphQL tests**

Add tests for registration and login entry points that match the new account model.

```elixir
test "registerWithEmail creates a user and verified email join" do
  mutation = """
  mutation {
    registerWithEmail(input: {email: "user@example.com"}) {
      successful
    }
  }
  """

  assert {:ok, %{data: %{"registerWithEmail" => %{"successful" => true}}}} =
           Absinthe.run(mutation, LiveCanvasGQL.Schema)
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs -v`

Expected: FAIL because the schema does not expose the new operations.

**Step 3: Write the minimal schema and resolver wiring**

Import new query and mutation fields, and delegate to `Accounts`.

```elixir
field :register_with_email, :simple_payload do
  arg :input, non_null(:register_with_email_input)
  resolve &LiveCanvasGQL.Accounts.Resolver.register_with_email/2
end

field :viewer, :user do
  resolve &LiveCanvasGQL.Accounts.Resolver.viewer/2
end
```

Create a resolver module with small wrappers:

```elixir
def register_with_email(_parent, %{input: attrs}, _resolution) do
  case Accounts.register_user_with_email(attrs) do
    {:ok, _user} -> {:ok, %{successful: true}}
    {:error, changeset} -> {:ok, %{successful: false, messages: format_errors(changeset)}}
  end
end
```

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas_gql/accounts/account_mutations_test.exs -v`

Expected: PASS, with account flows calling the new `Accounts` API instead of the old scaffold defaults.

**Step 5: Commit**

```bash
git add lib/live_canvas_gql/schema.ex lib/live_canvas_gql/accounts test/live_canvas_gql/accounts/account_mutations_test.exs
git commit -m "feat: add graphql account entry points"
```

### Task 4: Add The `Social` Context For Follows, Requests, And Blocks

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_create_social_tables.exs`
- Create: `lib/live_canvas/social.ex`
- Create: `lib/live_canvas/social/follow.ex`
- Create: `lib/live_canvas/social/block.ex`
- Create: `test/live_canvas/social_test.exs`
- Create: `test/support/fixtures/social_fixtures.ex`
- Create: `lib/live_canvas_gql/social/social_types.ex`
- Create: `lib/live_canvas_gql/social/social_mutations.ex`
- Create: `lib/live_canvas_gql/social/social_queries.ex`
- Create: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`

**Step 1: Write the failing relationship tests**

Cover public-account follow, private-account follow request, and block override behavior.

```elixir
test "following a public account becomes accepted immediately" do
  follower = user_fixture()
  followed = user_fixture()
  followed = mark_account_public(followed)

  assert {:ok, follow} = Social.follow_user(follower, followed)
  assert follow.state == :accepted
end

test "blocking removes visibility even when follow exists" do
  assert :blocked = Social.relationship_state(viewer, creator)
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/social_test.exs -v`

Expected: FAIL because `Social` does not exist yet.

**Step 3: Write the minimal `Social` slice**

Create the tables and context API.

```elixir
create table(:follows) do
  add :follower_id, references(:users, on_delete: :delete_all), null: false
  add :followed_id, references(:users, on_delete: :delete_all), null: false
  add :state, :string, null: false
  add :requested_at, :utc_datetime, null: false
  add :accepted_at, :utc_datetime
  timestamps(type: :utc_datetime)
end

create unique_index(:follows, [:follower_id, :followed_id])
```

Context API:

```elixir
def follow_user(follower, followed), do: ...
def accept_follow_request(follow, acting_user), do: ...
def block_user(actor, blocked_user), do: ...
def can_view_user?(viewer, creator), do: ...
```

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/social_test.exs -v`

Expected: PASS for public/private follow and block precedence.

**Step 5: Commit**

```bash
git add priv/repo/migrations lib/live_canvas/social.ex lib/live_canvas/social lib/live_canvas_gql/social test/live_canvas/social_test.exs test/support/fixtures/social_fixtures.ex
git commit -m "feat: add social graph context"
```

### Task 5: Add The `Content` Context For Posts And Media Metadata

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_create_content_tables.exs`
- Create: `lib/live_canvas/content.ex`
- Create: `lib/live_canvas/content/post.ex`
- Create: `lib/live_canvas/content/media_asset.ex`
- Create: `test/live_canvas/content_test.exs`
- Create: `test/support/fixtures/content_fixtures.ex`
- Create: `lib/live_canvas_gql/content/content_types.ex`
- Create: `lib/live_canvas_gql/content/content_mutations.ex`
- Create: `lib/live_canvas_gql/content/content_queries.ex`
- Create: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`

**Step 1: Write the failing content tests**

Cover post creation and media metadata attachment.

```elixir
test "create_post persists author-owned content" do
  author = user_fixture()
  attrs = %{body_text: "first post", kind: :standard}
  assert {:ok, post} = Content.create_post(author, attrs)
  assert post.author_id == author.id
end

test "attach_media_asset stores object metadata not binary payload" do
  assert {:ok, asset} = Content.create_media_asset(author, %{storage_key: "uploads/a.jpg", mime_type: "image/jpeg"})
  assert asset.storage_key == "uploads/a.jpg"
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/content_test.exs -v`

Expected: FAIL because `Content` does not exist.

**Step 3: Write the minimal `Content` slice**

Create `posts` and `media_assets` first; defer story-specific divergence until a real requirement forces a separate table.

```elixir
create table(:posts) do
  add :author_id, references(:users, on_delete: :delete_all), null: false
  add :kind, :string, null: false
  add :body_text, :text
  add :visibility, :string, null: false, default: "followers"
  add :expires_at, :utc_datetime
  timestamps(type: :utc_datetime)
end

create table(:media_assets) do
  add :owner_id, references(:users, on_delete: :delete_all), null: false
  add :post_id, references(:posts, on_delete: :delete_all)
  add :storage_key, :string, null: false
  add :mime_type, :string, null: false
  add :processing_state, :string, null: false, default: "uploaded"
  add :width, :integer
  add :height, :integer
  add :duration_ms, :integer
  timestamps(type: :utc_datetime)
end
```

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/content_test.exs -v`

Expected: PASS with basic content creation working through the context.

**Step 5: Commit**

```bash
git add priv/repo/migrations lib/live_canvas/content.ex lib/live_canvas/content lib/live_canvas_gql/content test/live_canvas/content_test.exs test/support/fixtures/content_fixtures.ex
git commit -m "feat: add content context"
```

### Task 6: Add The `Live` Context, Session Supervisor, And Presence Contract

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_create_live_tables.exs`
- Create: `lib/live_canvas/live.ex`
- Create: `lib/live_canvas/live/live_session.ex`
- Create: `lib/live_canvas/live/live_participant.ex`
- Create: `lib/live_canvas/live/session_supervisor.ex`
- Create: `lib/live_canvas/live/session_server.ex`
- Create: `lib/live_canvas_web/presence.ex`
- Modify: `lib/live_canvas/application.ex`
- Modify: `lib/live_canvas_web/endpoint.ex`
- Create: `test/live_canvas/live_test.exs`
- Create: `test/live_canvas/live/session_server_test.exs`

**Step 1: Write the failing live-session tests**

Cover session creation, state transitions, and supervised in-memory coordination.

```elixir
test "start_live_session creates a starting session and a server process" do
  host = user_fixture()
  assert {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
  assert session.status == :starting
  assert {:ok, _pid} = Live.lookup_session_server(session.id)
end

test "mark_session_live transitions after negotiation success" do
  assert {:ok, session} = Live.mark_session_live(session)
  assert session.status == :live
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/live_test.exs test/live_canvas/live/session_server_test.exs -v`

Expected: FAIL because `Live` and its supervisor tree do not exist.

**Step 3: Write the minimal `Live` slice**

Create the durable session tables and supervised runtime processes.

```elixir
children = [
  LiveCanvasWeb.Telemetry,
  LiveCanvas.Repo,
  {Phoenix.PubSub, name: LiveCanvas.PubSub},
  LiveCanvasWeb.Presence,
  {DynamicSupervisor, name: LiveCanvas.Live.SessionSupervisor, strategy: :one_for_one},
  LiveCanvasWeb.Endpoint
]
```

Context API:

```elixir
def start_live_session(host, attrs), do: ...
def mark_session_live(session), do: ...
def end_live_session(session, attrs \\ %{}), do: ...
def join_live_session(session, user, role), do: ...
def lookup_session_server(session_id), do: ...
```

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/live_test.exs test/live_canvas/live/session_server_test.exs -v`

Expected: PASS, with session persistence and supervised process startup working.

**Step 5: Commit**

```bash
git add priv/repo/migrations lib/live_canvas/live.ex lib/live_canvas/live lib/live_canvas/application.ex lib/live_canvas_web/presence.ex test/live_canvas/live_test.exs test/live_canvas/live
git commit -m "feat: add live session domain"
```

### Task 7: Add The `Chat` Context And Live Channel Topics

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_create_chat_tables.exs`
- Create: `lib/live_canvas/chat.ex`
- Create: `lib/live_canvas/chat/chat_message.ex`
- Create: `lib/live_canvas_web/channels/user_socket.ex`
- Create: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify: `lib/live_canvas_web/endpoint.ex`
- Create: `test/live_canvas/chat_test.exs`
- Create: `test/live_canvas_web/channels/live_session_channel_test.exs`

**Step 1: Write the failing chat and channel tests**

Cover authorized channel join, chat message persistence, and broadcast semantics.

```elixir
test "authorized viewer can join a live session topic" do
  assert {:ok, _, socket} =
           subscribe_and_join(socket_for(viewer), LiveSessionChannel, "live_session:#{session.id}")
end

test "sending a message persists and broadcasts it" do
  ref = push(socket, "chat:send", %{"body" => "hello"})
  assert_reply ref, :ok, %{"message" => %{"body" => "hello"}}
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs -v`

Expected: FAIL because no chat context or channel exists yet.

**Step 3: Write the minimal chat slice**

Create `chat_messages` and the live-session topic channel.

```elixir
socket "/socket", LiveCanvasWeb.UserSocket,
  websocket: true,
  longpoll: false
```

Channel shape:

```elixir
def join("live_session:" <> session_id, _params, socket) do
  with {:ok, session} <- Live.fetch_joinable_session(session_id),
       :ok <- Chat.authorize_join(socket.assigns.current_user, session) do
    {:ok, assign(socket, :live_session, session)}
  end
end
```

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs -v`

Expected: PASS, including message persistence and topic authorization.

**Step 5: Commit**

```bash
git add priv/repo/migrations lib/live_canvas/chat.ex lib/live_canvas/chat lib/live_canvas_web/channels lib/live_canvas_web/endpoint.ex test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
git commit -m "feat: add live chat channels"
```

### Task 8: Add The `Feed` Context And GraphQL Read Models

**Files:**
- Create: `lib/live_canvas/feed.ex`
- Create: `test/live_canvas/feed_test.exs`
- Create: `lib/live_canvas_gql/feed/feed_types.ex`
- Create: `lib/live_canvas_gql/feed/feed_queries.ex`
- Create: `lib/live_canvas_gql/feed/feed_resolver.ex`
- Create: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `lib/live_canvas_gql/schema.ex`

**Step 1: Write the failing feed tests**

Cover home feed visibility, live surfaces, and replay visibility.

```elixir
test "home_feed excludes blocked creators" do
  assert [] = Feed.home_feed(blocked_viewer)
end

test "live_now returns visible active sessions first" do
  assert [%{status: :live} | _] = Feed.live_now(viewer)
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs -v`

Expected: FAIL because `Feed` does not exist.

**Step 3: Write the minimal `Feed` slice**

Start with read-side composition in Elixir instead of building projections too early.

```elixir
def home_feed(viewer, opts \\ []) do
  Content.visible_posts_query(viewer)
  |> order_by([p], desc: p.inserted_at)
  |> limit(^Keyword.get(opts, :limit, 25))
  |> Repo.all()
end

def live_now(viewer) do
  Live.visible_live_sessions_query(viewer)
  |> Repo.all()
end
```

Expose GraphQL queries:

```elixir
field :home_feed, non_null(list_of(non_null(:post))) do
  resolve &LiveCanvasGQL.Feed.Resolver.home_feed/2
end

field :live_now, non_null(list_of(non_null(:live_session))) do
  resolve &LiveCanvasGQL.Feed.Resolver.live_now/2
end
```

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs -v`

Expected: PASS, with visibility governed by `Social`.

**Step 5: Commit**

```bash
git add lib/live_canvas/feed.ex lib/live_canvas_gql/feed lib/live_canvas_gql/schema.ex test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs
git commit -m "feat: add feed read layer"
```

### Task 9: Wire End-To-End Auth, Realtime, And API Regression Coverage

**Files:**
- Create: `test/integration/accounts_login_flow_test.exs`
- Create: `test/integration/live_session_flow_test.exs`
- Create: `test/integration/feed_visibility_flow_test.exs`
- Modify: `test/test_helper.exs`
- Modify: `test/support/conn_case.ex`
- Modify: `test/support/data_case.ex`

**Step 1: Write the failing integration tests**

Add three top-level flows that exercise the critical v1 slice.

```elixir
test "email registration, login, follow, post, and feed retrieval" do
  # create account -> authenticate -> follow creator -> create content -> verify feed
end

test "host starts live session, follower joins topic, chat message is delivered" do
  # create users -> start session -> join channel -> send message -> assert broadcast
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/integration -v`

Expected: FAIL because at least one domain edge or test helper contract will still be incomplete.

**Step 3: Fill the minimal gaps**

Patch only the missing seams discovered by the integration tests:

- auth helper setup in `ConnCase`
- channel socket helpers
- fixture helpers across contexts
- small authorization edge cases

Example helper:

```elixir
def authenticated_socket(user) do
  %Phoenix.Socket{}
  |> assign(:current_user, user)
end
```

**Step 4: Run the full focused suite**

Run: `mix test test/live_canvas test/live_canvas_gql test/live_canvas_web/channels test/integration -v`

Expected: PASS for the v1 backend foundations slice.

**Step 5: Commit**

```bash
git add test/integration test/support test/test_helper.exs
git commit -m "test: cover v1 backend foundation flows"
```

### Task 10: Prepare The Membrane Integration Seam Without Full Media Complexity

**Files:**
- Create: `lib/live_canvas/live/media_session.ex`
- Modify: `lib/live_canvas/live/session_server.ex`
- Create: `test/live_canvas/live/media_session_test.exs`
- Modify: `mix.exs`

**Step 1: Write the failing seam tests**

Define the boundary that `Live` will call when media negotiation starts, without implementing a full pipeline yet.

```elixir
test "session server delegates media bootstrap to MediaSession" do
  assert :ok = MediaSession.start_for_session(session)
end
```

**Step 2: Run tests to verify they fail**

Run: `mix test test/live_canvas/live/media_session_test.exs -v`

Expected: FAIL because `MediaSession` does not exist.

**Step 3: Write the minimal adapter boundary**

Keep this thin until the rest of the product proves stable.

```elixir
defmodule LiveCanvas.Live.MediaSession do
  @callback start_for_session(LiveCanvas.Live.LiveSession.t()) :: :ok | {:error, term()}

  def start_for_session(session) do
    # Placeholder seam for later Membrane pipeline startup.
    _ = session
    :ok
  end
end
```

If Membrane dependencies are introduced here, add them in `mix.exs`; otherwise leave the seam in place and defer package changes until actual media implementation begins.

**Step 4: Run tests to verify they pass**

Run: `mix test test/live_canvas/live/media_session_test.exs -v`

Expected: PASS, with the media boundary defined but still intentionally thin.

**Step 5: Commit**

```bash
git add lib/live_canvas/live/media_session.ex lib/live_canvas/live/session_server.ex test/live_canvas/live/media_session_test.exs mix.exs
git commit -m "chore: add membrane integration seam"
```

## Final Verification Checklist

Before calling this plan implemented, run these commands in order:

1. `mix format`
2. `mix test test/live_canvas/accounts_test.exs test/live_canvas/social_test.exs test/live_canvas/content_test.exs test/live_canvas/live_test.exs test/live_canvas/chat_test.exs test/live_canvas/feed_test.exs -v`
3. `mix test test/live_canvas_gql test/live_canvas_web/channels test/integration -v`
4. `mix test`

Expected final result:

- no compilation failures
- all targeted domain tests pass
- GraphQL and channel contracts pass
- integration flows pass

## Open Decisions To Revisit During Execution

- Confirm the target PostgreSQL version before relying on a native `uuidv7()` default in migrations. If the deployment target lacks native support, install the required extension or add a DB function in the migration rather than falling back to app-generated UUIDs.
- Decide whether OTP login uses one-time codes, magic links, or both first; the table design supports both, but the first shipped UX can be narrower.
- Keep story behavior inside `posts` until a concrete divergence requires a separate `stories` table.
- Do not add billing, geo, or profile customization while executing this plan.

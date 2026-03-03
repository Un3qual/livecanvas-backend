defmodule LCWeb.LiveSessionChannelTest do
  use LC.DataCase, async: false
  import Phoenix.ChannelTest

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Live}
  alias LC.Infra.Repo
  alias LC.Live.{SessionOwnership, SessionServer}
  alias LCSchemas.Chat.ChatMessage
  alias LCSchemas.Live.{LiveParticipant, LiveSession}
  alias LCWeb.{LiveSessionChannel, UserSocket}

  @endpoint LCWeb.Endpoint
  @live_channel_telemetry_events [
    [:live_canvas, :live, :channel, :join],
    [:live_canvas, :live, :channel, :chat_send]
  ]

  defmodule FakeRuntimeRPC do
    @moduledoc false

    def call(_owner_node, _module, function, _args, _opts \\ []) do
      mode =
        Application.get_env(:live_canvas, __MODULE__, [])
        |> Keyword.get(:mode, :ok)

      case {mode, function} do
        {:remote_not_found, :remote_lookup_session_server} -> {:ok, :ok}
        {:remote_not_found, :remote_join_session_server} -> {:ok, {:error, :not_found}}
        {:remote_timeout, _} -> {:error, :remote_timeout}
        _ -> {:ok, :ok}
      end
    end
  end

  setup do
    attach_live_channel_telemetry_handler()
    :ok
  end

  test "authorized viewer can join a live session topic" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, _socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )
  end

  test "sending chat:send persists and broadcasts the message" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    ref = push(socket, "chat:send", %{"body" => "hello"})

    assert_reply ref, :ok, %{message: %{body: "hello", id: message_id}}
    assert_broadcast "chat:message", %{message: %{body: "hello", id: ^message_id}}
    assert %ChatMessage{id: ^message_id, body: "hello"} = Repo.get!(ChatMessage, message_id)
  end

  test "viewer who muted host cannot join a live session topic" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    _mute = mute_fixture(viewer, host)
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:error, %{reason: "not_authorized"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :not_authorized,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "remote-owned session returns session_unavailable and emits remote_unreachable telemetry" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    session = live_session_fixture(host.id)
    remote_owner = "remote-owner@127.0.0.1"

    assert {:ok, _lease} = SessionOwnership.claim(session.id, remote_owner, now_utc())

    assert {:error, %{reason: "session_unavailable"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :remote_unreachable,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "remote runtime not found returns session_unavailable and preserves telemetry reason" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    session = live_session_fixture(host.id)
    remote_owner = "remote-owner@127.0.0.1"

    :ok = configure_live_runtime_rpc(:remote_not_found)

    assert {:ok, _lease} = SessionOwnership.claim(session.id, remote_owner, now_utc())

    assert {:error, %{reason: "session_unavailable"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :remote_not_found,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "remote runtime timeout returns session_unavailable and preserves telemetry reason" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    session = live_session_fixture(host.id)
    remote_owner = "remote-owner@127.0.0.1"

    :ok = configure_live_runtime_rpc(:remote_timeout)
    assert {:ok, _lease} = SessionOwnership.claim(session.id, remote_owner, now_utc())

    assert {:error, %{reason: "session_unavailable"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :remote_timeout,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "suspended viewer cannot join a live session topic" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})
    assert {:ok, _suspended_viewer} = Accounts.suspend_user(viewer)

    assert {:error, %{reason: "not_authorized"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )
  end

  test "rate limits repeated join attempts for the same viewer" do
    previous_rate_limit_config = Application.get_env(:live_canvas, LCWeb.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LCWeb.RateLimiter,
      Keyword.put(previous_rate_limit_config, :limits,
        channel_join: [limit: 1, window_ms: 60_000]
      )
    )

    LCWeb.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LCWeb.RateLimiter, previous_rate_limit_config)
      LCWeb.RateLimiter.reset!()
    end)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, _socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    assert {:error, %{reason: "rate_limited"}} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :join], %{count: 1},
                    %{
                      result: :error,
                      reason: :rate_limited,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "invalid chat payload emits telemetry and returns invalid_body" do
    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    ref = push(socket, "chat:send", %{"body" => 42})
    assert_reply ref, :error, %{reason: "invalid_body"}

    assert_receive {:telemetry_event, [:live_canvas, :live, :channel, :chat_send], %{count: 1},
                    %{
                      result: :error,
                      reason: :invalid_body,
                      session_id: session_id,
                      user_id: user_id
                    }}

    assert session_id == session.id
    assert user_id == viewer.id
  end

  test "disconnect marks participant left and prunes runtime membership" do
    Process.flag(:trap_exit, true)

    host = user_fixture(privacy_mode: :public)
    viewer = user_fixture()
    {:ok, session} = Live.start_live_session(host, %{visibility: :public})

    assert {:ok, _join_payload, socket} =
             subscribe_and_join(
               socket_for(viewer),
               LiveSessionChannel,
               "live_session:#{session.id}"
             )

    assert {:ok, pid} = Live.lookup_session_server(session.id)
    assert %{participants: participants_before_leave} = SessionServer.snapshot(pid)
    assert Map.has_key?(participants_before_leave, viewer.id)

    assert :ok = close(socket)
    assert :ok = wait_for_participant_left(session.id, viewer.id)

    assert %LiveParticipant{left_at: %DateTime{}} =
             Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

    assert %{participants: participants_after_leave} = SessionServer.snapshot(pid)
    refute Map.has_key?(participants_after_leave, viewer.id)
  end

  defp socket_for(user) do
    socket(UserSocket, "user_socket:#{user.id}", %{current_user: user})
  end

  defp configure_live_runtime_rpc(mode) when is_atom(mode) do
    previous_live_config = Application.get_env(:live_canvas, Live, [])
    previous_fake_rpc_config = Application.get_env(:live_canvas, FakeRuntimeRPC, [])

    Application.put_env(
      :live_canvas,
      Live,
      Keyword.put(previous_live_config, :runtime_rpc, FakeRuntimeRPC)
    )

    Application.put_env(:live_canvas, FakeRuntimeRPC, mode: mode)

    on_exit(fn ->
      Application.put_env(:live_canvas, Live, previous_live_config)
      Application.put_env(:live_canvas, FakeRuntimeRPC, previous_fake_rpc_config)
    end)

    :ok
  end

  defp live_session_fixture(host_id) when is_integer(host_id) do
    Repo.insert!(%LiveSession{
      host_id: host_id,
      status: :live,
      visibility: :public
    })
  end

  defp wait_for_participant_left(session_id, user_id, attempts \\ 30)

  defp wait_for_participant_left(_session_id, _user_id, 0),
    do: flunk("participant row not marked left")

  defp wait_for_participant_left(session_id, user_id, attempts) do
    case Repo.get_by(LiveParticipant, live_session_id: session_id, user_id: user_id) do
      %LiveParticipant{left_at: %DateTime{}} ->
        :ok

      _other ->
        Process.sleep(10)
        wait_for_participant_left(session_id, user_id, attempts - 1)
    end
  end

  defp attach_live_channel_telemetry_handler do
    test_pid = self()
    handler_id = "live-channel-test-#{System.unique_integer([:positive, :monotonic])}"

    :ok =
      :telemetry.attach_many(
        handler_id,
        @live_channel_telemetry_events,
        &__MODULE__.handle_live_channel_telemetry_event/4,
        test_pid
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)
  end

  @spec handle_live_channel_telemetry_event([atom()], map(), map(), pid()) :: :ok
  def handle_live_channel_telemetry_event(event, measurements, metadata, test_pid)
      when is_list(event) and is_map(measurements) and is_map(metadata) and is_pid(test_pid) do
    send(test_pid, {:telemetry_event, event, measurements, metadata})
    :ok
  end

  defp now_utc, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end

defmodule LC.Integration.Live.RuntimePartitionRejoinTest do
  use ExUnit.Case, async: false

  import LC.AccountsFixtures, only: [user_fixture: 1]

  alias LC.Live
  alias LC.Infra.Repo
  alias LC.RealtimeRuntime
  alias LC.TestSupport.Live.PeerRuntimeHelper
  alias LCSchemas.Live.{LiveParticipant, LiveSession}

  @moduletag :peer_runtime

  test "partition-triggered remote unreachability preserves safe joins and supports local takeover" do
    PeerRuntimeHelper.with_local_repo_auto_mode(fn ->
      PeerRuntimeHelper.with_peer_node(fn peer_node ->
        host =
          user_fixture(%{
            email: unique_email("host"),
            privacy_mode: :public
          })

        partition_viewer = user_fixture(%{email: unique_email("partition-viewer")})
        recovered_viewer = user_fixture(%{email: unique_email("recovered-viewer")})

        session = live_session_fixture(host.id)
        remote_owner = Atom.to_string(peer_node)

        put_remote_owner(session, remote_owner)

        assert {:error, {:owned_by_remote, ^remote_owner}} =
                 Live.lookup_session_server(session.id)

        :ok = PeerRuntimeHelper.disconnect_peer(peer_node)
        :ok = PeerRuntimeHelper.await_peer_disconnected(peer_node)

        assert {:error, :remote_unreachable} =
                 Live.join_live_session(session, partition_viewer, :viewer)

        assert is_nil(
                 Repo.get_by(
                   LiveParticipant,
                   live_session_id: session.id,
                   user_id: partition_viewer.id
                 )
               )

        clear_remote_owner(session)

        assert {:ok, %LiveParticipant{user_id: recovered_viewer_id}} =
                 Live.join_live_session(session, recovered_viewer, :viewer)

        assert recovered_viewer_id == recovered_viewer.id
        assert {:ok, local_runtime_pid} = Live.lookup_session_server(session.id)
        assert node(local_runtime_pid) == Node.self()
      end)
    end)
  end

  defp live_session_fixture(host_id) when is_integer(host_id) do
    Repo.insert!(%LiveSession{
      host_id: host_id,
      status: :live,
      visibility: :public
    })
  end

  defp unique_email(prefix) when is_binary(prefix) do
    "#{prefix}-#{System.system_time(:microsecond)}-#{System.unique_integer([:positive, :monotonic])}@example.com"
  end

  defp put_remote_owner(%LiveSession{id: session_id}, remote_owner)
       when is_integer(session_id) and is_binary(remote_owner) do
    shard_id = RealtimeRuntime.shard_id(session_id)
    :ok = RealtimeRuntime.put_test_shard_owner(shard_id, {:remote, remote_owner})

    on_exit(fn ->
      RealtimeRuntime.clear_test_shard_owner(shard_id)
      RealtimeRuntime.stop_session_runtime(session_id)
    end)

    :ok
  end

  defp clear_remote_owner(%LiveSession{id: session_id}) when is_integer(session_id) do
    session_id
    |> RealtimeRuntime.shard_id()
    |> RealtimeRuntime.clear_test_shard_owner()
  end
end

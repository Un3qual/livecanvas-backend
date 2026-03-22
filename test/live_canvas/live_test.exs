defmodule LC.LiveTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.{Accounts, Content, Live}
  alias LC.Live.SessionServer
  alias LCSchemas.Live.{LiveParticipant, LiveSession}

  @live_session_telemetry_events [
    [:live_canvas, :live, :session, :start],
    [:live_canvas, :live, :session, :join],
    [:live_canvas, :live, :session, :end]
  ]

  setup do
    attach_live_session_telemetry_handler()
    :ok
  end

  describe "start_live_session/2" do
    test "emits telemetry for successful and rejected session starts" do
      host = user_fixture()
      expected_host_id = host.id

      assert {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      expected_session_id = session.id

      assert_receive {:telemetry_event, [:live_canvas, :live, :session, :start], %{count: 1},
                      %{
                        result: :ok,
                        host_id: ^expected_host_id,
                        session_id: ^expected_session_id,
                        visibility: :followers
                      }}

      assert {:ok, _suspended_host} = Accounts.suspend_user(host)
      assert {:error, :not_authorized} = Live.start_live_session(host, %{visibility: :followers})

      assert_receive {:telemetry_event, [:live_canvas, :live, :session, :start], %{count: 1},
                      %{
                        result: :error,
                        host_id: ^expected_host_id,
                        reason: :not_authorized,
                        visibility: :followers
                      }}
    end

    test "returns not_authorized for suspended hosts" do
      host = user_fixture()
      assert {:ok, _suspended_host} = Accounts.suspend_user(host)

      assert {:error, :not_authorized} = Live.start_live_session(host, %{visibility: :followers})
    end

    test "creates a starting session and boots a session server" do
      host = user_fixture()

      assert {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      assert session.host_id == host.id
      assert session.status == :starting
      assert session.visibility == :followers
      assert is_binary(session.entropy_id)

      assert {:ok, pid} = Live.lookup_session_server(session.id)
      assert Process.alive?(pid)
    end
  end

  describe "mark_session_live/1" do
    test "transitions the session to live with a started_at timestamp" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, live_session} = Live.mark_session_live(session)
      assert live_session.status == :live
      assert %DateTime{} = live_session.started_at
    end

    test "does not transition an ended session back to live" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})

      assert {:error, changeset} = Live.mark_session_live(ended_session)
      assert %{status: ["cannot transition ended session to live"]} = errors_on(changeset)
    end

    test "returns one transition winner when concurrent go-live calls race" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      tasks =
        Enum.map(1..2, fn _attempt ->
          Task.async(fn -> Live.mark_session_live_with_transition(session) end)
        end)

      Enum.each(tasks, &allow_live_db(&1.pid))

      results = Enum.map(tasks, &Task.await(&1, 5_000))
      assert Enum.count(results, &match?({:ok, %LiveSession{}, true}, &1)) == 1
      assert Enum.count(results, &match?({:ok, %LiveSession{}, false}, &1)) == 1

      assert %{status: :live, started_at: %DateTime{}} = Live.get_live_session!(session.id)
    end

    test "preserves a won go-live transition when end wins the post-update reload race" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      test_pid = self()

      lock_task =
        Task.async(fn ->
          Repo.transaction(fn ->
            from(live_session in LiveSession,
              where: live_session.id == ^session.id,
              lock: "FOR UPDATE"
            )
            |> Repo.one!()

            send(test_pid, :live_session_locked)

            receive do
              :release_live_session_lock -> :ok
            after
              5_000 -> exit(:release_live_session_lock_timeout)
            end
          end)
        end)

      allow_live_db(lock_task.pid)
      assert_receive :live_session_locked

      go_live_task = Task.async(fn -> Live.mark_session_live_with_transition(session) end)
      allow_live_db(go_live_task.pid)
      Process.sleep(20)

      end_task =
        Task.async(fn ->
          Live.end_live_session_with_transition(session, %{ended_reason: :host_ended})
        end)

      allow_live_db(end_task.pid)
      send(lock_task.pid, :release_live_session_lock)

      assert {:ok, _lock_result} = Task.await(lock_task, 5_000)
      assert {:ok, %LiveSession{started_at: %DateTime{}}, true} = Task.await(go_live_task, 5_000)
      assert {:ok, %LiveSession{status: :ended, ended_reason: :host_ended}, true} =
               Task.await(end_task, 5_000)

      assert %LiveSession{
               status: :ended,
               started_at: %DateTime{},
               ended_reason: :host_ended
             } = Live.get_live_session!(session.id)

      assert :ok = wait_for_session_server_down(session.id)
    end
  end

  describe "live_session_state_snapshot/1" do
    test "returns persisted lifecycle fields with zero viewers for a fresh session" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert Live.live_session_state_snapshot(session) == %{
               status: :starting,
               visibility: :followers,
               viewer_count: 0
             }
    end

    test "updates viewer_count across joins and leaves without exposing participant identities" do
      host = user_fixture()
      first_viewer = user_fixture()
      second_viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, _participant} = Live.join_live_session(session, first_viewer, :viewer)
      assert {:ok, _participant} = Live.join_live_session(session, second_viewer, :viewer)

      assert Live.live_session_state_snapshot(session) == %{
               status: :starting,
               visibility: :public,
               viewer_count: 2
             }

      assert :ok = Live.leave_live_session(session, first_viewer)

      assert Live.live_session_state_snapshot(session) == %{
               status: :starting,
               visibility: :public,
               viewer_count: 1
             }
    end

    test "falls back to durable viewer rows when the runtime is missing" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)
      assert {:ok, pid} = Live.lookup_session_server(session.id)
      monitor_ref = Process.monitor(pid)

      Process.exit(pid, :kill)

      assert_receive {:DOWN, ^monitor_ref, :process, ^pid, _reason}
      assert :ok = wait_for_session_server_down(session.id)

      assert Live.live_session_state_snapshot(session) == %{
               status: :starting,
               visibility: :public,
               viewer_count: 1
             }
    end

    test "returns zero viewers for ended sessions even when participant rows remain active" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)
      assert {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})

      assert %LiveParticipant{left_at: nil} =
               Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

      assert Live.live_session_state_snapshot(ended_session) == %{
               status: :ended,
               visibility: :public,
               viewer_count: 0
             }
    end
  end

  describe "join_live_session/3 and end_live_session/2" do
    test "emits telemetry for join success and authorization failure" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      expected_host_id = host.id
      expected_viewer_id = viewer.id
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      expected_session_id = session.id

      assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)

      assert_receive {:telemetry_event, [:live_canvas, :live, :session, :join], %{count: 1},
                      %{
                        result: :ok,
                        host_id: ^expected_host_id,
                        role: :viewer,
                        session_id: ^expected_session_id,
                        user_id: ^expected_viewer_id
                      }}

      assert {:ok, _suspended_viewer} = Accounts.suspend_user(viewer)
      assert {:error, :not_authorized} = Live.join_live_session(session, viewer, :viewer)

      assert_receive {:telemetry_event, [:live_canvas, :live, :session, :join], %{count: 1},
                      %{
                        result: :error,
                        reason: :not_authorized,
                        role: :viewer,
                        session_id: ^expected_session_id,
                        user_id: ^expected_viewer_id
                      }}
    end

    test "emits telemetry when ending a live session" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})
      expected_session_id = ended_session.id

      assert_receive {:telemetry_event, [:live_canvas, :live, :session, :end], %{count: 1},
                      %{result: :ok, session_id: ^expected_session_id, status: :ended}}
    end

    test "returns one transition winner when concurrent end calls race" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      tasks =
        Enum.map(1..2, fn _attempt ->
          Task.async(fn -> Live.end_live_session_with_transition(session, %{ended_reason: :host_ended}) end)
        end)

      Enum.each(tasks, &allow_live_db(&1.pid))

      results = Enum.map(tasks, &Task.await(&1, 5_000))
      assert Enum.count(results, &match?({:ok, %LiveSession{}, true}, &1)) == 1
      assert Enum.count(results, &match?({:ok, %LiveSession{}, false}, &1)) == 1

      assert %{status: :ended, ended_reason: :host_ended, ended_at: %DateTime{}} =
               Live.get_live_session!(session.id)

      assert :ok = wait_for_session_server_down(session.id)
    end

    test "links a host-owned uploaded recording asset when ending a session" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
                 storage_key: "uploads/users/#{host.id}/recording-uploaded.mp4",
                 mime_type: "video/mp4",
                 processing_state: :uploaded
               })

      assert {:ok, ended_session} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: recording_asset.id
               })

      assert Map.get(ended_session, :recording_media_asset_id) == recording_asset.id
    end

    test "links a host-owned processed recording asset when ending a session" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
                 storage_key: "uploads/users/#{host.id}/recording-processed.mp4",
                 mime_type: "video/mp4",
                 processing_state: :processed
               })

      assert {:ok, ended_session} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: recording_asset.id
               })

      assert Map.get(ended_session, :recording_media_asset_id) == recording_asset.id
    end

    test "links a recording asset whose bigint id exceeds 32-bit integer range" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      recording_media_asset_id = 3_000_000_000

      Repo.query!(
        """
        INSERT INTO media_assets (
          id,
          entropy_id,
          owner_id,
          storage_key,
          mime_type,
          processing_state,
          inserted_at,
          updated_at
        )
        VALUES ($1, uuidv7(), $2, $3, $4, 'uploaded', NOW(), NOW())
        """,
        [
          recording_media_asset_id,
          host.id,
          "uploads/users/#{host.id}/recording-bigint.mp4",
          "video/mp4"
        ]
      )

      assert {:ok, ended_session} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: recording_media_asset_id
               })

      assert Map.get(ended_session, :recording_media_asset_id) == recording_media_asset_id
    end

    test "keeps recording_media_asset_id nil when no recording asset is supplied" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})
      assert Map.get(ended_session, :recording_media_asset_id) == nil
    end

    test "rejects linking another user's recording asset" do
      host = user_fixture()
      other_user = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, recording_asset} =
               Content.create_media_asset(other_user, %{
                 storage_key: "uploads/users/#{other_user.id}/foreign-recording.mp4",
                 mime_type: "video/mp4",
                 processing_state: :uploaded
               })

      assert {:error, changeset} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: recording_asset.id
               })

      assert %{recording_media_asset_id: ["must belong to the session host"]} =
               errors_on(changeset)
    end

    test "keeps the session runtime running when end validation fails" do
      host = user_fixture()
      other_user = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, recording_asset} =
               Content.create_media_asset(other_user, %{
                 storage_key: "uploads/users/#{other_user.id}/foreign-runtime-recording.mp4",
                 mime_type: "video/mp4",
                 processing_state: :uploaded
               })

      assert {:ok, pid} = Live.lookup_session_server(session.id)
      assert Process.alive?(pid)
      monitor_ref = Process.monitor(pid)

      assert {:error, changeset} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: recording_asset.id
               })

      assert %{recording_media_asset_id: ["must belong to the session host"]} =
               errors_on(changeset)

      refute_receive {:DOWN, ^monitor_ref, :process, ^pid, _reason}, 100
      assert {:ok, same_pid} = Live.lookup_session_server(session.id)
      assert same_pid == pid
      assert Process.alive?(same_pid)

      assert %LiveSession{status: :starting, recording_media_asset_id: nil} =
               Live.get_live_session!(session.id)
    end

    test "rejects linking a pending-upload recording asset" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, %{media_asset: recording_asset}} =
               Content.request_media_upload(host, %{mime_type: "video/mp4"})

      assert {:error, changeset} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: recording_asset.id
               })

      assert %{recording_media_asset_id: ["must be uploaded or processed"]} =
               errors_on(changeset)
    end

    test "rejects linking a failed recording asset" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, recording_asset} =
               Content.create_media_asset(host, %{
                 storage_key: "uploads/users/#{host.id}/failed-recording.mp4",
                 mime_type: "video/mp4",
                 processing_state: :failed
               })

      assert {:error, changeset} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: recording_asset.id
               })

      assert %{recording_media_asset_id: ["must be uploaded or processed"]} =
               errors_on(changeset)
    end

    test "keeps the first linked recording when repeated end calls race or repeat" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, first_recording_asset} =
               Content.create_media_asset(host, %{
                 storage_key: "uploads/users/#{host.id}/recording-first.mp4",
                 mime_type: "video/mp4",
                 processing_state: :uploaded
               })

      assert {:ok, second_recording_asset} =
               Content.create_media_asset(host, %{
                 storage_key: "uploads/users/#{host.id}/recording-second.mp4",
                 mime_type: "video/mp4",
                 processing_state: :processed
               })

      assert {:ok, ended_session} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: first_recording_asset.id
               })

      first_recording_id = Map.get(ended_session, :recording_media_asset_id)
      assert first_recording_id == first_recording_asset.id

      assert {:ok, ended_session_again} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: second_recording_asset.id
               })

      assert Map.get(ended_session_again, :recording_media_asset_id) == first_recording_id

      assert Map.get(Live.get_live_session!(session.id), :recording_media_asset_id) ==
               first_recording_id
    end

    test "stops the local session server when the end transition was already won elsewhere" do
      host = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, pid} = Live.lookup_session_server(session.id)
      assert Process.alive?(pid)

      ended_at = DateTime.utc_now() |> DateTime.truncate(:microsecond)

      {1, _rows} =
        from(live_session in LiveSession, where: live_session.id == ^session.id)
        |> Repo.update_all(
          set: [status: :ended, ended_at: ended_at, ended_reason: :host_ended]
        )

      assert {:ok,
              %LiveSession{
                status: :ended,
                ended_at: ^ended_at,
                ended_reason: :host_ended
              }, false} =
               Live.end_live_session_with_transition(session, %{ended_reason: :host_ended})

      assert :ok = wait_for_session_server_down(session.id)
    end

    test "returns not_authorized when the viewer is suspended" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      assert {:ok, _suspended_viewer} = Accounts.suspend_user(viewer)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})

      assert {:error, :not_authorized} = Live.join_live_session(session, viewer, :viewer)
    end

    test "returns not_authorized when the host is suspended" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      assert {:ok, _suspended_host} = Accounts.suspend_user(host)

      assert {:error, :not_authorized} = Live.join_live_session(session, viewer, :viewer)
    end

    test "persists participant joins and shuts down the runtime process when ended" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, participant} = Live.join_live_session(session, viewer, :viewer)
      assert participant.live_session_id == session.id
      assert participant.user_id == viewer.id
      assert participant.role == :viewer
      assert is_binary(participant.entropy_id)

      assert {:ok, pid} = Live.lookup_session_server(session.id)
      monitor_ref = Process.monitor(pid)

      assert {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})
      assert ended_session.status == :ended
      assert ended_session.ended_reason == :host_ended
      assert %DateTime{} = ended_session.ended_at

      assert_receive {:DOWN, ^monitor_ref, :process, ^pid, _reason}
    end

    test "returns an error when joining an ended session" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, ended_session} = Live.end_live_session(session, %{ended_reason: :host_ended})
      assert ended_session.status == :ended

      assert {:error, :ended} = Live.join_live_session(ended_session, viewer, :viewer)
    end

    test "rehydrates participants when recreating a missing session server" do
      host = user_fixture()
      first_viewer = user_fixture()
      second_viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, _participant} = Live.join_live_session(session, first_viewer, :viewer)
      assert {:ok, stale_pid} = Live.lookup_session_server(session.id)

      monitor_ref = Process.monitor(stale_pid)
      Process.exit(stale_pid, :kill)
      assert_receive {:DOWN, ^monitor_ref, :process, ^stale_pid, _reason}
      assert :ok = wait_for_session_server_down(session.id)

      assert {:ok, _participant} = Live.join_live_session(session, second_viewer, :viewer)
      assert {:ok, restarted_pid} = Live.lookup_session_server(session.id)
      refute restarted_pid == stale_pid

      assert %{participants: participants} = SessionServer.snapshot(restarted_pid)
      first_viewer_id = first_viewer.id
      second_viewer_id = second_viewer.id

      assert Map.keys(participants) |> Enum.sort() == [first_viewer_id, second_viewer_id]

      assert %{user_id: ^first_viewer_id, role: :viewer} =
               Map.fetch!(participants, first_viewer_id)

      assert %{user_id: ^second_viewer_id, role: :viewer} =
               Map.fetch!(participants, second_viewer_id)
    end

    test "marks participant left_at and removes runtime membership on leave" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)
      assert {:ok, pid} = Live.lookup_session_server(session.id)
      assert %{participants: participants_before_leave} = SessionServer.snapshot(pid)
      assert Map.has_key?(participants_before_leave, viewer.id)

      assert :ok = Live.leave_live_session(session, viewer)

      assert %LiveParticipant{left_at: %DateTime{} = left_at} =
               Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

      assert DateTime.compare(left_at, DateTime.utc_now()) in [:lt, :eq]
      assert %{participants: participants_after_leave} = SessionServer.snapshot(pid)
      refute Map.has_key?(participants_after_leave, viewer.id)
    end

    test "leaving a session is idempotent for already-left participants" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})

      assert {:ok, _participant} = Live.join_live_session(session, viewer, :viewer)
      assert :ok = Live.leave_live_session(session, viewer)

      assert %LiveParticipant{left_at: %DateTime{} = first_left_at} =
               Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)

      assert :ok = Live.leave_live_session(session, viewer)

      assert %LiveParticipant{left_at: ^first_left_at} =
               Repo.get_by!(LiveParticipant, live_session_id: session.id, user_id: viewer.id)
    end
  end

  defp wait_for_session_server_down(session_id, attempts \\ 20)
  defp wait_for_session_server_down(_session_id, 0), do: flunk("session server did not stop")

  defp wait_for_session_server_down(session_id, attempts) do
    case Live.lookup_session_server(session_id) do
      {:error, :not_found} ->
        :ok

      {:ok, _pid} ->
        Process.sleep(10)
        wait_for_session_server_down(session_id, attempts - 1)
    end
  end

  defp attach_live_session_telemetry_handler do
    test_pid = self()
    handler_id = "live-test-#{System.unique_integer([:positive, :monotonic])}"

    :ok =
      :telemetry.attach_many(
        handler_id,
        @live_session_telemetry_events,
        &__MODULE__.handle_live_session_telemetry_event/4,
        test_pid
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)
  end

  @spec handle_live_session_telemetry_event([atom()], map(), map(), pid()) :: :ok
  def handle_live_session_telemetry_event(event, measurements, metadata, test_pid)
      when is_list(event) and is_map(measurements) and is_map(metadata) and is_pid(test_pid) do
    send(test_pid, {:telemetry_event, event, measurements, metadata})
    :ok
  end

  defp allow_live_db(pid) when is_pid(pid) do
    case Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), pid) do
      :ok -> :ok
      {:already, _owner} -> :ok
      :not_found -> :ok
    end
  end
end

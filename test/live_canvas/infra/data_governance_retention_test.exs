defmodule LC.Infra.DataGovernanceRetentionTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Infra.DataGovernance.Retention
  alias LCSchemas.Chat.LiveSessionTimelineEvent
  alias LCSchemas.Live.{LiveParticipant, LiveSession}
  alias LCSchemas.Accounts.AuthEvent
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}

  describe "run/1" do
    test "computes cutoff_at from cutoff-days using UTC microsecond precision" do
      now = ~U[2026-03-04 18:45:12.123456Z]

      assert {:ok, report} = Retention.run(cutoff_days: 10, now: now)

      assert report.cutoff_days == 10
      assert report.cutoff_at == ~U[2026-02-22 18:45:12.123456Z]
      assert Enum.uniq(Enum.map(report.families, &Map.fetch!(&1, :cutoff_days))) == [10]

      assert Enum.uniq(Enum.map(report.families, &Map.fetch!(&1, :cutoff_at))) == [
               report.cutoff_at
             ]
    end

    test "reports deterministic table ordering and candidate counts" do
      now = ~U[2026-03-04 20:00:00.000000Z]
      old_timestamp = ~U[2026-01-15 20:00:00.000000Z]
      recent_timestamp = ~U[2026-03-03 20:00:00.000000Z]
      user = user_fixture()
      live_host = user_fixture()
      old_participant_user = user_fixture()
      recent_participant_user = user_fixture()

      live_session =
        Repo.insert!(%LiveSession{host_id: live_host.id, status: :live, visibility: :public})

      old_auth_event =
        Repo.insert!(%AuthEvent{
          event_type: :password_login_succeeded,
          user_id: user.id,
          metadata: %{}
        })

      recent_auth_event =
        Repo.insert!(%AuthEvent{
          event_type: :password_login_failed,
          user_id: user.id,
          metadata: %{}
        })

      completed_async_job =
        Repo.insert!(%AsyncJob{
          kind: "retention-test",
          status: :completed,
          payload: %{},
          attempts: 1,
          max_attempts: 3,
          scheduled_at: old_timestamp,
          completed_at: old_timestamp
        })

      pending_async_job =
        Repo.insert!(%AsyncJob{
          kind: "retention-test",
          status: :pending,
          payload: %{},
          attempts: 0,
          max_attempts: 3,
          scheduled_at: old_timestamp
        })

      old_webhook_event =
        Repo.insert!(%WebhookEvent{
          provider: "media",
          external_event_id: Ecto.UUID.generate(),
          event_type: "processed",
          status: :processed,
          payload: %{},
          received_at: old_timestamp,
          processed_at: old_timestamp
        })

      recent_webhook_event =
        Repo.insert!(%WebhookEvent{
          provider: "media",
          external_event_id: Ecto.UUID.generate(),
          event_type: "processed",
          status: :processed,
          payload: %{},
          received_at: recent_timestamp,
          processed_at: recent_timestamp
        })

      _received_webhook_event =
        Repo.insert!(%WebhookEvent{
          provider: "media",
          external_event_id: Ecto.UUID.generate(),
          event_type: "received",
          status: :received,
          payload: %{},
          received_at: old_timestamp,
          processed_at: nil
        })

      set_auth_event_inserted_at!(old_auth_event.id, old_timestamp)
      set_auth_event_inserted_at!(recent_auth_event.id, recent_timestamp)
      set_async_job_timestamps!(completed_async_job.id, old_timestamp, old_timestamp)
      set_async_job_timestamps!(pending_async_job.id, old_timestamp, nil)
      set_webhook_timestamps!(old_webhook_event.id, old_timestamp, old_timestamp)
      set_webhook_timestamps!(recent_webhook_event.id, recent_timestamp, recent_timestamp)

      old_timeline_event =
        Repo.insert!(%LiveSessionTimelineEvent{
          live_session_id: live_session.id,
          actor_user_id: old_participant_user.id,
          event_type: :chat_message_sent,
          occurred_at: old_timestamp,
          payload: %{}
        })

      recent_timeline_event =
        Repo.insert!(%LiveSessionTimelineEvent{
          live_session_id: live_session.id,
          actor_user_id: recent_participant_user.id,
          event_type: :chat_message_sent,
          occurred_at: recent_timestamp,
          payload: %{}
        })

      old_live_participant =
        Repo.insert!(%LiveParticipant{
          live_session_id: live_session.id,
          user_id: old_participant_user.id,
          role: :viewer,
          joined_at: DateTime.add(old_timestamp, -60, :second),
          left_at: old_timestamp
        })

      recent_live_participant =
        Repo.insert!(%LiveParticipant{
          live_session_id:
            Repo.insert!(%LiveSession{
              host_id: recent_participant_user.id,
              status: :live,
              visibility: :public
            }).id,
          user_id: live_host.id,
          role: :viewer,
          joined_at: DateTime.add(recent_timestamp, -60, :second),
          left_at: recent_timestamp
        })

      set_timeline_event_timestamps!(old_timeline_event.id, old_timestamp)
      set_timeline_event_timestamps!(recent_timeline_event.id, recent_timestamp)
      set_live_participant_timestamps!(old_live_participant.id, old_timestamp, old_timestamp)

      set_live_participant_timestamps!(
        recent_live_participant.id,
        recent_timestamp,
        recent_timestamp
      )

      assert {:ok, report} = Retention.run(cutoff_days: 30, now: now)
      assert report.mode == :dry_run
      assert report.deletion_stubbed?
      assert report.cutoff_at == ~U[2026-02-02 20:00:00.000000Z]

      assert Enum.map(report.families, & &1.family) == [
               :auth_events,
               :async_jobs,
               :webhook_events,
               :live_session_timeline_events,
               :live_participants
             ]

      assert Enum.map(report.families, & &1.eligible_count) == [1, 1, 1, 1, 1]
      assert Enum.all?(report.families, &(&1.action == :count_only))
      assert Enum.uniq(Enum.map(report.families, &Map.fetch!(&1, :cutoff_days))) == [30]

      assert Enum.uniq(Enum.map(report.families, &Map.fetch!(&1, :cutoff_at))) == [
               report.cutoff_at
             ]
    end

    test "uses policy cutoff windows per family when cutoff-days override is omitted" do
      now = ~U[2026-03-05 00:00:00.000000Z]
      user = user_fixture()

      # auth_events policy: 365 days
      old_auth_event =
        Repo.insert!(%AuthEvent{
          event_type: :password_login_succeeded,
          user_id: user.id,
          metadata: %{}
        })

      recent_auth_event =
        Repo.insert!(%AuthEvent{
          event_type: :password_login_failed,
          user_id: user.id,
          metadata: %{}
        })

      set_auth_event_inserted_at!(old_auth_event.id, DateTime.add(now, -(366 * 86_400), :second))

      set_auth_event_inserted_at!(
        recent_auth_event.id,
        DateTime.add(now, -(300 * 86_400), :second)
      )

      # async_jobs policy: 30 days
      old_async_job =
        Repo.insert!(%AsyncJob{
          kind: "retention-default-policy",
          status: :completed,
          payload: %{},
          attempts: 1,
          max_attempts: 3,
          scheduled_at: DateTime.add(now, -(40 * 86_400), :second),
          completed_at: DateTime.add(now, -(40 * 86_400), :second)
        })

      recent_async_job =
        Repo.insert!(%AsyncJob{
          kind: "retention-default-policy",
          status: :completed,
          payload: %{},
          attempts: 1,
          max_attempts: 3,
          scheduled_at: DateTime.add(now, -(10 * 86_400), :second),
          completed_at: DateTime.add(now, -(10 * 86_400), :second)
        })

      set_async_job_timestamps!(
        old_async_job.id,
        DateTime.add(now, -(40 * 86_400), :second),
        DateTime.add(now, -(40 * 86_400), :second)
      )

      set_async_job_timestamps!(
        recent_async_job.id,
        DateTime.add(now, -(10 * 86_400), :second),
        DateTime.add(now, -(10 * 86_400), :second)
      )

      # webhook_events policy: 90 days
      old_webhook_event =
        Repo.insert!(%WebhookEvent{
          provider: "media",
          external_event_id: Ecto.UUID.generate(),
          event_type: "processed",
          status: :processed,
          payload: %{},
          received_at: DateTime.add(now, -(100 * 86_400), :second),
          processed_at: DateTime.add(now, -(100 * 86_400), :second)
        })

      recent_webhook_event =
        Repo.insert!(%WebhookEvent{
          provider: "media",
          external_event_id: Ecto.UUID.generate(),
          event_type: "processed",
          status: :processed,
          payload: %{},
          received_at: DateTime.add(now, -(50 * 86_400), :second),
          processed_at: DateTime.add(now, -(50 * 86_400), :second)
        })

      set_webhook_timestamps!(
        old_webhook_event.id,
        DateTime.add(now, -(100 * 86_400), :second),
        DateTime.add(now, -(100 * 86_400), :second)
      )

      set_webhook_timestamps!(
        recent_webhook_event.id,
        DateTime.add(now, -(50 * 86_400), :second),
        DateTime.add(now, -(50 * 86_400), :second)
      )

      host = user_fixture()
      sender = user_fixture()
      participant = user_fixture()

      live_session =
        Repo.insert!(%LiveSession{host_id: host.id, status: :live, visibility: :public})

      # live_session_timeline_events policy: 180 days
      old_timeline_event =
        Repo.insert!(%LiveSessionTimelineEvent{
          live_session_id: live_session.id,
          actor_user_id: sender.id,
          event_type: :chat_message_sent,
          occurred_at: DateTime.add(now, -(200 * 86_400), :second),
          payload: %{}
        })

      recent_timeline_event =
        Repo.insert!(%LiveSessionTimelineEvent{
          live_session_id: live_session.id,
          actor_user_id: sender.id,
          event_type: :chat_message_sent,
          occurred_at: DateTime.add(now, -(90 * 86_400), :second),
          payload: %{}
        })

      set_timeline_event_timestamps!(
        old_timeline_event.id,
        DateTime.add(now, -(200 * 86_400), :second)
      )

      set_timeline_event_timestamps!(
        recent_timeline_event.id,
        DateTime.add(now, -(90 * 86_400), :second)
      )

      # live_participants policy: 180 days
      old_live_participant =
        Repo.insert!(%LiveParticipant{
          live_session_id: live_session.id,
          user_id: participant.id,
          role: :viewer,
          joined_at: DateTime.add(now, -(200 * 86_400 + 60), :second),
          left_at: DateTime.add(now, -(200 * 86_400), :second)
        })

      recent_live_participant =
        Repo.insert!(%LiveParticipant{
          live_session_id:
            Repo.insert!(%LiveSession{host_id: sender.id, status: :live, visibility: :public}).id,
          user_id: host.id,
          role: :viewer,
          joined_at: DateTime.add(now, -(90 * 86_400 + 60), :second),
          left_at: DateTime.add(now, -(90 * 86_400), :second)
        })

      set_live_participant_timestamps!(
        old_live_participant.id,
        DateTime.add(now, -(200 * 86_400), :second),
        DateTime.add(now, -(200 * 86_400), :second)
      )

      set_live_participant_timestamps!(
        recent_live_participant.id,
        DateTime.add(now, -(90 * 86_400), :second),
        DateTime.add(now, -(90 * 86_400), :second)
      )

      assert {:ok, report} = Retention.run(now: now)

      assert report.cutoff_days == nil
      assert report.cutoff_at == nil

      assert Enum.map(report.families, & &1.family) == [
               :auth_events,
               :async_jobs,
               :webhook_events,
               :live_session_timeline_events,
               :live_participants
             ]

      assert Enum.map(report.families, &Map.fetch!(&1, :cutoff_days)) == [365, 30, 90, 180, 180]
      assert Enum.map(report.families, & &1.eligible_count) == [1, 1, 1, 1, 1]
    end

    test "apply mode remains non-destructive and marks each table as stubbed" do
      now = ~U[2026-03-04 22:10:00.123456Z]
      old_timestamp = ~U[2026-01-01 22:10:00.123456Z]
      user = user_fixture()

      auth_event =
        Repo.insert!(%AuthEvent{
          event_type: :password_login_succeeded,
          user_id: user.id,
          metadata: %{}
        })

      set_auth_event_inserted_at!(auth_event.id, old_timestamp)

      before_count = Repo.aggregate(AuthEvent, :count, :id)

      assert {:ok, report} =
               with_retention_config(
                 [apply_mode_enabled: true, incident_hold_active: false],
                 fn ->
                   Retention.run(apply: true, cutoff_days: 30, now: now)
                 end
               )

      assert report.mode == :apply
      assert report.deletion_stubbed?
      assert Enum.all?(report.families, &(&1.action == :stubbed_delete))
      assert Repo.aggregate(AuthEvent, :count, :id) == before_count
    end

    test "returns an error when apply mode is disabled by config" do
      assert {:error, :apply_mode_disabled} =
               with_retention_config(
                 [apply_mode_enabled: false, incident_hold_active: false],
                 fn ->
                   Retention.run(apply: true, cutoff_days: 30)
                 end
               )
    end

    test "returns an error when incident hold is active for apply mode" do
      assert {:error, :incident_hold_active} =
               with_retention_config(
                 [apply_mode_enabled: true, incident_hold_active: true],
                 fn ->
                   Retention.run(apply: true, cutoff_days: 30)
                 end
               )
    end

    test "returns an error when cutoff-days is invalid" do
      assert {:error, :invalid_cutoff_days} = Retention.run(cutoff_days: 0)
      assert {:error, :invalid_cutoff_days} = Retention.run(cutoff_days: -7)
    end

    test "returns an error when apply and dry-run are both set" do
      assert {:error, :invalid_mode_combination} = Retention.run(apply: true, dry_run: true)
    end
  end

  @spec set_auth_event_inserted_at!(pos_integer(), DateTime.t()) :: :ok
  defp set_auth_event_inserted_at!(auth_event_id, inserted_at)
       when is_integer(auth_event_id) and auth_event_id > 0 and is_struct(inserted_at, DateTime) do
    {_count, _rows} =
      Repo.update_all(
        from(auth_event in AuthEvent, where: auth_event.id == ^auth_event_id),
        set: [inserted_at: inserted_at]
      )

    :ok
  end

  @spec set_async_job_timestamps!(pos_integer(), DateTime.t(), DateTime.t() | nil) :: :ok
  defp set_async_job_timestamps!(async_job_id, inserted_at, completed_at)
       when is_integer(async_job_id) and async_job_id > 0 and is_struct(inserted_at, DateTime) do
    {_count, _rows} =
      Repo.update_all(
        from(async_job in AsyncJob, where: async_job.id == ^async_job_id),
        set: [inserted_at: inserted_at, updated_at: inserted_at, completed_at: completed_at]
      )

    :ok
  end

  @spec set_webhook_timestamps!(pos_integer(), DateTime.t(), DateTime.t() | nil) :: :ok
  defp set_webhook_timestamps!(webhook_event_id, inserted_at, processed_at)
       when is_integer(webhook_event_id) and webhook_event_id > 0 and
              is_struct(inserted_at, DateTime) do
    {_count, _rows} =
      Repo.update_all(
        from(webhook_event in WebhookEvent, where: webhook_event.id == ^webhook_event_id),
        set: [inserted_at: inserted_at, updated_at: inserted_at, processed_at: processed_at]
      )

    :ok
  end

  @spec set_timeline_event_timestamps!(pos_integer(), DateTime.t()) :: :ok
  defp set_timeline_event_timestamps!(timeline_event_id, occurred_at)
       when is_integer(timeline_event_id) and timeline_event_id > 0 and
              is_struct(occurred_at, DateTime) do
    {_count, _rows} =
      Repo.update_all(
        from(timeline_event in LiveSessionTimelineEvent,
          where: timeline_event.id == ^timeline_event_id
        ),
        set: [occurred_at: occurred_at, inserted_at: occurred_at, updated_at: occurred_at]
      )

    :ok
  end

  @spec set_live_participant_timestamps!(pos_integer(), DateTime.t(), DateTime.t() | nil) :: :ok
  defp set_live_participant_timestamps!(live_participant_id, inserted_at, left_at)
       when is_integer(live_participant_id) and live_participant_id > 0 and
              is_struct(inserted_at, DateTime) do
    {_count, _rows} =
      Repo.update_all(
        from(live_participant in LiveParticipant,
          where: live_participant.id == ^live_participant_id
        ),
        set: [
          inserted_at: inserted_at,
          updated_at: inserted_at,
          joined_at: inserted_at,
          left_at: left_at
        ]
      )

    :ok
  end

  @spec with_retention_config(keyword(), (-> term())) :: term()
  defp with_retention_config(overrides, fun) when is_list(overrides) and is_function(fun, 0) do
    previous_config = Application.get_env(:live_canvas, Retention, [])
    merged_config = Keyword.merge(previous_config, overrides)
    Application.put_env(:live_canvas, Retention, merged_config)

    try do
      fun.()
    after
      Application.put_env(:live_canvas, Retention, previous_config)
    end
  end
end

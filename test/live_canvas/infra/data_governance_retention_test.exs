defmodule LC.Infra.DataGovernanceRetentionTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Infra.DataGovernance.Retention
  alias LCSchemas.Accounts.AuthEvent
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}

  describe "run/1" do
    test "computes cutoff_at from cutoff-days using UTC microsecond precision" do
      now = ~U[2026-03-04 18:45:12.123456Z]

      assert {:ok, report} = Retention.run(cutoff_days: 10, now: now)

      assert report.cutoff_days == 10
      assert report.cutoff_at == ~U[2026-02-22 18:45:12.123456Z]
    end

    test "reports deterministic table ordering and candidate counts" do
      now = ~U[2026-03-04 20:00:00.000000Z]
      old_timestamp = ~U[2026-01-15 20:00:00.000000Z]
      recent_timestamp = ~U[2026-03-03 20:00:00.000000Z]
      user = user_fixture()

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

      assert {:ok, report} = Retention.run(cutoff_days: 30, now: now)
      assert report.mode == :dry_run
      assert report.deletion_stubbed?
      assert report.cutoff_at == ~U[2026-02-02 20:00:00.000000Z]

      assert Enum.map(report.families, & &1.family) == [
               :auth_events,
               :async_jobs,
               :webhook_events
             ]

      assert Enum.map(report.families, & &1.eligible_count) == [1, 1, 1]
      assert Enum.all?(report.families, &(&1.action == :count_only))
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

      assert {:ok, report} = Retention.run(apply: true, cutoff_days: 30, now: now)

      assert report.mode == :apply
      assert report.deletion_stubbed?
      assert Enum.all?(report.families, &(&1.action == :stubbed_delete))
      assert Repo.aggregate(AuthEvent, :count, :id) == before_count
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
end

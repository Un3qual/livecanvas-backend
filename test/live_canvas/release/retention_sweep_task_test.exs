defmodule Mix.Tasks.Release.RetentionSweepTest do
  use LC.DataCase, async: false

  import ExUnit.CaptureIO
  import LC.AccountsFixtures

  alias LC.Infra.DataGovernance.Retention
  alias LCSchemas.Accounts.AuthEvent

  describe "mix release.retention_sweep" do
    test "defaults to policy cutoffs in dry-run output and prints per-table candidate counts" do
      old_timestamp = ~U[2024-01-01 12:00:00.000000Z]
      user = user_fixture()

      auth_event =
        Repo.insert!(%AuthEvent{
          event_type: :password_login_succeeded,
          user_id: user.id,
          metadata: %{}
        })

      set_auth_event_inserted_at!(auth_event.id, old_timestamp)

      output =
        capture_io(fn ->
          Mix.Task.reenable("release.retention_sweep")
          Mix.Task.run("release.retention_sweep", [])
        end)

      assert output =~ "Retention sweep mode: dry_run"
      assert output =~ "Cutoff strategy: policy_defaults"
      assert output =~ ~r/- auth_events: \d+ eligible rows/
      assert output =~ "cutoff_days=365"
      assert output =~ ~r/- async_jobs: \d+ eligible rows/
      assert output =~ "cutoff_days=30"
      assert output =~ ~r/- webhook_events: \d+ eligible rows/
      assert output =~ "cutoff_days=90"
      assert output =~ ~r/- live_session_timeline_events: \d+ eligible rows/
      assert output =~ "cutoff_days=180"
      assert output =~ ~r/- live_participants: \d+ eligible rows/
    end

    test "prints cutoff override details when --cutoff-days is provided" do
      output =
        capture_io(fn ->
          Mix.Task.reenable("release.retention_sweep")
          Mix.Task.run("release.retention_sweep", ["--cutoff-days", "45"])
        end)

      assert output =~ "Cutoff days override: 45"
      assert output =~ ~r/- auth_events: \d+ eligible rows \(count_only, cutoff_days=45/
      assert output =~ ~r/- async_jobs: \d+ eligible rows \(count_only, cutoff_days=45/
      assert output =~ ~r/- webhook_events: \d+ eligible rows \(count_only, cutoff_days=45/

      assert output =~
               ~r/- live_session_timeline_events: \d+ eligible rows \(count_only, cutoff_days=45/

      assert output =~ ~r/- live_participants: \d+ eligible rows \(count_only, cutoff_days=45/
    end

    test "apply mode is explicit and remains non-destructive while deletion is stubbed" do
      old_timestamp = ~U[2026-01-01 13:00:00.000000Z]
      user = user_fixture()

      auth_event =
        Repo.insert!(%AuthEvent{
          event_type: :password_login_failed,
          user_id: user.id,
          metadata: %{}
        })

      set_auth_event_inserted_at!(auth_event.id, old_timestamp)
      before_count = Repo.aggregate(AuthEvent, :count, :id)

      output =
        with_retention_config([apply_mode_enabled: true, incident_hold_active: false], fn ->
          capture_io(fn ->
            Mix.Task.reenable("release.retention_sweep")
            Mix.Task.run("release.retention_sweep", ["--apply", "--cutoff-days", "30"])
          end)
        end)

      assert output =~ "Retention sweep mode: apply"
      assert output =~ "NOTE: hard deletion is currently stubbed; no rows were deleted."
      assert Repo.aggregate(AuthEvent, :count, :id) == before_count
    end

    test "fails fast when apply mode is disabled by config" do
      assert_raise Mix.Error, ~r/--apply is disabled by configuration/, fn ->
        with_retention_config([apply_mode_enabled: false, incident_hold_active: false], fn ->
          Mix.Task.reenable("release.retention_sweep")
          Mix.Task.run("release.retention_sweep", ["--apply"])
        end)
      end
    end

    test "fails fast when incident hold is active" do
      assert_raise Mix.Error, ~r/incident hold is active/, fn ->
        with_retention_config([apply_mode_enabled: true, incident_hold_active: true], fn ->
          Mix.Task.reenable("release.retention_sweep")
          Mix.Task.run("release.retention_sweep", ["--apply"])
        end)
      end
    end

    test "fails fast when --dry-run and --apply are combined" do
      assert_raise Mix.Error, ~r/choose either --dry-run or --apply/, fn ->
        Mix.Task.reenable("release.retention_sweep")
        Mix.Task.run("release.retention_sweep", ["--dry-run", "--apply"])
      end
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

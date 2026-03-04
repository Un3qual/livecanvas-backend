defmodule Mix.Tasks.Release.RetentionSweepTest do
  use LC.DataCase, async: false

  import ExUnit.CaptureIO
  import LC.AccountsFixtures

  alias LCSchemas.Accounts.AuthEvent

  describe "mix release.retention_sweep" do
    test "defaults to dry-run output and prints per-table candidate counts" do
      old_timestamp = ~U[2026-01-01 12:00:00.000000Z]
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
          Mix.Task.run("release.retention_sweep", ["--cutoff-days", "30"])
        end)

      assert output =~ "Retention sweep mode: dry_run"
      assert output =~ "Cutoff timestamp (UTC):"
      assert output =~ "- auth_events: 1 eligible rows"
      assert output =~ "- async_jobs: 0 eligible rows"
      assert output =~ "- webhook_events: 0 eligible rows"
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
        capture_io(fn ->
          Mix.Task.reenable("release.retention_sweep")
          Mix.Task.run("release.retention_sweep", ["--apply", "--cutoff-days", "30"])
        end)

      assert output =~ "Retention sweep mode: apply"
      assert output =~ "NOTE: hard deletion is currently stubbed; no rows were deleted."
      assert Repo.aggregate(AuthEvent, :count, :id) == before_count
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
end

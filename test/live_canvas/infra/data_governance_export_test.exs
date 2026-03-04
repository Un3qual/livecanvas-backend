defmodule LC.Infra.DataGovernanceExportTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Infra.DataGovernance
  alias LCSchemas.Infra.{AsyncJob, DataExportRequest}

  describe "request_data_export/2" do
    test "persists one pending request and enqueues one async job per active request" do
      user = user_fixture()

      assert {:ok, first_request} = DataGovernance.request_data_export(user)
      assert first_request.user_id == user.id
      assert first_request.status == :pending
      assert first_request.format == :json
      assert match?(%DateTime{}, first_request.requested_at)

      assert {:ok, deduped_request} = DataGovernance.request_data_export(user)
      assert deduped_request.id == first_request.id

      assert Repo.aggregate(DataExportRequest, :count, :id) == 1
      assert Repo.aggregate(AsyncJob, :count, :id) == 1

      [job] = Repo.all(AsyncJob)
      assert job.kind == "data_export_request"
      assert job.status == :pending
      assert job.payload["data_export_request_id"] == first_request.id
    end

    test "lists viewer-owned export requests newest-first" do
      viewer = user_fixture()
      outsider = user_fixture()

      assert {:ok, first_request} = DataGovernance.request_data_export(viewer)
      mark_request_completed!(first_request)
      assert {:ok, second_request} = DataGovernance.request_data_export(viewer)
      assert {:ok, _outsider_request} = DataGovernance.request_data_export(outsider)

      requests = DataGovernance.list_data_export_requests(viewer)

      assert Enum.map(requests, & &1.id) == [second_request.id, first_request.id]
      assert Enum.all?(requests, &(&1.user_id == viewer.id))
    end
  end

  describe "export async handler" do
    test "marks requests completed and stores artifact metadata" do
      user = user_fixture()

      assert {:ok, request} = DataGovernance.request_data_export(user)

      job =
        Repo.one!(
          from(async_job in AsyncJob,
            where: async_job.kind == "data_export_request",
            order_by: [desc: async_job.inserted_at, desc: async_job.id]
          )
        )

      assert :ok = DataGovernance.Export.handle(job)

      reloaded = Repo.get!(DataExportRequest, request.id)
      assert reloaded.status == :completed
      assert match?(%DateTime{}, reloaded.completed_at)
      assert is_map(reloaded.artifact_metadata)
      assert reloaded.artifact_metadata["content_type"] == "application/json"

      assert reloaded.artifact_metadata["object_key"] =~
               "exports/users/#{user.id}/requests/#{request.entropy_id}"
    end
  end

  @spec mark_request_completed!(DataExportRequest.t()) :: :ok
  defp mark_request_completed!(%DataExportRequest{id: id}) when is_integer(id) and id > 0 do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    {_updated_count, _rows} =
      Repo.update_all(
        from(request in DataExportRequest, where: request.id == ^id),
        set: [
          status: :completed,
          completed_at: now,
          artifact_metadata: %{
            "object_key" => "exports/completed/#{id}.json",
            "content_type" => "application/json"
          }
        ]
      )

    :ok
  end
end

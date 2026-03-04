defmodule LCSchemas.Infra.DataGovernanceRequestSchemaTest do
  use LC.DataCase, async: true

  alias LCSchemas.Accounts.User

  describe "schema modules and field conventions" do
    test "loads governance schema and status modules" do
      assert Code.ensure_loaded?(data_export_request_module())
      assert Code.ensure_loaded?(account_deletion_request_module())
      assert Code.ensure_loaded?(data_export_status_module())
      assert Code.ensure_loaded?(account_deletion_status_module())
    end
  end

  describe "data_export_requests table behavior" do
    test "persists defaults and entropy id", %{user: user} do
      schema = data_export_request_module()

      assert Code.ensure_loaded?(schema)

      request =
        Repo.insert!(
          struct(schema, %{
            user_id: user.id,
            format: :json
          })
        )

      reloaded = Repo.get!(schema, request.id)

      assert :id == schema.__schema__(:type, :id)
      assert :entropy_id in schema.__schema__(:fields)
      assert reloaded.user_id == user.id
      assert reloaded.status == :pending
      assert reloaded.format == :json
      assert match?(%DateTime{}, reloaded.requested_at)
      assert is_binary(reloaded.entropy_id)
    end

    test "enforces entropy_id uniqueness", %{user: user} do
      schema = data_export_request_module()
      duplicate_entropy_id = Ecto.UUID.generate()

      Repo.insert!(
        struct(schema, %{
          user_id: user.id,
          entropy_id: duplicate_entropy_id,
          format: :json
        })
      )

      assert_raise Ecto.ConstraintError, fn ->
        Repo.insert!(
          struct(schema, %{
            user_id: user.id,
            entropy_id: duplicate_entropy_id,
            format: :json
          })
        )
      end
    end
  end

  describe "account_deletion_requests table behavior" do
    test "persists defaults and entropy id", %{user: user} do
      schema = account_deletion_request_module()

      scheduled_purge_at =
        DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.truncate(:microsecond)

      assert Code.ensure_loaded?(schema)

      request =
        Repo.insert!(
          struct(schema, %{
            user_id: user.id,
            scheduled_purge_at: scheduled_purge_at
          })
        )

      reloaded = Repo.get!(schema, request.id)

      assert :id == schema.__schema__(:type, :id)
      assert :entropy_id in schema.__schema__(:fields)
      assert reloaded.user_id == user.id
      assert reloaded.status == :pending
      assert match?(%DateTime{}, reloaded.requested_at)
      assert DateTime.compare(reloaded.scheduled_purge_at, scheduled_purge_at) == :eq
      assert is_binary(reloaded.entropy_id)
    end

    test "enforces entropy_id uniqueness", %{user: user} do
      schema = account_deletion_request_module()
      duplicate_entropy_id = Ecto.UUID.generate()

      Repo.insert!(
        struct(schema, %{
          user_id: user.id,
          entropy_id: duplicate_entropy_id,
          scheduled_purge_at:
            DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.truncate(:microsecond)
        })
      )

      assert_raise Ecto.ConstraintError, fn ->
        Repo.insert!(
          struct(schema, %{
            user_id: user.id,
            entropy_id: duplicate_entropy_id,
            scheduled_purge_at:
              DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.truncate(:microsecond)
          })
        )
      end
    end
  end

  setup do
    user = Repo.insert!(%User{})
    %{user: user}
  end

  defp data_export_request_module, do: Module.concat([LCSchemas.Infra, DataExportRequest])

  defp account_deletion_request_module,
    do: Module.concat([LCSchemas.Infra, AccountDeletionRequest])

  defp data_export_status_module, do: Module.concat([LCSchemas.Infra, DataExportRequestStatus])

  defp account_deletion_status_module,
    do: Module.concat([LCSchemas.Infra, AccountDeletionRequestStatus])
end

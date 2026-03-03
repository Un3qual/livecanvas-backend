defmodule LC.Live.SessionOwnership do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LC.Infra.Repo
  alias LCSchemas.Live.LiveSessionRuntimeOwner

  @default_lease_ttl_seconds 30

  @type claim_result ::
          {:ok, LiveSessionRuntimeOwner.t()} | {:error, {:owned_by_remote, String.t()}}
  @type refresh_result ::
          {:ok, LiveSessionRuntimeOwner.t()}
          | {:error, :not_found}
          | {:error, {:owned_by_remote, String.t()}}
  @type owner_lookup_result :: {:ok, String.t()} | {:error, :not_found}

  @spec claim(pos_integer(), String.t(), DateTime.t()) :: claim_result()
  def claim(session_id, owner_node, %DateTime{} = now)
      when is_integer(session_id) and session_id > 0 and is_binary(owner_node) do
    Repo.transact(fn ->
      # A per-session row lock guarantees claim/takeover decisions are serialized
      # so two nodes cannot both win ownership for the same lease window.
      case lock_lease(session_id) do
        nil ->
          insert_lease(session_id, owner_node, now)

        %LiveSessionRuntimeOwner{owner_node: ^owner_node} = lease ->
          update_lease(lease, owner_node, now)

        %LiveSessionRuntimeOwner{} = lease ->
          if lease_active?(lease, now) do
            {:error, {:owned_by_remote, lease.owner_node}}
          else
            update_lease(lease, owner_node, now)
          end
      end
    end)
  end

  @spec refresh(pos_integer(), String.t(), DateTime.t()) :: refresh_result()
  def refresh(session_id, owner_node, %DateTime{} = now)
      when is_integer(session_id) and session_id > 0 and is_binary(owner_node) do
    Repo.transact(fn ->
      case lock_lease(session_id) do
        nil ->
          {:error, :not_found}

        %LiveSessionRuntimeOwner{owner_node: ^owner_node} = lease ->
          update_lease(lease, owner_node, now)

        %LiveSessionRuntimeOwner{} = lease ->
          if lease_active?(lease, now) do
            {:error, {:owned_by_remote, lease.owner_node}}
          else
            {:error, :not_found}
          end
      end
    end)
  end

  @spec release(pos_integer(), String.t()) :: :ok
  def release(session_id, owner_node)
      when is_integer(session_id) and session_id > 0 and is_binary(owner_node) do
    # Release is best-effort and idempotent because the runtime owner process
    # can terminate concurrently with takeover attempts.
    from(lease in LiveSessionRuntimeOwner,
      where: lease.live_session_id == ^session_id and lease.owner_node == ^owner_node
    )
    |> Repo.delete_all()

    :ok
  end

  @spec get_owner(pos_integer(), DateTime.t()) :: owner_lookup_result()
  def get_owner(session_id, %DateTime{} = now) when is_integer(session_id) and session_id > 0 do
    case Repo.get_by(LiveSessionRuntimeOwner, live_session_id: session_id) do
      %LiveSessionRuntimeOwner{} = lease ->
        if lease_active?(lease, now), do: {:ok, lease.owner_node}, else: {:error, :not_found}

      _ ->
        {:error, :not_found}
    end
  end

  @spec lease_ttl_seconds() :: pos_integer()
  defp lease_ttl_seconds do
    Application.get_env(:live_canvas, __MODULE__, [])
    |> Keyword.get(:lease_ttl_seconds, @default_lease_ttl_seconds)
  end

  @spec lock_lease(pos_integer()) :: LiveSessionRuntimeOwner.t() | nil
  defp lock_lease(session_id) when is_integer(session_id) do
    from(lease in LiveSessionRuntimeOwner,
      where: lease.live_session_id == ^session_id,
      lock: "FOR UPDATE"
    )
    |> Repo.one()
  end

  @spec insert_lease(pos_integer(), String.t(), DateTime.t()) ::
          {:ok, LiveSessionRuntimeOwner.t()} | {:error, Ecto.Changeset.t()}
  defp insert_lease(session_id, owner_node, %DateTime{} = now)
       when is_integer(session_id) and is_binary(owner_node) do
    expires_at = DateTime.add(now, lease_ttl_seconds(), :second)

    %LiveSessionRuntimeOwner{
      live_session_id: session_id,
      owner_node: owner_node,
      heartbeat_at: now,
      lease_expires_at: expires_at
    }
    |> Repo.insert()
  end

  @spec update_lease(LiveSessionRuntimeOwner.t(), String.t(), DateTime.t()) ::
          {:ok, LiveSessionRuntimeOwner.t()} | {:error, Ecto.Changeset.t()}
  defp update_lease(%LiveSessionRuntimeOwner{} = lease, owner_node, %DateTime{} = now)
       when is_binary(owner_node) do
    expires_at = DateTime.add(now, lease_ttl_seconds(), :second)

    lease
    |> Ecto.Changeset.change(
      owner_node: owner_node,
      heartbeat_at: now,
      lease_expires_at: expires_at
    )
    |> Repo.update()
  end

  @spec lease_active?(LiveSessionRuntimeOwner.t(), DateTime.t()) :: boolean()
  defp lease_active?(
         %LiveSessionRuntimeOwner{lease_expires_at: lease_expires_at},
         %DateTime{} = now
       )
       when is_struct(lease_expires_at, DateTime) do
    DateTime.compare(lease_expires_at, now) == :gt
  end
end

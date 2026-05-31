defmodule LC.RealtimeRuntime.Supervisor do
  @moduledoc false

  use Supervisor

  @registry LC.RealtimeRuntime.SessionRegistry
  @dynamic_supervisor LC.RealtimeRuntime.SessionDynamicSupervisor

  @spec start_link(keyword()) :: Supervisor.on_start()
  def start_link(opts \\ []) do
    {name, init_opts} = Keyword.pop(opts, :name, __MODULE__)
    Supervisor.start_link(__MODULE__, init_opts, name: name)
  end

  @impl true
  @spec init(keyword()) :: {:ok, {Supervisor.sup_flags(), [Supervisor.child_spec()]}}
  def init(opts) when is_list(opts) do
    shard_ids = Keyword.get(opts, :shard_ids, LC.RealtimeRuntime.default_shard_ids())

    children =
      [
        {Registry, keys: :unique, name: @registry},
        {DynamicSupervisor, strategy: :one_for_one, name: @dynamic_supervisor}
      ] ++ Enum.map(shard_ids, &{LC.RealtimeRuntime.ShardOwner, shard_id: &1})

    Supervisor.init(children, strategy: :one_for_all)
  end
end

defmodule LC.RealtimeRuntime do
  @moduledoc false

  use Boundary, deps: [LCSchemas], exports: [SessionServer, Supervisor]

  alias LC.RealtimeRuntime.SessionServer

  @default_shard_count 1

  @type shard_id :: non_neg_integer()
  @type initial_participants :: %{optional(pos_integer()) => SessionServer.participant()}
  @type remote_owner_error :: {:owned_by_remote, String.t()}
  @type lookup_error :: :not_found | remote_owner_error()
  @type runtime_lookup_result :: {:ok, pid()} | {:error, lookup_error()}
  @type runtime_start_result :: {:ok, pid()} | {:error, term() | lookup_error()}
  @type runtime_stop_result :: :ok | {:error, remote_owner_error()}
  @type start_option ::
          {:shard_id, shard_id()} | {:media_bootstrap, SessionServer.media_bootstrap()}

  @spec shard_id(pos_integer()) :: shard_id()
  @spec shard_id(pos_integer(), keyword()) :: shard_id()
  def shard_id(session_id, opts \\ [])

  def shard_id(session_id, opts)
      when is_integer(session_id) and session_id > 0 and is_list(opts) do
    shard_count =
      opts
      |> Keyword.get(:shard_count, configured_shard_count())
      |> normalize_shard_count()

    rem(session_id, shard_count)
  end

  @spec lookup_session_runtime(pos_integer()) :: runtime_lookup_result()
  @spec lookup_session_runtime(pos_integer(), keyword()) :: runtime_lookup_result()
  def lookup_session_runtime(session_id, opts \\ [])

  def lookup_session_runtime(session_id, opts)
      when is_integer(session_id) and session_id > 0 and is_list(opts) do
    session_id
    |> shard_id_from_opts(opts)
    |> call_shard({:lookup_session_runtime, session_id})
  end

  @spec start_session_runtime(pos_integer()) :: runtime_start_result()
  @spec start_session_runtime(pos_integer(), initial_participants()) :: runtime_start_result()
  @spec start_session_runtime(pos_integer(), initial_participants(), [start_option()]) ::
          runtime_start_result()
  def start_session_runtime(session_id, initial_participants \\ %{}, opts \\ [])

  def start_session_runtime(session_id, initial_participants, opts)
      when is_integer(session_id) and session_id > 0 and is_map(initial_participants) and
             is_list(opts) do
    start_opts = runtime_start_options(opts)

    session_id
    |> shard_id_from_opts(opts)
    |> call_shard({:start_session_runtime, session_id, initial_participants, start_opts})
  end

  @spec stop_session_runtime(pos_integer()) :: runtime_stop_result()
  @spec stop_session_runtime(pos_integer(), keyword()) :: runtime_stop_result()
  def stop_session_runtime(session_id, opts \\ [])

  def stop_session_runtime(session_id, opts)
      when is_integer(session_id) and session_id > 0 and is_list(opts) do
    shard_id = shard_id_from_opts(session_id, opts)

    case call_shard(shard_id, {:stop_session_runtime, session_id}) do
      :ok -> :ok
      {:error, :not_found} -> :ok
      {:error, {:owned_by_remote, _owner_node}} = error -> error
    end
  end

  @spec join_session_runtime(
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role()
        ) :: :ok | {:error, lookup_error()}
  def join_session_runtime(session_id, user_id, role)
      when is_integer(session_id) and session_id > 0 and is_integer(user_id) and is_atom(role) do
    session_id
    |> shard_id()
    |> call_shard({:join_session_runtime, session_id, user_id, role})
  end

  @spec global_shard_name(shard_id()) :: {LC.RealtimeRuntime.ShardOwner, shard_id()}
  def global_shard_name(shard_id) when is_integer(shard_id) and shard_id >= 0 do
    {LC.RealtimeRuntime.ShardOwner, shard_id}
  end

  @spec default_shard_ids() :: [shard_id()]
  def default_shard_ids do
    0..(configured_shard_count() - 1)//1 |> Enum.to_list()
  end

  if Mix.env() == :test do
    @test_owner_overrides_table :lc_realtime_runtime_test_owner_overrides

    @doc false
    @spec put_test_shard_owner(shard_id(), {:remote, String.t()} | :unavailable) :: :ok
    def put_test_shard_owner(shard_id, owner)
        when is_integer(shard_id) and shard_id >= 0 and
               (owner == :unavailable or
                  (is_tuple(owner) and tuple_size(owner) == 2 and elem(owner, 0) == :remote and
                     is_binary(elem(owner, 1)))) do
      ensure_test_owner_overrides_table()
      :ets.insert(@test_owner_overrides_table, {shard_id, owner})
      :ok
    end

    @doc false
    @spec clear_test_shard_owner(shard_id()) :: :ok
    def clear_test_shard_owner(shard_id) when is_integer(shard_id) and shard_id >= 0 do
      ensure_test_owner_overrides_table()
      :ets.delete(@test_owner_overrides_table, shard_id)
      :ok
    end

    @spec test_owner_override(shard_id()) :: {:remote, String.t()} | :unavailable | :none
    defp test_owner_override(shard_id) when is_integer(shard_id) do
      ensure_test_owner_overrides_table()

      case :ets.lookup(@test_owner_overrides_table, shard_id) do
        [{^shard_id, owner}] -> owner
        [] -> :none
      end
    end

    @spec ensure_test_owner_overrides_table() :: :ok
    defp ensure_test_owner_overrides_table do
      case :ets.whereis(@test_owner_overrides_table) do
        :undefined ->
          :ets.new(@test_owner_overrides_table, [:named_table, :public, :set])
          :ok

        _table ->
          :ok
      end
    rescue
      ArgumentError -> :ok
    end
  else
    defp test_owner_override(_shard_id) do
      Application.get_env(:live_canvas, :disabled_realtime_runtime_test_owner_override, :none)
    end
  end

  @spec configured_shard_count() :: pos_integer()
  defp configured_shard_count do
    :live_canvas
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:shard_count, @default_shard_count)
    |> normalize_shard_count()
  end

  @spec normalize_shard_count(term()) :: pos_integer()
  defp normalize_shard_count(count) when is_integer(count) and count > 0, do: count
  defp normalize_shard_count(_count), do: @default_shard_count

  @spec shard_id_from_opts(pos_integer(), keyword()) :: shard_id()
  defp shard_id_from_opts(session_id, opts) when is_integer(session_id) and is_list(opts) do
    case Keyword.get(opts, :shard_id) do
      shard_id when is_integer(shard_id) and shard_id >= 0 -> shard_id
      _other -> shard_id(session_id, opts)
    end
  end

  @spec runtime_start_options(keyword()) :: keyword()
  defp runtime_start_options(opts) when is_list(opts) do
    case Keyword.get(opts, :media_bootstrap) do
      media_bootstrap when is_function(media_bootstrap, 1) -> [media_bootstrap: media_bootstrap]
      _other -> []
    end
  end

  defp call_shard(shard_id, request) when is_integer(shard_id) and shard_id >= 0 do
    case test_owner_override(shard_id) do
      {:remote, owner_node} ->
        {:error, {:owned_by_remote, owner_node}}

      :unavailable ->
        {:error, :not_found}

      :none ->
        call_global_shard(shard_id, request)
    end
  end

  defp call_global_shard(shard_id, request) when is_integer(shard_id) and shard_id >= 0 do
    case :global.whereis_name(global_shard_name(shard_id)) do
      :undefined -> {:error, :not_found}
      pid when is_pid(pid) -> call_shard_pid(pid, request)
    end
  end

  defp call_shard_pid(pid, request) when is_pid(pid) do
    if node(pid) == Node.self() do
      GenServer.call(pid, request)
    else
      {:error, {:owned_by_remote, Atom.to_string(node(pid))}}
    end
  end
end

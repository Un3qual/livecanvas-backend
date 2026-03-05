defmodule LC.Release.LiveRuntimeDrill do
  @moduledoc """
  Builds and executes deterministic operator drill steps for live runtime failover rehearsal.
  """

  @type drill_step :: %{
          name: String.t(),
          command: String.t(),
          success_criteria: String.t()
        }
  @type drill_failure :: %{step: drill_step(), reason: term()}
  @type runner_fun :: (drill_step() -> :ok | {:error, term()})

  @spec command_plan(pos_integer(), String.t()) :: [drill_step()]
  def command_plan(session_id, takeover_node)
      when is_integer(session_id) and session_id > 0 and is_binary(takeover_node) do
    [
      %{
        name: "Capture current runtime owner lease",
        command:
          "Inspect lease owner for live_session_id=#{session_id} and record lease_expires_at/heartbeat_at.",
        success_criteria: "Lease owner is captured with timestamps before any failover action."
      },
      %{
        name: "Simulate owner-node partition",
        command:
          "Disconnect current owner node from takeover node #{takeover_node} to simulate a partition for live_session_id=#{session_id}.",
        success_criteria:
          "Ownership lookup from #{takeover_node} no longer reaches the previous owner."
      },
      %{
        name: "Force ownership takeover on target node",
        command:
          "On takeover node #{takeover_node}, start/restart session runtime for live_session_id=#{session_id} and confirm lease owner flips.",
        success_criteria:
          "Lease owner updates to #{takeover_node} and a local runtime process is present."
      },
      %{
        name: "Run reconnect join probe",
        command:
          "Join session as a fresh viewer for live_session_id=#{session_id} and confirm join succeeds without ghost participants.",
        success_criteria:
          "Viewer reconnect succeeds and `live_participants` has no duplicate active rows."
      },
      %{
        name: "Restore topology and verify steady owner",
        command:
          "Reconnect partitioned node, confirm owner heartbeat stabilizes, and capture final lease owner for live_session_id=#{session_id}.",
        success_criteria:
          "Heartbeat keeps advancing for the selected owner with no split-brain ownership."
      }
    ]
  end

  @spec run(keyword()) ::
          :ok
          | {:dry_run, [drill_step()]}
          | {:error, :session_id_required | :invalid_session_id | :invalid_takeover_node}
          | {:error, :confirmation_required | drill_failure()}
  def run(opts \\ []) do
    env = Keyword.get(opts, :env, Mix.env())
    confirm? = Keyword.get(opts, :confirm, false)
    dry_run? = Keyword.get(opts, :dry_run, false)
    session_id = Keyword.get(opts, :session_id)
    takeover_node = normalized_takeover_node(opts)
    runner = Keyword.get(opts, :runner, &default_runner/1)

    with :ok <- validate_session_id(session_id),
         :ok <- validate_takeover_node(takeover_node),
         :ok <- validate_confirmation(env, confirm?) do
      steps = command_plan(session_id, takeover_node)

      if dry_run? do
        {:dry_run, steps}
      else
        run_steps(steps, runner)
      end
    end
  end

  @spec format_step(drill_step()) :: String.t()
  def format_step(%{name: name, command: command, success_criteria: success_criteria}) do
    "#{name}: #{command} (success: #{success_criteria})"
  end

  @spec run_steps([drill_step()], runner_fun()) :: :ok | {:error, drill_failure()}
  defp run_steps([], _runner), do: :ok

  defp run_steps([step | remaining], runner) do
    # Fail fast to keep operator evidence aligned with the first broken step.
    case runner.(step) do
      :ok -> run_steps(remaining, runner)
      {:error, reason} -> {:error, %{step: step, reason: reason}}
    end
  end

  @spec normalized_takeover_node(keyword()) :: term()
  defp normalized_takeover_node(opts) when is_list(opts) do
    default_node = Node.self() |> Atom.to_string()

    case Keyword.fetch(opts, :takeover_node) do
      :error -> default_node
      {:ok, nil} -> default_node
      {:ok, takeover_node} -> takeover_node
    end
  end

  @spec validate_session_id(term()) :: :ok | {:error, :session_id_required | :invalid_session_id}
  defp validate_session_id(nil), do: {:error, :session_id_required}
  defp validate_session_id(session_id) when is_integer(session_id) and session_id > 0, do: :ok
  defp validate_session_id(_session_id), do: {:error, :invalid_session_id}

  @spec validate_takeover_node(term()) :: :ok | {:error, :invalid_takeover_node}
  defp validate_takeover_node(takeover_node)
       when is_binary(takeover_node) and byte_size(takeover_node) > 0,
       do: :ok

  defp validate_takeover_node(_takeover_node), do: {:error, :invalid_takeover_node}

  @spec validate_confirmation(atom(), boolean()) :: :ok | {:error, :confirmation_required}
  defp validate_confirmation(:test, _confirm?), do: :ok
  defp validate_confirmation(_env, true), do: :ok
  defp validate_confirmation(_env, false), do: {:error, :confirmation_required}

  @spec default_runner(drill_step()) :: :ok
  defp default_runner(step) when is_map(step) do
    Mix.shell().info("Executing drill step: #{format_step(step)}")
    :ok
  end
end

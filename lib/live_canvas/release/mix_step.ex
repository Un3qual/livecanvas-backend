defmodule LC.Release.MixStep do
  @moduledoc false

  @type t :: %{task: String.t(), args: [String.t()]}
  @type failure :: %{step: t(), reason: term()}
  @type runner_fun :: (String.t(), [String.t()] -> :ok | {:error, term()})
  @type operator_step :: %{
          required(:name) => String.t(),
          required(:command) => String.t(),
          required(:success_criteria) => String.t(),
          optional(atom()) => term()
        }

  @spec format(t()) :: String.t()
  def format(%{task: task, args: []}), do: "mix #{task}"
  def format(%{task: task, args: args}), do: "mix #{task} #{Enum.join(args, " ")}"

  @spec format_operator(operator_step()) :: String.t()
  def format_operator(%{name: name, command: command, success_criteria: success_criteria}) do
    "#{name}: #{command} (success: #{success_criteria})"
  end

  @spec run_steps([t()], runner_fun()) :: :ok | {:error, failure()}
  def run_steps([], _runner), do: :ok

  def run_steps([step | remaining], runner) do
    case runner.(step.task, step.args) do
      :ok -> run_steps(remaining, runner)
      {:error, reason} -> {:error, %{step: step, reason: reason}}
    end
  end
end

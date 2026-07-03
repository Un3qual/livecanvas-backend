defmodule LC.Release.MixStep do
  @moduledoc false

  @type t :: %{task: String.t(), args: [String.t()]}

  @spec format(t()) :: String.t()
  def format(%{task: task, args: []}), do: "mix #{task}"
  def format(%{task: task, args: args}), do: "mix #{task} #{Enum.join(args, " ")}"
end

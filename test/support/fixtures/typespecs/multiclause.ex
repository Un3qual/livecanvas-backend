defmodule LiveCanvas.TypespecFixtures.Multiclause do
  @spec normalize(integer() | String.t()) :: integer()
  def normalize(value) when is_integer(value), do: value
  def normalize(value) when is_binary(value), do: String.to_integer(value)
end

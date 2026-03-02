defmodule LiveCanvas.TypespecFixtures.WithSpec do
  @spec ping(term()) :: term()
  def ping(value), do: value
end

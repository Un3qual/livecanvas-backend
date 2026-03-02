defmodule LiveCanvas.TypespecFixtures.IgnoredDefs do
  defmacro sample(value) do
    private(value)
  end

  defp private(value), do: value
end

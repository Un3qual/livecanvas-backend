defmodule LCGQL.FieldNames do
  @moduledoc """
  Shared GraphQL field-name formatting for payload values that expose field paths.
  """

  @spec lower_camel(atom()) :: String.t()
  def lower_camel(field) when is_atom(field) do
    field
    |> Atom.to_string()
    |> Absinthe.Adapter.LanguageConventions.to_external_name(:field)
  end
end

defmodule LCGQL.Relay do
  @moduledoc false

  @type decode_error :: :invalid_id | :invalid_type
  @type decode_result :: {:ok, pos_integer()} | {:error, decode_error()}

  @spec decode_global_id(term(), atom(), module()) :: decode_result()
  def decode_global_id(value, expected_type, schema) do
    case Absinthe.Relay.Node.from_global_id(value, schema) do
      {:ok, %{type: ^expected_type, id: id}} -> cast_local_id(id)
      {:ok, _decoded_node} -> {:error, :invalid_type}
      {:error, _reason} -> cast_local_id(value)
    end
  end

  defp cast_local_id(value) do
    case Ecto.Type.cast(:id, value) do
      {:ok, id} when is_integer(id) and id > 0 -> {:ok, id}
      _ -> {:error, :invalid_id}
    end
  end
end

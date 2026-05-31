defmodule LC.Infra.Payload do
  @moduledoc """
  Helpers for fixed-key boundary payload lookup.

  Callers must pass known atom keys. This keeps request, webhook, and async-job
  payload handling compatible with atom or string maps without creating atoms
  from external input.
  """

  @type invalid_payload :: :invalid_payload

  @spec value_for(term(), atom()) :: term() | nil
  def value_for(payload, key) when is_map(payload) and is_atom(key) do
    Map.get(payload, key) || Map.get(payload, Atom.to_string(key))
  end

  def value_for(_payload, _key), do: nil

  @spec positive_integer(term(), atom()) :: {:ok, pos_integer()} | {:error, invalid_payload()}
  def positive_integer(payload, key) when is_atom(key) do
    case value_for(payload, key) do
      value when is_integer(value) and value > 0 -> {:ok, value}
      _other -> {:error, :invalid_payload}
    end
  end

  def positive_integer(_payload, _key), do: {:error, :invalid_payload}
end

defmodule LC.Accounts.PhoneNumbers do
  @moduledoc false

  @default_region "US"

  @doc false
  @spec normalize(term(), term()) :: {:ok, String.t()} | {:error, :invalid_phone_number}
  def normalize(raw_phone_number, default_region \\ @default_region)

  def normalize(raw_phone_number, default_region)
      when is_binary(raw_phone_number) and is_binary(default_region) do
    with {:ok, phone_number} <- ExPhoneNumber.parse(raw_phone_number, default_region),
         true <- ExPhoneNumber.is_valid_number?(phone_number) || {:error, :invalid_phone_number} do
      case ExPhoneNumber.format(phone_number, :e164) do
        normalized_phone_number when is_binary(normalized_phone_number) ->
          {:ok, normalized_phone_number}

        {:ok, normalized_phone_number} when is_binary(normalized_phone_number) ->
          {:ok, normalized_phone_number}

        _ ->
          {:error, :invalid_phone_number}
      end
    else
      _ -> {:error, :invalid_phone_number}
    end
  end

  def normalize(_, _), do: {:error, :invalid_phone_number}
end

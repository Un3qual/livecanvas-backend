defmodule LC.Accounts.Passkeys do
  @moduledoc false

  alias LCSchemas.Accounts.{User, UserPasskey}

  @type adapter_config :: keyword()
  @type challenge_options :: map()
  @type verification_result :: %{
          required(:credential_id) => String.t(),
          required(:public_key) => binary(),
          required(:sign_count) => non_neg_integer(),
          required(:transports) => [String.t()]
        }
  @type authentication_result :: %{required(:sign_count) => non_neg_integer()}

  @callback build_registration_options(User.t(), binary(), adapter_config()) ::
              {:ok, challenge_options()} | {:error, :passkey_verification_failed}
  @callback build_authentication_options(User.t(), [UserPasskey.t()], binary(), adapter_config()) ::
              {:ok, challenge_options()} | {:error, :passkey_verification_failed}
  @callback verify_registration(map(), binary(), adapter_config()) ::
              {:ok, verification_result()} | {:error, :passkey_verification_failed}
  @callback verify_authentication(map(), UserPasskey.t(), binary(), adapter_config()) ::
              {:ok, authentication_result()} | {:error, :passkey_verification_failed}

  @spec build_registration_options(User.t(), binary(), keyword()) ::
          {:ok, challenge_options()} | {:error, :passkey_verification_failed}
  def build_registration_options(%User{} = user, raw_challenge, opts \\ [])
      when is_binary(raw_challenge) and is_list(opts) do
    with {:ok, {adapter, adapter_opts}} <- adapter_and_opts(opts) do
      adapter.build_registration_options(user, raw_challenge, adapter_opts)
    end
  end

  @spec build_authentication_options(User.t(), [UserPasskey.t()], binary(), keyword()) ::
          {:ok, challenge_options()} | {:error, :passkey_verification_failed}
  def build_authentication_options(%User{} = user, passkeys, raw_challenge, opts \\ [])
      when is_list(passkeys) and is_binary(raw_challenge) and is_list(opts) do
    with {:ok, {adapter, adapter_opts}} <- adapter_and_opts(opts) do
      adapter.build_authentication_options(user, passkeys, raw_challenge, adapter_opts)
    end
  end

  @spec verify_registration(map(), binary(), keyword()) ::
          {:ok, verification_result()} | {:error, :passkey_verification_failed}
  def verify_registration(input, raw_challenge, opts \\ [])
      when is_map(input) and is_binary(raw_challenge) and is_list(opts) do
    with {:ok, {adapter, adapter_opts}} <- adapter_and_opts(opts) do
      adapter.verify_registration(input, raw_challenge, adapter_opts)
    end
  end

  @spec verify_authentication(map(), UserPasskey.t(), binary(), keyword()) ::
          {:ok, authentication_result()} | {:error, :passkey_verification_failed}
  def verify_authentication(input, %UserPasskey{} = passkey, raw_challenge, opts \\ [])
      when is_map(input) and is_binary(raw_challenge) and is_list(opts) do
    with {:ok, {adapter, adapter_opts}} <- adapter_and_opts(opts) do
      adapter.verify_authentication(input, passkey, raw_challenge, adapter_opts)
    end
  end

  @spec encode_base64url(binary()) :: String.t()
  def encode_base64url(value) when is_binary(value), do: Base.url_encode64(value, padding: false)

  @spec decode_base64url(String.t()) :: {:ok, binary()} | :error
  def decode_base64url(value) when is_binary(value), do: Base.url_decode64(value, padding: false)

  def decode_base64url(_value), do: :error

  @spec serialize_public_key(term()) :: binary()
  def serialize_public_key(public_key), do: :erlang.term_to_binary(public_key)

  @spec deserialize_public_key(binary()) :: {:ok, term()} | :error
  def deserialize_public_key(encoded_public_key) when is_binary(encoded_public_key) do
    {:ok, :erlang.binary_to_term(encoded_public_key, [:safe])}
  rescue
    ArgumentError -> :error
  end

  def deserialize_public_key(_encoded_public_key), do: :error

  @spec user_handle(User.t()) :: String.t()
  def user_handle(%User{entropy_id: entropy_id}) when is_binary(entropy_id) do
    encode_base64url(entropy_id)
  end

  def user_handle(%User{id: user_id}) when is_integer(user_id),
    do: encode_base64url(Integer.to_string(user_id))

  @spec challenge_options_json(challenge_options()) :: String.t()
  def challenge_options_json(options) when is_map(options), do: Jason.encode!(options)

  @spec adapter_and_opts(keyword()) ::
          {:ok, {module(), adapter_config()}} | {:error, :passkey_verification_failed}
  defp adapter_and_opts(overrides) when is_list(overrides) do
    with {:ok, config} <- fetch_config(overrides),
         adapter when is_atom(adapter) <- Keyword.fetch!(config, :adapter) do
      {:ok, {adapter, Keyword.delete(config, :adapter)}}
    end
  end

  @spec fetch_config(keyword()) ::
          {:ok, adapter_config()} | {:error, :passkey_verification_failed}
  defp fetch_config(overrides) when is_list(overrides) do
    config =
      :live_canvas
      |> Application.get_env(__MODULE__, [])
      |> Keyword.merge(overrides)

    with adapter when is_atom(adapter) <- Keyword.get(config, :adapter),
         true <- Code.ensure_loaded?(adapter),
         {:ok, origin} <- fetch_origin(config),
         {:ok, rp_id} <- fetch_string(config, :rp_id),
         {:ok, rp_name} <- fetch_string(config, :rp_name) do
      {:ok,
       [
         adapter: adapter,
         attestation: Keyword.get(config, :attestation, "none"),
         origin: origin,
         rp_id: rp_id,
         rp_name: rp_name,
         user_verification: Keyword.get(config, :user_verification, "preferred")
       ]}
    else
      _other -> {:error, :passkey_verification_failed}
    end
  end

  defp fetch_origin(config) when is_list(config) do
    case Keyword.get(config, :origin) do
      origin when is_binary(origin) ->
        if String.trim(origin) == "" do
          {:error, :passkey_verification_failed}
        else
          {:ok, String.trim(origin)}
        end

      origins when is_list(origins) and origins != [] ->
        trimmed =
          origins
          |> Enum.filter(&is_binary/1)
          |> Enum.map(&String.trim/1)
          |> Enum.reject(&(&1 == ""))

        if trimmed == [] do
          {:error, :passkey_verification_failed}
        else
          {:ok, trimmed}
        end

      _other ->
        {:error, :passkey_verification_failed}
    end
  end

  defp fetch_string(config, key) when is_list(config) and is_atom(key) do
    case Keyword.get(config, key) do
      value when is_binary(value) ->
        trimmed = String.trim(value)

        if trimmed == "" do
          {:error, :passkey_verification_failed}
        else
          {:ok, trimmed}
        end

      _other ->
        {:error, :passkey_verification_failed}
    end
  end
end

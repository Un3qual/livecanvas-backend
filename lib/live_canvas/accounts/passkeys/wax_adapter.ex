defmodule LC.Accounts.Passkeys.WaxAdapter do
  @moduledoc false
  @behaviour LC.Accounts.Passkeys

  alias LC.Accounts.Passkeys
  alias LCSchemas.Accounts.{User, UserPasskey}

  @pub_key_cred_params [%{"alg" => -7, "type" => "public-key"}]

  @spec build_registration_options(User.t(), binary(), keyword()) ::
          {:ok, map()} | {:error, :passkey_verification_failed}
  def build_registration_options(%User{} = user, raw_challenge, opts)
      when is_binary(raw_challenge) and is_list(opts) do
    challenge = Wax.new_registration_challenge(wax_registration_opts(raw_challenge, opts))

    {:ok,
     %{
       "attestation" => Keyword.get(opts, :attestation, "none"),
       "challenge" => Passkeys.encode_base64url(challenge.bytes),
       "pubKeyCredParams" => @pub_key_cred_params,
       "rp" => %{"id" => challenge.rp_id, "name" => Keyword.fetch!(opts, :rp_name)},
       "user" => %{
         "displayName" => user.email,
         "id" => Passkeys.user_handle(user),
         "name" => user.email
       },
       "userVerification" => challenge.user_verification
     }}
  rescue
    _error -> {:error, :passkey_verification_failed}
  end

  @spec build_authentication_options(User.t(), [UserPasskey.t()], binary(), keyword()) ::
          {:ok, map()} | {:error, :passkey_verification_failed}
  def build_authentication_options(%User{} = _user, passkeys, raw_challenge, opts)
      when is_list(passkeys) and is_binary(raw_challenge) and is_list(opts) do
    credentials = credentials(passkeys)

    challenge =
      Wax.new_authentication_challenge(wax_authentication_opts(raw_challenge, credentials, opts))

    {:ok,
     %{
       "allowCredentials" =>
         Enum.map(passkeys, fn passkey ->
           %{
             "id" => passkey.credential_id,
             "transports" => passkey.transports,
             "type" => "public-key"
           }
         end),
       "challenge" => Passkeys.encode_base64url(challenge.bytes),
       "rpId" => challenge.rp_id,
       "userVerification" => challenge.user_verification
     }}
  rescue
    _error -> {:error, :passkey_verification_failed}
  end

  @spec verify_registration(map(), binary(), keyword()) ::
          {:ok, LC.Accounts.Passkeys.verification_result()}
          | {:error, :passkey_verification_failed}
  def verify_registration(input, raw_challenge, opts)
      when is_map(input) and is_binary(raw_challenge) and is_list(opts) do
    challenge = Wax.new_registration_challenge(wax_registration_opts(raw_challenge, opts))

    with credential_id when is_binary(credential_id) <- fetch_input(input, :credential_id),
         {:ok, attestation_object} <-
           Passkeys.decode_base64url(fetch_input(input, :attestation_object)),
         client_data_json when is_binary(client_data_json) <-
           fetch_input(input, :client_data_json),
         {:ok, {authenticator_data, _attestation_result}} <-
           Wax.register(attestation_object, client_data_json, challenge),
         encoded_credential_id <-
           Passkeys.encode_base64url(authenticator_data.attested_credential_data.credential_id),
         true <- encoded_credential_id == credential_id do
      {:ok,
       %{
         credential_id: credential_id,
         public_key:
           Passkeys.serialize_public_key(
             authenticator_data.attested_credential_data.credential_public_key
           ),
         sign_count: authenticator_data.sign_count,
         transports: []
       }}
    else
      _other -> {:error, :passkey_verification_failed}
    end
  rescue
    _error -> {:error, :passkey_verification_failed}
  end

  @spec verify_authentication(map(), UserPasskey.t(), binary(), keyword()) ::
          {:ok, LC.Accounts.Passkeys.authentication_result()}
          | {:error, :passkey_verification_failed}
  def verify_authentication(input, %UserPasskey{} = passkey, raw_challenge, opts)
      when is_map(input) and is_binary(raw_challenge) and is_list(opts) do
    with credential_id when is_binary(credential_id) <- fetch_input(input, :credential_id),
         true <- credential_id == passkey.credential_id,
         {:ok, public_key} <- Passkeys.deserialize_public_key(passkey.public_key),
         {:ok, authenticator_data} <-
           Passkeys.decode_base64url(fetch_input(input, :authenticator_data)),
         {:ok, signature} <- Passkeys.decode_base64url(fetch_input(input, :signature)),
         client_data_json when is_binary(client_data_json) <-
           fetch_input(input, :client_data_json),
         challenge <-
           Wax.new_authentication_challenge(
             wax_authentication_opts(raw_challenge, [{credential_id, public_key}], opts)
           ),
         {:ok, verification} <-
           Wax.authenticate(
             credential_id,
             authenticator_data,
             signature,
             client_data_json,
             challenge,
             [{credential_id, public_key}]
           ) do
      {:ok, %{sign_count: verification.sign_count}}
    else
      _other -> {:error, :passkey_verification_failed}
    end
  rescue
    _error -> {:error, :passkey_verification_failed}
  end

  defp credentials(passkeys) do
    Enum.map(passkeys, fn passkey ->
      {:ok, public_key} = Passkeys.deserialize_public_key(passkey.public_key)
      {passkey.credential_id, public_key}
    end)
  end

  defp wax_registration_opts(raw_challenge, opts) do
    [
      attestation: Keyword.get(opts, :attestation, "none"),
      bytes: raw_challenge,
      origin: Keyword.fetch!(opts, :origin),
      rp_id: Keyword.fetch!(opts, :rp_id),
      user_verification: Keyword.get(opts, :user_verification, "preferred")
    ]
  end

  defp wax_authentication_opts(raw_challenge, credentials, opts) do
    [
      allow_credentials: credentials,
      bytes: raw_challenge,
      origin: Keyword.fetch!(opts, :origin),
      rp_id: Keyword.fetch!(opts, :rp_id),
      user_verification: Keyword.get(opts, :user_verification, "preferred")
    ]
  end

  defp fetch_input(input, key) when is_map(input) and is_atom(key) do
    Map.get(input, key) || Map.get(input, Atom.to_string(key))
  end
end

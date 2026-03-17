defmodule LC.PasskeyTestSupport do
  @moduledoc false

  alias LC.Accounts.Tokens

  @origin "https://livecanvas.invalid"

  defmodule FakeAdapter do
    @moduledoc false
    @origin "https://livecanvas.invalid"

    def build_registration_options(user, raw_challenge, opts) do
      {:ok,
       %{
         "challenge" => encode_challenge(raw_challenge),
         "pubKeyCredParams" => [%{"alg" => -7, "type" => "public-key"}],
         "rp" => %{
           "id" => Keyword.fetch!(opts, :rp_id),
           "name" => Keyword.fetch!(opts, :rp_name)
         },
         "user" => %{
           "displayName" => user.email,
           "id" => Base.url_encode64(Integer.to_string(user.id), padding: false),
           "name" => user.email
         }
       }}
    end

    def build_authentication_options(_user, passkeys, raw_challenge, opts) do
      {:ok,
       %{
         "allowCredentials" =>
           Enum.map(passkeys, fn passkey ->
             %{"id" => passkey.credential_id, "type" => "public-key"}
           end),
         "challenge" => encode_challenge(raw_challenge),
         "rpId" => Keyword.fetch!(opts, :rp_id)
       }}
    end

    def verify_registration(input, raw_challenge, _opts) do
      with :ok <-
             verify_client_data(
               fetch_input(input, :client_data_json),
               "webauthn.create",
               raw_challenge
             ),
           {:ok, attestation} <- Jason.decode(fetch_input(input, :attestation_object)),
           credential_id when is_binary(credential_id) <- fetch_input(input, :credential_id),
           true <- attestation["credentialId"] == credential_id,
           {:ok, public_key} <- decode_public_key(attestation["publicKey"]),
           sign_count when is_integer(sign_count) and sign_count >= 0 <-
             Map.get(attestation, "signCount", 0),
           transports when is_list(transports) <- Map.get(attestation, "transports", []) do
        {:ok,
         %{
           credential_id: credential_id,
           public_key: public_key,
           sign_count: sign_count,
           transports: transports
         }}
      else
        _other -> {:error, :passkey_verification_failed}
      end
    end

    def verify_authentication(input, passkey, raw_challenge, _opts) do
      with :ok <-
             verify_client_data(
               fetch_input(input, :client_data_json),
               "webauthn.get",
               raw_challenge
             ),
           credential_id when is_binary(credential_id) <- fetch_input(input, :credential_id),
           true <- credential_id == passkey.credential_id,
           "valid-signature" <- fetch_input(input, :signature),
           {:ok, auth_data} <- Jason.decode(fetch_input(input, :authenticator_data)),
           sign_count when is_integer(sign_count) and sign_count >= passkey.sign_count <-
             Map.get(auth_data, "signCount") do
        {:ok, %{sign_count: sign_count}}
      else
        _other -> {:error, :passkey_verification_failed}
      end
    end

    defp encode_challenge(raw_challenge) when is_binary(raw_challenge) do
      Base.url_encode64(raw_challenge, padding: false)
    end

    defp verify_client_data(client_data_json, expected_type, raw_challenge)
         when is_binary(client_data_json) and is_binary(expected_type) and
                is_binary(raw_challenge) do
      with {:ok, client_data} <- Jason.decode(client_data_json),
           ^expected_type <- Map.get(client_data, "type"),
           true <- Map.get(client_data, "origin") == @origin,
           ^raw_challenge <- decode_challenge(Map.get(client_data, "challenge")) do
        :ok
      else
        _other -> {:error, :passkey_verification_failed}
      end
    end

    defp verify_client_data(_, _, _), do: {:error, :passkey_verification_failed}

    defp decode_public_key(public_key) when is_binary(public_key) do
      Base.url_decode64(public_key, padding: false)
    end

    defp decode_public_key(_public_key), do: :error

    defp decode_challenge(challenge) when is_binary(challenge) do
      case Base.url_decode64(challenge, padding: false) do
        {:ok, decoded} -> decoded
        :error -> :invalid
      end
    end

    defp decode_challenge(_challenge), do: :invalid

    defp fetch_input(input, key) when is_map(input) and is_atom(key) do
      Map.get(input, key) || Map.get(input, Atom.to_string(key))
    end
  end

  def with_fake_passkey_adapter(fun) when is_function(fun, 0) do
    module = LC.Accounts.Passkeys
    previous_config = Application.get_env(:live_canvas, module)

    Application.put_env(:live_canvas, module,
      adapter: FakeAdapter,
      origin: @origin,
      rp_id: "livecanvas.invalid",
      rp_name: "LiveCanvas"
    )

    try do
      fun.()
    after
      if is_nil(previous_config) do
        Application.delete_env(:live_canvas, module)
      else
        Application.put_env(:live_canvas, module, previous_config)
      end
    end
  end

  def registration_passkey_input(challenge_token, opts \\ []) when is_binary(challenge_token) do
    credential_id =
      Keyword.get(opts, :credential_id, "passkey-#{System.unique_integer([:positive])}")

    challenge = encode_challenge_from_token!(challenge_token)
    public_key = Keyword.get(opts, :public_key, "public-key-#{credential_id}")

    %{
      challenge_token: challenge_token,
      credential_id: credential_id,
      client_data_json:
        Jason.encode!(%{
          "challenge" => challenge,
          "origin" => @origin,
          "type" => "webauthn.create"
        }),
      attestation_object:
        Jason.encode!(%{
          "credentialId" => credential_id,
          "publicKey" => Base.url_encode64(public_key, padding: false),
          "signCount" => Keyword.get(opts, :sign_count, 0),
          "transports" => Keyword.get(opts, :transports, ["internal"])
        })
    }
  end

  def assertion_passkey_input(challenge_token, credential_id, opts \\ [])
      when is_binary(challenge_token) and is_binary(credential_id) do
    challenge = encode_challenge_from_token!(challenge_token)

    %{
      challenge_token: challenge_token,
      credential_id: credential_id,
      client_data_json:
        Jason.encode!(%{
          "challenge" => challenge,
          "origin" => @origin,
          "type" => "webauthn.get"
        }),
      authenticator_data: Jason.encode!(%{"signCount" => Keyword.get(opts, :sign_count, 1)}),
      signature: Keyword.get(opts, :signature, "valid-signature"),
      user_handle: Keyword.get(opts, :user_handle)
    }
  end

  defp encode_challenge_from_token!(challenge_token) when is_binary(challenge_token) do
    {:ok, %{raw_secret: raw_secret}} = Tokens.decode_serialized_value(challenge_token)
    Base.url_encode64(raw_secret, padding: false)
  end
end

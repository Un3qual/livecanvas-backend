defmodule LC.Accounts.Tokens do
  @moduledoc false

  import Ecto.Query

  alias LCSchemas.Accounts.{User, UserToken}

  @hash_algorithm :sha3_256
  @rand_size 32
  @magic_link_validity_in_minutes 15
  @password_reset_validity_in_minutes 60
  @passkey_challenge_validity_in_minutes 10
  @change_email_validity_in_days 7
  @contact_invite_validity_in_days 7
  @session_validity_in_days 14
  @refresh_validity_in_days 30
  @email_token_contexts [
    :email_verification_token,
    :email_mfa_token,
    :email_magic_link_token,
    :password_reset_token,
    :email_one_time_code_token
  ]

  @type token_context :: LCSchemas.Accounts.user_token_context()

  @type email_token_context ::
          :email_verification_token
          | :email_mfa_token
          | :email_magic_link_token
          | :password_reset_token
          | :email_one_time_code_token
  @type passkey_challenge_context ::
          :passkey_registration_challenge_token | :passkey_authentication_challenge_token

  @type token_pair :: {binary(), UserToken.t()}

  @doc false
  @spec secret_hash(binary()) :: binary()
  def secret_hash(secret) when is_binary(secret), do: :crypto.hash(@hash_algorithm, secret)

  @doc """
  Encodes a token id and raw secret into the transport value.
  """
  @spec encode_serialized_value(binary(), binary()) :: String.t()
  def encode_serialized_value(id, raw_secret) when is_binary(id) and is_binary(raw_secret) do
    encoded_secret = Base.url_encode64(raw_secret, padding: false)
    "#{id}.#{encoded_secret}"
  end

  @doc """
  Decodes the serialized token value into its id and raw secret.
  """
  @spec decode_serialized_value(String.t()) ::
          {:ok, %{id: Ecto.UUID.t(), raw_secret: binary()}} | :error
  def decode_serialized_value(serialized_value) when is_binary(serialized_value) do
    case String.split(serialized_value, ".", parts: 2) do
      [id, encoded_secret] ->
        with {:ok, raw_secret} <- Base.url_decode64(encoded_secret, padding: false),
             {:ok, _id} <- Ecto.UUID.cast(id) do
          {:ok, %{id: id, raw_secret: raw_secret}}
        else
          _ -> :error
        end

      _ ->
        :error
    end
  end

  @doc """
  Builds an insertable access token payload.
  """
  @spec build_session_token(User.t()) :: token_pair()
  def build_session_token(user) do
    authenticated_at = user.authenticated_at || DateTime.utc_now()
    build_token(user, :access_token, authenticated_at: authenticated_at)
  end

  @doc """
  Builds an insertable email token payload.
  """
  @spec build_email_token(User.t(), email_token_context()) :: token_pair()
  def build_email_token(user, context) when context in @email_token_contexts do
    build_token(user, context, sent_to: user.email)
  end

  @doc """
  Returns a query that fetches the token and owning user by token id only.
  """
  @spec user_token_lookup_query(String.t()) ::
          {:ok, Ecto.Query.t(), binary()} | :error
  def user_token_lookup_query(serialized_value) do
    with {:ok, %{id: id, raw_secret: raw_secret}} <- decode_serialized_value(serialized_value) do
      query =
        from token in UserToken,
          where: token.id == ^id,
          join: user in assoc(token, :user),
          left_join: user_email_address in assoc(user, :user_email_addresses),
          left_join: email_address in assoc(user_email_address, :email_address),
          order_by: [asc: user_email_address.inserted_at],
          limit: 1,
          select: {user, token, email_address.normalized_email}

      {:ok, query, raw_secret}
    end
  end

  @doc false
  @spec valid_session_token?(UserToken.t(), binary()) :: boolean()
  def valid_session_token?(%UserToken{} = token, raw_secret) do
    valid_secret?(token, raw_secret) and
      token.context == :access_token and
      token_fresh?(token.inserted_at, days: @session_validity_in_days)
  end

  @doc false
  @spec valid_refresh_token?(UserToken.t(), binary()) :: boolean()
  def valid_refresh_token?(%UserToken{} = token, raw_secret) do
    valid_secret?(token, raw_secret) and
      token.context == :refresh_token and
      token_fresh?(token.inserted_at, days: @refresh_validity_in_days)
  end

  @doc false
  @spec valid_magic_link_token?(UserToken.t(), binary(), String.t() | nil) :: boolean()
  def valid_magic_link_token?(%UserToken{} = token, raw_secret, current_email) do
    valid_secret?(token, raw_secret) and
      token.context == :email_magic_link_token and
      token.sent_to == current_email and
      token_fresh?(token.inserted_at, minutes: @magic_link_validity_in_minutes)
  end

  @doc false
  @spec valid_password_reset_token?(UserToken.t(), binary(), String.t() | nil) :: boolean()
  def valid_password_reset_token?(%UserToken{} = token, raw_secret, current_email) do
    valid_secret?(token, raw_secret) and
      token.context == :password_reset_token and
      token.sent_to == current_email and
      token_fresh?(token.inserted_at, minutes: @password_reset_validity_in_minutes)
  end

  @doc false
  @spec valid_change_email_token?(UserToken.t(), binary()) :: boolean()
  def valid_change_email_token?(%UserToken{} = token, raw_secret) do
    valid_secret?(token, raw_secret) and
      token.context == :email_verification_token and
      token_fresh?(token.inserted_at, days: @change_email_validity_in_days)
  end

  @doc false
  @spec valid_contact_invite_token?(UserToken.t(), binary()) :: boolean()
  def valid_contact_invite_token?(%UserToken{} = token, raw_secret) do
    valid_secret?(token, raw_secret) and
      token.context == :contact_invite_token and
      token_fresh?(token.inserted_at, days: @contact_invite_validity_in_days)
  end

  @doc false
  @spec valid_passkey_registration_challenge_token?(UserToken.t(), binary(), String.t() | nil) ::
          boolean()
  def valid_passkey_registration_challenge_token?(%UserToken{} = token, raw_secret, current_email) do
    valid_passkey_challenge_token?(
      token,
      raw_secret,
      current_email,
      :passkey_registration_challenge_token
    )
  end

  @doc false
  @spec valid_passkey_authentication_challenge_token?(UserToken.t(), binary(), String.t() | nil) ::
          boolean()
  def valid_passkey_authentication_challenge_token?(
        %UserToken{} = token,
        raw_secret,
        current_email
      ) do
    valid_passkey_challenge_token?(
      token,
      raw_secret,
      current_email,
      :passkey_authentication_challenge_token
    )
  end

  @doc false
  @spec valid_secret?(UserToken.t(), binary()) :: boolean()
  def valid_secret?(%UserToken{secret_hash: stored_secret_hash}, raw_secret)
      when is_binary(stored_secret_hash) and is_binary(raw_secret) do
    Plug.Crypto.secure_compare(stored_secret_hash, secret_hash(raw_secret))
  end

  def valid_secret?(_, _), do: false

  @doc false
  @spec build_token(User.t(), token_context(), keyword()) :: token_pair()
  def build_token(user, context, attrs \\ [])

  def build_token(user, context, attrs) do
    raw_secret = :crypto.strong_rand_bytes(@rand_size)

    {raw_secret,
     %UserToken{
       raw_secret: raw_secret,
       secret_hash: secret_hash(raw_secret),
       context: context,
       sent_to: Keyword.get(attrs, :sent_to),
       user_id: user.id,
       authenticated_at: Keyword.get(attrs, :authenticated_at)
     }}
  end

  defp token_fresh?(inserted_at, opts) when is_struct(inserted_at, DateTime) do
    unit =
      cond do
        Keyword.has_key?(opts, :days) -> :day
        Keyword.has_key?(opts, :minutes) -> :minute
      end

    amount =
      case unit do
        :day -> Keyword.fetch!(opts, :days)
        :minute -> Keyword.fetch!(opts, :minutes)
      end

    DateTime.compare(inserted_at, DateTime.add(DateTime.utc_now(), -amount, unit)) == :gt
  end

  defp token_fresh?(_, _), do: false

  @spec valid_passkey_challenge_token?(
          UserToken.t(),
          binary(),
          String.t() | nil,
          passkey_challenge_context()
        ) :: boolean()
  defp valid_passkey_challenge_token?(%UserToken{} = token, raw_secret, current_email, context) do
    valid_secret?(token, raw_secret) and
      token.context == context and
      token.sent_to == current_email and
      token_fresh?(token.inserted_at, minutes: @passkey_challenge_validity_in_minutes)
  end
end

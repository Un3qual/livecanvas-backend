defmodule LCGQL.MutationErrors do
  @moduledoc false

  @type field_name :: String.t() | nil
  @type user_error :: %{field: field_name(), message: String.t()}
  @type auth_error_code ::
          :unauthenticated
          | :invalid_input
          | :invalid_credentials
          | :email_taken
          | :token_expired
          | :token_revoked
          | :unsupported_provider
          | :provider_verification_failed
          | :passkey_verification_failed
  @type auth_error :: %{field: field_name(), code: auth_error_code(), message: String.t()}
  @type field_mapper :: (atom() -> field_name())

  @spec user_error(field_name(), String.t() | atom()) :: user_error()
  def user_error(field, message) do
    %{field: field, message: message_text(message)}
  end

  @spec invalid_error(field_name()) :: user_error()
  def invalid_error(field), do: user_error(field, "is invalid")

  @spec changeset_errors(Ecto.Changeset.t(), field_mapper()) :: [user_error()]
  def changeset_errors(%Ecto.Changeset{} = changeset, field_mapper)
      when is_function(field_mapper, 1) do
    changeset
    |> Ecto.Changeset.traverse_errors(&interpolate_message/1)
    |> flatten_user_errors(fn field, message ->
      user_error(field_mapper.(field), message)
    end)
  end

  @spec auth_error(field_name(), auth_error_code()) :: auth_error()
  @spec auth_error(field_name(), auth_error_code(), String.t() | nil) :: auth_error()
  def auth_error(field, code, message \\ nil) do
    %{field: field, code: code, message: message_text(message || code)}
  end

  @spec auth_changeset_errors(Ecto.Changeset.t(), String.t(), field_mapper()) :: [auth_error()]
  def auth_changeset_errors(%Ecto.Changeset{} = changeset, prefix, field_mapper)
      when is_binary(prefix) and is_function(field_mapper, 1) do
    changeset
    |> Ecto.Changeset.traverse_errors(&interpolate_message/1)
    |> flatten_auth_errors(fn field, message ->
      auth_error("#{prefix}.#{field_mapper.(field)}", :invalid_input, message)
    end)
  end

  @spec flatten_user_errors(map(), (atom(), String.t() -> user_error())) :: [user_error()]
  defp flatten_user_errors(errors, error_builder)
       when is_map(errors) and is_function(error_builder, 2) do
    Enum.flat_map(errors, fn {field, messages} ->
      Enum.map(messages, fn message -> error_builder.(field, message) end)
    end)
  end

  @spec flatten_auth_errors(map(), (atom(), String.t() -> auth_error())) :: [auth_error()]
  defp flatten_auth_errors(errors, error_builder)
       when is_map(errors) and is_function(error_builder, 2) do
    Enum.flat_map(errors, fn {field, messages} ->
      Enum.map(messages, fn message -> error_builder.(field, message) end)
    end)
  end

  @spec interpolate_message({String.t(), Keyword.t()}) :: String.t()
  defp interpolate_message({message, options}) do
    Enum.reduce(options, message, fn {key, value}, acc ->
      String.replace(acc, "%{#{key}}", to_string(value))
    end)
  end

  @spec message_text(String.t() | atom()) :: String.t()
  defp message_text(message) when is_binary(message), do: message
  defp message_text(message) when is_atom(message), do: Atom.to_string(message)
end

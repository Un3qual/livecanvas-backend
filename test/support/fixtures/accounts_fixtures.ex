defmodule LC.AccountsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `LC.Accounts` context.
  """

  import Ecto.Query

  alias LC.Accounts
  alias LC.Accounts.Tokens
  alias LC.Infra.Repo

  def unique_user_email, do: "user#{System.unique_integer()}@example.com"
  def valid_user_password, do: "hello world!"

  def valid_user_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      email: unique_user_email()
    })
  end

  def unconfirmed_user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> valid_user_attributes()
      |> Accounts.register_user()

    user
  end

  def user_fixture(attrs \\ %{}) do
    attrs = Enum.into(attrs, %{})
    {privacy_mode, attrs} = Map.pop(attrs, :privacy_mode, :private)
    {role, attrs} = Map.pop(attrs, :role, :user)
    user = unconfirmed_user_fixture(attrs)

    token =
      extract_user_token(fn url ->
        Accounts.deliver_login_instructions(user, url)
      end)

    {:ok, {user, _expired_tokens}} =
      Accounts.login_user_by_magic_link(token)

    user
    |> maybe_update_user_privacy_mode(privacy_mode)
    |> maybe_update_user_role(role)
  end

  def user_scope_fixture do
    user = user_fixture()
    user_scope_fixture(user)
  end

  def user_scope_fixture(user) do
    Accounts.scope_for_user(user)
  end

  def set_password(user) do
    {:ok, {user, _expired_tokens}} =
      Accounts.update_user_password(user, %{password: valid_user_password()})

    user
  end

  def attach_phone_number(user, raw_phone_number, opts \\ []) do
    {:ok, user_phone_number} = Accounts.attach_user_phone_number(user, raw_phone_number, opts)
    user_phone_number
  end

  def attach_user_identity(user, provider, provider_uid, opts \\ []) do
    {:ok, user_identity} = Accounts.register_user_identity(user, provider, provider_uid, opts)
    user_identity
  end

  def upsert_contact_entry(user, attrs \\ %{}) do
    attrs =
      Enum.into(attrs, %{
        contact_client_id: :crypto.strong_rand_bytes(16),
        contact_name: "Fixture Contact",
        emails: [],
        phone_numbers: []
      })

    {:ok, contact_entry} = Accounts.upsert_user_contact_entry(user, attrs)
    contact_entry
  end

  def extract_user_token(fun) do
    {:ok, captured_email} = fun.(&"[TOKEN]#{&1}[TOKEN]")
    [_, token | _] = String.split(captured_email.text_body, "[TOKEN]")
    token
  end

  defp maybe_update_user_privacy_mode(user, :private), do: user

  defp maybe_update_user_privacy_mode(user, privacy_mode) do
    {:ok, updated_user} = Accounts.update_user_privacy_mode(user, privacy_mode)
    updated_user
  end

  defp maybe_update_user_role(user, :user), do: user

  defp maybe_update_user_role(user, role) do
    {:ok, updated_user} = Accounts.update_user_role(user, role)
    updated_user
  end

  def override_token_authenticated_at(token, authenticated_at) when is_binary(token) do
    {:ok, %{id: id}} = Tokens.decode_serialized_value(token)

    Repo.update_all(
      from(t in "users_tokens",
        where: field(t, :id) == type(^id, Ecto.UUID)
      ),
      set: [authenticated_at: authenticated_at]
    )
  end

  def generate_user_magic_link_token(user) do
    {:ok, %{token: encoded_token, user_token: user_token}} = Accounts.issue_magic_link_token(user)
    {encoded_token, user_token.secret_hash}
  end

  def offset_user_token(token, amount_to_add, unit) do
    dt = DateTime.add(DateTime.utc_now(), amount_to_add, unit)
    {:ok, %{id: id}} = Tokens.decode_serialized_value(token)

    Repo.update_all(
      from(ut in "users_tokens", where: field(ut, :id) == type(^id, Ecto.UUID)),
      set: [inserted_at: dt, authenticated_at: dt]
    )
  end
end

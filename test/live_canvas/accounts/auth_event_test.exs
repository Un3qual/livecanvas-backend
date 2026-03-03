defmodule LC.Accounts.AuthEventTest do
  use LC.DataCase

  import Ecto.Query
  import LC.AccountsFixtures

  alias LC.Accounts
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.AuthEvent

  describe "record_auth_event/2" do
    test "persists an event with user ownership and metadata" do
      user = user_fixture()

      assert {:ok, %AuthEvent{} = event} =
               Accounts.record_auth_event(
                 :password_login_succeeded,
                 user: user,
                 metadata: %{"transport" => "password"}
               )

      assert event.user_id == user.id
      assert event.event_type == :password_login_succeeded
      assert event.metadata == %{"transport" => "password"}
      assert is_binary(event.entropy_id)
    end

    test "persists anonymous auth events without a user id" do
      assert {:ok, %AuthEvent{} = event} =
               Accounts.record_auth_event(
                 :password_login_failed,
                 metadata: %{"reason" => "invalid_credentials"}
               )

      assert is_nil(event.user_id)
      assert event.event_type == :password_login_failed
      assert event.metadata == %{"reason" => "invalid_credentials"}
    end
  end

  describe "list_user_auth_events/2" do
    test "returns newest-first events for a user and respects the limit" do
      user = user_fixture()
      other_user = user_fixture()

      assert {:ok, _first} = Accounts.record_auth_event(:password_login_succeeded, user: user)
      Process.sleep(1)
      assert {:ok, _second} = Accounts.record_auth_event(:magic_link_login_succeeded, user: user)
      Process.sleep(1)
      assert {:ok, _other} = Accounts.record_auth_event(:refresh_token_revoked, user: other_user)
      Process.sleep(1)
      assert {:ok, _third} = Accounts.record_auth_event(:password_login_failed, user: user)

      events = Accounts.list_user_auth_events(user, limit: 2)

      assert length(events) == 2

      assert Enum.map(events, & &1.event_type) == [
               :password_login_failed,
               :magic_link_login_succeeded
             ]

      assert Enum.all?(events, &(&1.user_id == user.id))
    end
  end

  describe "auth flow audit emission" do
    test "emits password login success and failure events" do
      user = user_fixture() |> set_password()

      assert %{} = Accounts.get_user_by_email_and_password(user.email, valid_user_password())
      assert :password_login_succeeded == latest_user_event_type(user)

      assert is_nil(Accounts.get_user_by_email_and_password(user.email, "totally-wrong-password"))

      assert %AuthEvent{event_type: :password_login_failed, metadata: metadata} =
               latest_user_event(user)

      assert metadata["reason"] == "invalid_credentials"
      refute Enum.any?(Map.values(metadata), &(&1 == "totally-wrong-password"))
    end

    test "emits magic-link login success and failure events" do
      user = user_fixture()
      {token, _secret_hash} = generate_user_magic_link_token(user)

      assert {:ok, {_logged_in_user, _expired_tokens}} = Accounts.login_user_by_magic_link(token)
      assert :magic_link_login_succeeded == latest_user_event_type(user)

      assert {:error, :not_found} = Accounts.login_user_by_magic_link("invalid-token")

      assert %AuthEvent{event_type: :magic_link_login_failed, user_id: nil, metadata: metadata} =
               latest_anonymous_event(:magic_link_login_failed)

      assert metadata["reason"] == "not_found"
    end

    test "emits refresh token revocation only when a token is actually revoked" do
      user = user_fixture()
      {:ok, %{token: refresh_token}} = Accounts.issue_refresh_token(user)

      assert :ok = Accounts.revoke_refresh_token(refresh_token)
      assert :ok = Accounts.revoke_refresh_token(refresh_token)

      events =
        Accounts.list_user_auth_events(user, limit: 20)
        |> Enum.filter(&(&1.event_type == :refresh_token_revoked))

      assert length(events) == 1
    end
  end

  defp latest_user_event_type(user), do: latest_user_event(user).event_type

  defp latest_user_event(user) do
    [latest | _rest] = Accounts.list_user_auth_events(user, limit: 1)
    latest
  end

  defp latest_anonymous_event(event_type) do
    Repo.one!(
      from(event in AuthEvent,
        where: is_nil(event.user_id) and event.event_type == ^event_type,
        order_by: [desc: event.inserted_at, desc: event.id],
        limit: 1
      )
    )
  end
end

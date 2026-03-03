defmodule LC.Accounts.AuthEventTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.Accounts
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
end

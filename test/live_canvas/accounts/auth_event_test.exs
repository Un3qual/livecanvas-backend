defmodule LC.Accounts.AuthEventTest do
  use LC.DataCase

  import Ecto.Query
  import LC.AccountsFixtures

  alias LC.Accounts
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.AuthEvent

  @auth_telemetry_events [
    [:live_canvas, :accounts, :auth, :password_login_succeeded],
    [:live_canvas, :accounts, :auth, :password_login_failed],
    [:live_canvas, :accounts, :auth, :magic_link_login_succeeded],
    [:live_canvas, :accounts, :auth, :magic_link_login_failed],
    [:live_canvas, :accounts, :auth, :refresh_token_revoked],
    [:live_canvas, :accounts, :auth, :refresh_token_rotation_succeeded],
    [:live_canvas, :accounts, :auth, :refresh_token_rotation_failed],
    [:live_canvas, :accounts, :auth, :password_change_succeeded],
    [:live_canvas, :accounts, :auth, :password_change_failed],
    [:live_canvas, :accounts, :auth, :email_change_succeeded],
    [:live_canvas, :accounts, :auth, :email_change_failed],
    [:live_canvas, :accounts, :auth, :account_recovery_requested],
    [:live_canvas, :accounts, :auth, :account_recovery_succeeded],
    [:live_canvas, :accounts, :auth, :account_recovery_failed],
    [:live_canvas, :accounts, :auth, :provider_identity_unlink_succeeded],
    [:live_canvas, :accounts, :auth, :provider_identity_unlink_failed]
  ]

  setup do
    attach_auth_telemetry_handler()
    :ok
  end

  describe "record_auth_event/2" do
    test "persists an event with user ownership and metadata" do
      user = unconfirmed_user_fixture()

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
      user = unconfirmed_user_fixture()
      other_user = user_fixture()

      assert {:ok, _first} = Accounts.record_auth_event(:password_login_succeeded, user: user)
      Process.sleep(1)
      assert {:ok, _second} = Accounts.record_auth_event(:magic_link_login_succeeded, user: user)
      Process.sleep(1)
      assert {:ok, _other} = Accounts.record_auth_event(:refresh_token_revoked, user: other_user)
      Process.sleep(1)
      assert {:ok, _third} = Accounts.record_auth_event(:password_login_failed, user: user)

      events = Accounts.list_user_auth_events(user, limit: 2)

      assert [_, _] = events

      assert Enum.map(events, & &1.event_type) == [
               :password_login_failed,
               :magic_link_login_succeeded
             ]

      assert Enum.all?(events, &(&1.user_id == user.id))
    end

    test "falls back to default limit when limit is non-positive" do
      user = unconfirmed_user_fixture()

      for event_type <- [
            :password_login_succeeded,
            :magic_link_login_succeeded,
            :password_login_failed
          ] do
        assert {:ok, _event} = Accounts.record_auth_event(event_type, user: user)
        Process.sleep(1)
      end

      events = Accounts.list_user_auth_events(user, limit: 0)

      assert [_, _, _] = events

      assert Enum.map(events, & &1.event_type) == [
               :password_login_failed,
               :magic_link_login_succeeded,
               :password_login_succeeded
             ]
    end
  end

  describe "auth flow audit emission" do
    test "emits password login success and failure events" do
      user = user_fixture() |> set_password()

      assert %{} = Accounts.get_user_by_email_and_password(user.email, valid_user_password())
      assert :password_login_succeeded == latest_user_event_type(user)

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :password_login_succeeded], %{count: 1},
                      %{metadata: %{"method" => "password"}, user_id: user_id}}

      assert user_id == user.id

      assert is_nil(Accounts.get_user_by_email_and_password(user.email, "totally-wrong-password"))

      assert_receive {:telemetry_event, [:live_canvas, :accounts, :auth, :password_login_failed],
                      %{count: 1}, %{metadata: telemetry_metadata, user_id: user_id}}

      assert %AuthEvent{event_type: :password_login_failed, metadata: metadata} =
               latest_user_event(user)

      assert user_id == user.id
      assert telemetry_metadata["reason"] == "invalid_credentials"
      refute Enum.any?(Map.values(telemetry_metadata), &(&1 == "totally-wrong-password"))
      assert metadata["reason"] == "invalid_credentials"
      refute Enum.any?(Map.values(metadata), &(&1 == "totally-wrong-password"))
    end

    test "emits magic-link login success and failure events" do
      user = user_fixture()
      {token, _secret_hash} = generate_user_magic_link_token(user)

      assert {:ok, {_logged_in_user, _expired_tokens}} = Accounts.login_user_by_magic_link(token)
      assert :magic_link_login_succeeded == latest_user_event_type(user)

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :magic_link_login_succeeded], %{count: 1},
                      %{metadata: %{"method" => "magic_link"}, user_id: user_id}}

      assert user_id == user.id

      assert {:error, :not_found} = Accounts.login_user_by_magic_link("invalid-token")

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :magic_link_login_failed], %{count: 1},
                      %{metadata: telemetry_metadata, user_id: nil}}

      assert %AuthEvent{event_type: :magic_link_login_failed, user_id: nil, metadata: metadata} =
               latest_anonymous_event(:magic_link_login_failed)

      assert telemetry_metadata["reason"] == "not_found"
      assert metadata["reason"] == "not_found"
    end

    test "emits refresh token revocation only when a token is actually revoked" do
      user = user_fixture()
      {:ok, %{token: refresh_token}} = Accounts.issue_refresh_token(user)

      assert :ok = Accounts.revoke_refresh_token(refresh_token)

      assert_receive {:telemetry_event, [:live_canvas, :accounts, :auth, :refresh_token_revoked],
                      %{count: 1}, %{metadata: %{"context" => "refresh_token"}, user_id: user_id}}

      assert user_id == user.id
      assert :ok = Accounts.revoke_refresh_token(refresh_token)

      refute_receive {:telemetry_event, [:live_canvas, :accounts, :auth, :refresh_token_revoked],
                      %{count: 1}, _metadata}

      events =
        Accounts.list_user_auth_events(user, limit: 20)
        |> Enum.filter(&(&1.event_type == :refresh_token_revoked))

      assert [_] = events
    end

    test "emits refresh-token rotation success and failure events" do
      user = user_fixture()
      {:ok, %{token: refresh_token}} = Accounts.issue_refresh_token(user)

      assert {:ok, %{access_token: _access_token, refresh_token: _fresh_refresh_token}} =
               Accounts.rotate_refresh_token(refresh_token)

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :refresh_token_rotation_succeeded],
                      %{count: 1}, %{metadata: telemetry_metadata, user_id: user_id}}

      assert user_id == user.id
      assert telemetry_metadata["outcome"] == "rotated"

      assert [:refresh_token_rotation_succeeded] =
               user
               |> Accounts.list_user_auth_events(limit: 10)
               |> Enum.filter(&(&1.event_type == :refresh_token_rotation_succeeded))
               |> Enum.map(& &1.event_type)

      assert {:error, :invalid_token} = Accounts.rotate_refresh_token("bad-token")

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :refresh_token_rotation_failed],
                      %{count: 1}, %{metadata: telemetry_metadata, user_id: nil}}

      assert %AuthEvent{
               event_type: :refresh_token_rotation_failed,
               user_id: nil,
               metadata: metadata
             } =
               latest_anonymous_event()

      assert telemetry_metadata["reason"] == "invalid_token"
      assert metadata["reason"] == "invalid_token"
    end

    test "emits password-change success and failure events" do
      user = user_fixture()

      assert {:ok, {_updated_user, _expired_tokens}} =
               Accounts.update_user_password(user, %{password: "new valid password"})

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :password_change_succeeded], %{count: 1},
                      %{metadata: %{"method" => "password"}, user_id: user_id}}

      assert user_id == user.id

      assert [:password_change_succeeded] =
               user
               |> Accounts.list_user_auth_events(limit: 10)
               |> Enum.filter(&(&1.event_type == :password_change_succeeded))
               |> Enum.map(& &1.event_type)

      assert {:error, _changeset} =
               Accounts.update_user_password(user, %{
                 password: "too short",
                 password_confirmation: "mismatch"
               })

      assert_receive {:telemetry_event, [:live_canvas, :accounts, :auth, :password_change_failed],
                      %{count: 1}, %{metadata: telemetry_metadata, user_id: ^user_id}}

      assert %AuthEvent{event_type: :password_change_failed, user_id: user_id, metadata: metadata} =
               latest_user_event(user)

      assert user_id == user.id
      assert telemetry_metadata["reason"] == "validation_failed"
      assert metadata["reason"] == "validation_failed"
      refute Enum.any?(Map.values(metadata), &(&1 == "too short"))
    end

    test "emits email-change success and failure events" do
      user = unconfirmed_user_fixture()
      new_email = unique_user_email()

      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_update_email_instructions(
            %{user | email: new_email},
            user.email,
            url
          )
        end)

      assert {:ok, %{email: ^new_email}} = Accounts.update_user_email(user, token)

      assert_receive {:telemetry_event, [:live_canvas, :accounts, :auth, :email_change_succeeded],
                      %{count: 1},
                      %{metadata: %{"method" => "email_verification_token"}, user_id: user_id}}

      assert user_id == user.id

      assert [:email_change_succeeded] =
               user
               |> Accounts.list_user_auth_events(limit: 10)
               |> Enum.filter(&(&1.event_type == :email_change_succeeded))
               |> Enum.map(& &1.event_type)

      assert {:error, :transaction_aborted} = Accounts.update_user_email(user, "bad-token")

      assert_receive {:telemetry_event, [:live_canvas, :accounts, :auth, :email_change_failed],
                      %{count: 1}, %{metadata: telemetry_metadata, user_id: ^user_id}}

      assert %AuthEvent{event_type: :email_change_failed, user_id: user_id, metadata: metadata} =
               latest_user_event(user)

      assert user_id == user.id
      assert telemetry_metadata["reason"] == "transaction_aborted"
      assert metadata["reason"] == "transaction_aborted"
    end

    test "emits account recovery request, success, and failure events" do
      user = user_fixture()

      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_reset_password_instructions(user, url)
        end)

      assert is_binary(token)

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :account_recovery_requested], %{count: 1},
                      %{metadata: %{"method" => "password_reset_token"}, user_id: user_id}}

      assert user_id == user.id
      assert :account_recovery_requested == latest_user_event_type(user)

      assert {:ok, {_updated_user, _expired_tokens}} =
               Accounts.reset_user_password(token, %{password: "an even newer password"})

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :account_recovery_succeeded], %{count: 1},
                      %{metadata: %{"method" => "password_reset_token"}, user_id: ^user_id}}

      assert [:account_recovery_succeeded] =
               user
               |> Accounts.list_user_auth_events(limit: 10)
               |> Enum.filter(&(&1.event_type == :account_recovery_succeeded))
               |> Enum.map(& &1.event_type)

      assert {:error, :not_found} =
               Accounts.reset_user_password("invalid-password-reset-token", %{
                 password: "another new password"
               })

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :account_recovery_failed], %{count: 1},
                      %{metadata: telemetry_metadata, user_id: nil}}

      assert %AuthEvent{
               event_type: :account_recovery_failed,
               user_id: nil,
               metadata: metadata
             } = latest_anonymous_event(:account_recovery_failed)

      assert telemetry_metadata["reason"] == "not_found"
      assert metadata["reason"] == "not_found"
      refute Enum.any?(Map.values(metadata), &(&1 == "invalid-password-reset-token"))
    end

    test "emits provider identity unlink success and failure events" do
      user = user_fixture()
      identity = attach_user_identity(user, :google_provider, "google-auth-event-unlink")

      assert {:ok, _revoked_identity} = Accounts.unlink_user_identity(user, identity.id)

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :provider_identity_unlink_succeeded],
                      %{count: 1},
                      %{metadata: %{"provider" => "google_provider"}, user_id: user_id}}

      assert user_id == user.id

      assert [:provider_identity_unlink_succeeded] =
               user
               |> Accounts.list_user_auth_events(limit: 10)
               |> Enum.filter(&(&1.event_type == :provider_identity_unlink_succeeded))
               |> Enum.map(& &1.event_type)

      assert {:error, :already_revoked} = Accounts.unlink_user_identity(user, identity.id)

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :provider_identity_unlink_failed],
                      %{count: 1}, %{metadata: telemetry_metadata, user_id: ^user_id}}

      assert telemetry_metadata["reason"] == "already_revoked"
      refute Enum.any?(Map.values(telemetry_metadata), &(&1 == "google-auth-event-unlink"))

      assert %AuthEvent{
               event_type: :provider_identity_unlink_failed,
               user_id: ^user_id,
               metadata: metadata
             } = latest_user_event(user)

      assert metadata["reason"] == "already_revoked"
      refute Enum.any?(Map.values(metadata), &(&1 == "google-auth-event-unlink"))

      assert {:error, :not_found} = Accounts.unlink_user_identity(user, 9_999_991)

      assert_receive {:telemetry_event,
                      [:live_canvas, :accounts, :auth, :provider_identity_unlink_failed],
                      %{count: 1}, %{metadata: not_found_metadata, user_id: ^user_id}}

      assert not_found_metadata["reason"] == "not_found"
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

  defp latest_anonymous_event do
    Repo.one!(
      from(event in AuthEvent,
        where: is_nil(event.user_id),
        order_by: [desc: event.inserted_at, desc: event.id],
        limit: 1
      )
    )
  end

  defp attach_auth_telemetry_handler do
    test_pid = self()
    handler_id = "auth-event-test-#{System.unique_integer([:positive, :monotonic])}"

    :ok =
      :telemetry.attach_many(
        handler_id,
        @auth_telemetry_events,
        &__MODULE__.handle_auth_telemetry_event/4,
        test_pid
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)
  end

  @spec handle_auth_telemetry_event([atom()], map(), map(), pid()) :: :ok
  def handle_auth_telemetry_event(event, measurements, metadata, test_pid)
      when is_list(event) and is_map(measurements) and is_map(metadata) and is_pid(test_pid) do
    send(test_pid, {:telemetry_event, event, measurements, metadata})
    :ok
  end
end

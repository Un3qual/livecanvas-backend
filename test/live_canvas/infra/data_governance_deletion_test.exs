defmodule LC.Infra.DataGovernanceDeletionTest do
  use LC.DataCase, async: true

  import Ecto.Query
  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Chat, Content, Live}
  alias LC.Infra.DataGovernance
  alias LCSchemas.Accounts.{AuthEvent, User}
  alias LCSchemas.Chat.ChatMessage
  alias LCSchemas.Content.{MediaAsset, Post}
  alias LCSchemas.Infra.{AccountDeletionRequest, AsyncJob}
  alias LCSchemas.Live.{LiveParticipant, LiveSession}
  alias LCSchemas.Social.{Block, Follow, Mute}

  describe "request_account_deletion/2" do
    test "schedules one active deletion request and one async job per viewer" do
      user = user_fixture()

      assert {:ok, first_request} =
               DataGovernance.request_account_deletion(user, grace_period_seconds: 3_600)

      assert first_request.user_id == user.id
      assert first_request.status == :scheduled
      assert match?(%DateTime{}, first_request.requested_at)
      assert match?(%DateTime{}, first_request.scheduled_purge_at)

      assert DateTime.compare(first_request.scheduled_purge_at, first_request.requested_at) in [
               :gt,
               :eq
             ]

      assert {:ok, deduped_request} =
               DataGovernance.request_account_deletion(user, grace_period_seconds: 3_600)

      assert deduped_request.id == first_request.id
      assert Repo.aggregate(AccountDeletionRequest, :count, :id) == 1
      assert Repo.aggregate(AsyncJob, :count, :id) == 1

      [job] =
        Repo.all(
          from(async_job in AsyncJob,
            where: async_job.kind == "account_deletion_request",
            order_by: [desc: async_job.inserted_at, desc: async_job.id]
          )
        )

      assert job.payload["account_deletion_request_id"] == first_request.id
      assert job.status == :pending
    end
  end

  describe "cancel_account_deletion_request/2" do
    test "allows cancellation only for pending or scheduled requests" do
      user = user_fixture()
      outsider = user_fixture()

      assert {:ok, first_request} =
               DataGovernance.request_account_deletion(user, grace_period_seconds: 3_600)

      assert {:ok, canceled_request} =
               DataGovernance.cancel_account_deletion_request(user, first_request.id)

      assert canceled_request.status == :canceled
      assert match?(%DateTime{}, canceled_request.completed_at)

      assert {:error, :cannot_cancel} =
               DataGovernance.cancel_account_deletion_request(user, first_request.id)

      assert {:ok, second_request} =
               DataGovernance.request_account_deletion(user, grace_period_seconds: 3_600)

      refute second_request.id == first_request.id

      mark_request_status!(second_request.id, :processing)

      assert {:error, :already_processing} =
               DataGovernance.cancel_account_deletion_request(user, second_request.id)

      assert {:error, :not_found} =
               DataGovernance.cancel_account_deletion_request(outsider, second_request.id)
    end
  end

  describe "deletion async handler" do
    test "transitions scheduled requests to completed while hard deletion is stubbed" do
      user = user_fixture()
      other_user = user_fixture()
      third_user = user_fixture()

      follow = accepted_follow_fixture(user, other_user)
      block = block_fixture(user, third_user)
      mute = mute_fixture(user, other_user)

      assert {:ok, post} =
               Content.create_post(user, %{body_text: "queued for deletion", kind: :standard})

      assert {:ok, media_asset} =
               Content.create_media_asset(user, %{
                 post_id: post.id,
                 mime_type: "image/jpeg",
                 storage_key: "uploads/stubbed-delete.jpg"
               })

      assert {:ok, session} = Live.start_live_session(user, %{visibility: :public})
      assert {:ok, participant} = Live.join_live_session(session, other_user, :viewer)
      assert {:ok, message} = Chat.create_message(session, user, %{body: "pending deletion"})
      assert {:ok, refresh_token_payload} = Accounts.issue_refresh_token(user)

      assert {:ok, contact_entry} =
               Accounts.upsert_user_contact_entry(user, %{
                 contact_client_id: :crypto.strong_rand_bytes(16),
                 contact_name: "stubbed deletion contact",
                 emails: ["delete-me@example.com"],
                 phone_numbers: []
               })

      assert {:ok, request} =
               DataGovernance.request_account_deletion(user, grace_period_seconds: 0)

      job =
        Repo.one!(
          from(async_job in AsyncJob,
            where: async_job.kind == "account_deletion_request",
            order_by: [desc: async_job.inserted_at, desc: async_job.id]
          )
        )

      assert :ok = DataGovernance.Deletion.handle(job)
      assert :ok = DataGovernance.Deletion.handle(job)

      reloaded_request = Repo.get!(AccountDeletionRequest, request.id)
      assert reloaded_request.status == :completed
      assert match?(%DateTime{}, reloaded_request.completed_at)

      assert Repo.get!(User, user.id).id == user.id
      assert Repo.get!(Post, post.id).id == post.id
      assert Repo.get!(MediaAsset, media_asset.id).id == media_asset.id
      assert Repo.get!(LiveSession, session.id).id == session.id
      assert Repo.get!(LiveParticipant, participant.id).id == participant.id
      assert Repo.get!(ChatMessage, message.id).id == message.id
      assert Repo.get!(Follow, follow.id).id == follow.id
      assert Repo.get!(Block, block.id).id == block.id
      assert Repo.get!(Mute, mute.id).id == mute.id
      assert refresh_token_payload.token != ""
      assert contact_entry.contact_name == "stubbed deletion contact"

      auth_events =
        Repo.all(
          from(auth_event in AuthEvent,
            select: %{event_type: auth_event.event_type, metadata: auth_event.metadata},
            order_by: [asc: auth_event.inserted_at, asc: auth_event.id]
          )
        )

      auth_event_types = Enum.map(auth_events, & &1.event_type)

      assert :account_deletion_requested in auth_event_types
      assert :account_deletion_completed in auth_event_types

      assert Enum.any?(auth_events, fn auth_event ->
               auth_event.event_type == :account_deletion_completed and
                 auth_event.metadata["purge_mode"] == "stubbed"
             end)
    end
  end

  @spec mark_request_status!(pos_integer(), LCSchemas.Infra.account_deletion_request_status()) ::
          :ok
  defp mark_request_status!(request_id, status)
       when is_integer(request_id) and request_id > 0 and is_atom(status) do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    {_count, _rows} =
      Repo.update_all(
        from(request in AccountDeletionRequest, where: request.id == ^request_id),
        set: [
          status: status,
          updated_at: now,
          completed_at: if(status in [:completed, :canceled], do: now, else: nil)
        ]
      )

    :ok
  end
end

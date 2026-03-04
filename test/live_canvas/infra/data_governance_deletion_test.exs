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
    test "transitions scheduled requests to completed and purges user-owned rows" do
      user = user_fixture()
      other_user = user_fixture()
      third_user = user_fixture()

      _follow = accepted_follow_fixture(user, other_user)
      _block = block_fixture(user, third_user)
      _mute = mute_fixture(user, other_user)

      assert {:ok, post} = Content.create_post(user, %{body_text: "delete me", kind: :standard})

      assert {:ok, _media_asset} =
               Content.create_media_asset(user, %{
                 post_id: post.id,
                 mime_type: "image/jpeg",
                 storage_key: "uploads/delete-me.jpg"
               })

      assert {:ok, session} = Live.start_live_session(user, %{visibility: :public})
      assert {:ok, _participant} = Live.join_live_session(session, other_user, :viewer)
      assert {:ok, _message} = Chat.create_message(session, user, %{body: "goodbye"})
      assert {:ok, _refresh_token_payload} = Accounts.issue_refresh_token(user)

      assert {:ok, _contact_entry} =
               Accounts.upsert_user_contact_entry(user, %{
                 contact_client_id: :crypto.strong_rand_bytes(16),
                 contact_name: "to be deleted",
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

      assert is_nil(Repo.get(User, user.id))
      assert Repo.aggregate(Post, :count, :id) == 0
      assert Repo.aggregate(MediaAsset, :count, :id) == 0
      assert Repo.aggregate(LiveSession, :count, :id) == 0
      assert Repo.aggregate(LiveParticipant, :count, :id) == 0
      assert Repo.aggregate(ChatMessage, :count, :id) == 0
      assert Repo.aggregate(Follow, :count, :id) == 0
      assert Repo.aggregate(Block, :count, :id) == 0
      assert Repo.aggregate(Mute, :count, :id) == 0

      auth_event_types =
        Repo.all(
          from(auth_event in AuthEvent,
            select: auth_event.event_type,
            order_by: [asc: auth_event.inserted_at, asc: auth_event.id]
          )
        )

      assert :account_deletion_requested in auth_event_types
      assert :account_deletion_completed in auth_event_types
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

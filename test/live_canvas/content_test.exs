defmodule LC.ContentTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.{Accounts, Content, Live}
  alias LC.Content.MediaProcessingJob
  alias LCSchemas.Content.MediaAsset, as: MediaAssetSchema
  alias LCSchemas.Content.Post, as: PostSchema
  alias LCSchemas.Content.PostReport, as: PostReportSchema
  alias LCSchemas.Infra.{AsyncJob, WebhookEvent}
  alias LCSchemas.Live.LiveSession

  @story_ttl_seconds 24 * 60 * 60

  describe "create_post/2" do
    test "persists author-owned content" do
      author = user_fixture()
      attrs = %{body_text: "first post", kind: :standard}

      assert {:ok, post} = Content.create_post(author, attrs)
      assert post.author_id == author.id
      assert post.kind == :standard
      assert post.body_text == "first post"
      assert post.visibility == :followers
      assert is_binary(post.entropy_id)
    end

    test "attaches viewer-owned uploaded and processed media assets to a new post" do
      author = user_fixture()

      assert {:ok, uploaded_asset} =
               Content.create_media_asset(author, %{
                 storage_key: "uploads/users/#{author.id}/uploaded.jpg",
                 mime_type: "image/jpeg",
                 processing_state: :uploaded
               })

      assert {:ok, processed_asset} =
               Content.create_media_asset(author, %{
                 storage_key: "uploads/users/#{author.id}/processed.jpg",
                 mime_type: "image/jpeg",
                 processing_state: :processed
               })

      assert {:ok, post} =
               Content.create_post(author, %{
                 kind: :standard,
                 body_text: "with attachments",
                 media_asset_ids: [uploaded_asset.id, processed_asset.id]
               })

      attached_post = Repo.preload(post, :media_assets)

      assert Enum.sort(Enum.map(attached_post.media_assets, & &1.id)) ==
               Enum.sort([uploaded_asset.id, processed_asset.id])

      assert Repo.get!(MediaAssetSchema, uploaded_asset.id).post_id == post.id
      assert Repo.get!(MediaAssetSchema, processed_asset.id).post_id == post.id
    end

    test "rejects media assets owned by another viewer" do
      author = user_fixture()
      other_user = user_fixture()

      assert {:ok, other_asset} =
               Content.create_media_asset(other_user, %{
                 storage_key: "uploads/users/#{other_user.id}/other.jpg",
                 mime_type: "image/jpeg",
                 processing_state: :uploaded
               })

      assert {:error, %Ecto.Changeset{} = changeset} =
               Content.create_post(author, %{
                 kind: :standard,
                 body_text: "cross-account attach",
                 media_asset_ids: [other_asset.id]
               })

      assert %{media_asset_ids: ["must reference viewer-owned uploaded or processed assets"]} =
               errors_on(changeset)

      assert Repo.aggregate(PostSchema, :count, :id) == 0
      assert Repo.get!(MediaAssetSchema, other_asset.id).post_id == nil
    end

    test "rejects media assets that are not in a durable processing state" do
      author = user_fixture()

      assert {:ok, %{media_asset: pending_asset}} =
               Content.request_media_upload(author, %{mime_type: "image/jpeg"})

      assert {:ok, failed_asset} =
               Content.create_media_asset(author, %{
                 storage_key: "uploads/users/#{author.id}/failed.jpg",
                 mime_type: "image/jpeg",
                 processing_state: :failed
               })

      for media_asset_id <- [pending_asset.id, failed_asset.id] do
        assert {:error, %Ecto.Changeset{} = changeset} =
                 Content.create_post(author, %{
                   kind: :standard,
                   body_text: "invalid attachment",
                   media_asset_ids: [media_asset_id]
                 })

        assert %{media_asset_ids: ["must reference viewer-owned uploaded or processed assets"]} =
                 errors_on(changeset)
      end

      assert Repo.aggregate(PostSchema, :count, :id) == 0
      assert Repo.get!(MediaAssetSchema, pending_asset.id).post_id == nil
      assert Repo.get!(MediaAssetSchema, failed_asset.id).post_id == nil
    end

    test "defaults story posts to a bounded expiry window" do
      author = user_fixture()
      before_insert = DateTime.utc_now()

      assert {:ok, story_post} =
               Content.create_post(author, %{
                 kind: :story,
                 body_text: "story post"
               })

      after_insert = DateTime.utc_now()
      lower_bound = DateTime.add(before_insert, @story_ttl_seconds, :second)
      upper_bound = DateTime.add(after_insert, @story_ttl_seconds, :second)

      assert story_post.kind == :story
      assert %DateTime{} = story_post.expires_at
      assert DateTime.compare(story_post.expires_at, lower_bound) in [:eq, :gt]
      assert DateTime.compare(story_post.expires_at, upper_bound) in [:eq, :lt]
    end

    test "rejects explicit story expirations outside the allowed window" do
      author = user_fixture()
      past_expiration = DateTime.add(DateTime.utc_now(), -1, :second)
      far_future_expiration = DateTime.add(DateTime.utc_now(), @story_ttl_seconds + 1, :second)

      assert {:error, %Ecto.Changeset{} = past_changeset} =
               Content.create_post(author, %{
                 kind: :story,
                 body_text: "expired story",
                 expires_at: past_expiration
               })

      assert %{expires_at: ["must be in the future"]} = errors_on(past_changeset)

      assert {:error, %Ecto.Changeset{} = far_future_changeset} =
               Content.create_post(author, %{
                 kind: :story,
                 body_text: "permanent story",
                 expires_at: far_future_expiration
               })

      assert %{expires_at: ["must be within 24 hours"]} = errors_on(far_future_changeset)
    end
  end

  describe "create_media_asset/2" do
    test "stores object metadata without binary payload fields" do
      author = user_fixture()

      assert {:ok, asset} =
               Content.create_media_asset(author, %{
                 storage_key: "uploads/a.jpg",
                 mime_type: "image/jpeg"
               })

      assert asset.owner_id == author.id
      assert asset.storage_key == "uploads/a.jpg"
      assert asset.mime_type == "image/jpeg"
      assert asset.processing_state == :uploaded
      assert is_binary(asset.entropy_id)
      refute :binary_payload in Map.keys(asset)
    end
  end

  describe "update_user_post/3" do
    test "updates body_text and visibility for viewer-owned posts" do
      owner = user_fixture()
      {:ok, post} = Content.create_post(owner, %{kind: :standard, body_text: "before"})

      assert {:ok, updated_post} =
               Content.update_user_post(owner, post.id, %{
                 body_text: "after",
                 visibility: :public
               })

      assert updated_post.id == post.id
      assert updated_post.body_text == "after"
      assert updated_post.visibility == :public
      assert updated_post.kind == :standard
    end

    test "returns not_found when post does not belong to the viewer" do
      owner = user_fixture()
      other_user = user_fixture()
      {:ok, post} = Content.create_post(owner, %{kind: :standard, body_text: "before"})

      assert {:error, :not_found} =
               Content.update_user_post(other_user, post.id, %{body_text: "after"})
    end

    test "returns changeset errors for invalid update attrs" do
      owner = user_fixture()
      {:ok, post} = Content.create_post(owner, %{kind: :standard, body_text: "before"})
      oversized_body = String.duplicate("a", 5001)

      assert {:error, %Ecto.Changeset{} = changeset} =
               Content.update_user_post(owner, post.id, %{body_text: oversized_body})

      assert %{body_text: ["should be at most 5000 character(s)"]} = errors_on(changeset)
    end

    test "returns not_found for non-positive post ids" do
      owner = user_fixture()

      assert {:error, :not_found} = Content.update_user_post(owner, 0, %{body_text: "after"})
      assert {:error, :not_found} = Content.update_user_post(owner, -1, %{body_text: "after"})
    end
  end

  describe "delete_user_post/2" do
    test "deletes viewer-owned posts" do
      owner = user_fixture()
      {:ok, post} = Content.create_post(owner, %{kind: :standard, body_text: "to delete"})

      assert {:ok, deleted_post} = Content.delete_user_post(owner, post.id)
      assert deleted_post.id == post.id
      refute Repo.get(PostSchema, post.id)
    end

    test "returns not_found when post is not viewer-owned" do
      owner = user_fixture()
      other_user = user_fixture()
      {:ok, post} = Content.create_post(owner, %{kind: :standard, body_text: "to keep"})

      assert {:error, :not_found} = Content.delete_user_post(other_user, post.id)
      assert Repo.get(PostSchema, post.id)
    end

    test "returns not_found for non-positive post ids" do
      owner = user_fixture()

      assert {:error, :not_found} = Content.delete_user_post(owner, 0)
      assert {:error, :not_found} = Content.delete_user_post(owner, -1)
    end

    test "uses SET NULL for linked recording media asset deletion" do
      owner = user_fixture()
      {:ok, post} = Content.create_post(owner, %{kind: :standard, body_text: "recorded post"})

      assert {:ok, media_asset} =
               Content.create_media_asset(owner, %{
                 post_id: post.id,
                 storage_key: "uploads/users/#{owner.id}/recorded-post.mp4",
                 mime_type: "video/mp4",
                 processing_state: :uploaded
               })

      assert {:ok, session} = Live.start_live_session(owner, %{visibility: :followers})

      assert {:ok, ended_session} =
               Live.end_live_session(session, %{
                 ended_reason: :host_ended,
                 recording_media_asset_id: media_asset.id
               })

      assert Map.get(ended_session, :recording_media_asset_id) == media_asset.id

      constraint_rows =
        Repo.query!("""
        SELECT rc.delete_rule
        FROM information_schema.referential_constraints AS rc
        WHERE rc.constraint_schema = current_schema()
          AND rc.constraint_name = 'live_sessions_recording_media_asset_id_fkey'
        """).rows

      assert [["SET NULL"]] = constraint_rows

      assert {:ok, deleted_post} = Content.delete_user_post(owner, post.id)
      assert deleted_post.id == post.id
      refute Repo.get(MediaAssetSchema, media_asset.id)

      assert %LiveSession{recording_media_asset_id: nil} = Live.get_live_session!(session.id)
    end
  end

  describe "report_post/3" do
    test "creates one reporter-owned post report per viewer and post" do
      author = user_fixture()
      reporter = user_fixture()
      {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "report me"})

      assert {:ok, report} =
               Content.report_post(reporter, post, %{
                 reason: :spam,
                 details: "repeated promotional content"
               })

      assert report.reporter_id == reporter.id
      assert report.post_id == post.id
      assert report.reason == :spam
      assert report.details == "repeated promotional content"
      assert report.status == :open
      assert is_binary(report.entropy_id)

      assert {:ok, duplicate_report} =
               Content.report_post(reporter, post, %{
                 reason: :harassment,
                 details: "later duplicate"
               })

      assert duplicate_report.id == report.id
      assert duplicate_report.reason == :spam
      assert duplicate_report.details == "repeated promotional content"
    end

    test "rejects self reports and invalid report details" do
      author = user_fixture()
      {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "own post"})

      assert {:error, :own_post} = Content.report_post(author, post, %{reason: :spam})

      other_reporter = user_fixture()

      assert {:error, %Ecto.Changeset{} = changeset} =
               Content.report_post(other_reporter, post, %{
                 reason: :spam,
                 details: String.duplicate("x", 2001)
               })

      assert %{details: ["should be at most 2000 character(s)"]} = errors_on(changeset)
    end

    test "fetches reports only for the owning reporter" do
      author = user_fixture()
      reporter = user_fixture()
      other_user = user_fixture()
      {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "reported"})
      {:ok, report} = Content.report_post(reporter, post, %{reason: :other})

      assert %{id: report_id} = Content.get_user_post_report(reporter, report.id)
      assert report_id == report.id
      refute Content.get_user_post_report(other_user, report.id)
    end

    test "redacts staff review metadata from reporter-facing results" do
      author = user_fixture()
      reporter = user_fixture()
      staff = user_fixture()
      assert {:ok, _permission} = Accounts.grant_staff_permission(staff, :post_report_moderation)
      staff_scope = Accounts.scope_for_user(staff)

      {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "reported"})
      {:ok, report} = Content.report_post(reporter, post, %{reason: :other})

      assert {:ok, moderated_report} =
               Content.decide_post_report(staff_scope, report.id, %{
                 status: :reviewed,
                 decision_note: "internal moderation note"
               })

      assert moderated_report.reviewed_by_id == staff.id
      assert %DateTime{} = moderated_report.reviewed_at
      assert moderated_report.decision_note == "internal moderation note"

      assert reporter_report = Content.get_user_post_report(reporter, report.id)
      assert reporter_report.status == :reviewed
      assert is_nil(reporter_report.reviewed_by_id)
      assert is_nil(reporter_report.reviewed_at)
      assert is_nil(reporter_report.decision_note)

      assert {:ok, duplicate_report} = Content.report_post(reporter, post, %{reason: :spam})
      assert duplicate_report.id == report.id
      assert is_nil(duplicate_report.reviewed_by_id)
      assert is_nil(duplicate_report.reviewed_at)
      assert is_nil(duplicate_report.decision_note)
    end
  end

  describe "post report moderation" do
    test "lists and fetches reports only for staff moderators" do
      author = user_fixture()
      reporter = user_fixture()
      staff = user_fixture()
      nonstaff = user_fixture()

      assert {:ok, _permission} = Accounts.grant_staff_permission(staff, :post_report_moderation)
      staff_scope = Accounts.scope_for_user(staff)
      nonstaff_scope = Accounts.scope_for_user(nonstaff)

      {:ok, first_post} =
        Content.create_post(author, %{kind: :standard, body_text: "first reported"})

      {:ok, second_post} =
        Content.create_post(author, %{kind: :standard, body_text: "second reported"})

      {:ok, first_report} = Content.report_post(reporter, first_post, %{reason: :spam})
      {:ok, second_report} = Content.report_post(reporter, second_post, %{reason: :other})

      assert {:ok, query} =
               Content.list_post_reports_for_moderation(staff_scope, status: :open)

      assert {:ok, open_reports} =
               Content.run_post_reports_moderation_query(staff_scope, query)

      assert [first_report.id, second_report.id] == Enum.map(open_reports, & &1.id)

      assert {:ok, dismissed_report} =
               Content.decide_post_report(staff_scope, second_report.id, %{
                 status: :dismissed,
                 decision_note: "not a violation"
               })

      assert {:ok, dismissed_query} =
               Content.list_post_reports_for_moderation(staff_scope, %{"status" => "dismissed"})

      assert {:ok, dismissed_reports} =
               Content.run_post_reports_moderation_query(staff_scope, dismissed_query)

      assert [dismissed_report.id] == Enum.map(dismissed_reports, & &1.id)

      assert {:ok, fetched_report} =
               Content.get_moderation_post_report(staff_scope, first_report.id)

      assert fetched_report.id == first_report.id

      assert {:error, :not_authorized} =
               Content.list_post_reports_for_moderation(nonstaff_scope, status: :open)

      assert {:error, :not_authorized} =
               Content.get_moderation_post_report(nonstaff_scope, first_report.id)

      assert {:error, :not_authorized} =
               Content.list_post_reports_for_moderation(nil, status: :open)

      assert {:error, :not_authorized} =
               Content.run_post_reports_moderation_query(nonstaff_scope, query)
    end

    test "does not expose a generic public query runner" do
      staff = user_fixture()
      assert {:ok, _permission} = Accounts.grant_staff_permission(staff, :post_report_moderation)
      staff_scope = Accounts.scope_for_user(staff)

      refute function_exported?(Content, :run_query, 1)
      refute function_exported?(Content, :run_post_reports_moderation_query, 1)

      assert_raise ArgumentError, ~r/authorized post report moderation query/, fn ->
        Content.run_post_reports_moderation_query(staff_scope, from(post in PostSchema))
      end
    end

    test "records allowed decisions and keeps terminal report states closed" do
      author = user_fixture()
      reporter = user_fixture()
      staff = user_fixture()
      finalizer = user_fixture()
      assert {:ok, _permission} = Accounts.grant_staff_permission(staff, :post_report_moderation)

      assert {:ok, _permission} =
               Accounts.grant_staff_permission(finalizer, :post_report_moderation)

      staff_scope = Accounts.scope_for_user(staff)
      finalizer_scope = Accounts.scope_for_user(finalizer)

      {:ok, first_post} =
        Content.create_post(author, %{kind: :standard, body_text: "review then dismiss"})

      {:ok, second_post} =
        Content.create_post(author, %{kind: :standard, body_text: "direct action"})

      {:ok, third_post} =
        Content.create_post(author, %{kind: :standard, body_text: "direct dismiss"})

      {:ok, first_report} = Content.report_post(reporter, first_post, %{reason: :spam})
      {:ok, second_report} = Content.report_post(reporter, second_post, %{reason: :hate})
      {:ok, third_report} = Content.report_post(reporter, third_post, %{reason: :other})

      assert {:ok, reviewed_report} =
               Content.decide_post_report(staff_scope, first_report.id, %{
                 status: :reviewed,
                 decision_note: "needs another look"
               })

      assert reviewed_report.status == :reviewed
      assert reviewed_report.reviewed_by_id == staff.id
      assert %DateTime{} = reviewed_at = reviewed_report.reviewed_at
      assert reviewed_report.decision_note == "needs another look"

      assert {:ok, dismissed_after_review} =
               Content.decide_post_report(finalizer_scope, first_report.id, %{
                 status: :dismissed,
                 decision_note: "not a violation"
               })

      assert dismissed_after_review.status == :dismissed
      assert dismissed_after_review.reviewed_by_id == staff.id
      assert dismissed_after_review.reviewed_at == reviewed_at
      assert dismissed_after_review.decision_note == "needs another look"

      assert {:ok, actioned_report} =
               Content.decide_post_report(staff_scope, second_report.id, %{
                 status: :actioned,
                 decision_note: "policy action tracked elsewhere"
               })

      assert actioned_report.status == :actioned
      assert Content.get_post(second_post.id).body_text == "direct action"

      assert {:error, :invalid_transition} =
               Content.decide_post_report(staff_scope, actioned_report.id, %{status: :dismissed})

      assert {:ok, dismissed_report} =
               Content.decide_post_report(staff_scope, third_report.id, %{status: :dismissed})

      assert {:error, :invalid_transition} =
               Content.decide_post_report(staff_scope, dismissed_report.id, %{status: :actioned})
    end

    test "finalizes reviewed reports when reviewer metadata was nilified" do
      author = user_fixture()
      reporter = user_fixture()
      reviewer = user_fixture()
      finalizer = user_fixture()

      assert {:ok, _permission} =
               Accounts.grant_staff_permission(reviewer, :post_report_moderation)

      assert {:ok, _permission} =
               Accounts.grant_staff_permission(finalizer, :post_report_moderation)

      reviewer_scope = Accounts.scope_for_user(reviewer)
      finalizer_scope = Accounts.scope_for_user(finalizer)

      {:ok, post} =
        Content.create_post(author, %{kind: :standard, body_text: "reviewer deleted"})

      {:ok, report} = Content.report_post(reporter, post, %{reason: :other})

      assert {:ok, reviewed_report} =
               Content.decide_post_report(reviewer_scope, report.id, %{
                 status: :reviewed,
                 decision_note: "needs final pass"
               })

      stale_reviewed_at = DateTime.add(DateTime.utc_now(), -3600, :second)

      {1, nil} =
        Repo.update_all(
          from(post_report in PostReportSchema, where: post_report.id == ^reviewed_report.id),
          set: [reviewed_by_id: nil, reviewed_at: stale_reviewed_at]
        )

      assert {:ok, dismissed_report} =
               Content.decide_post_report(finalizer_scope, reviewed_report.id, %{
                 status: :dismissed
               })

      assert dismissed_report.status == :dismissed
      assert dismissed_report.reviewed_by_id == finalizer.id
      assert DateTime.compare(dismissed_report.reviewed_at, stale_reviewed_at) == :gt
      assert dismissed_report.decision_note == "needs final pass"
    end

    test "accepts params-style string decision statuses and separates invalid status input" do
      author = user_fixture()
      reporter = user_fixture()
      staff = user_fixture()
      assert {:ok, _permission} = Accounts.grant_staff_permission(staff, :post_report_moderation)
      staff_scope = Accounts.scope_for_user(staff)

      {:ok, first_post} =
        Content.create_post(author, %{kind: :standard, body_text: "string decision"})

      {:ok, second_post} =
        Content.create_post(author, %{kind: :standard, body_text: "invalid decision"})

      {:ok, first_report} = Content.report_post(reporter, first_post, %{reason: :spam})
      {:ok, second_report} = Content.report_post(reporter, second_post, %{reason: :spam})

      assert {:ok, dismissed_report} =
               Content.decide_post_report(staff_scope, first_report.id, %{
                 "status" => "dismissed",
                 "decision_note" => "params-style status"
               })

      assert dismissed_report.status == :dismissed
      assert dismissed_report.decision_note == "params-style status"

      assert {:error, :invalid_status} =
               Content.decide_post_report(staff_scope, second_report.id, %{
                 "status" => "archived"
               })
    end

    test "rejects nonstaff decisions" do
      author = user_fixture()
      reporter = user_fixture()
      nonstaff = user_fixture()
      {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "reported"})
      {:ok, report} = Content.report_post(reporter, post, %{reason: :spam})

      assert {:error, :not_authorized} =
               Content.decide_post_report(Accounts.scope_for_user(nonstaff), report.id, %{
                 status: :dismissed
               })
    end
  end

  describe "request_media_upload/2" do
    test "creates pending upload metadata with a server-generated storage key" do
      author = user_fixture()

      assert {:ok, %{media_asset: asset, upload: upload}} =
               Content.request_media_upload(author, %{
                 mime_type: "image/jpeg",
                 storage_key: "client-controlled.jpg"
               })

      assert asset.owner_id == author.id
      assert asset.mime_type == "image/jpeg"
      assert asset.processing_state == :pending_upload
      assert is_binary(asset.entropy_id)
      assert String.starts_with?(asset.storage_key, "uploads/users/#{author.id}/")
      refute asset.storage_key == "client-controlled.jpg"

      assert upload.method == :put
      assert upload.url == "https://object-storage.invalid/#{asset.storage_key}"
      assert upload.headers["content-type"] == "image/jpeg"
      assert %DateTime{} = upload.expires_at
    end

    test "returns changeset errors when mime type is missing" do
      author = user_fixture()

      assert {:error, %Ecto.Changeset{} = changeset} = Content.request_media_upload(author, %{})
      assert %{mime_type: ["can't be blank"]} = errors_on(changeset)
    end
  end

  describe "media_asset_public_url/1" do
    test "returns canonical public URL for a persisted media asset" do
      owner = user_fixture()

      assert {:ok, %{media_asset: media_asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert {:ok, public_url} = Content.media_asset_public_url(media_asset)
      assert public_url == "https://object-storage.invalid/#{media_asset.storage_key}"
    end

    test "returns invalid_storage_key when storage key is missing" do
      assert {:error, :invalid_storage_key} =
               Content.media_asset_public_url(%MediaAssetSchema{storage_key: nil})
    end
  end

  describe "finalize_media_upload/3" do
    test "finalizes a viewer-owned pending upload and enqueues async processing" do
      owner = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert asset.processing_state == :pending_upload

      assert {:ok, finalized_asset} =
               Content.finalize_media_upload(owner, asset.id, %{width: 1080, height: 1920})

      assert finalized_asset.id == asset.id
      assert finalized_asset.processing_state == :uploaded
      assert finalized_asset.width == 1080
      assert finalized_asset.height == 1920

      assert Repo.aggregate(AsyncJob, :count, :id) == 1

      async_job = Repo.one!(AsyncJob)
      assert async_job.kind == "media_asset_processing"
      assert async_job.payload == %{"media_asset_id" => asset.id}
      assert async_job.dedupe_key == "media_asset_processing:#{asset.id}"
      assert async_job.max_attempts == 2
    end

    test "returns not found for non-owners" do
      owner = user_fixture()
      other_user = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert {:error, :not_found} = Content.finalize_media_upload(other_user, asset.id, %{})
    end

    test "is idempotent when finalize is called repeatedly for the same upload" do
      owner = user_fixture()

      assert {:ok, %{media_asset: asset}} =
               Content.request_media_upload(owner, %{mime_type: "image/jpeg"})

      assert {:ok, uploaded_asset} = Content.finalize_media_upload(owner, asset.id, %{})
      assert uploaded_asset.processing_state == :uploaded

      assert {:ok, uploaded_asset_again} = Content.finalize_media_upload(owner, asset.id, %{})
      assert uploaded_asset_again.id == uploaded_asset.id
      assert uploaded_asset_again.processing_state == :uploaded

      assert Repo.aggregate(AsyncJob, :count, :id) == 1
    end

    test "enqueues async processing for already-uploaded rows during finalize recovery" do
      owner = user_fixture()

      assert {:ok, uploaded_asset} =
               Content.create_media_asset(owner, %{
                 storage_key: "uploads/users/#{owner.id}/already-uploaded.jpg",
                 mime_type: "image/jpeg",
                 processing_state: :uploaded
               })

      assert {:ok, finalized_asset} = Content.finalize_media_upload(owner, uploaded_asset.id, %{})
      assert finalized_asset.processing_state == :uploaded
      assert Repo.aggregate(AsyncJob, :count, :id) == 1
    end

    test "processing handler accepts atom-key payload identifiers" do
      job = %AsyncJob{kind: "media_asset_processing", payload: %{media_asset_id: 9_999_999_999}}

      assert :ok = MediaProcessingJob.handle(job)
    end
  end

  describe "ingest_media_processing_webhook/2" do
    test "is idempotent for repeated provider event ids" do
      owner = user_fixture()

      assert {:ok, media_asset} =
               Content.create_media_asset(owner, %{
                 storage_key: "uploads/users/#{owner.id}/duplicate-webhook.jpg",
                 mime_type: "image/jpeg",
                 processing_state: :uploaded
               })

      payload = %{
        "event_type" => "media.processed",
        "media_asset_id" => media_asset.id,
        "processing_state" => "processed",
        "metadata" => %{"width" => 640, "height" => 480}
      }

      assert {:ok, :accepted} =
               Content.ingest_media_processing_webhook("evt_content_duplicate", payload)

      assert {:ok, :duplicate} =
               Content.ingest_media_processing_webhook("evt_content_duplicate", payload)

      assert Repo.aggregate(WebhookEvent, :count, :id) == 1
      assert Repo.aggregate(AsyncJob, :count, :id) == 1

      async_job = Repo.one!(AsyncJob)
      assert async_job.kind == "media_processing_webhook"
      assert async_job.dedupe_key == "webhook_event:media_processing:evt_content_duplicate"
    end
  end
end

defmodule LCGQL.Schema do
  use Absinthe.Schema

  use Absinthe.Relay.Schema,
    flavor: :modern

  alias LC.{Accounts, Chat, Content, Live, Social}

  # global_id_translator: SmokespotsGraphQL.IDTranslator
  import_types(Absinthe.Plug.Types)
  import_types(LCGQL.Accounts.Queries)
  import_types(LCGQL.Accounts.Types)
  import_types(LCGQL.Chat.Types)
  import_types(LCGQL.Content.Queries)
  import_types(LCGQL.Content.Types)
  import_types(LCGQL.Feed.Queries)
  import_types(LCGQL.Feed.Types)
  import_types(LCGQL.Social.Queries)
  import_types(LCGQL.Social.Types)
  # import_types LCGQL.Chat.Types

  query do
    node field do
      resolve(fn
        %{type: :user, id: id}, _resolution ->
          fetch_user_node(id)

        %{type: :user_identity, id: id}, resolution ->
          fetch_user_identity_node(id, resolution)

        %{type: :post, id: id}, _resolution ->
          fetch_post_node(id)

        %{type: :media_asset, id: id}, resolution ->
          fetch_media_asset_node(id, resolution)

        %{type: :live_session, id: id}, resolution ->
          fetch_live_session_node(id, resolution)

        %{type: :follow_request, id: id}, resolution ->
          fetch_follow_request_node(id, resolution)

        %{type: :chat_message, id: id}, resolution ->
          fetch_chat_message_node(id, resolution)

        %{type: :data_export_request, id: id}, resolution ->
          fetch_data_export_request_node(id, resolution)

        %{type: :account_deletion_request, id: id}, resolution ->
          fetch_account_deletion_request_node(id, resolution)

        %{type: :contact_match, id: id}, resolution ->
          fetch_contact_match_node(id, resolution)

        _arguments, _resolution ->
          {:ok, nil}
      end)
    end

    import_fields(:account_queries)
    import_fields(:content_queries)
    import_fields(:feed_queries)
    import_fields(:social_queries)

    # field :convo_lookup, non_null(:conversation) do
    #   arg :conversation_id, non_null(:string)

    #   resolve fn %{conversation_id: conversation_id}, _ -> {:ok, nil} end
    # end
  end

  node interface do
    resolve_type(fn
      %{provider_uid: _provider_uid, user_id: _user_id}, _resolution ->
        :user_identity

      %{privacy_mode: _privacy_mode, confirmed_at: _confirmed_at}, _resolution ->
        :user

      %{kind: _kind, visibility: _visibility, author_id: _author_id}, _resolution ->
        :post

      %{mime_type: _mime_type, processing_state: _processing_state, owner_id: _owner_id},
      _resolution ->
        :media_asset

      %{status: _status, format: _format, requested_at: _requested_at, user_id: _user_id},
      _resolution ->
        :data_export_request

      %{
        status: _status,
        requested_at: _requested_at,
        scheduled_purge_at: _scheduled_purge_at,
        user_id: _user_id
      },
      _resolution ->
        :account_deletion_request

      %{status: _status, visibility: _visibility, host_id: _host_id}, _resolution ->
        :live_session

      %{state: :requested, follower_id: _follower_id, followed_id: _followed_id}, _resolution ->
        :follow_request

      %{kind: _kind, metadata: _metadata, live_session_id: _live_session_id}, _resolution ->
        :chat_message

      %{contact_entry: %{contact_client_id: _contact_client_id}, matched_users: _matched_users},
      _resolution ->
        :contact_match

      _, _ ->
        nil
    end)
  end

  mutation do
    import_types(LCGQL.Accounts.Mutations)
    import_types(LCGQL.Chat.Mutations)
    import_types(LCGQL.Content.Mutations)
    import_types(LCGQL.Live.Mutations)
    import_types(LCGQL.Social.Mutations)
    import_fields(:account_mutations)
    import_fields(:chat_mutations)
    import_fields(:content_mutations)
    import_fields(:live_mutations)
    import_fields(:social_mutations)
  end

  # Node resolution crosses from GraphQL IDs into boundary APIs, so keep the
  # lookup logic centralized and failure-tolerant at the schema edge.
  defp fetch_user_node(id) do
    {:ok, Accounts.get_user!(id)}
  rescue
    Ecto.NoResultsError -> {:ok, nil}
  end

  # User-identity nodes are viewer-scoped and active-only to prevent global ID
  # refetch from exposing revoked or cross-account identity metadata.
  defp fetch_user_identity_node(id, %{context: %{current_scope: %{user: %{id: _id} = user}}}) do
    case Ecto.Type.cast(:id, id) do
      {:ok, local_id} when is_integer(local_id) and local_id > 0 ->
        {:ok, Accounts.get_active_user_identity(user, local_id)}

      _ ->
        {:ok, nil}
    end
  end

  defp fetch_user_identity_node(_id, _resolution), do: {:ok, nil}

  defp fetch_post_node(id) do
    {:ok, Content.get_post!(id)}
  rescue
    Ecto.NoResultsError -> {:ok, nil}
  end

  # Media-asset nodes are viewer-scoped to avoid exposing object keys across
  # accounts through globally refetchable IDs.
  defp fetch_media_asset_node(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}}) do
    case Ecto.Type.cast(:id, id) do
      {:ok, local_id} when is_integer(local_id) and local_id > 0 ->
        {:ok, Content.get_user_media_asset(viewer, local_id)}

      _ ->
        {:ok, nil}
    end
  end

  defp fetch_media_asset_node(_id, _resolution), do: {:ok, nil}

  # Globally refetchable live-session IDs must re-apply viewer visibility so
  # replay/history surfaces cannot bypass ownership checks via `node(id:)`
  # (`CWE-639` / IDOR).
  defp fetch_live_session_node(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}}) do
    with {:ok, local_id} when is_integer(local_id) and local_id > 0 <- Ecto.Type.cast(:id, id),
         %{status: _status} = live_session <- Live.get_live_session(local_id),
         :ok <- authorize_live_session_node_refetch(viewer, live_session) do
      {:ok, live_session}
    else
      _other -> {:ok, nil}
    end
  end

  defp fetch_live_session_node(_id, _resolution), do: {:ok, nil}

  defp authorize_live_session_node_refetch(viewer, %{status: :ended} = live_session) do
    Chat.authorize_history_access(viewer, live_session)
  end

  defp authorize_live_session_node_refetch(viewer, live_session) do
    Chat.authorize_join(viewer, live_session)
  end

  # Follow-request nodes are viewer-scoped because a pending request belongs to
  # the acted-on account and should not be globally enumerable or refetchable.
  defp fetch_follow_request_node(id, %{context: %{current_scope: %{user: %{id: _id} = user}}}) do
    case Ecto.Type.cast(:id, id) do
      {:ok, local_id} when is_integer(local_id) and local_id > 0 ->
        {:ok, Social.get_pending_follow_request(user, local_id)}

      _ ->
        {:ok, nil}
    end
  end

  defp fetch_follow_request_node(_id, _resolution), do: {:ok, nil}

  # Chat-message nodes are viewer-scoped because history remains readable after
  # a session ends, but only to viewers who still satisfy chat visibility rules.
  defp fetch_chat_message_node(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}}) do
    case Ecto.Type.cast(:id, id) do
      {:ok, local_id} when is_integer(local_id) and local_id > 0 ->
        {:ok, Chat.get_history_message(viewer, local_id)}

      _ ->
        {:ok, nil}
    end
  end

  defp fetch_chat_message_node(_id, _resolution), do: {:ok, nil}

  # Export-request nodes are viewer-scoped because they carry private governance
  # workflow metadata; node refetch enforces ownership through the auth scope.
  defp fetch_data_export_request_node(id, %{
         context: %{current_scope: %{user: %{id: _id} = user}}
       }) do
    case Ecto.Type.cast(:id, id) do
      {:ok, local_id} when is_integer(local_id) and local_id > 0 ->
        {:ok, Accounts.get_user_data_export_request(user, local_id)}

      _ ->
        {:ok, nil}
    end
  end

  defp fetch_data_export_request_node(_id, _resolution), do: {:ok, nil}

  # Deletion-request nodes are viewer-scoped because they contain private
  # governance workflow state and must not be globally enumerable.
  defp fetch_account_deletion_request_node(id, %{
         context: %{current_scope: %{user: %{id: _id} = user}}
       }) do
    case Ecto.Type.cast(:id, id) do
      {:ok, local_id} when is_integer(local_id) and local_id > 0 ->
        {:ok, Accounts.get_user_account_deletion_request(user, local_id)}

      _ ->
        {:ok, nil}
    end
  end

  defp fetch_account_deletion_request_node(_id, _resolution), do: {:ok, nil}

  # Contact-match nodes are viewer-scoped, so node refetch must enforce
  # ownership via the authenticated scope instead of exposing raw ids globally.
  defp fetch_contact_match_node(id, %{context: %{current_scope: %{user: %{id: _id} = user}}}) do
    case Ecto.Type.cast(:id, id) do
      {:ok, local_id} when is_integer(local_id) and local_id > 0 ->
        {:ok, Accounts.get_user_contact_match(user, local_id)}

      _ ->
        {:ok, nil}
    end
  end

  defp fetch_contact_match_node(_id, _resolution), do: {:ok, nil}
end

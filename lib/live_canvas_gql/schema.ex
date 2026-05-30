defmodule LCGQL.Schema do
  use Absinthe.Schema

  use Absinthe.Relay.Schema,
    flavor: :modern

  alias LC.{Accounts, Chat, Content, Feed, Live, Social}
  alias LCGQL.Dataloader
  alias LCGQL.Accounts.Resolver, as: AccountsResolver
  alias LCSchemas.Accounts.{User, UserContactEntry, UserIdentity}
  alias LCSchemas.Chat.ChatMessage
  alias LCSchemas.Content.{MediaAsset, Post, PostReport}
  alias LCSchemas.Infra.{AccountDeletionRequest, DataExportRequest}
  alias LCSchemas.Live.LiveSession
  alias LCSchemas.Social.Follow

  # global_id_translator: SmokespotsGraphQL.IDTranslator
  import_types(Absinthe.Plug.Types)
  import_types(LCGQL.MutationErrorTypes)
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

        %{type: :post, id: id}, resolution ->
          fetch_post_node(id, resolution)

        %{type: :media_asset, id: id}, resolution ->
          fetch_media_asset_node(id, resolution)

        %{type: :post_report, id: id}, resolution ->
          fetch_post_report_node(id, resolution)

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
      %UserIdentity{}, _resolution ->
        :user_identity

      %User{}, _resolution ->
        :user

      %Post{}, _resolution ->
        :post

      %MediaAsset{}, _resolution ->
        :media_asset

      %PostReport{}, _resolution ->
        :post_report

      %DataExportRequest{}, _resolution ->
        :data_export_request

      %AccountDeletionRequest{}, _resolution ->
        :account_deletion_request

      %LiveSession{}, _resolution ->
        :live_session

      %Follow{state: :requested}, _resolution ->
        :follow_request

      %ChatMessage{}, _resolution ->
        :chat_message

      %{id: id, contact_entry: %UserContactEntry{}, matched_users: matched_users}, _resolution ->
        if is_integer(id) and is_list(matched_users), do: :contact_match

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

  @impl true
  @spec plugins() :: [Absinthe.Plugin.t()]
  def plugins do
    [Absinthe.Middleware.Dataloader | Absinthe.Plugin.defaults()]
  end

  @impl true
  @spec context(map()) :: map()
  def context(context) do
    context
    |> Map.put_new(:auth_transport, :none)
    |> Map.put_new(:auth_error, nil)
    |> Map.put_new_lazy(:loader, fn -> Dataloader.new(context) end)
  end

  # Node resolution crosses from GraphQL IDs into boundary APIs, so keep the
  # lookup logic centralized and failure-tolerant at the schema edge.
  defp fetch_user_node(id) do
    with {:ok, local_id} <- cast_node_local_id(id) do
      {:ok, Accounts.get_user!(local_id)}
    else
      :error -> {:ok, nil}
    end
  rescue
    Ecto.NoResultsError -> {:ok, nil}
  end

  # User-identity nodes are viewer-scoped and active-only to prevent global ID
  # refetch from exposing revoked or cross-account identity metadata.
  defp fetch_user_identity_node(id, %{context: %{current_scope: %{user: %{id: _id} = user}}}) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Accounts.get_active_user_identity(user, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_user_identity_node(_id, _resolution), do: {:ok, nil}

  # Post nodes must re-apply feed visibility so Relay refetch cannot turn a
  # follower-only post ID into a shortcut around author visibility policy.
  defp fetch_post_node(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}}) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Feed.get_visible_post(viewer, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_post_node(id, _resolution) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Feed.get_visible_post(nil, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  # Media-asset nodes are viewer-scoped to avoid exposing object keys across
  # accounts through globally refetchable IDs.
  defp fetch_media_asset_node(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}}) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Content.get_user_media_asset(viewer, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_media_asset_node(_id, _resolution), do: {:ok, nil}

  # Post-report nodes are reporter-scoped because they describe moderation
  # complaints submitted by a specific viewer.
  defp fetch_post_report_node(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}}) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Content.get_user_post_report(viewer, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_post_report_node(_id, _resolution), do: {:ok, nil}

  # Globally refetchable live-session IDs must re-apply viewer visibility so
  # replay/history surfaces cannot bypass ownership checks via `node(id:)`
  # (`CWE-639` / IDOR).
  defp fetch_live_session_node(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}}) do
    with {:ok, local_id} <- cast_node_local_id(id),
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
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Social.get_pending_follow_request(user, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_follow_request_node(_id, _resolution), do: {:ok, nil}

  # Chat-message nodes are viewer-scoped because history remains readable after
  # a session ends, but only to viewers who still satisfy chat visibility rules.
  defp fetch_chat_message_node(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}}) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Chat.get_history_message(viewer, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_chat_message_node(_id, _resolution), do: {:ok, nil}

  # Export-request nodes are viewer-scoped because they carry private governance
  # workflow metadata; node refetch enforces ownership through the auth scope.
  defp fetch_data_export_request_node(id, %{
         context: %{current_scope: %{user: %{id: _id} = user}}
       }) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Accounts.get_user_data_export_request(user, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_data_export_request_node(_id, _resolution), do: {:ok, nil}

  # Deletion-request nodes are viewer-scoped because they contain private
  # governance workflow state and must not be globally enumerable.
  defp fetch_account_deletion_request_node(id, %{
         context: %{current_scope: %{user: %{id: _id} = user}}
       }) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        {:ok, Accounts.get_user_account_deletion_request(user, local_id)}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_account_deletion_request_node(_id, _resolution), do: {:ok, nil}

  # Contact-match nodes are viewer-scoped, so node refetch must enforce
  # ownership via the authenticated scope instead of exposing raw ids globally.
  defp fetch_contact_match_node(id, %{context: %{current_scope: %{user: %{id: _id} = user}}}) do
    case cast_node_local_id(id) do
      {:ok, local_id} ->
        contact_match =
          user
          |> Accounts.get_user_contact_match(local_id)
          |> maybe_contact_match_node()

        {:ok, contact_match}

      :error ->
        {:ok, nil}
    end
  end

  defp fetch_contact_match_node(_id, _resolution), do: {:ok, nil}

  @spec maybe_contact_match_node(Accounts.contact_match() | nil) ::
          AccountsResolver.contact_match_node() | nil
  defp maybe_contact_match_node(nil), do: nil

  defp maybe_contact_match_node(contact_match),
    do: AccountsResolver.contact_match_node(contact_match)

  @spec cast_node_local_id(term()) :: {:ok, integer()} | :error
  defp cast_node_local_id(value) do
    case Ecto.Type.cast(:id, value) do
      {:ok, local_id} when is_integer(local_id) -> {:ok, local_id}
      _other -> :error
    end
  end
end

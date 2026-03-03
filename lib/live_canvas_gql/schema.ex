defmodule LCGQL.Schema do
  use Absinthe.Schema

  use Absinthe.Relay.Schema,
    flavor: :modern

  alias LC.{Accounts, Content, Live}

  # global_id_translator: SmokespotsGraphQL.IDTranslator
  import_types(Absinthe.Plug.Types)
  import_types(LCGQL.Accounts.Queries)
  import_types(LCGQL.Accounts.Types)
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
        %{type: :user, id: id}, _resolution -> fetch_user_node(id)
        %{type: :user_identity, id: id}, _resolution -> fetch_user_identity_node(id)
        %{type: :post, id: id}, _resolution -> fetch_post_node(id)
        %{type: :live_session, id: id}, _resolution -> fetch_live_session_node(id)
        _arguments, _resolution -> {:ok, nil}
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

      %{status: _status, visibility: _visibility, host_id: _host_id}, _resolution ->
        :live_session

      %{contact_entry: %{contact_client_id: _contact_client_id}, matched_users: _matched_users},
      _resolution ->
        :contact_match

      _, _ ->
        nil
    end)
  end

  mutation do
    import_types(LCGQL.Accounts.Mutations)
    import_types(LCGQL.Content.Mutations)
    import_types(LCGQL.Social.Mutations)
    import_fields(:account_mutations)
    import_fields(:content_mutations)
    import_fields(:social_mutations)
  end

  # Node resolution crosses from GraphQL IDs into boundary APIs, so keep the
  # lookup logic centralized and failure-tolerant at the schema edge.
  defp fetch_user_node(id) do
    {:ok, Accounts.get_user!(id)}
  rescue
    Ecto.NoResultsError -> {:ok, nil}
  end

  defp fetch_user_identity_node(id) do
    {:ok, Accounts.get_user_identity!(id)}
  rescue
    Ecto.NoResultsError -> {:ok, nil}
  end

  defp fetch_post_node(id) do
    {:ok, Content.get_post!(id)}
  rescue
    Ecto.NoResultsError -> {:ok, nil}
  end

  defp fetch_live_session_node(id) do
    {:ok, Live.get_live_session!(id)}
  rescue
    Ecto.NoResultsError -> {:ok, nil}
  end
end

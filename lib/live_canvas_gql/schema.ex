defmodule LCGQL.Schema do
  use Absinthe.Schema

  use Absinthe.Relay.Schema,
    flavor: :modern

  # global_id_translator: SmokespotsGraphQL.IDTranslator
  import_types(Absinthe.Plug.Types)
  import_types(LCGQL.Accounts.Queries)
  import_types(LCGQL.Accounts.Types)
  import_types(LCGQL.Social.Queries)
  import_types(LCGQL.Social.Types)
  # import_types LCGQL.Chat.Types

  query do
    import_fields(:account_queries)
    import_fields(:social_queries)

    # field :convo_lookup, non_null(:conversation) do
    #   arg :conversation_id, non_null(:string)

    #   resolve fn %{conversation_id: conversation_id}, _ -> {:ok, nil} end
    # end
  end

  node interface do
    resolve_type(fn
      # %TechSupport.Accounts.User{}, _ ->
      #   :user
      _, _ ->
        nil
    end)
  end

  mutation do
    import_types(LCGQL.Accounts.Mutations)
    import_types(LCGQL.Social.Mutations)
    import_fields(:account_mutations)
    import_fields(:social_mutations)
  end
end

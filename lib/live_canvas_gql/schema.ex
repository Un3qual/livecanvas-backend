defmodule LiveCanvasGQL.Schema do
  use Absinthe.Schema

  use Absinthe.Relay.Schema,
    flavor: :modern

  # global_id_translator: SmokespotsGraphQL.IDTranslator
  import_types(Absinthe.Plug.Types)
  import_types(LiveCanvasGQL.Accounts.Queries)
  import_types(LiveCanvasGQL.Accounts.Types)
  # import_types LiveCanvasGQL.Chat.Types

  query do
    import_fields(:account_queries)

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
    import_types(LiveCanvasGQL.Accounts.Mutations)
    import_fields(:account_mutations)
  end
end

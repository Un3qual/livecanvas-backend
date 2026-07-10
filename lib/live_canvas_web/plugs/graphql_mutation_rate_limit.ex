defmodule LCWeb.Plugs.GraphQLMutationRateLimit do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn
  alias Absinthe.Blueprint

  alias Absinthe.Language.{
    Document,
    Field,
    Fragment,
    FragmentSpread,
    InlineFragment,
    OperationDefinition,
    SelectionSet
  }

  alias LC.RateLimiter

  @rate_limit_error_payload %{
    errors: [
      %{
        message: "rate_limited",
        extensions: %{code: "RATE_LIMITED"}
      }
    ]
  }

  @impl Plug
  @spec init(term()) :: term()
  def init(opts), do: opts

  @impl Plug
  @spec call(Plug.Conn.t(), term()) :: Plug.Conn.t()
  def call(conn, _opts) do
    case mutation_fields(conn) do
      {:ok, field_names} ->
        case allow_rate_limits(rate_limit_requests(field_names), RateLimiter.conn_subject(conn)) do
          :ok ->
            conn

          {:error, :rate_limited} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(:too_many_requests, Jason.encode!(@rate_limit_error_payload))
            |> halt()
        end

      :error ->
        conn
    end
  end

  @spec mutation_fields(Plug.Conn.t()) :: {:ok, [String.t()]} | :error
  defp mutation_fields(%Plug.Conn{
         method: "POST",
         request_path: "/graphql",
         params: params
       }) do
    with query when is_binary(query) <- Map.get(params, "query"),
         {:ok, field_names} <- selected_mutation_fields(query, operation_name(params)),
         false <- Enum.empty?(field_names) do
      {:ok, field_names}
    else
      _other -> :error
    end
  end

  defp mutation_fields(_conn), do: :error

  @type rate_limit_request ::
          {LC.RateLimiter.limit_key(), pos_integer()}
  @type rate_limit_requests :: [rate_limit_request()]

  @spec rate_limit_requests([String.t()]) :: rate_limit_requests()
  defp rate_limit_requests(field_names) when is_list(field_names) do
    auth_login_count = Enum.count(field_names, &auth_login_mutation?/1)
    moderation_count = Enum.count(field_names, &moderation_mutation?/1)
    generic_mutation_count = length(field_names) - auth_login_count - moderation_count

    []
    |> maybe_append_rate_limit(:auth_login, auth_login_count)
    |> maybe_append_rate_limit(:moderation_action, moderation_count)
    |> maybe_append_rate_limit(:graphql_mutation, if(generic_mutation_count > 0, do: 1, else: 0))
  end

  @spec allow_rate_limits(rate_limit_requests(), String.t()) :: :ok | {:error, :rate_limited}
  defp allow_rate_limits(rate_limit_requests, subject)
       when is_list(rate_limit_requests) and is_binary(subject) do
    Enum.reduce_while(rate_limit_requests, :ok, fn rate_limit_request, :ok ->
      case allow_rate_limit(rate_limit_request, subject) do
        :ok -> {:cont, :ok}
        {:error, :rate_limited} = error -> {:halt, error}
      end
    end)
  end

  @spec allow_rate_limit(rate_limit_request(), String.t()) :: :ok | {:error, :rate_limited}
  defp allow_rate_limit({limit_key, count}, subject)
       when is_atom(limit_key) and is_integer(count) and count > 0 and is_binary(subject) do
    # Mixed GraphQL root fields can trigger multiple sensitive behaviors in one
    # request, so charge each present bucket and consume one slot per matching
    # field instead of picking a single category for the whole document.
    Enum.reduce_while(1..count, :ok, fn _, :ok ->
      case RateLimiter.allow(limit_key, subject) do
        :ok -> {:cont, :ok}
        {:error, :rate_limited} = error -> {:halt, error}
      end
    end)
  end

  defp maybe_append_rate_limit(rate_limit_requests, _limit_key, count)
       when is_list(rate_limit_requests) and count <= 0,
       do: rate_limit_requests

  defp maybe_append_rate_limit(rate_limit_requests, limit_key, count)
       when is_list(rate_limit_requests) and is_atom(limit_key) and is_integer(count) do
    rate_limit_requests ++ [{limit_key, count}]
  end

  @spec auth_login_mutation?(String.t()) :: boolean()
  defp auth_login_mutation?(field_name), do: field_name in auth_login_mutation_names()

  @spec moderation_mutation?(String.t()) :: boolean()
  defp moderation_mutation?(field_name) when is_binary(field_name) do
    # Moderation writes can be high-impact/abusive and need tighter controls
    # than generic mutation traffic.
    field_name in moderation_mutation_names()
  end

  @spec selected_mutation_fields(String.t(), String.t() | nil) :: {:ok, [String.t()]} | :error
  defp selected_mutation_fields(query, operation_name) when is_binary(query) do
    with {:ok, %Blueprint{input: %Document{} = document}} <-
           Absinthe.Phase.Parse.run(%Blueprint{input: query}),
         %OperationDefinition{operation: :mutation, selection_set: %{selections: selections}} <-
           selected_operation(document, operation_name) do
      {:ok, collect_field_names(selections, Document.fragments_by_name(document))}
    else
      _other -> :error
    end
  end

  @spec selected_operation(Document.t(), String.t() | nil) :: OperationDefinition.t() | nil
  defp selected_operation(%Document{} = document, operation_name)
       when is_binary(operation_name) do
    case Document.get_operation(document, operation_name) do
      %OperationDefinition{operation: :mutation} = operation -> operation
      _other -> nil
    end
  end

  defp selected_operation(%Document{definitions: definitions}, nil) do
    case Enum.filter(definitions, &match?(%OperationDefinition{operation: :mutation}, &1)) do
      [%OperationDefinition{} = operation] -> operation
      _other -> nil
    end
  end

  @spec operation_name(map()) :: String.t() | nil
  defp operation_name(params) when is_map(params) do
    case Map.get(params, "operationName") do
      name when is_binary(name) and name != "" -> name
      _other -> nil
    end
  end

  @spec auth_login_mutation_names() :: [String.t()]
  # Removed auth field names intentionally fall through to the generic
  # mutation bucket so the limiter does not preserve retired transports.
  defp auth_login_mutation_names,
    do: ["logIn"]

  @spec moderation_mutation_names() :: [String.t()]
  defp moderation_mutation_names,
    do: [
      "blockUser",
      "unblockUser",
      "muteUser",
      "unmuteUser",
      "removeLiveChatMessageEvent",
      "editLiveChatMessage",
      "reportPost",
      "decidePostReport"
    ]

  @type fragment_definitions :: %{optional(String.t()) => Fragment.t()}
  @type selection_acc :: {[String.t()], MapSet.t(String.t())}
  @type mutation_selection :: Field.t() | FragmentSpread.t() | InlineFragment.t()

  @spec collect_field_names([mutation_selection()], fragment_definitions()) :: [String.t()]
  defp collect_field_names(selections, fragments)
       when is_list(selections) and is_map(fragments) do
    selections
    |> collect_field_names(fragments, MapSet.new())
    |> elem(0)
    |> Enum.reverse()
  end

  @spec collect_field_names(
          [mutation_selection()],
          fragment_definitions(),
          MapSet.t(String.t())
        ) :: selection_acc()
  defp collect_field_names(selections, fragments, visited_fragments)
       when is_list(selections) and is_map(fragments) do
    Enum.reduce(selections, {[], visited_fragments}, fn
      %Field{name: name}, {field_names, visited} when is_binary(name) ->
        {[name | field_names], visited}

      %InlineFragment{selection_set: %SelectionSet{selections: nested}}, {field_names, visited} ->
        merge_nested_field_names(field_names, visited, nested, fragments)

      %FragmentSpread{name: name}, {field_names, visited} when is_binary(name) ->
        if MapSet.member?(visited, name) do
          {field_names, visited}
        else
          case Map.get(fragments, name) do
            %Fragment{selection_set: %SelectionSet{selections: nested}} ->
              merge_nested_field_names(
                field_names,
                MapSet.put(visited, name),
                nested,
                fragments
              )

            _other ->
              {field_names, visited}
          end
        end

      _other, state ->
        state
    end)
  end

  @spec merge_nested_field_names(
          [String.t()],
          MapSet.t(String.t()),
          [mutation_selection()],
          fragment_definitions()
        ) :: selection_acc()
  defp merge_nested_field_names(field_names, visited, nested, fragments)
       when is_list(field_names) and is_list(nested) and is_map(fragments) do
    {nested_field_names, visited} = collect_field_names(nested, fragments, visited)
    {nested_field_names ++ field_names, visited}
  end
end

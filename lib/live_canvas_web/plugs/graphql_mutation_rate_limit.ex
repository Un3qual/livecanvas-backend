defmodule LCWeb.Plugs.GraphQLMutationRateLimit do
  @moduledoc false

  @behaviour Plug

  import Plug.Conn
  alias Absinthe.Blueprint
  alias Absinthe.Language.{Document, Field, OperationDefinition}

  alias LCWeb.RateLimiter

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
        case RateLimiter.allow(rate_limit_key(field_names), RateLimiter.conn_subject(conn)) do
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

  @spec rate_limit_key([String.t()]) :: :auth_login | :graphql_mutation | :moderation_action
  defp rate_limit_key(field_names) when is_list(field_names) do
    cond do
      Enum.any?(field_names, &auth_login_mutation?/1) -> :auth_login
      Enum.any?(field_names, &moderation_mutation?/1) -> :moderation_action
      true -> :graphql_mutation
    end
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
      {:ok, for(%Field{name: name} <- selections, is_binary(name), do: name)}
    else
      _other -> :error
    end
  end

  @spec selected_operation(Document.t(), String.t() | nil) :: OperationDefinition.t() | nil
  defp selected_operation(%Document{} = document, operation_name) when is_binary(operation_name) do
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
  defp auth_login_mutation_names,
    do: ["loginWithPassword", "requestMagicLinkLogin", "loginWithMagicLink"]

  @spec moderation_mutation_names() :: [String.t()]
  defp moderation_mutation_names,
    do: ["blockUser", "unblockUser", "muteUser", "unmuteUser"]
end

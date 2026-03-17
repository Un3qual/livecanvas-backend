defmodule LCGQL.Chat.Resolver do
  @moduledoc false

  import Ecto.Query, warn: false

  alias LC.{Accounts, Chat}

  @type connection_result :: {:ok, Absinthe.Relay.Connection.t()} | {:error, term()}

  @spec chat_messages(map(), map(), Absinthe.Resolution.t()) :: connection_result()
  def chat_messages(%{id: _id} = live_session, args, resolution) do
    with {:ok, viewer} <- viewer_from_resolution(resolution),
         # History reads stay valid after a session ends, so GraphQL must
         # consult the dedicated history policy instead of join-only rules.
         :ok <- Chat.authorize_history_access(viewer, live_session) do
      query =
        live_session
        |> Chat.history_query()
        |> preload(:sender)

      # Relay cursors depend on the Chat boundary's inserted_at/id total order,
      # so keep GraphQL pagination on the same query shape.
      Absinthe.Relay.Connection.from_query(query, &Chat.run_query/1, args)
    else
      _other -> Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec chat_message_inserted_at(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, String.t()}
  def chat_message_inserted_at(%{inserted_at: %DateTime{} = inserted_at}, _args, _resolution) do
    {:ok, DateTime.to_iso8601(inserted_at)}
  end

  def chat_message_inserted_at(_chat_message, _args, _resolution), do: {:ok, ""}

  @spec chat_message_sender(map(), map(), Absinthe.Resolution.t()) :: {:ok, map() | nil}
  def chat_message_sender(%{sender: %{id: _id} = sender}, _args, _resolution), do: {:ok, sender}

  def chat_message_sender(%{sender_id: sender_id}, _args, _resolution)
      when is_integer(sender_id) do
    try do
      {:ok, Accounts.get_user!(sender_id)}
    rescue
      Ecto.NoResultsError -> {:ok, nil}
    end
  end

  def chat_message_sender(_chat_message, _args, _resolution), do: {:ok, nil}

  @spec viewer_from_resolution(Absinthe.Resolution.t()) :: {:ok, map()} | :error
  defp viewer_from_resolution(%Absinthe.Resolution{
         context: %{current_scope: %{user: %{id: user_id} = viewer}}
       })
       when is_integer(user_id) do
    {:ok, viewer}
  end

  defp viewer_from_resolution(_resolution), do: :error
end

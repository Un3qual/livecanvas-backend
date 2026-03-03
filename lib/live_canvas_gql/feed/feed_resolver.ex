defmodule LCGQL.Feed.Resolver do
  alias LC.{Accounts, Feed}

  @type connection_result :: {:ok, Absinthe.Relay.Connection.t()} | {:error, term()}

  @spec home_feed(term(), map(), Absinthe.Resolution.t()) :: connection_result()
  def home_feed(_parent, args, resolution) do
    with {:ok, viewer} <- viewer_from_resolution(resolution) do
      viewer
      |> Feed.home_feed_query()
      |> Absinthe.Relay.Connection.from_query(&Feed.run_query/1, args)
    else
      _ -> Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec live_now(term(), map(), Absinthe.Resolution.t()) :: connection_result()
  def live_now(_parent, args, resolution) do
    with {:ok, viewer} <- viewer_from_resolution(resolution) do
      viewer
      |> Feed.live_now_query()
      |> Absinthe.Relay.Connection.from_query(&Feed.run_query/1, args)
    else
      _ -> Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec host(map(), map(), Absinthe.Resolution.t()) :: {:ok, map() | nil}
  def host(%{host_id: host_id}, _args, _resolution) when is_integer(host_id) do
    try do
      {:ok, Accounts.get_user!(host_id)}
    rescue
      Ecto.NoResultsError -> {:ok, nil}
    end
  end

  def host(_live_session, _args, _resolution), do: {:ok, nil}

  defp viewer_from_resolution(%Absinthe.Resolution{
         context: %{current_scope: %{user: %{id: user_id} = viewer}}
       })
       when is_integer(user_id),
       do: {:ok, viewer}

  defp viewer_from_resolution(_resolution), do: :error
end

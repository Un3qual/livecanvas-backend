defmodule LCGQL.Feed.Resolver do
  alias LC.{Accounts, Chat, Content, Feed}

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

  @spec replay_feed(term(), map(), Absinthe.Resolution.t()) :: connection_result()
  def replay_feed(_parent, args, resolution) do
    with {:ok, viewer} <- viewer_from_resolution(resolution) do
      viewer
      |> Feed.replay_feed_query()
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

  @spec recording_media_asset(map(), map(), Absinthe.Resolution.t()) :: {:ok, map() | nil}
  def recording_media_asset(%{recording_media_asset_id: recording_media_asset_id} = live_session, _args, resolution)
      when is_integer(recording_media_asset_id) do
    with {:ok, viewer} <- viewer_from_resolution(resolution),
         # Global node refetch remains available for `LiveSession`, so child
         # fields must re-apply retained-history visibility before following
         # foreign keys into durable recording assets.
         :ok <- Chat.authorize_history_access(viewer, live_session) do
      {:ok, load_recording_media_asset(live_session, recording_media_asset_id)}
    else
      _other -> {:ok, nil}
    end
  end

  def recording_media_asset(_live_session, _args, _resolution), do: {:ok, nil}

  @spec recording_media_asset_id(map(), map(), Absinthe.Resolution.t()) :: {:ok, String.t() | nil}
  def recording_media_asset_id(%{id: recording_media_asset_id}, _args, _resolution)
      when is_integer(recording_media_asset_id) do
    {:ok, Absinthe.Relay.Node.to_global_id(:media_asset, recording_media_asset_id, LCGQL.Schema)}
  end

  def recording_media_asset_id(_recording_media_asset, _args, _resolution), do: {:ok, nil}

  @spec load_recording_media_asset(map(), pos_integer()) :: map() | nil
  defp load_recording_media_asset(live_session, recording_media_asset_id)
       when is_integer(recording_media_asset_id) do
    case Map.get(live_session, :recording_media_asset) do
      %Ecto.Association.NotLoaded{} ->
        Content.get_live_recording_media_asset(recording_media_asset_id)

      recording_media_asset when is_map(recording_media_asset) ->
        recording_media_asset

      _other ->
        Content.get_live_recording_media_asset(recording_media_asset_id)
    end
  end

  defp viewer_from_resolution(%Absinthe.Resolution{
         context: %{current_scope: %{user: %{id: user_id} = viewer}}
       })
       when is_integer(user_id),
       do: {:ok, viewer}

  defp viewer_from_resolution(_resolution), do: :error
end

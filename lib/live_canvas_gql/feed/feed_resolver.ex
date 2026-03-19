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

  @spec story_feed(term(), map(), Absinthe.Resolution.t()) :: connection_result()
  def story_feed(_parent, args, resolution) do
    with {:ok, viewer} <- viewer_from_resolution(resolution) do
      viewer
      |> Feed.story_feed_query()
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

  @spec host(map(), map(), Absinthe.Resolution.t()) :: LCGQL.Dataloader.dataloader_result()
  def host(%{host: %{id: _id} = host}, _args, _resolution), do: {:ok, host}

  def host(%{host_id: host_id} = live_session, _args, resolution) when is_integer(host_id),
    do: LCGQL.Dataloader.load_assoc(live_session, :host, Accounts, resolution)

  def host(_live_session, _args, _resolution), do: {:ok, nil}

  @spec recording_media_asset(map(), map(), Absinthe.Resolution.t()) ::
          LCGQL.Dataloader.dataloader_result()
  def recording_media_asset(%{recording_media_asset_id: recording_media_asset_id} = live_session, _args, resolution)
      when is_integer(recording_media_asset_id) do
    with {:ok, viewer} <- viewer_from_resolution(resolution),
         # Global node refetch remains available for `LiveSession`, so child
         # fields must re-apply retained-history visibility before following
         # foreign keys into durable recording assets.
         :ok <- Chat.authorize_history_access(viewer, live_session) do
      load_durable_recording_media_asset(live_session, resolution)
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

  defp viewer_from_resolution(%Absinthe.Resolution{
         context: %{current_scope: %{user: %{id: user_id} = viewer}}
       })
       when is_integer(user_id),
       do: {:ok, viewer}

  defp viewer_from_resolution(_resolution), do: :error

  @spec load_durable_recording_media_asset(map(), Absinthe.Resolution.t()) ::
          LCGQL.Dataloader.dataloader_result()
  defp load_durable_recording_media_asset(live_session, %{context: %{loader: loader}})
       when is_map(live_session) do
    loader
    |> Dataloader.load(Content, :recording_media_asset, live_session)
    |> Absinthe.Resolution.Helpers.on_load(fn loader ->
      {:ok,
       loader
       |> Dataloader.get(Content, :recording_media_asset, live_session)
       |> durable_recording_media_asset()}
    end)
  end

  defp load_durable_recording_media_asset(_live_session, _resolution), do: {:ok, nil}

  @spec durable_recording_media_asset(map() | nil) :: map() | nil
  defp durable_recording_media_asset(%{processing_state: processing_state} = recording_media_asset)
       when processing_state in [:uploaded, :processed, "uploaded", "processed"],
       do: recording_media_asset

  defp durable_recording_media_asset(_recording_media_asset), do: nil
end

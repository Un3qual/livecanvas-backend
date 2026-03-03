defmodule LC.Content.MediaProcessing do
  @moduledoc false

  alias LCSchemas.Content.MediaAsset

  @type processing_attrs :: %{
          optional(:width | :height | :duration_ms) => integer()
        }
  @type process_result :: {:ok, processing_attrs()} | {:error, term()}

  @callback process_upload(MediaAsset.t()) :: process_result()

  @spec process_upload(MediaAsset.t()) :: process_result()
  def process_upload(%MediaAsset{} = media_asset) do
    adapter().process_upload(media_asset)
  end

  @spec adapter() :: module()
  defp adapter do
    :live_canvas
    |> Application.fetch_env!(__MODULE__)
    |> Keyword.fetch!(:adapter)
  end
end

defmodule LC.Content.MediaProcessing.FakeAdapter do
  @moduledoc false

  @behaviour LC.Content.MediaProcessing

  alias LCSchemas.Content.MediaAsset

  @impl LC.Content.MediaProcessing
  @spec process_upload(MediaAsset.t()) :: LC.Content.MediaProcessing.process_result()
  def process_upload(%MediaAsset{mime_type: "image/" <> _rest}), do: {:ok, %{}}
  def process_upload(%MediaAsset{mime_type: "video/" <> _rest}), do: {:ok, %{}}
  def process_upload(%MediaAsset{}), do: {:error, :unsupported_mime_type}
end

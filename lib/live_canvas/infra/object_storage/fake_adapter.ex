defmodule LC.Infra.ObjectStorage.FakeAdapter do
  @moduledoc false

  @behaviour LC.Infra.ObjectStorage

  @upload_ttl_seconds 900

  @impl LC.Infra.ObjectStorage
  @spec sign_upload(LC.Infra.ObjectStorage.upload_request()) ::
          {:ok, LC.Infra.ObjectStorage.signed_upload()} | {:error, term()}
  def sign_upload(%{key: key, mime_type: mime_type})
      when is_binary(key) and is_binary(mime_type) do
    expires_at =
      DateTime.utc_now()
      |> DateTime.add(@upload_ttl_seconds, :second)
      |> DateTime.truncate(:second)

    {:ok,
     %{
       method: :put,
       url: "https://object-storage.invalid/#{key}",
       headers: %{"content-type" => mime_type},
       expires_at: expires_at
     }}
  end

  def sign_upload(_request), do: {:error, :invalid_upload_request}

  @impl LC.Infra.ObjectStorage
  @spec public_asset_url(LC.Infra.ObjectStorage.storage_key()) ::
          {:ok, String.t()} | {:error, term()}
  def public_asset_url(key) when is_binary(key) do
    {:ok, "https://object-storage.invalid/#{key}"}
  end

  def public_asset_url(_key), do: {:error, :invalid_storage_key}
end

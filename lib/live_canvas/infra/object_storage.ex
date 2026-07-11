defmodule LC.Infra.ObjectStorage do
  @moduledoc false

  @type storage_key :: String.t()

  @type upload_request :: %{
          required(:key) => storage_key(),
          required(:mime_type) => String.t()
        }

  @type signed_upload :: %{
          required(:method) => :put | :post,
          required(:url) => String.t(),
          required(:headers) => %{optional(String.t()) => String.t()},
          required(:expires_at) => DateTime.t()
        }

  @type verification_request :: %{
          required(:key) => storage_key(),
          required(:mime_type) => String.t(),
          required(:max_bytes) => pos_integer()
        }

  @type verified_upload :: %{
          required(:content_length) => pos_integer(),
          required(:content_type) => String.t()
        }

  @callback sign_upload(upload_request()) :: {:ok, signed_upload()} | {:error, term()}
  @callback verify_upload(verification_request()) :: {:ok, verified_upload()} | {:error, term()}
  @callback public_asset_url(storage_key()) :: {:ok, String.t()} | {:error, term()}

  @spec sign_upload(upload_request()) :: {:ok, signed_upload()} | {:error, term()}
  def sign_upload(%{key: key, mime_type: mime_type} = request)
      when is_binary(key) and is_binary(mime_type) do
    adapter().sign_upload(request)
  end

  def sign_upload(_request), do: {:error, :invalid_upload_request}

  @spec verify_upload(verification_request()) :: {:ok, verified_upload()} | {:error, term()}
  def verify_upload(%{key: key, mime_type: mime_type, max_bytes: max_bytes} = request)
      when is_binary(key) and is_binary(mime_type) and is_integer(max_bytes) and max_bytes > 0 do
    adapter().verify_upload(request)
  end

  def verify_upload(_request), do: {:error, :invalid_verification_request}

  @spec public_asset_url(storage_key()) :: {:ok, String.t()} | {:error, term()}
  def public_asset_url(key) when is_binary(key) do
    adapter().public_asset_url(key)
  end

  def public_asset_url(_key), do: {:error, :invalid_storage_key}

  @spec adapter() :: module()
  defp adapter do
    :live_canvas
    |> Application.fetch_env!(__MODULE__)
    |> Keyword.fetch!(:adapter)
  end
end

defmodule LC.Infra.ObjectStorage do
  @moduledoc false

  @type upload_request :: %{
          required(:key) => String.t(),
          required(:mime_type) => String.t()
        }

  @type signed_upload :: %{
          required(:method) => :put | :post,
          required(:url) => String.t(),
          required(:headers) => %{optional(String.t()) => String.t()},
          required(:expires_at) => DateTime.t()
        }

  @callback sign_upload(upload_request()) :: {:ok, signed_upload()} | {:error, term()}

  @spec sign_upload(upload_request()) :: {:ok, signed_upload()} | {:error, term()}
  def sign_upload(%{key: key, mime_type: mime_type} = request)
      when is_binary(key) and is_binary(mime_type) do
    adapter().sign_upload(request)
  end

  def sign_upload(_request), do: {:error, :invalid_upload_request}

  @spec adapter() :: module()
  defp adapter do
    :live_canvas
    |> Application.fetch_env!(__MODULE__)
    |> Keyword.fetch!(:adapter)
  end
end

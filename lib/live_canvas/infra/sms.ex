defmodule LiveCanvas.Infra.SMS do
  @moduledoc false

  @type delivery :: %{
          required(:to) => String.t(),
          required(:body) => String.t(),
          optional(:template) => atom(),
          optional(:metadata) => map()
        }

  @callback deliver(delivery()) :: :ok | {:error, term()}

  @spec deliver(delivery()) :: :ok | {:error, term()}
  def deliver(%{to: to, body: body} = delivery) when is_binary(to) and is_binary(body) do
    adapter().deliver(delivery)
  end

  def deliver(_delivery), do: {:error, :invalid_delivery}

  @spec adapter() :: module()
  defp adapter do
    :live_canvas
    |> Application.fetch_env!(__MODULE__)
    |> Keyword.fetch!(:adapter)
  end
end

defmodule LC.Accounts.ProviderAuth.Google do
  @moduledoc false

  @behaviour LC.Accounts.ProviderAuth

  alias LC.Accounts.ProviderAuth

  @impl LC.Accounts.ProviderAuth
  def verify_id_token(id_token, opts \\ [])

  @spec verify_id_token(String.t(), keyword()) :: ProviderAuth.verify_result()
  def verify_id_token(id_token, opts) when is_binary(id_token) and is_list(opts) do
    ProviderAuth.verify_configured_rs256_identity(__MODULE__, :google_provider, id_token, opts)
  end

  def verify_id_token(_id_token, _opts), do: {:error, :provider_verification_failed}
end

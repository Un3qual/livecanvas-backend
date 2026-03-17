defmodule LC.Accounts.ProviderAuth.Apple do
  @moduledoc false

  @behaviour LC.Accounts.ProviderAuth

  alias LC.Accounts.ProviderAuth

  @impl LC.Accounts.ProviderAuth
  def verify_id_token(id_token, opts \\ [])

  @spec verify_id_token(String.t(), keyword()) :: ProviderAuth.verify_result()
  def verify_id_token(id_token, opts) when is_binary(id_token) and is_list(opts) do
    with {:ok, config} <- ProviderAuth.fetch_config(__MODULE__, opts),
         {:ok, claims} <- ProviderAuth.verify_rs256_id_token(id_token, Map.to_list(config)),
         {:ok, verified_identity} <- normalize_claims(claims) do
      {:ok, verified_identity}
    else
      _other -> {:error, :provider_verification_failed}
    end
  end

  def verify_id_token(_id_token, _opts), do: {:error, :provider_verification_failed}

  @spec normalize_claims(map()) :: ProviderAuth.verify_result()
  defp normalize_claims(%{
         "email" => email,
         "email_verified" => email_verified,
         "iss" => issuer,
         "sub" => sub
       })
       when is_binary(email) and is_binary(issuer) and is_binary(sub) do
    if verified_email?(email_verified) do
      normalized_email = String.downcase(email)

      {:ok,
       %{
         provider: :apple_provider,
         provider_uid: sub,
         email: normalized_email,
         provider_data: %{
           "email" => normalized_email,
           "email_verified" => true,
           "issuer" => issuer,
           "subject" => sub
         }
       }}
    else
      {:error, :provider_verification_failed}
    end
  end

  defp normalize_claims(_claims), do: {:error, :provider_verification_failed}

  @spec verified_email?(term()) :: boolean()
  defp verified_email?(true), do: true
  defp verified_email?("true"), do: true
  defp verified_email?(_value), do: false
end

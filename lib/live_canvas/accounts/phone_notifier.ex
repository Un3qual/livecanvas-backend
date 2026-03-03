defmodule LC.Accounts.PhoneNotifier do
  @moduledoc false

  alias LC.Infra.SMS

  @type delivery_result :: :ok | {:error, term()}

  @doc """
  Delivers phone verification instructions through the configured SMS adapter.
  """
  @spec deliver_phone_verification_instructions(String.t(), String.t(), keyword()) ::
          delivery_result()
  def deliver_phone_verification_instructions(phone_number, serialized_token, opts \\ [])
      when is_binary(phone_number) and is_binary(serialized_token) do
    SMS.deliver(%{
      to: phone_number,
      body: "Your LiveCanvas verification token is: #{serialized_token}",
      template: :phone_verification,
      metadata: %{user_id: Keyword.get(opts, :user_id)}
    })
  end
end

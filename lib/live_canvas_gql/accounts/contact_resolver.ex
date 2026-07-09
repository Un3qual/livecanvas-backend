defmodule LCGQL.Accounts.ContactResolver do
  alias LC.Accounts
  alias LCGQL.MutationErrors
  alias LCSchemas.Accounts.User

  @type mutation_error :: MutationErrors.user_error()
  @type contact_match_node :: %{
          id: pos_integer(),
          contact_name: String.t() | nil,
          birthday: Date.t() | nil,
          invite_recipient: String.t() | nil,
          contact_entry: map(),
          matched_users: [User.t()]
        }
  @type contact_upsert_payload :: %{
          contact_match: contact_match_node() | nil,
          errors: [mutation_error()]
        }
  @type contact_upsert_result :: {:ok, contact_upsert_payload()}
  @type invite_delivery_payload :: %{errors: [mutation_error()]}
  @type invite_delivery_result :: {:ok, invite_delivery_payload()}
  @type contact_upsert_error_reason ::
          :invalid_contact_client_id
          | :invalid_birthday
          | :invalid_phone_number
          | :invalid_email_list
  @type invite_delivery_error_reason :: :invalid_recipient | :unauthenticated | :delivery_failed

  @spec upsert_viewer_contact_entry(
          term(),
          %{
            optional(:input) => map(),
            optional(:contact_client_id) => String.t(),
            optional(:contact_name) => String.t(),
            optional(:birthday) => String.t(),
            optional(:emails) => [String.t()] | nil,
            optional(:phone_numbers) => [String.t()] | nil
          },
          Absinthe.Resolution.t()
        ) :: contact_upsert_result()
  def upsert_viewer_contact_entry(parent, %{input: input}, resolution),
    do: upsert_viewer_contact_entry(parent, input, resolution)

  def upsert_viewer_contact_entry(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    contact_attrs = %{
      contact_client_id: Map.get(args, :contact_client_id),
      contact_name: Map.get(args, :contact_name),
      birthday: Map.get(args, :birthday),
      emails: normalize_string_list(Map.get(args, :emails)),
      phone_numbers: normalize_string_list(Map.get(args, :phone_numbers))
    }

    case Accounts.upsert_user_contact_entry(user, contact_attrs) do
      {:ok, contact_entry} ->
        contact_match =
          user
          |> Accounts.get_user_contact_match(contact_entry.id)
          |> contact_match_payload()

        {:ok, %{contact_match: contact_match, errors: []}}

      {:error, reason} ->
        {:ok, %{contact_match: nil, errors: [contact_upsert_error(reason)]}}
    end
  end

  def upsert_viewer_contact_entry(_parent, _args, _resolution) do
    {:ok, %{contact_match: nil, errors: [MutationErrors.user_error(nil, :unauthenticated)]}}
  end

  @spec deliver_viewer_contact_invite(
          term(),
          %{optional(:input) => map(), optional(:recipient) => String.t()},
          Absinthe.Resolution.t()
        ) :: invite_delivery_result()
  def deliver_viewer_contact_invite(parent, %{input: input}, resolution),
    do: deliver_viewer_contact_invite(parent, input, resolution)

  def deliver_viewer_contact_invite(_parent, %{recipient: recipient}, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    with {:ok, normalized_recipient} <- normalize_invite_recipient(recipient),
         {:ok, _email} <-
           Accounts.deliver_contact_invite_instructions(
             user,
             normalized_recipient,
             &contact_invite_url/1
           ) do
      {:ok, %{errors: []}}
    else
      {:error, :invalid_recipient} ->
        {:ok, %{errors: [invite_delivery_error(:invalid_recipient)]}}

      {:error, _reason} ->
        {:ok, %{errors: [invite_delivery_error(:delivery_failed)]}}
    end
  end

  def deliver_viewer_contact_invite(_parent, _args, _resolution) do
    {:ok, %{errors: [invite_delivery_error(:unauthenticated)]}}
  end

  @spec viewer_contact_matches(term(), map(), Absinthe.Resolution.t()) ::
          {:ok, map()} | {:error, term()}
  def viewer_contact_matches(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    user
    |> Accounts.list_user_contact_matches()
    |> Enum.map(&contact_match_node/1)
    |> Absinthe.Relay.Connection.from_list(args)
  end

  def viewer_contact_matches(_parent, args, _resolution) do
    Absinthe.Relay.Connection.from_list([], args)
  end

  @spec contact_match_node(LC.Accounts.contact_match()) :: contact_match_node()
  def contact_match_node(%{contact_entry: %{id: id} = contact_entry} = contact_match) do
    contact_match
    |> Map.put(:id, id)
    |> Map.put(:contact_name, Map.get(contact_entry, :contact_name))
    |> Map.put(:birthday, Map.get(contact_entry, :birthday))
  end

  @spec contact_upsert_error(contact_upsert_error_reason()) :: mutation_error()
  defp contact_upsert_error(:invalid_contact_client_id),
    do: MutationErrors.invalid_error("contactClientId")

  defp contact_upsert_error(:invalid_birthday), do: MutationErrors.invalid_error("birthday")

  defp contact_upsert_error(:invalid_phone_number),
    do: MutationErrors.invalid_error("phoneNumbers")

  defp contact_upsert_error(:invalid_email_list), do: MutationErrors.invalid_error("emails")

  @spec normalize_string_list([String.t()] | nil) :: [String.t()]
  defp normalize_string_list(nil), do: []
  defp normalize_string_list(values), do: values

  @spec normalize_invite_recipient(term()) :: {:ok, String.t()} | {:error, :invalid_recipient}
  defp normalize_invite_recipient(recipient) when is_binary(recipient) do
    normalized_recipient = recipient |> String.trim() |> String.downcase()

    if Regex.match?(~r/^[^@\s]+@[^@\s]+$/, normalized_recipient) do
      {:ok, normalized_recipient}
    else
      {:error, :invalid_recipient}
    end
  end

  defp normalize_invite_recipient(_recipient), do: {:error, :invalid_recipient}

  # Keep URL construction deterministic at the GraphQL boundary so Accounts stays
  # transport-agnostic while tests can assert invite delivery side effects.
  @spec contact_invite_url(String.t()) :: String.t()
  defp contact_invite_url(token), do: "https://livecanvas.invalid/invites/#{token}"

  @spec invite_delivery_error(invite_delivery_error_reason()) :: mutation_error()
  defp invite_delivery_error(:invalid_recipient),
    do: MutationErrors.invalid_error("recipient")

  defp invite_delivery_error(:unauthenticated),
    do: MutationErrors.user_error(nil, :unauthenticated)

  defp invite_delivery_error(:delivery_failed),
    do: MutationErrors.user_error(nil, :delivery_failed)

  @spec contact_match_payload(LC.Accounts.contact_match() | nil) :: contact_match_node() | nil
  defp contact_match_payload(nil), do: nil
  defp contact_match_payload(contact_match), do: contact_match_node(contact_match)
end

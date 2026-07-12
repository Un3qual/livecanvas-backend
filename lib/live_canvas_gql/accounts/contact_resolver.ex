defmodule LCGQL.Accounts.ContactResolver do
  alias LC.{Accounts, ReadPolicy}
  alias LCGQL.{MutationErrors, Relay}
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
  @type invite_consumption_payload :: %{consumed: boolean(), errors: [mutation_error()]}
  @type invite_consumption_result :: {:ok, invite_consumption_payload()}
  @type contact_upsert_error_reason ::
          :invalid_contact_client_id
          | :invalid_birthday
          | :invalid_phone_number
          | :invalid_email_list
  @type invite_delivery_error_reason ::
          :invalid_contact_match | :unauthenticated | :delivery_failed

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
          |> contact_match_payload(user)

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
          %{optional(:input) => map(), optional(:contact_match_id) => term()},
          Absinthe.Resolution.t()
        ) :: invite_delivery_result()
  def deliver_viewer_contact_invite(parent, %{input: input}, resolution),
    do: deliver_viewer_contact_invite(parent, input, resolution)

  def deliver_viewer_contact_invite(_parent, %{contact_match_id: contact_match_id}, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    with {:ok, contact_entry_id} <-
           Relay.decode_global_id(contact_match_id, :contact_match, LCGQL.Schema),
         {:ok, _delivery} <-
           Accounts.deliver_contact_invite_instructions(
             user,
             contact_entry_id,
             &contact_invite_url/1
           ) do
      {:ok, %{errors: []}}
    else
      {:error, reason}
      when reason in [:invalid_id, :invalid_type, :invalid_contact_match] ->
        {:ok, %{errors: [invite_delivery_error(:invalid_contact_match)]}}

      {:error, _reason} ->
        {:ok, %{errors: [invite_delivery_error(:delivery_failed)]}}
    end
  end

  def deliver_viewer_contact_invite(_parent, _args, _resolution) do
    {:ok, %{errors: [invite_delivery_error(:unauthenticated)]}}
  end

  @spec consume_contact_invite(
          term(),
          %{optional(:input) => map(), optional(:token) => String.t()},
          Absinthe.Resolution.t()
        ) :: invite_consumption_result()
  def consume_contact_invite(parent, %{input: input}, resolution),
    do: consume_contact_invite(parent, input, resolution)

  def consume_contact_invite(_parent, %{token: token}, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    case Accounts.consume_contact_invite(user, token) do
      {:ok, _conversion} ->
        {:ok, %{consumed: true, errors: []}}

      {:error, :invalid_contact_invite} ->
        {:ok, %{consumed: false, errors: [contact_invite_consumption_error()]}}
    end
  end

  def consume_contact_invite(_parent, _args, _resolution) do
    {:ok,
     %{
       consumed: false,
       errors: [MutationErrors.user_error(nil, :unauthenticated)]
     }}
  end

  @spec viewer_contact_matches(term(), map(), Absinthe.Resolution.t()) ::
          {:ok, map()} | {:error, term()}
  def viewer_contact_matches(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    user
    |> Accounts.list_user_contact_matches()
    |> visible_contact_match_nodes(user)
    |> Absinthe.Relay.Connection.from_list(args)
  end

  def viewer_contact_matches(_parent, args, _resolution) do
    Absinthe.Relay.Connection.from_list([], args)
  end

  @doc """
  Projects one contact match after applying viewer-specific block visibility.
  """
  @spec visible_contact_match_node(LC.Accounts.contact_match(), User.t()) ::
          contact_match_node()
  def visible_contact_match_node(contact_match, %User{} = viewer) do
    [contact_match]
    |> visible_contact_match_nodes(viewer)
    |> List.first()
  end

  @doc """
  Projects contact matches with one batched viewer-visibility lookup.
  """
  @spec visible_contact_match_nodes([LC.Accounts.contact_match()], User.t()) ::
          [contact_match_node()]
  def visible_contact_match_nodes(contact_matches, %User{} = viewer) do
    blocking_ids =
      contact_matches
      |> Enum.flat_map(& &1.matched_users)
      |> Enum.map(& &1.id)
      |> then(&ReadPolicy.blocking_owner_ids(viewer, &1))
      |> MapSet.new()

    Enum.map(contact_matches, &project_contact_match(&1, blocking_ids))
  end

  @spec project_contact_match(LC.Accounts.contact_match(), MapSet.t(pos_integer())) ::
          contact_match_node()
  defp project_contact_match(contact_match, blocking_ids) do
    contact_match
    |> put_contact_scalars()
    |> Map.update!(:matched_users, fn users ->
      Enum.reject(users, &MapSet.member?(blocking_ids, &1.id))
    end)
  end

  @spec put_contact_scalars(LC.Accounts.contact_match()) :: contact_match_node()
  defp put_contact_scalars(%{contact_entry: %{id: id} = contact_entry} = contact_match) do
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

  # Keep URL construction deterministic at the GraphQL boundary so Accounts stays
  # transport-agnostic while tests can assert invite delivery side effects.
  @spec contact_invite_url(String.t()) :: String.t()
  defp contact_invite_url(token) do
    public_app_origin =
      :live_canvas
      |> Application.fetch_env!(:public_app_origin)
      |> String.trim_trailing("/")

    "#{public_app_origin}/invites#token=#{URI.encode_www_form(token)}"
  end

  @spec invite_delivery_error(invite_delivery_error_reason()) :: mutation_error()
  defp invite_delivery_error(:invalid_contact_match),
    do: MutationErrors.invalid_error("contactMatchId")

  defp invite_delivery_error(:unauthenticated),
    do: MutationErrors.user_error(nil, :unauthenticated)

  defp invite_delivery_error(:delivery_failed),
    do: MutationErrors.user_error(nil, :delivery_failed)

  @spec contact_invite_consumption_error() :: mutation_error()
  defp contact_invite_consumption_error,
    do: MutationErrors.user_error(nil, :invalid_contact_invite)

  @spec contact_match_payload(LC.Accounts.contact_match() | nil, User.t()) ::
          contact_match_node() | nil
  defp contact_match_payload(nil, %User{}), do: nil

  defp contact_match_payload(contact_match, %User{} = viewer),
    do: visible_contact_match_node(contact_match, viewer)
end

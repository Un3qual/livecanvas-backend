defmodule LC.Accounts.AuthEvent do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Accounts.AuthEvent, as: AuthEventSchema
  alias LCSchemas.Accounts.User

  @type attrs :: %{
          required(:event_type) => LCSchemas.Accounts.auth_event_type(),
          optional(:metadata | :user_id) => term()
        }

  @type opts ::
          [
            user: User.t() | nil,
            user_id: pos_integer() | nil,
            metadata: map()
          ]

  @spec attrs_for_insert(LCSchemas.Accounts.auth_event_type(), opts()) :: attrs()
  def attrs_for_insert(event_type, opts \\ []) when is_atom(event_type) and is_list(opts) do
    %{
      event_type: event_type,
      user_id: resolve_user_id(opts),
      metadata: normalize_metadata(Keyword.get(opts, :metadata, %{}))
    }
  end

  @spec changeset(AuthEventSchema.t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%AuthEventSchema{} = auth_event, attrs) when is_map(attrs) do
    auth_event
    |> cast(attrs, [:event_type, :metadata, :user_id])
    |> validate_required([:event_type])
    |> validate_change(:metadata, fn :metadata, metadata ->
      if is_map(metadata), do: [], else: [metadata: "must be a map"]
    end)
    |> foreign_key_constraint(:user_id)
  end

  defp resolve_user_id(opts) do
    case Keyword.get(opts, :user) do
      %User{id: user_id} when is_integer(user_id) and user_id > 0 -> user_id
      _ -> normalize_user_id(Keyword.get(opts, :user_id))
    end
  end

  defp normalize_user_id(user_id) when is_integer(user_id) and user_id > 0, do: user_id
  defp normalize_user_id(_user_id), do: nil

  defp normalize_metadata(metadata) when is_map(metadata), do: metadata
  defp normalize_metadata(_metadata), do: %{}
end

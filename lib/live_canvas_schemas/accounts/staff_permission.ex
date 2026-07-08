defmodule LCSchemas.Accounts.StaffPermission do
  use LCSchemas.Schema, :relational

  import Ecto.Changeset

  alias LCSchemas.Accounts.User

  @moduledoc """
  Schema for the `staff_permissions` table.

  Table contract:
  - Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
  - `permission` is constrained to known staff permission values.
  - `(user_id, permission)` is unique while `revoked_at IS NULL`, allowing historical revoked grants.
  - Deleting the user cascades to staff permission rows.
  - `(permission, revoked_at)` supports active permission loading for authorization scopes.
  """

  @type attrs :: %{
          optional(:user_id | :permission | :granted_at | :revoked_at | String.t()) => term()
        }

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          user_id: pos_integer() | nil,
          user: User.t() | Ecto.Association.NotLoaded.t(),
          permission: LCSchemas.Accounts.staff_permission() | nil,
          granted_at: DateTime.t() | nil,
          revoked_at: DateTime.t() | nil,
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "staff_permissions" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :permission, Ecto.Enum, values: [:post_report_moderation]
    field :granted_at, :utc_datetime_usec
    field :revoked_at, :utc_datetime_usec

    belongs_to :user, User

    timestamps()
  end

  @doc false
  @spec changeset(t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = staff_permission, attrs) when is_map(attrs) do
    staff_permission
    |> cast(attrs, [:user_id, :permission, :granted_at, :revoked_at])
    |> validate_required([:user_id, :permission, :granted_at])
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id, name: :staff_permissions_active_user_permission_index)
  end
end

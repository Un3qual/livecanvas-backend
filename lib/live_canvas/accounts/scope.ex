defmodule LC.Accounts.Scope do
  @moduledoc """
  Defines the scope of the caller to be used throughout the app.

  The `LC.Accounts.Scope` allows public interfaces to receive
  information about the caller, such as if the call is initiated from an
  end-user, and if so, which user. Additionally, such a scope can carry fields
  such as "super user" or other privileges for use as authorization, or to
  ensure specific code paths can only be access for a given scope.

  It is useful for logging as well as for scoping pubsub subscriptions and
  broadcasts when a caller subscribes to an interface or performs a particular
  action.

  Feel free to extend the fields on this struct to fit the needs of
  growing application requirements.
  """

  alias LCSchemas.Accounts.User

  defstruct user: nil, staff_permissions: MapSet.new()

  @type t :: %__MODULE__{
          user: User.t() | nil,
          staff_permissions: MapSet.t(LCSchemas.Accounts.staff_permission())
        }

  @doc """
  Creates a scope for the given user.

  Returns nil if no user is given.
  """
  @spec for_user(User.t() | nil) :: t() | nil
  def for_user(user), do: for_user(user, [])

  @spec for_user(User.t() | nil, Enumerable.t()) :: t() | nil
  def for_user(%User{} = user, staff_permissions) do
    %__MODULE__{user: user, staff_permissions: MapSet.new(staff_permissions)}
  end

  def for_user(nil, _staff_permissions), do: nil

  @doc """
  Returns whether the scope carries the given active staff permission.
  """
  @spec has_staff_permission?(t() | nil, LCSchemas.Accounts.staff_permission()) :: boolean()
  def has_staff_permission?(%__MODULE__{staff_permissions: staff_permissions}, permission) do
    MapSet.member?(staff_permissions, permission)
  end

  def has_staff_permission?(_scope, _permission), do: false
end

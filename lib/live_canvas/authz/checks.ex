defmodule LC.Authz.Checks do
  @moduledoc """
  Shared LetMe checks for transport-independent authorization policies.
  """

  alias LC.Accounts.Scope
  alias LCSchemas.Accounts.User

  @doc """
  Returns whether the policy subject is backed by an authenticated user scope.
  """
  @spec authenticated(Scope.t() | nil, term()) :: boolean()
  def authenticated(%Scope{user: %User{id: user_id}}, _object) when is_integer(user_id), do: true
  def authenticated(_, _), do: false
end

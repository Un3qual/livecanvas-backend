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

  @doc """
  Returns whether the policy subject can moderate post reports.
  """
  @spec post_report_moderator(Scope.t() | nil, term()) :: boolean()
  def post_report_moderator(%Scope{user: %User{id: user_id}} = scope, _object)
      when is_integer(user_id) do
    Scope.has_staff_permission?(scope, :post_report_moderation)
  end

  def post_report_moderator(_scope, _object), do: false
end

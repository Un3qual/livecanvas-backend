defmodule LC.Authz.Policy do
  @moduledoc """
  Root LetMe policy module for cross-context backend authorization.
  """

  use LetMe.Policy, check_module: LC.Authz.Checks, error: :not_authorized

  object :scope do
    action :authenticated do
      desc "Allow callers backed by an authenticated end-user scope."
      allow :authenticated
    end
  end
end

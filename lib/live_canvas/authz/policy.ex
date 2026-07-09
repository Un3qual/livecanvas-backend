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

    action :post_report_moderation do
      desc "Allow authenticated staff who can moderate post reports."
      allow :post_report_moderator
    end
  end
end

defmodule LC.Authz do
  @moduledoc """
  Shared authorization boundary for backend policy-as-code.
  """

  use Boundary,
    deps: [LC.Accounts, LCSchemas],
    exports: [Checks, Policy]
end

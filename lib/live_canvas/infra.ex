defmodule LC.Infra do
  @moduledoc false

  use Boundary, exports: [Repo, Mailer, SMS]
end

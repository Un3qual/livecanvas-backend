defmodule LC.Infra do
  @moduledoc false

  use Boundary, exports: [Repo, Mailer, ObjectStorage, SMS]
end

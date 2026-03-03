defmodule LC.Infra do
  @moduledoc false

  use Boundary, exports: [AsyncJobs, Mailer, ObjectStorage, Repo, SMS, WebhookEvent]
end

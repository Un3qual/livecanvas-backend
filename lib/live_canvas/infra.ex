defmodule LC.Infra do
  @moduledoc false

  use Boundary,
    deps: [LCPayload],
    exports: [
      AsyncJobs,
      AsyncJobs.Handler,
      DataGovernance,
      DataGovernance.Deletion,
      DataGovernance.Export,
      DataGovernance.Retention,
      Mailer,
      ObjectStorage,
      Repo,
      SMS,
      WebhookEvent
    ]
end

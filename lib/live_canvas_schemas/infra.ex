defmodule LCSchemas.Infra do
  @moduledoc false

  @type async_job_status :: :completed | :failed | :pending | :processing
  @type webhook_event_status :: :failed | :processed | :received
end

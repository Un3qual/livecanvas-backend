defmodule LCSchemas.Infra do
  @moduledoc false

  @type account_deletion_request_status ::
          :pending | :scheduled | :processing | :completed | :failed | :canceled
  @type async_job_status :: :completed | :failed | :pending | :processing
  @type data_export_request_format :: :json
  @type data_export_request_status :: :pending | :processing | :completed | :failed
  @type webhook_event_status :: :failed | :processed | :received
end

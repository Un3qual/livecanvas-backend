defmodule LCSchemas.Content do
  @moduledoc false

  @type post_kind :: :standard | :story
  @type post_visibility :: :followers | :public
  @type media_processing_state :: :failed | :pending_upload | :processed | :uploaded
  @type post_report_reason ::
          :harassment
          | :hate
          | :illegal
          | :other
          | :self_harm
          | :sexual_content
          | :spam
          | :violence
  @type post_report_status :: :actioned | :dismissed | :open | :reviewed
end

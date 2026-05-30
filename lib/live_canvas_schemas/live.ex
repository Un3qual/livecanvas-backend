defmodule LCSchemas.Live do
  @moduledoc false

  @type live_participant_role :: :host | :viewer
  @type live_session_end_reason :: :host_ended | :moderator_ended | :network_failure
  @type live_session_status :: :starting | :live | :ended
  @type live_session_visibility :: :followers | :public
end

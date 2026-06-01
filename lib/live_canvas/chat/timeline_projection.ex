defmodule LC.Chat.TimelineProjection do
  @moduledoc false

  alias LCSchemas.Accounts.User

  @type t :: %{
          required(:id) => pos_integer(),
          required(:entropy_id) => Ecto.UUID.t(),
          required(:live_session_id) => pos_integer(),
          required(:event_type) => LCSchemas.Chat.timeline_event_type(),
          required(:actor_user_id) => pos_integer() | nil,
          required(:actor) => User.t() | nil,
          required(:occurred_at) => DateTime.t(),
          required(:target_event_id) => pos_integer() | nil,
          required(:projection_state) => LCSchemas.Chat.timeline_projection_state(),
          required(:body) => String.t() | nil,
          required(:edited) => boolean(),
          required(:edit_count) => non_neg_integer(),
          required(:edited_at) => DateTime.t() | nil
        }
end

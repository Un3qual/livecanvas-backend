defmodule LC.Live.LiveParticipant do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Live.LiveParticipant, as: LiveParticipantSchema

  @type attrs :: %{
          optional(:joined_at | :left_at | :live_session_id | :role | :user_id | String.t()) =>
            term()
        }

  @spec attrs_for_join(
          pos_integer(),
          pos_integer(),
          LCSchemas.Live.live_participant_role(),
          DateTime.t()
        ) ::
          map()
  def attrs_for_join(session_id, user_id, role, now)
      when is_integer(session_id) and is_integer(user_id) and is_atom(role) do
    %{
      live_session_id: session_id,
      user_id: user_id,
      role: normalize_role(role),
      joined_at: now,
      left_at: nil
    }
  end

  @spec changeset(LiveParticipantSchema.t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%LiveParticipantSchema{} = live_participant, attrs) when is_map(attrs) do
    live_participant
    |> cast(attrs, [:live_session_id, :user_id, :role, :joined_at, :left_at])
    |> validate_required([:live_session_id, :user_id, :role, :joined_at])
    |> foreign_key_constraint(:live_session_id)
    |> foreign_key_constraint(:user_id)
  end

  defp normalize_role(role) when role in [:host, :viewer], do: role
  defp normalize_role(_role), do: :viewer
end

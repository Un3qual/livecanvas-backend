defmodule LC.Live.LiveSession do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Live.LiveSession, as: LiveSessionSchema

  @type attrs :: %{
          optional(
            :ended_at
            | :ended_reason
            | :host_id
            | :recording_media_asset_id
            | :status
            | :started_at
            | :visibility
            | String.t()
          ) => term()
        }

  @spec attrs_for_insert(pos_integer(), map()) :: map()
  def attrs_for_insert(host_id, attrs) when is_integer(host_id) and is_map(attrs) do
    %{
      host_id: host_id,
      status: :starting,
      visibility: attrs |> value_for(:visibility, :followers) |> normalize_visibility()
    }
  end

  @spec changeset(LiveSessionSchema.t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%LiveSessionSchema{} = live_session, attrs) when is_map(attrs) do
    live_session
    |> cast(attrs, [
      :host_id,
      :status,
      :visibility,
      :started_at,
      :ended_at,
      :ended_reason,
      :recording_media_asset_id
    ])
    |> validate_required([:host_id, :status, :visibility])
    |> foreign_key_constraint(:host_id)
    |> foreign_key_constraint(:recording_media_asset_id)
  end

  @spec mark_live_changeset(LiveSessionSchema.t(), DateTime.t()) :: Ecto.Changeset.t()
  def mark_live_changeset(%LiveSessionSchema{} = live_session, %DateTime{} = now) do
    if live_session.status == :ended do
      # `ended` is terminal and must not be revived by a subsequent mark-live call.
      live_session
      |> changeset(%{})
      |> add_error(:status, "cannot transition ended session to live")
    else
      changeset(live_session, %{status: :live, started_at: live_session.started_at || now})
    end
  end

  @spec end_changeset(LiveSessionSchema.t(), attrs(), DateTime.t()) :: Ecto.Changeset.t()
  def end_changeset(%LiveSessionSchema{} = live_session, attrs, %DateTime{} = now)
      when is_map(attrs) do
    ended_reason = attrs |> value_for(:ended_reason, :host_ended) |> normalize_ended_reason()
    recording_media_asset_id = value_for(attrs, :recording_media_asset_id, nil)

    changeset(live_session, %{
      status: :ended,
      ended_at: now,
      ended_reason: ended_reason,
      recording_media_asset_id: recording_media_asset_id
    })
  end

  defp value_for(attrs, key, default) do
    Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key)) || default
  end

  defp normalize_visibility(value) when value in [:followers, :public], do: value
  defp normalize_visibility("followers"), do: :followers
  defp normalize_visibility("public"), do: :public
  defp normalize_visibility(value), do: value

  defp normalize_ended_reason(value)
       when value in [:host_ended, :moderator_ended, :network_failure],
       do: value

  defp normalize_ended_reason("host_ended"), do: :host_ended
  defp normalize_ended_reason("moderator_ended"), do: :moderator_ended
  defp normalize_ended_reason("network_failure"), do: :network_failure
  defp normalize_ended_reason(value), do: value
end

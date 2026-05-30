defmodule LC.Chat.ChatMessage do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Chat.ChatMessage, as: ChatMessageSchema

  @max_body_length 2000

  @type attrs :: %{
          optional(
            :body
            | :kind
            | :live_session_id
            | :metadata
            | :moderated_at
            | :moderated_by_id
            | :sender_id
            | :status
            | String.t()
          ) =>
            term()
        }

  @spec attrs_for_insert(pos_integer(), pos_integer(), map()) :: map()
  def attrs_for_insert(live_session_id, sender_id, attrs)
      when is_integer(live_session_id) and is_integer(sender_id) and is_map(attrs) do
    %{
      live_session_id: live_session_id,
      sender_id: sender_id,
      body: attrs |> value_for(:body, "") |> normalize_body(),
      kind: attrs |> value_for(:kind, :user_message) |> normalize_kind(),
      status: attrs |> value_for(:status, :active) |> normalize_status(),
      metadata: attrs |> value_for(:metadata, %{}) |> normalize_metadata()
    }
  end

  @spec changeset(ChatMessageSchema.t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%ChatMessageSchema{} = chat_message, attrs) when is_map(attrs) do
    chat_message
    |> cast(attrs, [
      :live_session_id,
      :sender_id,
      :moderated_by_id,
      :body,
      :kind,
      :status,
      :metadata,
      :moderated_at
    ])
    |> validate_required([:live_session_id, :sender_id, :body, :kind, :status])
    |> validate_length(:body, min: 1, max: @max_body_length)
    |> validate_change(:metadata, fn :metadata, metadata ->
      if is_map(metadata), do: [], else: [metadata: "must be a map"]
    end)
    |> foreign_key_constraint(:live_session_id)
    |> foreign_key_constraint(:sender_id)
    |> foreign_key_constraint(:moderated_by_id)
  end

  @spec removal_changeset(ChatMessageSchema.t(), pos_integer(), DateTime.t()) :: Ecto.Changeset.t()
  def removal_changeset(
        %ChatMessageSchema{} = chat_message,
        moderator_id,
        %DateTime{} = moderated_at
      )
      when is_integer(moderator_id) do
    changeset(
      chat_message,
      %{
        status: :removed,
        moderated_at: moderated_at,
        moderated_by_id: moderator_id
      }
    )
  end

  @doc false
  @spec visible_body(map()) :: String.t() | nil
  def visible_body(chat_message) when is_map(chat_message) do
    if removed?(chat_message) do
      nil
    else
      Map.get(chat_message, :body)
    end
  end

  defp value_for(attrs, key, default) do
    Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key)) || default
  end

  defp normalize_body(body) when is_binary(body), do: String.trim(body)
  defp normalize_body(body), do: body

  defp normalize_kind(kind) when kind in [:user_message, :system_event], do: kind
  defp normalize_kind("system_event"), do: :system_event
  defp normalize_kind(_kind), do: :user_message

  defp normalize_status(status) when status in [:active, :removed], do: status
  defp normalize_status("removed"), do: :removed
  defp normalize_status(_status), do: :active

  defp normalize_metadata(metadata) when is_map(metadata), do: metadata
  defp normalize_metadata(_metadata), do: %{}

  @spec removed?(map()) :: boolean()
  defp removed?(chat_message) when is_map(chat_message) do
    Map.get(chat_message, :status, :active) in [:removed, "removed"]
  end
end

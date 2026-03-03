defmodule LC.Chat.ChatMessage do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Chat.ChatMessage, as: ChatMessageSchema

  @max_body_length 2000

  @type attrs :: %{
          optional(:body | :kind | :live_session_id | :metadata | :sender_id | String.t()) =>
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
      metadata: attrs |> value_for(:metadata, %{}) |> normalize_metadata()
    }
  end

  @spec changeset(ChatMessageSchema.t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%ChatMessageSchema{} = chat_message, attrs) when is_map(attrs) do
    chat_message
    |> cast(attrs, [:live_session_id, :sender_id, :body, :kind, :metadata])
    |> validate_required([:live_session_id, :sender_id, :body, :kind])
    |> validate_length(:body, min: 1, max: @max_body_length)
    |> foreign_key_constraint(:live_session_id)
    |> foreign_key_constraint(:sender_id)
  end

  defp value_for(attrs, key, default) do
    Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key)) || default
  end

  defp normalize_body(body) when is_binary(body), do: String.trim(body)
  defp normalize_body(body), do: body

  defp normalize_kind(kind) when kind in [:user_message, :system_event], do: kind
  defp normalize_kind("system_event"), do: :system_event
  defp normalize_kind(_kind), do: :user_message

  defp normalize_metadata(metadata) when is_map(metadata), do: metadata
  defp normalize_metadata(_metadata), do: %{}
end

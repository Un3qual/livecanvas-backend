defmodule LCSchemas.Chat.ChatMessageTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures

  alias LC.Chat.ChatMessage, as: ChatMessageChanges
  alias LC.Infra.Repo
  alias LC.Live
  alias LCSchemas.Chat.ChatMessage

  describe "schema shape and moderation defaults" do
    test "adds moderation fields with relational defaults" do
      host = user_fixture(privacy_mode: :public)
      viewer = user_fixture()
      {:ok, live_session} = Live.start_live_session(host, %{visibility: :public})

      chat_message =
        Repo.insert!(
          struct(ChatMessage, %{
            live_session_id: live_session.id,
            sender_id: viewer.id,
            body: "hello"
          })
        )

      reloaded = Repo.get!(ChatMessage, chat_message.id)

      assert :status in ChatMessage.__schema__(:fields)
      assert :moderated_at in ChatMessage.__schema__(:fields)
      assert :moderated_by_id in ChatMessage.__schema__(:fields)
      assert Enum.member?([:utc_datetime_usec], ChatMessage.__schema__(:type, :moderated_at))
      assert Map.get(reloaded, :status) == :active
      assert Map.get(reloaded, :moderated_at) == nil
      assert Map.get(reloaded, :moderated_by_id) == nil
    end
  end

  describe "visible_body/1" do
    test "redacts removed messages without mutating stored body" do
      active_message =
        %ChatMessage{body: "hello"}
        |> Map.put(:status, :active)

      removed_message =
        %ChatMessage{body: "hello"}
        |> Map.put(:status, :removed)

      string_removed_message =
        %ChatMessage{body: "hello"}
        |> Map.put(:status, "removed")

      assert visible_body(active_message) == "hello"
      assert visible_body(removed_message) == nil
      assert visible_body(string_removed_message) == nil
    end
  end

  defp visible_body(chat_message) do
    if Code.ensure_loaded?(ChatMessageChanges) and
         function_exported?(ChatMessageChanges, :visible_body, 1) do
      apply(ChatMessageChanges, :visible_body, [chat_message])
    else
      :missing_visible_body_helper
    end
  end
end

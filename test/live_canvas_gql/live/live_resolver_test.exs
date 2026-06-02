defmodule LCGQL.Live.ResolverTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures
  import LC.SocialFixtures

  alias LC.{Accounts, Live}
  alias LCTransport.LiveSessionTopics
  alias LCGQL.Live.Resolver

  describe "live_session_channel_topic/3" do
    test "returns an opaque topic for an authorized active viewer" do
      host = user_fixture()
      viewer = user_fixture()
      _follow = accepted_follow_fixture(viewer, host)
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, live_session} = Live.mark_session_live(session)

      assert {:ok, topic} =
               Resolver.live_session_channel_topic(live_session, %{}, resolution_for(viewer))

      assert topic == LiveSessionTopics.live_session_topic(live_session.id)
    end

    test "returns nil for active sessions the viewer cannot join" do
      host = user_fixture()
      outsider = user_fixture()
      {:ok, session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, live_session} = Live.mark_session_live(session)

      assert {:ok, nil} =
               Resolver.live_session_channel_topic(live_session, %{}, resolution_for(outsider))
    end

    test "returns nil for ended sessions and missing viewer scope" do
      host = user_fixture(privacy_mode: :public)
      {:ok, session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, ended_session} = Live.end_live_session(session)

      assert {:ok, nil} =
               Resolver.live_session_channel_topic(ended_session, %{}, resolution_for(host))

      assert {:ok, nil} =
               Resolver.live_session_channel_topic(session, %{}, %Absinthe.Resolution{
                 context: %{}
               })
    end
  end

  defp resolution_for(viewer) do
    %Absinthe.Resolution{context: %{current_scope: Accounts.scope_for_user(viewer)}}
  end
end

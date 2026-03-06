defmodule LCGQL.Live.LiveMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures

  alias LC.{Accounts, Live}

  describe "startLiveSession" do
    test "starts a live session for the authenticated viewer" do
      viewer = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      mutation = """
      mutation {
        startLiveSession(input: {visibility: FOLLOWERS}) {
          liveSession {
            id
            status
            visibility
            host {
              id
            }
          }
          errors {
            field
            message
          }
        }
      }
      """

      viewer_id = Absinthe.Relay.Node.to_global_id(:user, viewer.id, LCGQL.Schema)

      assert {:ok,
              %{
                data: %{
                  "startLiveSession" => %{
                    "liveSession" => %{
                      "id" => live_session_id,
                      "status" => "STARTING",
                      "visibility" => "FOLLOWERS",
                      "host" => %{"id" => ^viewer_id}
                    },
                    "errors" => []
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema, context: context)

      assert {:ok, %{id: local_id, type: :live_session}} =
               Absinthe.Relay.Node.from_global_id(live_session_id, LCGQL.Schema)

      local_id = String.to_integer(local_id)
      assert %{id: ^local_id, host_id: host_id} = Live.get_live_session!(local_id)

      assert host_id == viewer.id
    end

    test "returns an unauthenticated error when no viewer scope is present" do
      mutation = """
      mutation {
        startLiveSession(input: {visibility: FOLLOWERS}) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "startLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "unauthenticated"}]
                  }
                }
              }} = Absinthe.run(mutation, LCGQL.Schema)
    end
  end

  describe "goLiveSession and endLiveSession" do
    test "allows only the host to transition lifecycle states" do
      host = user_fixture()
      other_viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :followers})

      session_id =
        Absinthe.Relay.Node.to_global_id(:live_session, started_session.id, LCGQL.Schema)

      go_live_mutation = """
      mutation GoLiveSession($liveSessionId: ID!) {
        goLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      end_mutation = """
      mutation EndLiveSession($liveSessionId: ID!) {
        endLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      other_context = %{current_scope: Accounts.scope_for_user(other_viewer)}

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(
                 go_live_mutation,
                 LCGQL.Schema,
                 context: other_context,
                 variables: %{"liveSessionId" => session_id}
               )

      host_context = %{current_scope: Accounts.scope_for_user(host)}

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "LIVE"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 go_live_mutation,
                 LCGQL.Schema,
                 context: host_context,
                 variables: %{"liveSessionId" => session_id}
               )

      assert {:ok,
              %{
                data: %{
                  "endLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "ENDED"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 end_mutation,
                 LCGQL.Schema,
                 context: host_context,
                 variables: %{"liveSessionId" => session_id}
               )
    end
  end

  describe "joinLiveSession and leaveLiveSession" do
    test "allows viewers to join and leave joinable sessions" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, live_session} = Live.mark_session_live(started_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, live_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      join_mutation = """
      mutation JoinLiveSession($liveSessionId: ID!) {
        joinLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
            status
          }
          errors {
            field
            message
          }
        }
      }
      """

      leave_mutation = """
      mutation LeaveLiveSession($liveSessionId: ID!) {
        leaveLiveSession(input: {liveSessionId: $liveSessionId}) {
          left
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "joinLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id, "status" => "LIVE"},
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 join_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      assert {:ok,
              %{
                data: %{
                  "leaveLiveSession" => %{
                    "left" => true,
                    "errors" => []
                  }
                }
              }} =
               Absinthe.run(
                 leave_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )
    end
  end

  describe "live mutation ID handling" do
    test "returns structured invalid-id errors for non-live-session global IDs" do
      viewer = user_fixture()
      other_user = user_fixture()
      context = %{current_scope: Accounts.scope_for_user(viewer)}
      non_session_id = Absinthe.Relay.Node.to_global_id(:user, other_user.id, LCGQL.Schema)

      mutation = """
      mutation GoLiveSession($liveSessionId: ID!) {
        goLiveSession(input: {liveSessionId: $liveSessionId}) {
          liveSession {
            id
          }
          errors {
            field
            message
          }
        }
      }
      """

      assert {:ok,
              %{
                data: %{
                  "goLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => "liveSessionId", "message" => "is invalid"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => non_session_id}
               )
    end
  end
end

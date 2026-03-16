defmodule LCGQL.Live.LiveMutationsTest do
  use LC.DataCase

  import LC.AccountsFixtures
  import Ecto.Query

  alias LC.{Accounts, Live}
  alias LC.Infra.Repo
  alias LCSchemas.Live.LiveParticipant

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

    test "rejects repeated end transitions once a session is already ended" do
      host = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, first_end} = Live.end_live_session(started_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, first_end.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(host)}

      mutation = """
      mutation EndLiveSession($liveSessionId: ID!) {
        endLiveSession(input: {liveSessionId: $liveSessionId}) {
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
                  "endLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "ended"}]
                  }
                }
              }} =
               Absinthe.run(
                 mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      persisted = Live.get_live_session!(first_end.id)
      assert persisted.ended_at == first_end.ended_at
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

    test "applies the channel join rate limit to joinLiveSession" do
      previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

      Application.put_env(
        :live_canvas,
        LC.RateLimiter,
        limits: [
          graphql_mutation: [limit: 10, window_ms: 60_000],
          moderation_action: [limit: 10, window_ms: 60_000],
          auth_login: [limit: 10, window_ms: 60_000],
          channel_join: [limit: 1, window_ms: 60_000],
          chat_send: [limit: 10, window_ms: 60_000]
        ]
      )

      LC.RateLimiter.reset!()

      on_exit(fn ->
        Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
        LC.RateLimiter.reset!()
      end)

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
                  "joinLiveSession" => %{
                    "liveSession" => %{"id" => ^session_id},
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
                  "joinLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "rate_limited"}]
                  }
                }
              }} =
               Absinthe.run(
                 join_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )
    end

    test "enforces host audience authorization before joining a followers-only session" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :followers})
      {:ok, live_session} = Live.mark_session_live(started_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, live_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

      join_mutation = """
      mutation JoinLiveSession($liveSessionId: ID!) {
        joinLiveSession(input: {liveSessionId: $liveSessionId}) {
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
                  "joinLiveSession" => %{
                    "liveSession" => nil,
                    "errors" => [%{"field" => nil, "message" => "not_authorized"}]
                  }
                }
              }} =
               Absinthe.run(
                 join_mutation,
                 LCGQL.Schema,
                 context: context,
                 variables: %{"liveSessionId" => session_id}
               )

      refute Repo.get_by(LiveParticipant, live_session_id: live_session.id, user_id: viewer.id)
    end

    test "allows leave cleanup even after the session has ended" do
      host = user_fixture()
      viewer = user_fixture()
      {:ok, started_session} = Live.start_live_session(host, %{visibility: :public})
      {:ok, live_session} = Live.mark_session_live(started_session)
      assert {:ok, _participant} = Live.join_live_session(live_session, viewer, :viewer)
      {:ok, ended_session} = Live.end_live_session(live_session)

      session_id = Absinthe.Relay.Node.to_global_id(:live_session, ended_session.id, LCGQL.Schema)
      context = %{current_scope: Accounts.scope_for_user(viewer)}

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

      assert left_at =
               from(participant in LiveParticipant,
                 where:
                   participant.live_session_id == ^ended_session.id and
                     participant.user_id == ^viewer.id,
                 select: participant.left_at
               )
               |> Repo.one()

      assert %DateTime{} = left_at
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

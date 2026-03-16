defmodule LCGQL.Relay.GraphQLRateLimitTest do
  use LCWeb.ConnCase, async: false

  @rate_limits [
    graphql_mutation: [limit: 1, window_ms: 60_000],
    moderation_action: [limit: 5, window_ms: 60_000],
    auth_login: [limit: 10, window_ms: 60_000],
    channel_join: [limit: 10, window_ms: 60_000],
    chat_send: [limit: 10, window_ms: 60_000]
  ]

  setup do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(:live_canvas, LC.RateLimiter, limits: @rate_limits)
    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    :ok
  end

  test "returns a structured 429 response when mutation limits are exceeded", %{conn: conn} do
    mutation = "mutation { __typename }"
    conn = %{conn | remote_ip: {127, 0, 0, 1}}

    first_conn = post(conn, "/graphql", %{"query" => mutation})
    assert first_conn.status == 200

    second_conn = post(conn, "/graphql", %{"query" => mutation})

    assert second_conn.status == 429

    assert %{
             "errors" => [
               %{"message" => "rate_limited", "extensions" => %{"code" => "RATE_LIMITED"}}
             ]
           } = Jason.decode!(second_conn.resp_body)
  end

  test "uses moderation-action limits for moderation mutations", %{conn: conn} do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      limits: [
        graphql_mutation: [limit: 10, window_ms: 60_000],
        moderation_action: [limit: 1, window_ms: 60_000],
        auth_login: [limit: 10, window_ms: 60_000],
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 10, window_ms: 60_000]
      ]
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    moderation_mutation = """
    mutation {
      muteUser(input: { mutedId: \"123\" }) {
        errors {
          message
        }
      }
    }
    """

    conn = %{conn | remote_ip: {127, 0, 0, 1}}
    first_conn = post(conn, "/graphql", %{"query" => moderation_mutation})
    assert first_conn.status == 200

    second_conn = post(conn, "/graphql", %{"query" => moderation_mutation})
    assert second_conn.status == 429

    assert %{
             "errors" => [
               %{"message" => "rate_limited", "extensions" => %{"code" => "RATE_LIMITED"}}
             ]
           } = Jason.decode!(second_conn.resp_body)
  end

  test "uses auth-login limits for auth bootstrap mutations", %{conn: conn} do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      limits: [
        graphql_mutation: [limit: 10, window_ms: 60_000],
        moderation_action: [limit: 10, window_ms: 60_000],
        auth_login: [limit: 1, window_ms: 60_000],
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 10, window_ms: 60_000]
      ]
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    auth_mutation = """
    mutation {
      loginWithPassword(input: {email: \"user@example.com\", password: \"bad-password\"}) {
        errors {
          message
        }
      }
    }
    """

    conn = %{conn | remote_ip: {127, 0, 0, 1}}
    first_conn = post(conn, "/graphql", %{"query" => auth_mutation})
    assert first_conn.status == 200

    second_conn = post(conn, "/graphql", %{"query" => auth_mutation})
    assert second_conn.status == 429

    assert %{
             "errors" => [
               %{"message" => "rate_limited", "extensions" => %{"code" => "RATE_LIMITED"}}
             ]
           } = Jason.decode!(second_conn.resp_body)
  end

  test "keeps moderation and generic mutation buckets independent", %{conn: conn} do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      limits: [
        graphql_mutation: [limit: 1, window_ms: 60_000],
        moderation_action: [limit: 1, window_ms: 60_000],
        auth_login: [limit: 10, window_ms: 60_000],
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 10, window_ms: 60_000]
      ]
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    conn = %{conn | remote_ip: {127, 0, 0, 1}}

    moderation_mutation = """
    mutation {
      muteUser(input: { mutedId: \"123\" }) {
        errors {
          message
        }
      }
    }
    """

    generic_mutation = "mutation { __typename }"

    first_moderation = post(conn, "/graphql", %{"query" => moderation_mutation})
    assert first_moderation.status == 200

    first_generic = post(conn, "/graphql", %{"query" => generic_mutation})
    assert first_generic.status == 200

    second_moderation = post(conn, "/graphql", %{"query" => moderation_mutation})
    assert second_moderation.status == 429

    second_generic = post(conn, "/graphql", %{"query" => generic_mutation})
    assert second_generic.status == 429
  end

  test "keeps auth-login and generic mutation buckets independent", %{conn: conn} do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      limits: [
        graphql_mutation: [limit: 1, window_ms: 60_000],
        moderation_action: [limit: 10, window_ms: 60_000],
        auth_login: [limit: 1, window_ms: 60_000],
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 10, window_ms: 60_000]
      ]
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    conn = %{conn | remote_ip: {127, 0, 0, 1}}

    auth_mutation = """
    mutation {
      loginWithMagicLink(input: {token: \"invalid-token\"}) {
        errors {
          message
        }
      }
    }
    """

    generic_mutation = "mutation { __typename }"

    first_auth = post(conn, "/graphql", %{"query" => auth_mutation})
    assert first_auth.status == 200

    first_generic = post(conn, "/graphql", %{"query" => generic_mutation})
    assert first_generic.status == 200

    second_auth = post(conn, "/graphql", %{"query" => auth_mutation})
    assert second_auth.status == 429

    second_generic = post(conn, "/graphql", %{"query" => generic_mutation})
    assert second_generic.status == 429
  end

  test "classifies mutations by selected field, not operation name text", %{conn: conn} do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      limits: [
        graphql_mutation: [limit: 10, window_ms: 60_000],
        moderation_action: [limit: 1, window_ms: 60_000],
        auth_login: [limit: 10, window_ms: 60_000],
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 10, window_ms: 60_000]
      ]
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    conn = %{conn | remote_ip: {127, 0, 0, 1}}

    moderation_mutation = """
    mutation loginWithPassword {
      muteUser(input: { mutedId: \"123\" }) {
        errors {
          message
        }
      }
    }
    """

    first_conn = post(conn, "/graphql", %{"query" => moderation_mutation})
    assert first_conn.status == 200

    second_conn = post(conn, "/graphql", %{"query" => moderation_mutation})
    assert second_conn.status == 429
  end

  test "classifies multi-operation documents by the selected operation", %{conn: conn} do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      limits: [
        graphql_mutation: [limit: 1, window_ms: 60_000],
        moderation_action: [limit: 10, window_ms: 60_000],
        auth_login: [limit: 10, window_ms: 60_000],
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 10, window_ms: 60_000]
      ]
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    conn = %{conn | remote_ip: {127, 0, 0, 1}}

    mutation = """
    mutation AuthBootstrap {
      loginWithMagicLink(input: {token: \"invalid-token\"}) {
        errors {
          message
        }
      }
    }

    mutation GenericMutation {
      __typename
    }
    """

    first_conn =
      post(conn, "/graphql", %{
        "query" => mutation,
        "operationName" => "GenericMutation"
      })

    assert first_conn.status == 200

    second_conn =
      post(conn, "/graphql", %{
        "query" => mutation,
        "operationName" => "GenericMutation"
      })

    assert second_conn.status == 429
  end

  test "uses auth-login limits when auth bootstrap mutations are wrapped in fragments", %{
    conn: conn
  } do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      limits: [
        graphql_mutation: [limit: 10, window_ms: 60_000],
        moderation_action: [limit: 10, window_ms: 60_000],
        auth_login: [limit: 1, window_ms: 60_000],
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 10, window_ms: 60_000]
      ]
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    conn = %{conn | remote_ip: {127, 0, 0, 1}}
    mutation_root_type = mutation_root_type_name()

    auth_mutation = """
    mutation {
      ...AuthBootstrapFields
    }

    fragment AuthBootstrapFields on #{mutation_root_type} {
      loginWithMagicLink(input: {token: \"invalid-token\"}) {
        errors {
          message
        }
      }
    }
    """

    first_conn = post(conn, "/graphql", %{"query" => auth_mutation})
    assert first_conn.status == 200

    second_conn = post(conn, "/graphql", %{"query" => auth_mutation})
    assert second_conn.status == 429
  end

  test "rejects batched auth bootstrap mutations that exceed the auth limit", %{conn: conn} do
    previous_config = Application.get_env(:live_canvas, LC.RateLimiter, [])

    Application.put_env(
      :live_canvas,
      LC.RateLimiter,
      limits: [
        graphql_mutation: [limit: 10, window_ms: 60_000],
        moderation_action: [limit: 10, window_ms: 60_000],
        auth_login: [limit: 1, window_ms: 60_000],
        channel_join: [limit: 10, window_ms: 60_000],
        chat_send: [limit: 10, window_ms: 60_000]
      ]
    )

    LC.RateLimiter.reset!()

    on_exit(fn ->
      Application.put_env(:live_canvas, LC.RateLimiter, previous_config)
      LC.RateLimiter.reset!()
    end)

    conn = %{conn | remote_ip: {127, 0, 0, 1}}

    auth_mutation = """
    mutation {
      first: loginWithPassword(
        input: {email: "user@example.com", password: "bad-password"}
      ) {
        errors {
          message
        }
      }

      second: loginWithMagicLink(input: {token: "invalid-token"}) {
        errors {
          message
        }
      }
    }
    """

    response_conn = post(conn, "/graphql", %{"query" => auth_mutation})
    assert response_conn.status == 429
  end

  defp mutation_root_type_name do
    assert {:ok, %{data: %{"__schema" => %{"mutationType" => %{"name" => name}}}}} =
             Absinthe.run("{ __schema { mutationType { name } } }", LCGQL.Schema)

    name
  end
end

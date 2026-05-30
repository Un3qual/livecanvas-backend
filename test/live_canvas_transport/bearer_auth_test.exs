defmodule LCTransport.BearerAuthTest do
  use ExUnit.Case, async: true

  import Plug.Conn
  import Plug.Test

  alias LCTransport.BearerAuth

  describe "token_from_conn/1" do
    test "returns missing when no authorization header exists" do
      assert BearerAuth.token_from_conn(conn(:get, "/")) == :missing
    end

    test "parses the first bearer authorization header" do
      conn = %{
        conn(:get, "/")
        | req_headers: [
            {"authorization", "Bearer first-token"},
            {"authorization", "Bearer second-token"}
          ]
      }

      assert BearerAuth.token_from_conn(conn) == {:ok, "first-token"}
    end

    test "accepts lower-case bearer and trims surrounding whitespace" do
      conn =
        :get
        |> conn("/")
        |> put_req_header("authorization", "  bearer   padded-token  ")

      assert BearerAuth.token_from_conn(conn) == {:ok, "padded-token"}
    end

    test "rejects malformed authorization headers" do
      assert malformed_conn("Bearer   ") |> BearerAuth.token_from_conn() == :malformed
      assert malformed_conn("Basic abc") |> BearerAuth.token_from_conn() == :malformed
      assert malformed_conn("bare-token") |> BearerAuth.token_from_conn() == :malformed
    end
  end

  describe "parse_authorization/1" do
    test "parses bearer token values" do
      assert BearerAuth.parse_authorization("Bearer abc") == {:ok, "abc"}
      assert BearerAuth.parse_authorization("  bearer   abc  ") == {:ok, "abc"}
    end

    test "rejects empty bearer, non-bearer, and non-binary values" do
      assert BearerAuth.parse_authorization("Bearer   ") == :malformed
      assert BearerAuth.parse_authorization("Basic abc") == :malformed
      assert BearerAuth.parse_authorization(:not_binary) == :malformed
    end
  end

  defp malformed_conn(authorization) do
    :get
    |> conn("/")
    |> put_req_header("authorization", authorization)
  end
end

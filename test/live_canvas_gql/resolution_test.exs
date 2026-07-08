defmodule LCGQL.ResolutionTest do
  use ExUnit.Case, async: true

  alias LCGQL.Resolution

  describe "viewer/1" do
    test "returns the authenticated viewer" do
      viewer = %{id: 123, email: "viewer@example.test"}

      assert {:ok, ^viewer} =
               viewer
               |> resolution_for_viewer()
               |> Resolution.viewer()
    end

    test "rejects missing or malformed viewer context" do
      assert :error == Resolution.viewer(%Absinthe.Resolution{})
      assert :error == Resolution.viewer(%Absinthe.Resolution{context: %{current_scope: %{}}})

      assert :error ==
               %{id: "123"}
               |> resolution_for_viewer()
               |> Resolution.viewer()
    end
  end

  describe "viewer_id/1" do
    test "returns the authenticated viewer id" do
      assert {:ok, 123} =
               %{id: 123}
               |> resolution_for_viewer()
               |> Resolution.viewer_id()
    end

    test "rejects missing or malformed viewer context" do
      assert :error == Resolution.viewer_id(%Absinthe.Resolution{})
      assert :error == Resolution.viewer_id(%Absinthe.Resolution{context: %{current_scope: %{}}})

      assert :error ==
               %{id: "123"}
               |> resolution_for_viewer()
               |> Resolution.viewer_id()
    end
  end

  defp resolution_for_viewer(viewer) do
    %Absinthe.Resolution{context: %{current_scope: %{user: viewer}}}
  end
end

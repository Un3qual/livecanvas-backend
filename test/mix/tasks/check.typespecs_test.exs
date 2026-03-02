defmodule Mix.Tasks.Check.TypespecsTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureIO

  @fixtures_dir "test/support/fixtures/typespecs"

  test "fails in strict mode and prints one missing @spec line" do
    file = Path.join(@fixtures_dir, "missing_spec.ex")

    output =
      capture_io(:stderr, fn ->
        assert_raise Mix.Error, ~r/typespec check failed/, fn ->
          run_task(["--strict", file])
        end
      end)

    assert output =~ "missing_spec.ex"
    assert output =~ "missing @spec for ping/1"
  end

  test "passes when all public functions have @spec" do
    file = Path.join(@fixtures_dir, "with_spec.ex")

    output =
      capture_io(:stderr, fn ->
        run_task(["--strict", file])
      end)

    assert output == ""
  end

  test "accepts one spec for all clauses of the same function" do
    file = Path.join(@fixtures_dir, "multiclause.ex")

    output =
      capture_io(:stderr, fn ->
        run_task(["--strict", file])
      end)

    assert output == ""
  end

  test "ignores defp and defmacro forms" do
    file = Path.join(@fixtures_dir, "ignored_defs.ex")

    output =
      capture_io(:stderr, fn ->
        run_task(["--strict", file])
      end)

    assert output == ""
  end

  test "manifest loads relative file paths and ignores comments/blank lines" do
    manifest = Path.join(@fixtures_dir, "manifest.txt")

    output =
      capture_io(:stderr, fn ->
        assert_raise Mix.Error, ~r/typespec check failed/, fn ->
          run_task(["--strict", "--manifest", manifest])
        end
      end)

    assert output =~ "missing_spec.ex"
    assert output =~ "missing @spec for ping/1"
    refute output =~ "with_spec.ex:"
  end

  defp run_task(args) do
    Mix.Task.reenable("check.typespecs")
    Mix.Task.run("check.typespecs", args)
  end
end

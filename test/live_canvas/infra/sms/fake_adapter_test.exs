defmodule LiveCanvas.Infra.SMS.FakeAdapterTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  require Logger

  alias LiveCanvas.Infra.SMS

  setup do
    original_level = Logger.level()
    Logger.configure(level: :info)
    on_exit(fn -> Logger.configure(level: original_level) end)
    :ok
  end

  test "logs a tagged fake SMS delivery and returns :ok" do
    log =
      capture_log([level: :info], fn ->
        assert :ok =
                 SMS.deliver(%{
                   to: "+16502530000",
                   body: "Your LiveCanvas verification token is: token-value",
                   template: :phone_verification,
                   metadata: %{user_id: 123}
                 })
      end)

    assert log =~ "[fake_sms]"
    assert log =~ "+16502530000"
    assert log =~ "phone_verification"
  end
end

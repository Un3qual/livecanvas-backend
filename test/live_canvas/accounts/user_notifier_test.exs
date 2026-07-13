defmodule LC.Accounts.UserNotifierTest do
  use ExUnit.Case, async: true

  alias LC.Accounts.UserNotifier

  test "contact invite email contains the landing URL without disclosing the inviter email" do
    inviter_email = "private-inviter@example.com"
    recipient = "recipient@example.com"
    url = "https://app.livecanvas.example/invites#token=opaque-token"

    assert {:ok, email} =
             UserNotifier.deliver_contact_invite_instructions(recipient, url)

    assert email.text_body =~ "You're invited to join LiveCanvas."
    assert email.text_body =~ url
    refute email.text_body =~ inviter_email
  end
end

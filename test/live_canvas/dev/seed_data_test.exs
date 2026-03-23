defmodule LC.Dev.SeedDataTest do
  use LC.DataCase, async: true

  alias LC.Accounts
  alias LC.Dev.SeedData
  alias LCSchemas.Accounts.User

  import Ecto.Query

  @seeded_accounts [
    %{email: "dev-viewer@example.com", privacy_mode: :private},
    %{email: "dev-creator@example.com", privacy_mode: :public},
    %{email: "dev-host@example.com", privacy_mode: :public}
  ]

  @shared_password "dev-password-123"

  test "seed!/0 creates the stable seeded users with shared credentials" do
    summary = SeedData.seed!()

    assert summary.shared_password == @shared_password
    assert Enum.map(summary.users, & &1.email) == Enum.map(@seeded_accounts, & &1.email)
    assert length(seeded_user_ids()) == length(@seeded_accounts)

    Enum.each(@seeded_accounts, fn %{email: email, privacy_mode: privacy_mode} ->
      assert %User{id: user_id, privacy_mode: ^privacy_mode} = Accounts.get_user_by_email(email)

      assert %User{id: ^user_id} =
               Accounts.get_user_by_email_and_password(email, @shared_password)
    end)
  end

  test "seed!/0 reuses seeded users instead of duplicating them and restores seed state" do
    SeedData.seed!()

    assert %User{} = creator = Accounts.get_user_by_email("dev-creator@example.com")

    {:ok, {creator, _expired_tokens}} =
      Accounts.update_user_password(creator, %{password: "another-password-123"})

    {:ok, _creator} = Accounts.update_user_privacy_mode(creator, :private)

    first_ids = seeded_user_ids()

    summary = SeedData.seed!()

    assert summary.shared_password == @shared_password
    assert seeded_user_ids() == first_ids
    assert length(seeded_user_ids()) == length(@seeded_accounts)
    assert %User{privacy_mode: :public} = Accounts.get_user_by_email("dev-creator@example.com")

    assert %User{} =
             Accounts.get_user_by_email_and_password("dev-creator@example.com", @shared_password)
  end

  defp seeded_user_ids do
    from(user in User,
      join: user_email in assoc(user, :user_email_addresses),
      join: email_address in assoc(user_email, :email_address),
      where: email_address.normalized_email in ^Enum.map(@seeded_accounts, & &1.email),
      order_by: [asc: email_address.normalized_email],
      select: user.id
    )
    |> Repo.all()
  end
end

defmodule LC.Integration.Accounts.ContactInviteConcurrencyTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  import LC.AccountsFixtures

  alias LC.Accounts
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.{ContactInviteConversion, User}

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo, sandbox: false)
    :ok
  end

  test "two independent database consumers return one conversion" do
    inviter = user_fixture()

    recipient =
      user_fixture(
        email: "concurrent-invite-recipient-#{System.unique_integer([:positive])}@example.com"
      )

    try do
      assert {:ok, %{token: token, user_token: persisted}} =
               Accounts.issue_contact_invite_token(inviter, recipient.email)

      parent = self()

      workers =
        for _index <- 1..2 do
          spawn_monitor(fn -> consume_on_independent_connection(parent, recipient, token) end)
        end

      backend_pids =
        for _index <- workers do
          assert_receive {:consumer_ready, worker, backend_pid}, 5_000
          {worker, backend_pid}
        end

      assert backend_pids |> Enum.map(&elem(&1, 1)) |> Enum.uniq() |> length() == 2
      Enum.each(backend_pids, fn {worker, _backend_pid} -> send(worker, :consume) end)

      results =
        for _index <- workers do
          assert_receive {:consumer_result, result}, 5_000
          result
        end

      assert [{:ok, first}, {:ok, second}] = results
      assert first.id == second.id
      assert first.recipient_user_id == recipient.id

      assert 1 ==
               Repo.aggregate(
                 from(conversion in ContactInviteConversion,
                   where: conversion.invite_token_id == ^persisted.id
                 ),
                 :count,
                 :id
               )

      refute Repo.get(LCSchemas.Accounts.UserToken, persisted.id)

      Enum.each(workers, fn {_worker, monitor_ref} ->
        assert_receive {:DOWN, ^monitor_ref, :process, _pid, :normal}, 5_000
      end)
    after
      Repo.delete_all(
        from(conversion in ContactInviteConversion,
          where:
            conversion.inviter_id == ^inviter.id and
              conversion.recipient_user_id == ^recipient.id
        )
      )

      Repo.delete_all(from(user in User, where: user.id in ^[inviter.id, recipient.id]))
    end
  end

  defp consume_on_independent_connection(parent, recipient, token) do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo, sandbox: false)

    try do
      assert {:ok, %{rows: [[backend_pid]]}} = Repo.query("SELECT pg_backend_pid()")
      send(parent, {:consumer_ready, self(), backend_pid})

      receive do
        :consume ->
          send(parent, {:consumer_result, Accounts.consume_contact_invite(recipient, token)})
      after
        5_000 -> raise "consumer did not receive the start signal"
      end
    after
      Ecto.Adapters.SQL.Sandbox.checkin(Repo)
    end
  end
end

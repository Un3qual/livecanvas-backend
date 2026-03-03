defmodule LC.Live.SessionOwnershipTest do
  use LC.DataCase, async: true

  import LC.AccountsFixtures, only: [user_fixture: 0]

  alias LC.Live.SessionOwnership
  alias LCSchemas.Live.{LiveSession, LiveSessionRuntimeOwner}

  describe "claim/3" do
    test "creates an ownership lease for first claim" do
      session_id = live_session_id_fixture()
      claimed_at = ~U[2026-03-03 23:00:00.000000Z]

      assert {:ok, lease} = SessionOwnership.claim(session_id, "node-a@127.0.0.1", claimed_at)

      assert lease.live_session_id == session_id
      assert lease.owner_node == "node-a@127.0.0.1"
      assert DateTime.compare(lease.heartbeat_at, claimed_at) == :eq
      assert DateTime.compare(lease.lease_expires_at, claimed_at) == :gt
    end

    test "rejects claim from a different node while lease is active" do
      session_id = live_session_id_fixture()
      claimed_at = ~U[2026-03-03 23:00:00.000000Z]

      assert {:ok, _lease} = SessionOwnership.claim(session_id, "node-a@127.0.0.1", claimed_at)

      assert {:error, {:owned_by_remote, "node-a@127.0.0.1"}} =
               SessionOwnership.claim(
                 session_id,
                 "node-b@127.0.0.1",
                 DateTime.add(claimed_at, 1, :second)
               )
    end

    test "allows takeover claim from another node after lease expiry" do
      session_id = live_session_id_fixture()
      claimed_at = ~U[2026-03-03 23:00:00.000000Z]

      assert {:ok, lease} = SessionOwnership.claim(session_id, "node-a@127.0.0.1", claimed_at)

      takeover_at = DateTime.add(lease.lease_expires_at, 1, :second)

      assert {:ok, taken_over} =
               SessionOwnership.claim(session_id, "node-b@127.0.0.1", takeover_at)

      assert taken_over.owner_node == "node-b@127.0.0.1"
      assert DateTime.compare(taken_over.heartbeat_at, takeover_at) == :eq
      assert {:ok, "node-b@127.0.0.1"} = SessionOwnership.get_owner(session_id, takeover_at)
    end
  end

  describe "refresh/3" do
    test "refreshes lease heartbeat and expiry for active owner" do
      session_id = live_session_id_fixture()
      claimed_at = ~U[2026-03-03 23:00:00.000000Z]

      assert {:ok, lease} = SessionOwnership.claim(session_id, "node-a@127.0.0.1", claimed_at)

      refreshed_at = DateTime.add(claimed_at, 5, :second)

      assert {:ok, refreshed} =
               SessionOwnership.refresh(session_id, "node-a@127.0.0.1", refreshed_at)

      assert DateTime.compare(refreshed.heartbeat_at, refreshed_at) == :eq
      assert DateTime.compare(refreshed.lease_expires_at, lease.lease_expires_at) == :gt
      assert {:ok, "node-a@127.0.0.1"} = SessionOwnership.get_owner(session_id, refreshed_at)
    end
  end

  describe "release/2" do
    test "is idempotent and releases only for matching owner" do
      session_id = live_session_id_fixture()
      claimed_at = ~U[2026-03-03 23:00:00.000000Z]

      assert {:ok, _lease} = SessionOwnership.claim(session_id, "node-a@127.0.0.1", claimed_at)
      assert :ok = SessionOwnership.release(session_id, "node-b@127.0.0.1")
      assert {:ok, "node-a@127.0.0.1"} = SessionOwnership.get_owner(session_id, claimed_at)

      assert :ok = SessionOwnership.release(session_id, "node-a@127.0.0.1")
      assert {:error, :not_found} = SessionOwnership.get_owner(session_id, claimed_at)
      assert :ok = SessionOwnership.release(session_id, "node-a@127.0.0.1")

      assert Repo.aggregate(LiveSessionRuntimeOwner, :count, :id) == 0
    end
  end

  defp live_session_id_fixture do
    host = user_fixture()
    live_session = Repo.insert!(%LiveSession{host_id: host.id})
    live_session.id
  end
end

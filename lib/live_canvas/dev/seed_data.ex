defmodule LC.Dev.SeedData do
  @moduledoc """
  Seeds deterministic development accounts and a small product-shaped dataset.
  """

  import Ecto.Query, warn: false

  alias LC.{Accounts, Content, Live, Social}
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post
  alias LCSchemas.Live.LiveSession

  @shared_password "dev-password-123"

  @seed_descriptors [
    %{key: :viewer, email: "dev-viewer@example.com", privacy_mode: :private},
    %{key: :creator, email: "dev-creator@example.com", privacy_mode: :public},
    %{key: :host, email: "dev-host@example.com", privacy_mode: :public}
  ]

  @follow_descriptors [
    %{follower_key: :viewer, followed_key: :creator},
    %{follower_key: :viewer, followed_key: :host}
  ]

  @post_descriptors [
    %{
      author_key: :creator,
      entropy_id: "0195df10-88b8-7d07-8dd9-000000000001",
      body_text: "Public studio check-in from the seeded creator account.",
      kind: :standard,
      visibility: :public
    },
    %{
      author_key: :creator,
      entropy_id: "0195df10-88b8-7d07-8dd9-000000000002",
      body_text: "Followers-only lighting notes from the seeded creator account.",
      kind: :standard,
      visibility: :followers
    },
    %{
      author_key: :host,
      entropy_id: "0195df10-88b8-7d07-8dd9-000000000003",
      body_text: "Host is warming up the camera rig for the seeded live session.",
      kind: :standard,
      visibility: :public
    }
  ]

  @live_session_descriptor %{
    host_key: :host,
    entropy_id: "0195df10-88b8-7d07-8dd9-000000000004",
    visibility: :followers
  }

  @type account_key :: :viewer | :creator | :host
  @type seeded_user_summary :: %{
          key: account_key(),
          email: String.t(),
          privacy_mode: LCSchemas.Accounts.user_privacy_mode(),
          user_id: pos_integer()
        }
  @type summary :: %{shared_password: String.t(), users: [seeded_user_summary()]}

  @spec seed!() :: summary()
  def seed! do
    users_by_key = seed_users!()

    seed_follows!(users_by_key)
    seed_posts!(users_by_key)
    seed_live_session!(users_by_key)

    %{
      shared_password: @shared_password,
      users:
        Enum.map(seed_descriptors(), fn descriptor ->
          users_by_key
          |> Map.fetch!(descriptor.key)
          |> summarize_user(descriptor)
        end)
    }
  end

  defp seed_descriptors, do: @seed_descriptors
  defp follow_descriptors, do: @follow_descriptors
  defp post_descriptors, do: @post_descriptors
  defp live_session_descriptor, do: @live_session_descriptor

  defp seed_users! do
    seed_descriptors()
    |> Enum.map(fn descriptor ->
      user =
        descriptor
        |> find_or_create_user!()
        |> normalize_password!()
        |> normalize_privacy_mode!(descriptor.privacy_mode)

      {descriptor.key, user}
    end)
    |> Map.new()
  end

  defp find_or_create_user!(%{email: email}) do
    case Accounts.get_user_by_email(email) do
      %User{} = user ->
        user

      nil ->
        case Accounts.register_user_with_email(%{email: email}) do
          {:ok, %User{} = user} -> user
          {:error, reason} -> raise "failed to seed development user #{email}: #{inspect(reason)}"
      end
    end
  end

  defp seed_follows!(users_by_key) do
    Enum.each(follow_descriptors(), fn descriptor ->
      follower = Map.fetch!(users_by_key, descriptor.follower_key)
      followed = Map.fetch!(users_by_key, descriptor.followed_key)

      follower
      |> ensure_follow!(followed)
      |> normalize_follow_state!(followed)
    end)
  end

  defp ensure_follow!(%User{} = follower, %User{} = followed) do
    case Social.follow_user(follower, followed) do
      {:ok, follow} ->
        follow

      {:error, reason} ->
        raise """
        failed to seed follow #{follower.email} -> #{followed.email}: #{inspect(reason)}
        """
    end
  end

  defp normalize_follow_state!(%{state: :accepted} = follow, _followed), do: follow

  defp normalize_follow_state!(follow, %User{} = followed) do
    case Social.accept_follow_request(follow, followed) do
      {:ok, accepted_follow} ->
        accepted_follow

      {:error, reason} ->
        raise "failed to accept seeded follow for #{followed.email}: #{inspect(reason)}"
    end
  end

  defp seed_posts!(users_by_key) do
    Enum.each(post_descriptors(), fn descriptor ->
      users_by_key
      |> Map.fetch!(descriptor.author_key)
      |> ensure_post!(descriptor)
    end)
  end

  defp ensure_post!(%User{} = author, descriptor) do
    case find_post(author, descriptor) do
      nil ->
        case Content.create_post(author, Map.take(descriptor, [:body_text, :kind, :visibility])) do
          {:ok, %Post{} = post} ->
            ensure_post_entropy_id!(post, descriptor.entropy_id)

          {:error, reason} ->
            raise "failed to seed post for #{author.email}: #{inspect(reason)}"
        end

      %Post{} = post ->
        post
        |> ensure_post_entropy_id!(descriptor.entropy_id)
        |> normalize_post!(author, descriptor)
    end
  end

  defp normalize_post!(%Post{} = post, %User{} = author, descriptor) do
    case Content.update_user_post(author, post.id, %{
           body_text: descriptor.body_text,
           visibility: descriptor.visibility
         }) do
      {:ok, %Post{} = updated_post} ->
        updated_post

      {:error, reason} ->
        raise "failed to normalize seeded post for #{author.email}: #{inspect(reason)}"
    end
  end

  defp find_post(%User{id: author_id}, %{entropy_id: entropy_id} = descriptor) do
    case Repo.get_by(Post, author_id: author_id, entropy_id: entropy_id) do
      %Post{} = post ->
        post

      nil ->
        find_legacy_post(author_id, descriptor)
    end
  end

  # Backfill pre-review seeded rows onto deterministic entropy IDs so future
  # reruns can find them even after local body-text edits.
  defp find_legacy_post(author_id, %{body_text: body_text, kind: kind}) do
    from(post in Post,
      where: post.author_id == ^author_id and post.body_text == ^body_text and post.kind == ^kind,
      limit: 1
    )
    |> Repo.one()
  end

  defp ensure_post_entropy_id!(%Post{entropy_id: entropy_id} = post, entropy_id), do: post

  defp ensure_post_entropy_id!(%Post{} = post, entropy_id) do
    post
    |> Ecto.Changeset.change(%{entropy_id: entropy_id})
    |> Repo.update()
    |> case do
      {:ok, %Post{} = updated_post} ->
        updated_post

      {:error, reason} ->
        raise "failed to assign seeded post entropy_id for post #{post.id}: #{inspect(reason)}"
    end
  end

  defp seed_live_session!(users_by_key) do
    descriptor = live_session_descriptor()

    _live_session =
      users_by_key
      |> Map.fetch!(descriptor.host_key)
      |> ensure_live_session!(descriptor)

    :ok
  end

  defp ensure_live_session!(%User{} = host, descriptor) do
    visibility = descriptor.visibility

    host
    |> find_live_session(descriptor)
    |> case do
      nil ->
        case Live.start_live_session(host, %{visibility: visibility}) do
          {:ok, %LiveSession{} = session} ->
            ensure_live_session_entropy_id!(session, descriptor.entropy_id)

          {:error, reason} ->
            raise "failed to seed live session for #{host.email}: #{inspect(reason)}"
        end

      %LiveSession{} = session ->
        ensure_live_session_entropy_id!(session, descriptor.entropy_id)
    end
    |> normalize_live_session_visibility!(visibility)
    |> ensure_live_session_live!()
  end

  defp find_live_session(%User{id: host_id}, %{entropy_id: entropy_id}) do
    case Repo.get_by(LiveSession, host_id: host_id, entropy_id: entropy_id) do
      %LiveSession{} = session ->
        session

      nil ->
        find_legacy_live_session(host_id)
    end
  end

  # Backfill the pre-review seeded session onto a deterministic entropy ID so
  # reruns keep reusing the same fixture instead of newer ad-hoc sessions.
  defp find_legacy_live_session(host_id) do
    from(live_session in LiveSession,
      where: live_session.host_id == ^host_id and live_session.status in [:starting, :live],
      order_by: [asc: live_session.inserted_at, asc: live_session.id],
      limit: 1
    )
    |> Repo.one()
  end

  defp ensure_live_session_entropy_id!(%LiveSession{entropy_id: entropy_id} = session, entropy_id),
    do: session

  defp ensure_live_session_entropy_id!(%LiveSession{} = session, entropy_id) do
    session
    |> Ecto.Changeset.change(%{entropy_id: entropy_id})
    |> Repo.update()
    |> case do
      {:ok, %LiveSession{} = updated_session} ->
        updated_session

      {:error, reason} ->
        raise "failed to assign seeded live session entropy_id for #{session.id}: #{inspect(reason)}"
    end
  end

  defp normalize_live_session_visibility!(%LiveSession{visibility: visibility} = session, visibility),
    do: session

  defp normalize_live_session_visibility!(%LiveSession{} = session, visibility) do
    session
    |> Ecto.Changeset.change(%{visibility: visibility})
    |> Repo.update()
    |> case do
      {:ok, %LiveSession{} = updated_session} ->
        updated_session

      {:error, reason} ->
        raise "failed to normalize seeded live session #{session.id}: #{inspect(reason)}"
    end
  end

  defp ensure_live_session_live!(%LiveSession{status: :live} = session), do: session

  defp ensure_live_session_live!(%LiveSession{} = session) do
    case Live.mark_session_live(session) do
      {:ok, %LiveSession{} = live_session} ->
        live_session

      {:error, reason} ->
        raise "failed to mark seeded live session #{session.id} live: #{inspect(reason)}"
    end
  end

  # Check the stored hash directly so reruns stay idempotent without emitting
  # password-login auth events from the normal sign-in flow.
  defp normalize_password!(%User{} = user) do
    if shared_password?(user) do
      user
    else
      case Accounts.update_user_password(user, %{password: @shared_password}) do
        {:ok, {%User{} = updated_user, _expired_tokens}} ->
          updated_user

        {:error, reason} ->
          raise "failed to set development password for #{user.email}: #{inspect(reason)}"
      end
    end
  end

  defp shared_password?(%User{hashed_password: hashed_password})
       when is_binary(hashed_password) do
    Argon2.verify_pass(@shared_password, hashed_password)
  end

  defp shared_password?(_user), do: false

  defp normalize_privacy_mode!(%User{privacy_mode: privacy_mode} = user, privacy_mode), do: user

  defp normalize_privacy_mode!(%User{} = user, privacy_mode) do
    case Accounts.update_user_privacy_mode(user, privacy_mode) do
      {:ok, %User{} = updated_user} ->
        updated_user

      {:error, reason} ->
        raise "failed to set development privacy mode for #{user.email}: #{inspect(reason)}"
    end
  end

  defp summarize_user(%User{id: user_id, email: email, privacy_mode: privacy_mode}, descriptor) do
    %{
      key: descriptor.key,
      email: email,
      privacy_mode: privacy_mode,
      user_id: user_id
    }
  end
end

defmodule LCGQL.Social.Resolver do
  alias LC.{Accounts, Social}
  alias LCGQL.Relay

  @type fetch_user_error :: :invalid_id | :invalid_type | :not_found
  @type resolver_error ::
          :blocked | :not_allowed | :unauthenticated | fetch_user_error() | Ecto.Changeset.t()
  @type follow_payload :: %{id: integer(), state: :accepted | :requested}
  @type social_error_payload :: %{field: String.t() | nil, message: String.t()}
  @type follow_result_payload :: %{
          follow: follow_payload() | nil,
          errors: [social_error_payload()]
        }
  @type error_only_result_payload :: %{errors: [social_error_payload()]}

  @spec follow_user(any(), %{followed_id: term()}, any()) ::
          {:ok, follow_result_payload()}
  def follow_user(_parent, %{followed_id: followed_id}, %{
        context: %{current_scope: %{user: %{id: _id} = follower}}
      }) do
    with {:ok, followed} <- fetch_user(followed_id, :followed_id),
         {:ok, follow} <- Social.follow_user(follower, followed) do
      {:ok, %{follow: follow_payload(follow), errors: []}}
    else
      {:error, {field, reason}} ->
        {:ok, %{follow: nil, errors: [social_error(field, reason)]}}

      {:error, reason} ->
        {:ok, %{follow: nil, errors: [social_error(nil, reason)]}}
    end
  end

  def follow_user(_parent, _args, _resolution) do
    {:ok, %{follow: nil, errors: [social_error(nil, :unauthenticated)]}}
  end

  @spec accept_follow_request(
          any(),
          %{follower_id: term()},
          any()
        ) ::
          {:ok, follow_result_payload()}
  def accept_follow_request(
        _parent,
        %{follower_id: follower_id},
        %{context: %{current_scope: %{user: %{id: _id} = acting_user}}}
      ) do
    with {:ok, follower} <- fetch_user(follower_id, :follower_id),
         # Accept-follow is viewer-owned: the authenticated viewer is the
         # recipient/acting user for the pending follower request.
         {:ok, follow} <- Social.follow_user(follower, acting_user),
         {:ok, accepted_follow} <- Social.accept_follow_request(follow, acting_user) do
      {:ok, %{follow: follow_payload(accepted_follow), errors: []}}
    else
      {:error, {field, reason}} ->
        {:ok, %{follow: nil, errors: [social_error(field, reason)]}}

      {:error, reason} ->
        {:ok, %{follow: nil, errors: [social_error(nil, reason)]}}
    end
  end

  def accept_follow_request(_parent, _args, _resolution) do
    {:ok, %{follow: nil, errors: [social_error(nil, :unauthenticated)]}}
  end

  @spec block_user(any(), %{blocked_id: term()}, any()) ::
          {:ok, error_only_result_payload()}
  def block_user(_parent, %{blocked_id: blocked_id}, %{
        context: %{current_scope: %{user: %{id: _id} = blocker}}
      }) do
    with {:ok, blocked} <- fetch_user(blocked_id, :blocked_id),
         {:ok, _block} <- Social.block_user(blocker, blocked) do
      {:ok, %{errors: []}}
    else
      {:error, {field, reason}} ->
        {:ok, %{errors: [social_error(field, reason)]}}

      {:error, reason} ->
        {:ok, %{errors: [social_error(nil, reason)]}}
    end
  end

  def block_user(_parent, _args, _resolution) do
    {:ok, %{errors: [social_error(nil, :unauthenticated)]}}
  end

  @spec mute_user(any(), %{muted_id: term()}, any()) ::
          {:ok, error_only_result_payload()}
  def mute_user(_parent, %{muted_id: muted_id}, %{
        context: %{current_scope: %{user: %{id: _id} = muter}}
      }) do
    with {:ok, muted} <- fetch_user(muted_id, :muted_id),
         {:ok, _mute} <- Social.mute_user(muter, muted) do
      {:ok, %{errors: []}}
    else
      {:error, {field, reason}} ->
        {:ok, %{errors: [social_error(field, reason)]}}

      {:error, reason} ->
        {:ok, %{errors: [social_error(nil, reason)]}}
    end
  end

  def mute_user(_parent, _args, _resolution) do
    {:ok, %{errors: [social_error(nil, :unauthenticated)]}}
  end

  @spec unmute_user(any(), %{muted_id: term()}, any()) ::
          {:ok, error_only_result_payload()}
  def unmute_user(_parent, %{muted_id: muted_id}, %{
        context: %{current_scope: %{user: %{id: _id} = muter}}
      }) do
    with {:ok, muted} <- fetch_user(muted_id, :muted_id),
         :ok <- Social.unmute_user(muter, muted) do
      {:ok, %{errors: []}}
    else
      {:error, {field, reason}} ->
        {:ok, %{errors: [social_error(field, reason)]}}
    end
  end

  def unmute_user(_parent, _args, _resolution) do
    {:ok, %{errors: [social_error(nil, :unauthenticated)]}}
  end

  @spec relationship_state(any(), %{viewer_id: term(), creator_id: term()}, any()) ::
          {:ok, Social.relationship_state()}
  def relationship_state(_parent, %{viewer_id: viewer_id, creator_id: creator_id}, _resolution) do
    with {:ok, viewer} <- fetch_user(viewer_id, :viewer_id),
         {:ok, creator} <- fetch_user(creator_id, :creator_id) do
      {:ok, Social.relationship_state(viewer, creator)}
    else
      _ -> {:ok, :none}
    end
  end

  @spec is_muted(any(), %{viewer_id: term(), creator_id: term()}, any()) :: {:ok, boolean()}
  def is_muted(_parent, %{viewer_id: viewer_id, creator_id: creator_id}, _resolution) do
    with {:ok, viewer} <- fetch_user(viewer_id, :viewer_id),
         {:ok, creator} <- fetch_user(creator_id, :creator_id) do
      {:ok, Social.muted?(viewer, creator)}
    else
      # Keep read queries stable by treating invalid or missing users as
      # "not muted" instead of raising at the GraphQL boundary.
      _ -> {:ok, false}
    end
  end

  @spec followers(map(), map(), Absinthe.Resolution.t()) :: {:ok, map()} | {:error, term()}
  def followers(%{id: _id} = user, args, _resolution) do
    query = Social.follower_users_query(user)
    Absinthe.Relay.Connection.from_query(query, &Social.run_query/1, args)
  end

  @spec following(map(), map(), Absinthe.Resolution.t()) :: {:ok, map()} | {:error, term()}
  def following(%{id: _id} = user, args, _resolution) do
    query = Social.following_users_query(user)
    Absinthe.Relay.Connection.from_query(query, &Social.run_query/1, args)
  end

  defp fetch_user(user_id, field) do
    with {:ok, id} <- Relay.decode_global_id(user_id, :user, LCGQL.Schema) do
      try do
        {:ok, Accounts.get_user!(id)}
      rescue
        Ecto.NoResultsError -> {:error, {field, :not_found}}
      end
    else
      {:error, reason} -> {:error, {field, reason}}
    end
  end

  @spec follow_payload(struct()) :: follow_payload()
  defp follow_payload(follow) do
    %{id: follow.id, state: follow.state}
  end

  @spec social_error(atom() | nil, resolver_error()) :: social_error_payload()
  defp social_error(field, reason) do
    %{
      field: format_field(field),
      message: format_error_message(reason)
    }
  end

  @spec format_field(atom() | nil) :: String.t() | nil
  defp format_field(nil), do: nil
  defp format_field(:blocked_id), do: "blockedId"
  defp format_field(:creator_id), do: "creatorId"
  defp format_field(:followed_id), do: "followedId"
  defp format_field(:follower_id), do: "followerId"
  defp format_field(:muted_id), do: "mutedId"
  defp format_field(:viewer_id), do: "viewerId"
  defp format_field(field), do: Atom.to_string(field)

  @spec format_error_message(resolver_error()) :: String.t()
  defp format_error_message(%Ecto.Changeset{}), do: "validation_failed"
  defp format_error_message(reason) when is_atom(reason), do: Atom.to_string(reason)
end

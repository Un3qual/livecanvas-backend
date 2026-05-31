defmodule LCGQL.Social.Resolver do
  alias LC.{Accounts, Social}
  alias LCGQL.{FieldNames, MutationErrors, Relay}

  @type fetch_user_error :: :invalid_id | :invalid_type | :not_found
  @type resolver_error ::
          :blocked | :not_allowed | :unauthenticated | fetch_user_error() | Ecto.Changeset.t()
  @type follow_payload :: %{id: integer(), state: :accepted | :requested}
  @type social_error_payload :: MutationErrors.user_error()
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
        {:ok, %{follow: nil, errors: [error_payload(field, reason)]}}

      {:error, reason} ->
        {:ok, %{follow: nil, errors: [error_payload(nil, reason)]}}
    end
  end

  def follow_user(_parent, _args, _resolution) do
    {:ok, %{follow: nil, errors: [error_payload(nil, :unauthenticated)]}}
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
         # Accept-follow is viewer-owned: only an already-pending request for
         # the authenticated viewer can transition to accepted.
         %{} = follow <- Social.get_pending_follow_request_for_follower(acting_user, follower),
         {:ok, accepted_follow} <- Social.accept_follow_request(follow, acting_user) do
      {:ok, %{follow: follow_payload(accepted_follow), errors: []}}
    else
      nil ->
        {:ok, %{follow: nil, errors: [error_payload(:follower_id, :not_found)]}}

      {:error, {field, reason}} ->
        {:ok, %{follow: nil, errors: [error_payload(field, reason)]}}

      {:error, reason} ->
        {:ok, %{follow: nil, errors: [error_payload(nil, reason)]}}
    end
  end

  def accept_follow_request(_parent, _args, _resolution) do
    {:ok, %{follow: nil, errors: [error_payload(nil, :unauthenticated)]}}
  end

  @spec decline_follow_request(
          any(),
          %{follower_id: term()},
          Absinthe.Resolution.t()
        ) ::
          {:ok, error_only_result_payload()}
  def decline_follow_request(
        _parent,
        %{follower_id: follower_id},
        %{context: %{current_scope: %{user: %{id: _id} = acting_user}}}
      ) do
    with {:ok, follower} <- fetch_user(follower_id, :follower_id),
         %{} = follow <- Social.get_pending_follow_request_for_follower(acting_user, follower),
         :ok <- Social.decline_follow_request(follow, acting_user) do
      {:ok, %{errors: []}}
    else
      nil ->
        {:ok, %{errors: [error_payload(:follower_id, :not_found)]}}

      {:error, {field, reason}} ->
        {:ok, %{errors: [error_payload(field, reason)]}}

      {:error, reason} ->
        {:ok, %{errors: [error_payload(nil, reason)]}}
    end
  end

  def decline_follow_request(_parent, _args, _resolution) do
    {:ok, %{errors: [error_payload(nil, :unauthenticated)]}}
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
        {:ok, %{errors: [error_payload(field, reason)]}}

      {:error, reason} ->
        {:ok, %{errors: [error_payload(nil, reason)]}}
    end
  end

  def block_user(_parent, _args, _resolution) do
    {:ok, %{errors: [error_payload(nil, :unauthenticated)]}}
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
        {:ok, %{errors: [error_payload(field, reason)]}}

      {:error, reason} ->
        {:ok, %{errors: [error_payload(nil, reason)]}}
    end
  end

  def mute_user(_parent, _args, _resolution) do
    {:ok, %{errors: [error_payload(nil, :unauthenticated)]}}
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
        {:ok, %{errors: [error_payload(field, reason)]}}
    end
  end

  def unmute_user(_parent, _args, _resolution) do
    {:ok, %{errors: [error_payload(nil, :unauthenticated)]}}
  end

  @spec relationship_state(any(), %{creator_id: term()}, Absinthe.Resolution.t()) ::
          {:ok, Social.relationship_state()}
  def relationship_state(_parent, %{creator_id: creator_id}, resolution) do
    # Relationship-state reads are viewer-scoped in the stabilized mobile
    # contract, so GraphQL derives the viewer from auth scope instead of
    # trusting a caller-supplied viewer ID.
    with {:ok, viewer} <- viewer_from_resolution(resolution),
         {:ok, creator} <- fetch_user(creator_id, :creator_id) do
      {:ok, Social.relationship_state(viewer, creator)}
    else
      _ -> {:ok, :none}
    end
  end

  @spec is_muted(any(), %{creator_id: term()}, Absinthe.Resolution.t()) :: {:ok, boolean()}
  def is_muted(_parent, %{creator_id: creator_id}, resolution) do
    with {:ok, viewer} <- viewer_from_resolution(resolution),
         {:ok, creator} <- fetch_user(creator_id, :creator_id) do
      {:ok, Social.muted?(viewer, creator)}
    else
      # Keep read queries stable by treating invalid or missing users as
      # "not muted" instead of raising at the GraphQL boundary.
      _ -> {:ok, false}
    end
  end

  @spec followers(map(), map(), Absinthe.Resolution.t()) :: {:ok, map()}
  def followers(%{id: _id} = user, args, resolution) do
    if can_view_relationship_graph?(user, resolution) do
      query = Social.follower_users_query(user)
      Absinthe.Relay.Connection.from_query(query, &Social.run_query/1, args)
    else
      Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec following(map(), map(), Absinthe.Resolution.t()) :: {:ok, map()}
  def following(%{id: _id} = user, args, resolution) do
    if can_view_relationship_graph?(user, resolution) do
      query = Social.following_users_query(user)
      Absinthe.Relay.Connection.from_query(query, &Social.run_query/1, args)
    else
      Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec viewer_pending_follow_requests(term(), map(), Absinthe.Resolution.t()) ::
          {:ok, map()} | {:error, term()}
  def viewer_pending_follow_requests(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    query = Social.pending_follow_requests_query(user)
    Absinthe.Relay.Connection.from_query(query, &Social.run_query/1, args)
  end

  def viewer_pending_follow_requests(_parent, args, _resolution) do
    Absinthe.Relay.Connection.from_list([], args)
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

  @spec error_payload(atom() | nil, resolver_error()) :: social_error_payload()
  defp error_payload(field, %Ecto.Changeset{}),
    do: MutationErrors.user_error(format_field(field), "validation_failed")

  defp error_payload(field, reason), do: MutationErrors.user_error(format_field(field), reason)

  @spec format_field(atom() | nil) :: String.t() | nil
  defp format_field(nil), do: nil
  defp format_field(field), do: FieldNames.lower_camel(field)

  @spec viewer_from_resolution(Absinthe.Resolution.t()) :: {:ok, map()} | :error
  defp viewer_from_resolution(%Absinthe.Resolution{
         context: %{current_scope: %{user: %{id: user_id} = viewer}}
       })
       when is_integer(user_id) do
    {:ok, viewer}
  end

  defp viewer_from_resolution(_resolution), do: :error

  @spec can_view_relationship_graph?(map(), Absinthe.Resolution.t()) :: boolean()
  defp can_view_relationship_graph?(%{privacy_mode: :public}, _resolution), do: true

  defp can_view_relationship_graph?(%{} = user, resolution) do
    case viewer_from_resolution(resolution) do
      {:ok, viewer} -> Social.can_view_user?(viewer, user)
      :error -> false
    end
  end
end

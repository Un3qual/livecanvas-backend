defmodule LCGQL.Social.Resolver do
  alias LC.{Accounts, ReadPolicy, Social}
  alias LCGQL.{FieldNames, MutationErrors, Relay, Resolution}
  alias LCSchemas.Accounts.User

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
    with {:ok, followed} <- fetch_visible_user(followed_id, :followed_id, follower),
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
    with {:ok, follower} <- fetch_visible_user(follower_id, :follower_id, acting_user),
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
    with {:ok, follower} <- fetch_visible_user(follower_id, :follower_id, acting_user),
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
  def block_user(_parent, args, resolution) do
    error_only_user_action(args, resolution, :blocked_id, &Social.block_user/2)
  end

  @spec unfollow_user(any(), %{followed_id: term()}, any()) ::
          {:ok, error_only_result_payload()}
  def unfollow_user(_parent, args, resolution) do
    error_only_user_action(args, resolution, :followed_id, &Social.unfollow_user/2)
  end

  @spec unblock_user(any(), %{blocked_id: term()}, any()) ::
          {:ok, error_only_result_payload()}
  def unblock_user(_parent, args, resolution) do
    error_only_user_action(args, resolution, :blocked_id, &Social.unblock_user/2)
  end

  @spec mute_user(any(), %{muted_id: term()}, any()) ::
          {:ok, error_only_result_payload()}
  def mute_user(_parent, args, resolution) do
    error_only_user_action(args, resolution, :muted_id, &Social.mute_user/2)
  end

  @spec unmute_user(any(), %{muted_id: term()}, any()) ::
          {:ok, error_only_result_payload()}
  def unmute_user(_parent, args, resolution) do
    error_only_user_action(args, resolution, :muted_id, &Social.unmute_user/2)
  end

  @spec relationship_state(any(), %{creator_id: term()}, Absinthe.Resolution.t()) ::
          {:ok, ReadPolicy.relationship_state()}
  def relationship_state(_parent, %{creator_id: creator_id}, resolution) do
    # Relationship-state reads are viewer-scoped in the stabilized mobile
    # contract, so GraphQL derives the viewer from auth scope instead of
    # trusting a caller-supplied viewer ID.
    with {:ok, viewer} <- Resolution.viewer(resolution),
         {:ok, creator} <- fetch_visible_user(creator_id, :creator_id, viewer) do
      {:ok, ReadPolicy.relationship_state(viewer, creator, creator.privacy_mode)}
    else
      _ -> {:ok, :none}
    end
  end

  @spec is_muted(any(), %{creator_id: term()}, Absinthe.Resolution.t()) :: {:ok, boolean()}
  def is_muted(_parent, %{creator_id: creator_id}, resolution) do
    with {:ok, viewer} <- Resolution.viewer(resolution),
         {:ok, creator} <- fetch_visible_user(creator_id, :creator_id, viewer) do
      {:ok, ReadPolicy.viewer_muted_owner?(viewer, creator)}
    else
      # Keep read queries stable by treating invalid or missing users as
      # "not muted" instead of raising at the GraphQL boundary.
      _ -> {:ok, false}
    end
  end

  @spec is_blocked_by_viewer(any(), %{creator_id: term()}, Absinthe.Resolution.t()) ::
          {:ok, boolean()}
  def is_blocked_by_viewer(_parent, %{creator_id: creator_id}, resolution) do
    with {:ok, viewer} <- Resolution.viewer(resolution),
         {:ok, creator} <- fetch_user(creator_id, :creator_id) do
      {:ok, Social.blocked_by_viewer?(viewer, creator)}
    else
      _ -> {:ok, false}
    end
  end

  @spec followers(User.t(), map(), Absinthe.Resolution.t()) :: {:ok, map()}
  def followers(%{id: _id} = user, args, resolution) do
    if can_view_relationship_graph?(user, resolution) do
      query =
        case Resolution.viewer(resolution) do
          {:ok, viewer} -> Social.viewer_follower_users_query(user, viewer)
          :error -> Social.public_follower_users_query(user)
        end

      Absinthe.Relay.Connection.from_query(query, &Social.run_query/1, args)
    else
      Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec following(User.t(), map(), Absinthe.Resolution.t()) :: {:ok, map()}
  def following(%{id: _id} = user, args, resolution) do
    if can_view_relationship_graph?(user, resolution) do
      query =
        case Resolution.viewer(resolution) do
          {:ok, viewer} -> Social.viewer_following_users_query(user, viewer)
          :error -> Social.public_following_users_query(user)
        end

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

  @spec fetch_visible_user(term(), atom(), User.t()) ::
          {:ok, User.t()} | {:error, {atom(), fetch_user_error()}}
  defp fetch_visible_user(user_id, field, %User{} = viewer) do
    with {:ok, user} <- fetch_user(user_id, field),
         false <- ReadPolicy.viewer_blocked_by_owner?(viewer, user) do
      {:ok, user}
    else
      true -> {:error, {field, :not_found}}
      {:error, _reason} = error -> error
    end
  end

  @spec error_only_user_action(map(), Absinthe.Resolution.t(), atom(), (map(), map() -> term())) ::
          {:ok, error_only_result_payload()}
  defp error_only_user_action(args, resolution, target_field, action_fun)
       when is_map(args) and is_atom(target_field) and is_function(action_fun, 2) do
    with {:ok, actor} <- Resolution.viewer(resolution),
         {:ok, target_id} <- Map.fetch(args, target_field) do
      run_error_only_user_action(actor, target_id, target_field, action_fun)
    else
      _other -> {:ok, %{errors: [error_payload(nil, :unauthenticated)]}}
    end
  end

  defp error_only_user_action(_args, _resolution, _target_field, _action_fun) do
    {:ok, %{errors: [error_payload(nil, :unauthenticated)]}}
  end

  @spec run_error_only_user_action(map(), term(), atom(), (map(), map() -> term())) ::
          {:ok, error_only_result_payload()}
  defp run_error_only_user_action(actor, target_id, target_field, action_fun) do
    with {:ok, target} <- fetch_visible_user(target_id, target_field, actor),
         :ok <- normalize_error_only_action(action_fun.(actor, target)) do
      {:ok, %{errors: []}}
    else
      {:error, {field, reason}} ->
        {:ok, %{errors: [error_payload(field, reason)]}}

      {:error, reason} ->
        {:ok, %{errors: [error_payload(nil, reason)]}}
    end
  end

  @spec normalize_error_only_action(:ok | {:ok, term()} | {:error, term()}) ::
          :ok | {:error, term()}
  defp normalize_error_only_action(:ok), do: :ok
  defp normalize_error_only_action({:ok, _result}), do: :ok
  defp normalize_error_only_action({:error, _reason} = error), do: error

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

  @spec can_view_relationship_graph?(User.t(), Absinthe.Resolution.t()) :: boolean()
  defp can_view_relationship_graph?(%User{privacy_mode: :public} = user, resolution) do
    case Resolution.viewer(resolution) do
      {:ok, viewer} -> ReadPolicy.viewer_can_view_relationship_graph?(viewer, user, :public)
      :error -> true
    end
  end

  defp can_view_relationship_graph?(%User{} = user, resolution) do
    case Resolution.viewer(resolution) do
      {:ok, viewer} ->
        ReadPolicy.viewer_can_view_relationship_graph?(viewer, user, user.privacy_mode)

      :error ->
        false
    end
  end
end

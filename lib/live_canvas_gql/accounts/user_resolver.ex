defmodule LCGQL.Accounts.UserResolver do
  alias LC.{Accounts, Feed, ReadPolicy}
  alias LCGQL.{FieldNames, MutationErrors, Relay, Resolution}
  alias LCSchemas.Accounts.{User, UserIdentity}
  alias LCSchemas.Live.LiveSession

  @type mutation_error :: MutationErrors.user_error()
  @type mutation_payload :: %{
          user: User.t() | nil,
          errors: [mutation_error()]
        }
  @type mutation_result :: {:ok, mutation_payload()}
  @type unlink_identity_payload :: %{
          user_identity: UserIdentity.t() | nil,
          errors: [mutation_error()]
        }
  @type unlink_identity_result :: {:ok, unlink_identity_payload()}
  @type connection_result :: {:ok, Absinthe.Relay.Connection.t()} | {:error, term()}
  @type unlink_identity_error_reason ::
          :invalid_identity_id
          | :not_found
          | :already_revoked
          | :last_sign_in_method
          | :unauthenticated

  @spec register_with_email(
          term(),
          %{optional(:input) => map(), optional(:email) => String.t()},
          term()
        ) ::
          mutation_result()
  def register_with_email(parent, %{input: input}, resolution),
    do: register_with_email(parent, input, resolution)

  def register_with_email(_parent, %{email: email}, _resolution) do
    case Accounts.register_user_with_email(%{email: email}) do
      {:ok, user} ->
        {:ok, %{user: user, errors: []}}

      {:error, changeset} ->
        {:ok, %{user: nil, errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)}}
    end
  end

  @spec attach_user_phone_number(
          term(),
          %{
            optional(:input) => map(),
            optional(:phone_number) => String.t()
          },
          Absinthe.Resolution.t()
        ) :: mutation_result()
  def attach_user_phone_number(parent, %{input: input}, resolution),
    do: attach_user_phone_number(parent, input, resolution)

  def attach_user_phone_number(
        _parent,
        %{phone_number: phone_number},
        %{context: %{current_scope: %{user: %{id: _id} = user}}}
      ) do
    with {:ok, _user_phone_number} <- Accounts.attach_user_phone_number(user, phone_number) do
      {:ok, %{user: Accounts.get_user!(user.id), errors: []}}
    else
      {:error, :invalid_phone_number} ->
        {:ok, %{user: nil, errors: [MutationErrors.invalid_error("phoneNumber")]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{user: nil, errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)}}
    end
  end

  # Viewer-scoped phone attachment prevents clients from mutating other users'
  # phone bindings by passing arbitrary user IDs into the GraphQL payload.
  def attach_user_phone_number(_parent, _args, _resolution) do
    {:ok, %{user: nil, errors: [MutationErrors.user_error(nil, :unauthenticated)]}}
  end

  @spec update_viewer_privacy_mode(
          term(),
          %{
            optional(:input) => map(),
            optional(:privacy_mode) => LCSchemas.Accounts.user_privacy_mode()
          },
          Absinthe.Resolution.t()
        ) :: mutation_result()
  def update_viewer_privacy_mode(parent, %{input: input}, resolution),
    do: update_viewer_privacy_mode(parent, input, resolution)

  def update_viewer_privacy_mode(
        _parent,
        %{privacy_mode: privacy_mode},
        %{context: %{current_scope: %{user: %{id: _id} = user}}}
      ) do
    case Accounts.update_user_privacy_mode(user, privacy_mode) do
      {:ok, updated_user} ->
        {:ok, %{user: updated_user, errors: []}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{user: nil, errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)}}
    end
  end

  # Privacy-mode updates are viewer-scoped so clients cannot toggle another
  # account's visibility through GraphQL payload data.
  def update_viewer_privacy_mode(_parent, _args, _resolution) do
    {:ok, %{user: nil, errors: [MutationErrors.user_error(nil, :unauthenticated)]}}
  end

  @spec update_viewer_profile_identity(
          term(),
          %{
            optional(:input) => map(),
            optional(:username) => String.t(),
            optional(:display_name) => String.t()
          },
          Absinthe.Resolution.t()
        ) :: mutation_result()
  def update_viewer_profile_identity(parent, %{input: input}, resolution),
    do: update_viewer_profile_identity(parent, input, resolution)

  def update_viewer_profile_identity(
        _parent,
        %{username: username, display_name: display_name},
        %{context: %{current_scope: %{user: %{id: _id} = user}}}
      ) do
    case Accounts.update_user_profile_identity(user, %{
           username: username,
           display_name: display_name
         }) do
      {:ok, updated_user} ->
        {:ok, %{user: updated_user, errors: []}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok,
         %{
           user: nil,
           errors: MutationErrors.changeset_errors(changeset, &FieldNames.lower_camel/1)
         }}
    end
  end

  # Identity updates are viewer-scoped so a payload cannot select an arbitrary
  # account even though User nodes are globally refetchable.
  def update_viewer_profile_identity(_parent, _args, _resolution) do
    {:ok, %{user: nil, errors: [MutationErrors.user_error(nil, :unauthenticated)]}}
  end

  @spec unlink_viewer_identity(
          term(),
          %{optional(:input) => map(), optional(:user_identity_id) => String.t()},
          Absinthe.Resolution.t()
        ) :: unlink_identity_result()
  def unlink_viewer_identity(parent, %{input: input}, resolution),
    do: unlink_viewer_identity(parent, input, resolution)

  def unlink_viewer_identity(_parent, args, %{
        context: %{current_scope: %{user: %{id: _id} = user}}
      }) do
    with {:ok, identity_id} <- decode_user_identity_id(args),
         {:ok, user_identity} <- Accounts.unlink_user_identity(user, identity_id) do
      {:ok, %{user_identity: user_identity, errors: []}}
    else
      {:error, :invalid_id} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:invalid_identity_id)]}}

      {:error, :invalid_type} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:invalid_identity_id)]}}

      {:error, :not_found} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:not_found)]}}

      {:error, :already_revoked} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:already_revoked)]}}

      {:error, :last_sign_in_method} ->
        {:ok, %{user_identity: nil, errors: [unlink_identity_error(:last_sign_in_method)]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok,
         %{
           user_identity: nil,
           errors: MutationErrors.changeset_errors(changeset, &Atom.to_string/1)
         }}
    end
  end

  def unlink_viewer_identity(_parent, _args, _resolution) do
    {:ok, %{user_identity: nil, errors: [unlink_identity_error(:unauthenticated)]}}
  end

  @spec user_identity_auth_provider(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, :google | :apple | :passkey | nil}
  def user_identity_auth_provider(%{provider: provider}, _args, _resolution) do
    {:ok, auth_provider_value(provider)}
  end

  @spec user_identity_oauth_provider(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, :google | :apple | :instagram | nil}
  def user_identity_oauth_provider(%{provider: provider}, _args, _resolution) do
    {:ok, oauth_provider_value(provider)}
  end

  @spec user_identity_can_unlink(map(), map(), Absinthe.Resolution.t()) :: {:ok, boolean()}
  def user_identity_can_unlink(%{id: identity_id, user_id: user_id}, _args, resolution)
      when is_integer(identity_id) and is_integer(user_id) do
    case Resolution.viewer(resolution) do
      {:ok, %{id: ^user_id} = viewer} ->
        {:ok, Accounts.user_identity_unlinkable?(viewer, identity_id)}

      _other ->
        {:ok, false}
    end
  end

  def user_identity_can_unlink(_user_identity, _args, _resolution), do: {:ok, false}

  @spec viewer(term(), map(), Absinthe.Resolution.t()) :: {:ok, User.t() | nil}

  def viewer(_parent, _args, %{context: %{current_scope: %{user: %{id: _id} = user}}}) do
    {:ok, user}
  end

  def viewer(_parent, _args, _resolution), do: {:ok, nil}

  @spec user_email(map(), map(), Absinthe.Resolution.t()) :: {:ok, String.t() | nil}
  def user_email(%{id: user_id}, _args, resolution) when is_integer(user_id) do
    case Resolution.viewer(resolution) do
      {:ok, %{id: ^user_id, email: email}} -> {:ok, email}
      _other -> {:ok, nil}
    end
  end

  def user_email(_user, _args, _resolution), do: {:ok, nil}

  @spec user_username(map(), map(), Absinthe.Resolution.t()) :: {:ok, String.t() | nil}
  def user_username(user, _args, resolution),
    do: public_profile_identity_value(user, :username, resolution)

  @spec user_display_name(map(), map(), Absinthe.Resolution.t()) :: {:ok, String.t() | nil}
  def user_display_name(user, _args, resolution),
    do: public_profile_identity_value(user, :display_name, resolution)

  @spec user_posts(map(), map(), Absinthe.Resolution.t()) :: connection_result()
  def user_posts(%{id: owner_id} = owner, args, resolution) when is_integer(owner_id) do
    visible_profile_connection(args, resolution, fn viewer ->
      Feed.profile_posts_query(viewer, owner)
    end)
  end

  def user_posts(_owner, args, _resolution), do: Absinthe.Relay.Connection.from_list([], args)

  @spec user_story_feed(map(), map(), Absinthe.Resolution.t()) :: connection_result()
  def user_story_feed(%{id: owner_id} = owner, args, resolution) when is_integer(owner_id) do
    visible_profile_connection(args, resolution, fn viewer ->
      Feed.profile_story_feed_query(viewer, owner)
    end)
  end

  def user_story_feed(_owner, args, _resolution),
    do: Absinthe.Relay.Connection.from_list([], args)

  @spec user_current_live_session(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, LiveSession.t() | nil}
  def user_current_live_session(%{id: owner_id} = owner, _args, resolution)
      when is_integer(owner_id) do
    with {:ok, viewer} <- Resolution.viewer(resolution) do
      # `User` nodes are globally refetchable, so child fields must reuse the
      # viewer-scoped feed policy instead of trusting the parent node shape.
      {:ok, Feed.profile_current_live_session(viewer, owner)}
    else
      _other -> {:ok, nil}
    end
  end

  def user_current_live_session(_owner, _args, _resolution), do: {:ok, nil}

  @spec user_replay_feed(map(), map(), Absinthe.Resolution.t()) :: connection_result()
  def user_replay_feed(%{id: owner_id} = owner, args, resolution) when is_integer(owner_id) do
    visible_profile_connection(args, resolution, fn viewer ->
      Feed.profile_replay_feed_query(viewer, owner)
    end)
  end

  def user_replay_feed(_owner, args, _resolution),
    do: Absinthe.Relay.Connection.from_list([], args)

  @spec user_identity_user(map(), map(), Absinthe.Resolution.t()) ::
          LCGQL.Dataloader.dataloader_result()
  def user_identity_user(%{user: %{id: user_id} = user}, _args, resolution)
      when is_integer(user_id) do
    case Resolution.viewer_id(resolution) do
      {:ok, ^user_id} -> {:ok, user}
      _other -> {:ok, nil}
    end
  end

  def user_identity_user(%{user_id: user_id} = user_identity, _args, resolution)
      when is_integer(user_id) do
    case Resolution.viewer_id(resolution) do
      {:ok, ^user_id} -> LCGQL.Dataloader.load_assoc(user_identity, :user, Accounts, resolution)
      _other -> {:ok, nil}
    end
  end

  def user_identity_user(_user_identity, _args, _resolution), do: {:ok, nil}

  @spec user_identities(map(), map(), Absinthe.Resolution.t()) :: connection_result()
  def user_identities(%{id: user_id} = user, args, resolution) when is_integer(user_id) do
    case Resolution.viewer_id(resolution) do
      {:ok, ^user_id} ->
        query = Accounts.user_identities_query(user)
        Absinthe.Relay.Connection.from_query(query, &Accounts.run_query/1, args)

      _other ->
        Absinthe.Relay.Connection.from_list([], args)
    end
  end

  def user_identities(_user, args, _resolution),
    do: Absinthe.Relay.Connection.from_list([], args)

  @spec visible_profile_connection(
          map(),
          Absinthe.Resolution.t(),
          (map() -> Ecto.Query.t())
        ) :: connection_result()
  defp visible_profile_connection(args, resolution, query_builder)
       when is_map(args) and is_function(query_builder, 1) do
    with {:ok, viewer} <- Resolution.viewer(resolution) do
      # Relay user IDs can be reached from `viewer`, `post.author`, `host`, or
      # `node(id:)`, so each child connection rebuilds the feed query from the
      # current viewer instead of assuming parent ownership implies access.
      viewer
      |> query_builder.()
      |> Absinthe.Relay.Connection.from_query(&Feed.run_query/1, args)
    else
      _other -> Absinthe.Relay.Connection.from_list([], args)
    end
  end

  @spec public_profile_identity_value(map(), :display_name | :username, Absinthe.Resolution.t()) ::
          {:ok, String.t() | nil}
  defp public_profile_identity_value(%User{id: owner_id} = owner, field, resolution)
       when is_integer(owner_id) and field in [:display_name, :username] do
    case Resolution.viewer(resolution) do
      {:ok, %User{id: ^owner_id}} ->
        {:ok, Map.get(owner, field)}

      {:ok, %User{} = viewer} ->
        if ReadPolicy.viewer_blocked_by_owner?(viewer, owner),
          do: {:ok, nil},
          else: {:ok, Map.get(owner, field)}

      :error ->
        {:ok, Map.get(owner, field)}
    end
  end

  defp public_profile_identity_value(_user, _field, _resolution), do: {:ok, nil}

  @spec unlink_identity_error(unlink_identity_error_reason()) :: mutation_error()
  defp unlink_identity_error(:invalid_identity_id),
    do: MutationErrors.invalid_error("userIdentityId")

  defp unlink_identity_error(:not_found),
    do: MutationErrors.user_error(nil, :not_found)

  defp unlink_identity_error(:already_revoked),
    do: MutationErrors.user_error(nil, :already_revoked)

  defp unlink_identity_error(:last_sign_in_method),
    do: MutationErrors.user_error(nil, :last_sign_in_method)

  defp unlink_identity_error(:unauthenticated),
    do: MutationErrors.user_error(nil, :unauthenticated)

  @spec decode_user_identity_id(map()) :: {:ok, pos_integer()} | {:error, Relay.decode_error()}
  defp decode_user_identity_id(args) when is_map(args) do
    args
    |> Map.get(:user_identity_id)
    |> Relay.decode_global_id(:user_identity, LCGQL.Schema)
  end

  @spec auth_provider_value(LCSchemas.Accounts.user_identity_provider()) ::
          :google | :apple | :passkey | nil
  defp auth_provider_value(:google_provider), do: :google
  defp auth_provider_value(:apple_provider), do: :apple
  defp auth_provider_value(:passkey_provider), do: :passkey
  defp auth_provider_value(_provider), do: nil

  @spec oauth_provider_value(LCSchemas.Accounts.user_identity_provider()) ::
          :google | :apple | :instagram | nil
  defp oauth_provider_value(:google_provider), do: :google
  defp oauth_provider_value(:apple_provider), do: :apple
  defp oauth_provider_value(:instagram_provider), do: :instagram
  defp oauth_provider_value(_provider), do: nil
end

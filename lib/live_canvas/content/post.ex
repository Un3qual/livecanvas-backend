defmodule LC.Content.Post do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Content.Post, as: PostSchema

  @story_ttl_seconds 24 * 60 * 60

  @type attrs :: %{
          optional(:author_id | :kind | :body_text | :visibility | :expires_at | String.t()) =>
            term()
        }
  @type update_attrs :: %{
          optional(:body_text | :visibility | String.t()) => term()
        }

  @doc """
  Injects required ownership metadata while keeping caller-provided fields intact.
  """
  @spec attrs_for_insert(pos_integer(), map()) :: attrs()
  def attrs_for_insert(author_id, attrs) when is_integer(author_id) and is_map(attrs) do
    Map.put(attrs, :author_id, author_id)
  end

  @doc """
  Builds the post changeset used by the `LC.Content` boundary.
  """
  @spec changeset(PostSchema.t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%PostSchema{} = post, attrs) when is_map(attrs) do
    now = DateTime.utc_now()

    post
    |> cast(attrs, [:author_id, :kind, :body_text, :visibility, :expires_at])
    |> validate_required([:author_id, :kind])
    |> validate_length(:body_text, max: 5000)
    |> normalize_story_expiration(now)
    |> validate_story_expiration(now)
  end

  @doc """
  Builds the post update changeset for viewer-scoped lifecycle writes.
  """
  @spec update_changeset(PostSchema.t(), update_attrs()) :: Ecto.Changeset.t()
  def update_changeset(%PostSchema{} = post, attrs) when is_map(attrs) do
    post
    |> cast(attrs, [:body_text, :visibility])
    |> validate_required([:visibility])
    |> validate_length(:body_text, max: 5000)
  end

  @spec normalize_story_expiration(Ecto.Changeset.t(), DateTime.t()) :: Ecto.Changeset.t()
  defp normalize_story_expiration(changeset, %DateTime{} = now) do
    case get_field(changeset, :kind) do
      :story ->
        case get_field(changeset, :expires_at) do
          nil ->
            # Story expiry is server-owned so omitted client input cannot create
            # effectively permanent stories.
            put_change(changeset, :expires_at, DateTime.add(now, @story_ttl_seconds, :second))

          _expires_at ->
            changeset
        end

      :standard ->
        put_change(changeset, :expires_at, nil)

      _kind ->
        changeset
    end
  end

  @spec validate_story_expiration(Ecto.Changeset.t(), DateTime.t()) :: Ecto.Changeset.t()
  defp validate_story_expiration(changeset, %DateTime{} = now) do
    case get_field(changeset, :kind) do
      :story ->
        expires_at = get_field(changeset, :expires_at)
        max_expires_at = DateTime.add(now, @story_ttl_seconds, :second)

        changeset
        |> validate_story_expiration_future(expires_at, now)
        |> validate_story_expiration_bound(expires_at, max_expires_at)

      _kind ->
        changeset
    end
  end

  @spec validate_story_expiration_future(Ecto.Changeset.t(), term(), DateTime.t()) ::
          Ecto.Changeset.t()
  defp validate_story_expiration_future(changeset, %DateTime{} = expires_at, %DateTime{} = now) do
    if DateTime.compare(expires_at, now) == :gt do
      changeset
    else
      add_error(changeset, :expires_at, "must be in the future")
    end
  end

  defp validate_story_expiration_future(changeset, _expires_at, _now), do: changeset

  @spec validate_story_expiration_bound(Ecto.Changeset.t(), term(), DateTime.t()) ::
          Ecto.Changeset.t()
  defp validate_story_expiration_bound(
         changeset,
         %DateTime{} = expires_at,
         %DateTime{} = max_expires_at
       ) do
    if DateTime.compare(expires_at, max_expires_at) in [:lt, :eq] do
      changeset
    else
      add_error(changeset, :expires_at, "must be within 24 hours")
    end
  end

  defp validate_story_expiration_bound(changeset, _expires_at, _max_expires_at), do: changeset
end

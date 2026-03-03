defmodule LC.Content.Post do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Content.Post, as: PostSchema

  @type attrs :: %{
          optional(:author_id | :kind | :body_text | :visibility | :expires_at | String.t()) =>
            term()
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
    post
    |> cast(attrs, [:author_id, :kind, :body_text, :visibility, :expires_at])
    |> validate_required([:author_id, :kind])
    |> validate_length(:body_text, max: 5000)
  end
end

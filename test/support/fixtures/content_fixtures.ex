defmodule LC.ContentFixtures do
  @moduledoc false

  import LC.AccountsFixtures, only: [user_fixture: 0]

  alias LC.Content
  alias LC.Infra.Repo
  alias LCSchemas.Content.{MediaAsset, Post}

  @spec post_fixture(map()) :: Post.t()
  def post_fixture(attrs \\ %{}) do
    author = user_fixture()
    post_fixture(author, attrs)
  end

  @spec post_fixture(struct(), map()) :: Post.t()
  def post_fixture(author, attrs) when is_map(attrs) do
    attrs =
      Enum.into(attrs, %{
        body_text: "fixture post",
        kind: :standard
      })

    {:ok, post} = Content.create_post(author, attrs)
    post
  end

  @spec media_asset_fixture(struct(), map()) :: MediaAsset.t()
  def media_asset_fixture(owner, attrs \\ %{}) when is_map(attrs) do
    attrs =
      Enum.into(attrs, %{
        mime_type: "image/jpeg",
        processing_state: :uploaded,
        storage_key: "uploads/users/#{owner.id}/fixture.jpg"
      })

    %MediaAsset{}
    |> Ecto.Changeset.change(Map.put(attrs, :owner_id, owner.id))
    |> Repo.insert!()
  end
end

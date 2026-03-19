defmodule LCGQL.Content.Resolver do
  import Ecto.Changeset, only: [traverse_errors: 2]

  alias LC.{Accounts, Content, Feed}
  alias LCGQL.Relay
  alias LCSchemas.Content.{MediaAsset, Post}

  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type create_post_payload :: %{post: Post.t() | nil, errors: [mutation_error()]}
  @type create_post_result :: {:ok, create_post_payload()}
  @type signed_upload_header_view :: %{name: String.t(), value: String.t()}
  @type signed_upload_view :: %{
          method: :put | :post,
          url: String.t(),
          expires_at: String.t(),
          headers: [signed_upload_header_view()]
        }
  @type request_media_upload_payload :: %{
          media_asset: MediaAsset.t() | nil,
          signed_upload: signed_upload_view() | nil,
          errors: [mutation_error()]
        }
  @type request_media_upload_result :: {:ok, request_media_upload_payload()}
  @type update_post_payload :: %{post: Post.t() | nil, errors: [mutation_error()]}
  @type update_post_result :: {:ok, update_post_payload()}
  @type delete_post_payload :: %{deleted_post_id: String.t() | nil, errors: [mutation_error()]}
  @type delete_post_result :: {:ok, delete_post_payload()}
  @type post_mutation_reason :: :invalid_id | :invalid_type | :not_found | :unauthenticated

  @spec create_post(
          term(),
          %{
            optional(:input) => map(),
            optional(:body_text) => String.t(),
            optional(:kind) => atom(),
            optional(:media_asset_ids) => [term()],
            optional(:visibility) => atom()
          },
          Absinthe.Resolution.t()
        ) :: create_post_result()
  def create_post(parent, %{input: input}, resolution), do: create_post(parent, input, resolution)

  def create_post(_parent, attrs, %{context: %{current_scope: %{user: %{id: _id} = author}}}) do
    with {:ok, post_attrs} <- create_post_attrs(attrs),
         {:ok, post} <- Content.create_post(author, post_attrs) do
      {:ok, %{post: post, errors: []}}
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{post: nil, errors: format_changeset_errors(changeset)}}

      {:error, reason} when reason in [:invalid_id, :invalid_type] ->
        {:ok, %{post: nil, errors: [post_mutation_error(:media_asset_ids, reason)]}}
    end
  end

  # Post creation is viewer-owned to prevent impersonation via client-supplied
  # author IDs in mutation input payloads.
  def create_post(_parent, _attrs, _resolution) do
    {:ok, %{post: nil, errors: [%{field: nil, message: "unauthenticated"}]}}
  end

  @spec request_media_upload(
          term(),
          %{optional(:input) => map(), optional(:mime_type) => String.t()},
          Absinthe.Resolution.t()
        ) :: request_media_upload_result()
  def request_media_upload(parent, %{input: input}, resolution),
    do: request_media_upload(parent, input, resolution)

  def request_media_upload(_parent, %{mime_type: mime_type}, %{
        context: %{current_scope: %{user: %{id: _id} = viewer}}
      }) do
    case Content.request_media_upload(viewer, %{mime_type: mime_type}) do
      {:ok, %{media_asset: media_asset, upload: upload}} ->
        {:ok, %{media_asset: media_asset, signed_upload: signed_upload_view(upload), errors: []}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{media_asset: nil, signed_upload: nil, errors: format_changeset_errors(changeset)}}

      {:error, _reason} ->
        {:ok,
         %{
           media_asset: nil,
           signed_upload: nil,
           errors: [%{field: nil, message: "upload_unavailable"}]
         }}
    end
  end

  # Upload intents are viewer-scoped so clients cannot mint signed uploads on
  # behalf of other users.
  def request_media_upload(_parent, _attrs, _resolution) do
    {:ok,
     %{media_asset: nil, signed_upload: nil, errors: [%{field: nil, message: "unauthenticated"}]}}
  end

  @spec update_post(
          term(),
          %{
            optional(:input) => map(),
            optional(:post_id) => term(),
            optional(:body_text) => String.t(),
            optional(:visibility) => atom()
          },
          Absinthe.Resolution.t()
        ) :: update_post_result()
  def update_post(parent, %{input: input}, resolution), do: update_post(parent, input, resolution)

  def update_post(_parent, %{post_id: post_id} = attrs, %{
        context: %{current_scope: %{user: %{id: _id} = viewer}}
      }) do
    with {:ok, id} <- decode_post_id(post_id),
         {:ok, post} <- Content.update_user_post(viewer, id, update_post_attrs(attrs)) do
      {:ok, %{post: post, errors: []}}
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{post: nil, errors: format_changeset_errors(changeset)}}

      {:error, reason} when reason in [:invalid_id, :invalid_type, :not_found] ->
        {:ok, %{post: nil, errors: [post_mutation_error(:post_id, reason)]}}
    end
  end

  # Post updates are viewer-scoped so clients cannot mutate posts they do not
  # own by providing arbitrary Relay IDs.
  def update_post(_parent, _attrs, _resolution) do
    {:ok, %{post: nil, errors: [post_mutation_error(nil, :unauthenticated)]}}
  end

  @spec delete_post(
          term(),
          %{optional(:input) => map(), optional(:post_id) => term()},
          Absinthe.Resolution.t()
        ) :: delete_post_result()
  def delete_post(parent, %{input: input}, resolution), do: delete_post(parent, input, resolution)

  def delete_post(_parent, %{post_id: post_id}, %{
        context: %{current_scope: %{user: %{id: _id} = viewer}}
      }) do
    with {:ok, id} <- decode_post_id(post_id),
         {:ok, deleted_post} <- Content.delete_user_post(viewer, id) do
      {:ok,
       %{
         deleted_post_id: Absinthe.Relay.Node.to_global_id(:post, deleted_post.id, LCGQL.Schema),
         errors: []
       }}
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{deleted_post_id: nil, errors: format_changeset_errors(changeset)}}

      {:error, reason} when reason in [:invalid_id, :invalid_type, :not_found] ->
        {:ok, %{deleted_post_id: nil, errors: [post_mutation_error(:post_id, reason)]}}
    end
  end

  def delete_post(_parent, _attrs, _resolution) do
    {:ok, %{deleted_post_id: nil, errors: [post_mutation_error(nil, :unauthenticated)]}}
  end

  @spec post(term(), %{id: term()}, term()) :: {:ok, Post.t() | nil}
  def post(_parent, %{id: post_id}, resolution) do
    with {:ok, id} <- Relay.decode_global_id(post_id, :post, LCGQL.Schema) do
      {:ok, visible_post(id, resolution)}
    else
      _ -> {:ok, nil}
    end
  end

  @spec media_asset(term(), %{id: term()}, Absinthe.Resolution.t()) :: {:ok, MediaAsset.t() | nil}
  def media_asset(_parent, %{id: media_asset_id}, %{
        context: %{current_scope: %{user: %{id: _id} = viewer}}
      }) do
    with {:ok, id} <- Relay.decode_global_id(media_asset_id, :media_asset, LCGQL.Schema) do
      {:ok, Content.get_user_media_asset(viewer, id)}
    else
      _ -> {:ok, nil}
    end
  end

  def media_asset(_parent, _args, _resolution), do: {:ok, nil}

  @spec media_asset_public_url(map(), map(), Absinthe.Resolution.t()) ::
          {:ok, String.t() | nil}
  def media_asset_public_url(%{storage_key: _storage_key} = media_asset, _args, _resolution) do
    case Content.media_asset_public_url(media_asset) do
      {:ok, public_url} ->
        {:ok, public_url}

      # Preserve media-asset query availability even if storage configuration
      # is temporarily unavailable; clients can retry using the same node ID.
      {:error, _reason} ->
        {:ok, nil}
    end
  end

  def media_asset_public_url(_media_asset, _args, _resolution), do: {:ok, nil}

  @spec author(map(), map(), Absinthe.Resolution.t()) :: LCGQL.Dataloader.dataloader_result()
  def author(%{author: %{id: _id} = author}, _args, _resolution), do: {:ok, author}

  def author(%{author_id: author_id} = post, _args, resolution) when is_integer(author_id),
    do: LCGQL.Dataloader.load_assoc(post, :author, Accounts, resolution)

  def author(_post, _args, _resolution), do: {:ok, nil}

  @spec media_assets(map(), map(), Absinthe.Resolution.t()) ::
          LCGQL.Dataloader.dataloader_result()
  def media_assets(%{id: post_id} = post, _args, %{context: %{loader: loader}})
      when is_integer(post_id) and post_id > 0 do
    # The parent post has already passed viewer visibility checks, so this
    # child-field association load can safely expose the post-owned media list.
    loader
    |> Dataloader.load(Content, :media_assets, post)
    |> Absinthe.Resolution.Helpers.on_load(fn loader ->
      {:ok,
       loader
       |> Dataloader.get(Content, :media_assets, post)
       |> normalize_post_media_assets()}
    end)
  end

  def media_assets(_post, _args, _resolution), do: {:ok, []}

  @spec format_changeset_errors(Ecto.Changeset.t()) :: [mutation_error()]
  defp format_changeset_errors(changeset) do
    changeset
    |> traverse_errors(fn {message, options} ->
      Enum.reduce(options, message, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.flat_map(fn {field, messages} ->
      Enum.map(messages, fn message ->
        %{field: to_string(field), message: message}
      end)
    end)
  end

  @spec signed_upload_view(LC.Infra.ObjectStorage.signed_upload()) :: signed_upload_view()
  defp signed_upload_view(upload) do
    %{
      method: upload.method,
      url: upload.url,
      expires_at: DateTime.to_iso8601(upload.expires_at),
      headers: upload_headers_view(upload.headers)
    }
  end

  @spec upload_headers_view(%{optional(String.t()) => String.t()}) :: [
          signed_upload_header_view()
        ]
  defp upload_headers_view(headers) do
    headers
    |> Enum.sort_by(fn {name, _value} -> name end)
    |> Enum.map(fn {name, value} -> %{name: name, value: value} end)
  end

  defp decode_post_id(post_id), do: Relay.decode_global_id(post_id, :post, LCGQL.Schema)

  @spec create_post_attrs(map()) ::
          {:ok, %{optional(:body_text | :kind | :media_asset_ids | :visibility) => term()}}
          | {:error, Relay.decode_error()}
  defp create_post_attrs(attrs) when is_map(attrs) do
    with {:ok, media_asset_ids} <- decode_media_asset_ids(Map.get(attrs, :media_asset_ids)) do
      {:ok,
       attrs
       |> Map.put_new(:visibility, :followers)
       |> maybe_put_media_asset_ids(media_asset_ids)}
    end
  end

  @spec decode_media_asset_ids(nil | [term()]) ::
          {:ok, nil | [pos_integer()]} | {:error, Relay.decode_error()}
  defp decode_media_asset_ids(nil), do: {:ok, nil}

  defp decode_media_asset_ids(media_asset_ids) when is_list(media_asset_ids) do
    media_asset_ids
    |> Enum.reduce_while({:ok, []}, fn media_asset_id, {:ok, decoded_ids} ->
      case Relay.decode_global_id(media_asset_id, :media_asset, LCGQL.Schema) do
        {:ok, decoded_id} -> {:cont, {:ok, [decoded_id | decoded_ids]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, decoded_ids} -> {:ok, Enum.reverse(decoded_ids)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp decode_media_asset_ids(_media_asset_ids), do: {:error, :invalid_id}

  @spec visible_post(pos_integer(), Absinthe.Resolution.t()) :: Post.t() | nil
  defp visible_post(id, %{context: %{current_scope: %{user: %{id: _id} = viewer}}})
       when is_integer(id) and id > 0 do
    Feed.get_visible_post(viewer, id)
  end

  defp visible_post(id, _resolution) when is_integer(id) and id > 0 do
    Feed.get_visible_post(nil, id)
  end

  @spec update_post_attrs(map()) :: %{optional(:body_text | :visibility) => term()}
  defp update_post_attrs(attrs) when is_map(attrs) do
    # Restrict updates to launch-safe mutable fields and keep kind/author
    # immutable through this API surface.
    Map.take(attrs, [:body_text, :visibility])
  end

  @spec maybe_put_media_asset_ids(map(), nil | [pos_integer()]) :: map()
  defp maybe_put_media_asset_ids(attrs, nil), do: Map.delete(attrs, :media_asset_ids)
  defp maybe_put_media_asset_ids(attrs, media_asset_ids), do: Map.put(attrs, :media_asset_ids, media_asset_ids)

  @spec normalize_post_media_assets([MediaAsset.t()] | term()) :: [MediaAsset.t()]
  defp normalize_post_media_assets(media_assets) when is_list(media_assets) do
    Enum.sort_by(media_assets, fn media_asset ->
      {media_asset.inserted_at, media_asset.id}
    end)
  end

  defp normalize_post_media_assets(_media_assets), do: []

  @spec post_mutation_error(:media_asset_ids | :post_id | nil, post_mutation_reason()) ::
          mutation_error()
  defp post_mutation_error(field, reason) do
    %{
      field: format_post_field(field),
      message: Atom.to_string(reason)
    }
  end

  @spec format_post_field(:media_asset_ids | :post_id | nil) :: String.t() | nil
  defp format_post_field(nil), do: nil
  defp format_post_field(:media_asset_ids), do: "mediaAssetIds"
  defp format_post_field(:post_id), do: "postId"
end

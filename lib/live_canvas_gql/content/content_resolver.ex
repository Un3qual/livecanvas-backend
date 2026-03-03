defmodule LCGQL.Content.Resolver do
  import Ecto.Changeset, only: [traverse_errors: 2]

  alias LC.{Accounts, Content}
  alias LCGQL.Relay
  alias LCSchemas.Accounts.User
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

  @spec create_post(
          term(),
          %{
            optional(:input) => map(),
            optional(:body_text) => String.t(),
            optional(:kind) => atom(),
            optional(:visibility) => atom()
          },
          Absinthe.Resolution.t()
        ) :: create_post_result()
  def create_post(parent, %{input: input}, resolution), do: create_post(parent, input, resolution)

  def create_post(_parent, attrs, %{context: %{current_scope: %{user: %{id: _id} = author}}}) do
    post_attrs =
      attrs
      |> Map.put_new(:visibility, :followers)

    with {:ok, post} <- Content.create_post(author, post_attrs) do
      {:ok, %{post: post, errors: []}}
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{post: nil, errors: format_changeset_errors(changeset)}}
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
         %{media_asset: nil, signed_upload: nil, errors: [%{field: nil, message: "upload_unavailable"}]}}
    end
  end

  # Upload intents are viewer-scoped so clients cannot mint signed uploads on
  # behalf of other users.
  def request_media_upload(_parent, _attrs, _resolution) do
    {:ok, %{media_asset: nil, signed_upload: nil, errors: [%{field: nil, message: "unauthenticated"}]}}
  end

  @spec post(term(), %{id: term()}, term()) :: {:ok, Post.t() | nil}
  def post(_parent, %{id: post_id}, _resolution) do
    with {:ok, id} <- Relay.decode_global_id(post_id, :post, LCGQL.Schema) do
      {:ok, Content.get_post(id)}
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

  @spec author(map(), map(), Absinthe.Resolution.t()) :: {:ok, User.t() | nil}
  def author(%{author_id: author_id}, _args, _resolution) when is_integer(author_id) do
    try do
      {:ok, Accounts.get_user!(author_id)}
    rescue
      Ecto.NoResultsError -> {:ok, nil}
    end
  end

  def author(_post, _args, _resolution), do: {:ok, nil}

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

  @spec upload_headers_view(%{optional(String.t()) => String.t()}) :: [signed_upload_header_view()]
  defp upload_headers_view(headers) do
    headers
    |> Enum.sort_by(fn {name, _value} -> name end)
    |> Enum.map(fn {name, value} -> %{name: name, value: value} end)
  end
end

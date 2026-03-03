defmodule LCGQL.Content.Resolver do
  import Ecto.Changeset, only: [traverse_errors: 2]

  alias LC.{Accounts, Content}
  alias LCGQL.Relay
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post

  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type create_post_payload :: %{post: Post.t() | nil, errors: [mutation_error()]}
  @type create_post_result :: {:ok, create_post_payload()}

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

  @spec post(term(), %{id: term()}, term()) :: {:ok, Post.t() | nil}
  def post(_parent, %{id: post_id}, _resolution) do
    with {:ok, id} <- Relay.decode_global_id(post_id, :post, LCGQL.Schema) do
      {:ok, Content.get_post(id)}
    else
      _ -> {:ok, nil}
    end
  end

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
end

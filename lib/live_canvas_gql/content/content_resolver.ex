defmodule LCGQL.Content.Resolver do
  import Ecto.Changeset, only: [traverse_errors: 2]

  alias LC.{Accounts, Content}
  alias LCGQL.Relay
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.Post

  @type mutation_error :: %{field: String.t() | nil, message: String.t()}
  @type create_post_payload :: %{post: Post.t() | nil, errors: [mutation_error()]}
  @type create_post_result :: {:ok, create_post_payload()}
  @type user_lookup_error :: :invalid_id | :invalid_type | :not_found
  @type user_lookup_result :: {:ok, User.t()} | {:error, user_lookup_error()}

  @spec create_post(
          term(),
          %{
            optional(:input) => map(),
            optional(:author_id) => term(),
            optional(:body_text) => String.t(),
            optional(:kind) => atom(),
            optional(:visibility) => atom()
          },
          term()
        ) :: create_post_result()
  def create_post(parent, %{input: input}, resolution), do: create_post(parent, input, resolution)

  def create_post(_parent, %{author_id: author_id} = attrs, _resolution) do
    post_attrs =
      attrs
      |> Map.drop([:author_id])
      |> Map.put_new(:visibility, :followers)

    with {:ok, author} <- fetch_user(author_id),
         {:ok, post} <- Content.create_post(author, post_attrs) do
      {:ok, %{post: post, errors: []}}
    else
      {:error, :invalid_id} ->
        {:ok, %{post: nil, errors: [%{field: "authorId", message: "is invalid"}]}}

      {:error, :invalid_type} ->
        {:ok, %{post: nil, errors: [%{field: "authorId", message: "has an invalid type"}]}}

      {:error, :not_found} ->
        {:ok, %{post: nil, errors: [%{field: "authorId", message: "does not exist"}]}}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:ok, %{post: nil, errors: format_changeset_errors(changeset)}}
    end
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

  @spec fetch_user(term()) :: user_lookup_result()
  defp fetch_user(author_id) do
    with {:ok, id} <- Relay.decode_global_id(author_id, :user, LCGQL.Schema) do
      try do
        {:ok, Accounts.get_user!(id)}
      rescue
        Ecto.NoResultsError -> {:error, :not_found}
      end
    end
  end

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

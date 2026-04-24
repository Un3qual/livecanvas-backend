defmodule LC.Content.PostReport do
  @moduledoc false

  import Ecto.Changeset

  alias LCSchemas.Content.PostReport, as: PostReportSchema

  @type attrs :: %{
          optional(:reporter_id | :post_id | :reason | :details | :status | String.t()) => term()
        }

  @doc """
  Injects server-owned reporter/post identifiers into report attrs.
  """
  @spec attrs_for_insert(pos_integer(), pos_integer(), map()) :: attrs()
  def attrs_for_insert(reporter_id, post_id, attrs)
      when is_integer(reporter_id) and is_integer(post_id) and is_map(attrs) do
    attrs
    |> Map.put(:reporter_id, reporter_id)
    |> Map.put(:post_id, post_id)
    |> Map.put_new(:status, :open)
  end

  @doc """
  Builds a post-report changeset for the `LC.Content` boundary.
  """
  @spec changeset(PostReportSchema.t(), attrs()) :: Ecto.Changeset.t()
  def changeset(%PostReportSchema{} = report, attrs) when is_map(attrs) do
    report
    |> cast(attrs, [:reporter_id, :post_id, :reason, :details, :status])
    |> validate_required([:reporter_id, :post_id, :reason, :status])
    |> validate_length(:details, max: 2000)
    |> foreign_key_constraint(:reporter_id)
    |> foreign_key_constraint(:post_id)
    |> unique_constraint([:reporter_id, :post_id])
  end
end

defmodule LCGQL.Resolution do
  @moduledoc false

  @type viewer_result :: {:ok, map()} | :error
  @type viewer_id_result :: {:ok, pos_integer()} | :error

  @spec viewer(Absinthe.Resolution.t()) :: viewer_result()
  def viewer(%Absinthe.Resolution{
        context: %{current_scope: %{user: %{id: user_id} = viewer}}
      })
      when is_integer(user_id),
      do: {:ok, viewer}

  def viewer(_resolution), do: :error

  @spec viewer_id(Absinthe.Resolution.t()) :: viewer_id_result()
  def viewer_id(%Absinthe.Resolution{
        context: %{current_scope: %{user: %{id: user_id}}}
      })
      when is_integer(user_id),
      do: {:ok, user_id}

  def viewer_id(_resolution), do: :error
end

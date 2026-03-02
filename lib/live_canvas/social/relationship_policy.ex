defmodule LiveCanvas.Social.RelationshipPolicy do
  @moduledoc false

  @type follow_decision_result :: %{
          required(:accepted_at) => DateTime.t() | nil,
          required(:requested_at) => DateTime.t(),
          required(:state) => :accepted | :requested
        }

  @doc """
  Decides whether a new follow should be requested or accepted immediately.
  """
  @spec follow_decision(map()) :: follow_decision_result() | {:error, :blocked}
  def follow_decision(%{blocked?: true}), do: {:error, :blocked}

  def follow_decision(%{followed_privacy_mode: :public, now: now}) do
    %{state: :accepted, requested_at: now, accepted_at: now}
  end

  def follow_decision(%{now: now}) do
    %{state: :requested, requested_at: now, accepted_at: nil}
  end
end

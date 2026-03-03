defmodule LC.Infra.WebhookEvent do
  @moduledoc false

  import Ecto.Changeset

  alias LC.Infra.Repo
  alias LCSchemas.Infra.WebhookEvent, as: WebhookEventSchema

  @type changeset :: Ecto.Changeset.t()
  @type record_result ::
          {:ok, WebhookEventSchema.t(), :duplicate | :inserted} | {:error, changeset()}

  @doc """
  Persists webhook events idempotently by provider + external event id.
  """
  @spec record_event(String.t(), String.t(), map()) :: record_result()
  def record_event(provider, external_event_id, attrs \\ %{})
      when is_binary(provider) and is_binary(external_event_id) and is_map(attrs) do
    with nil <-
           Repo.get_by(WebhookEventSchema,
             provider: provider,
             external_event_id: external_event_id
           ),
         {:ok, event} <- insert_event(provider, external_event_id, attrs) do
      {:ok, event, :inserted}
    else
      %WebhookEventSchema{} = event ->
        {:ok, event, :duplicate}

      {:error, %Ecto.Changeset{} = changeset} ->
        resolve_unique_event_conflict(changeset, provider, external_event_id)
    end
  end

  @spec insert_event(String.t(), String.t(), map()) ::
          {:ok, WebhookEventSchema.t()} | {:error, changeset()}
  defp insert_event(provider, external_event_id, attrs) do
    attrs =
      attrs
      |> Map.put(:provider, provider)
      |> Map.put(:external_event_id, external_event_id)
      |> Map.put_new(:received_at, utc_now())

    %WebhookEventSchema{}
    |> changeset(attrs)
    |> Repo.insert()
  end

  @spec resolve_unique_event_conflict(changeset(), String.t(), String.t()) :: record_result()
  defp resolve_unique_event_conflict(changeset, provider, external_event_id) do
    if unique_external_event_conflict?(changeset) do
      case Repo.get_by(WebhookEventSchema,
             provider: provider,
             external_event_id: external_event_id
           ) do
        %WebhookEventSchema{} = event -> {:ok, event, :duplicate}
        nil -> {:error, changeset}
      end
    else
      {:error, changeset}
    end
  end

  @spec unique_external_event_conflict?(changeset()) :: boolean()
  defp unique_external_event_conflict?(changeset) do
    Enum.any?(changeset.errors, fn {field, _details} -> field == :external_event_id end)
  end

  @spec changeset(WebhookEventSchema.t(), map()) :: changeset()
  defp changeset(%WebhookEventSchema{} = webhook_event, attrs) when is_map(attrs) do
    webhook_event
    |> cast(attrs, [
      :provider,
      :external_event_id,
      :event_type,
      :status,
      :payload,
      :received_at,
      :processed_at
    ])
    |> validate_required([:provider, :external_event_id, :status, :payload, :received_at])
    |> unique_constraint(:external_event_id,
      name: :webhook_events_provider_external_event_id_index
    )
  end

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end

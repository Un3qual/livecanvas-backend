defmodule LCWeb.Telemetry do
  use Supervisor
  import Telemetry.Metrics

  @live_session_events [:start, :join, :end]
  @live_channel_events [:join, :chat_send]
  @auth_events [
    :password_login_succeeded,
    :password_login_failed,
    :magic_link_login_succeeded,
    :magic_link_login_failed,
    :refresh_token_revoked,
    :refresh_token_rotation_succeeded,
    :refresh_token_rotation_failed,
    :password_change_succeeded,
    :password_change_failed,
    :email_change_succeeded,
    :email_change_failed,
    :account_recovery_requested,
    :account_recovery_succeeded,
    :account_recovery_failed,
    :provider_identity_unlink_succeeded,
    :provider_identity_unlink_failed
  ]

  @spec start_link(term()) :: Supervisor.on_start()
  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @spec init(term()) :: {:ok, {Supervisor.sup_flags(), [Supervisor.child_spec()]}}
  @impl true
  def init(_arg) do
    children = [
      # Telemetry poller will execute the given period measurements
      # every 10_000ms. Learn more here: https://hexdocs.pm/telemetry_metrics
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000}
      # Add reporters as children of your supervision tree.
      # {Telemetry.Metrics.ConsoleReporter, metrics: metrics()}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  @spec metrics() :: [Telemetry.Metrics.t()]
  def metrics do
    phoenix_metrics() ++
      repo_metrics() ++
      app_metrics() ++
      vm_metrics()
  end

  defp phoenix_metrics do
    [
      summary("phoenix.endpoint.start.system_time",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.endpoint.stop.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.start.system_time",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.exception.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.stop.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.socket_connected.duration",
        unit: {:native, :millisecond}
      ),
      sum("phoenix.socket_drain.count"),
      summary("phoenix.channel_joined.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.channel_handled_in.duration",
        tags: [:event],
        unit: {:native, :millisecond}
      )
    ]
  end

  defp repo_metrics do
    [
      summary("live_canvas.repo.query.total_time",
        unit: {:native, :millisecond},
        description: "The sum of the other measurements"
      ),
      summary("live_canvas.repo.query.decode_time",
        unit: {:native, :millisecond},
        description: "The time spent decoding the data received from the database"
      ),
      summary("live_canvas.repo.query.query_time",
        unit: {:native, :millisecond},
        description: "The time spent executing the query"
      ),
      summary("live_canvas.repo.query.queue_time",
        unit: {:native, :millisecond},
        description: "The time spent waiting for a database connection"
      ),
      summary("live_canvas.repo.query.idle_time",
        unit: {:native, :millisecond},
        description:
          "The time the connection spent waiting before being checked out for the query"
      )
    ]
  end

  defp app_metrics do
    live_session_metrics() ++
      live_channel_metrics() ++
      auth_metrics()
  end

  defp live_session_metrics do
    Enum.flat_map(@live_session_events, fn event_type ->
      event_name = [:live_canvas, :live, :session, event_type]
      metric_name = [:live_canvas, :live, :session, event_type, :total]
      tags = [:event_type, :result, :reason]
      tag_values = fn metadata -> live_result_tag_values(event_type, metadata) end

      [counter_metric(metric_name, event_name, tags, tag_values)]
    end)
  end

  defp live_channel_metrics do
    Enum.flat_map(@live_channel_events, fn event_type ->
      event_name = [:live_canvas, :live, :channel, event_type]
      metric_name = [:live_canvas, :live, :channel, event_type, :total]
      tags = [:event_type, :result, :reason]
      tag_values = fn metadata -> live_result_tag_values(event_type, metadata) end

      [counter_metric(metric_name, event_name, tags, tag_values)]
    end)
  end

  defp auth_metrics do
    Enum.flat_map(@auth_events, fn event_type ->
      event_name = [:live_canvas, :accounts, :auth, event_type]
      metric_name = [:live_canvas, :accounts, :auth, event_type, :total]
      tags = [:event_type, :result, :reason, :audit_persisted]
      tag_values = fn metadata -> auth_tag_values(event_type, metadata) end

      [counter_metric(metric_name, event_name, tags, tag_values)]
    end)
  end

  defp vm_metrics do
    [
      summary("vm.memory.total", unit: {:byte, :kilobyte}),
      summary("vm.total_run_queue_lengths.total"),
      summary("vm.total_run_queue_lengths.cpu"),
      summary("vm.total_run_queue_lengths.io")
    ]
  end

  defp counter_metric(metric_name, event_name, tags, tag_values) do
    counter(metric_name,
      event_name: event_name,
      measurement: :count,
      tags: tags,
      tag_values: tag_values
    )
  end

  # Metric tag values stay intentionally low-cardinality so the Task 2 exporter
  # can expose them safely without leaking request payloads or identifiers.
  defp live_result_tag_values(event_type, metadata) when is_atom(event_type) and is_map(metadata) do
    %{
      event_type: event_type,
      result: Map.get(metadata, :result, :unknown),
      reason: Map.get(metadata, :reason, :none)
    }
  end

  defp auth_tag_values(event_type, metadata) when is_atom(event_type) and is_map(metadata) do
    result = auth_result_tag(event_type)

    %{
      event_type: event_type,
      result: result,
      reason: auth_reason_tag(result, metadata),
      audit_persisted: Map.get(metadata, :audit_persisted, :unknown)
    }
  end

  defp auth_result_tag(event_type) when is_atom(event_type) do
    event_type
    |> Atom.to_string()
    |> String.ends_with?("_failed")
    |> case do
      true -> :error
      false -> :ok
    end
  end

  @known_auth_reasons MapSet.new([
    "already_revoked",
    "expired_token",
    "invalid_credentials",
    "invalid_token",
    "not_found",
    "revoked_token",
    "transaction_aborted",
    "validation_failed"
  ])

  defp auth_reason_tag(:ok, _metadata), do: :none

  defp auth_reason_tag(:error, %{metadata: %{"reason" => reason}})
       when is_binary(reason) and byte_size(reason) > 0 do
    if MapSet.member?(@known_auth_reasons, reason),
      do: String.to_existing_atom(reason),
      else: :other
  end

  defp auth_reason_tag(:error, _metadata), do: :unknown

  defp periodic_measurements do
    [
      # A module, function and arguments to be invoked periodically.
      # This function must call :telemetry.execute/3 and a metric must be added above.
      # {LCWeb, :count_users, []}
    ]
  end
end

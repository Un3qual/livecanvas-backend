defmodule LCWeb.TelemetryTest do
  use ExUnit.Case, async: true

  alias LCWeb.Telemetry, as: WebTelemetry
  alias Telemetry.Metrics.{Counter, Summary}

  @existing_metric_names [
    [:phoenix, :endpoint, :start, :system_time],
    [:live_canvas, :repo, :query, :total_time],
    [:vm, :memory, :total]
  ]

  @session_events [:start, :join, :end]
  @auth_events [
    {:password_login_succeeded, :ok},
    {:password_login_failed, :error},
    {:magic_link_login_succeeded, :ok},
    {:magic_link_login_failed, :error},
    {:refresh_token_revoked, :ok},
    {:refresh_token_rotation_succeeded, :ok},
    {:refresh_token_rotation_failed, :error},
    {:password_change_succeeded, :ok},
    {:password_change_failed, :error},
    {:email_change_succeeded, :ok},
    {:email_change_failed, :error},
    {:account_recovery_requested, :ok},
    {:account_recovery_succeeded, :ok},
    {:account_recovery_failed, :error},
    {:provider_identity_unlink_succeeded, :ok},
    {:provider_identity_unlink_failed, :error}
  ]

  describe "metrics/0" do
    test "keeps the existing Phoenix, repo, and VM metrics" do
      metric_names =
        WebTelemetry.metrics()
        |> Enum.map(& &1.name)

      assert Enum.all?(@existing_metric_names, &(&1 in metric_names))
    end

    test "adds live session lifecycle counters and summaries with bounded tags" do
      metrics = WebTelemetry.metrics()

      for event_type <- @session_events do
        metric_name = [:live_canvas, :live, :session, event_type, :count]
        event_name = [:live_canvas, :live, :session, event_type]
        expected_tag_keys = [:event_type, :result, :reason]
        expected_tags = %{event_type: event_type, result: :ok, reason: :none}

        assert_metric(
          metrics,
          Counter,
          metric_name,
          event_name,
          expected_tag_keys,
          expected_tags,
          %{result: :ok}
        )

        assert_metric(
          metrics,
          Summary,
          metric_name ++ [:summary],
          event_name,
          expected_tag_keys,
          expected_tags,
          %{result: :ok}
        )
      end
    end

    test "adds live channel counters and summaries with bounded tags" do
      metrics = WebTelemetry.metrics()

      for {event_type, sample_metadata, expected_tags} <- [
            {:join, %{result: :error, reason: :rate_limited},
             %{event_type: :join, result: :error, reason: :rate_limited}},
            {:chat_send, %{result: :ok},
             %{event_type: :chat_send, result: :ok, reason: :none}}
          ] do
        metric_name = [:live_canvas, :live, :channel, event_type, :count]
        event_name = [:live_canvas, :live, :channel, event_type]
        expected_tag_keys = [:event_type, :result, :reason]

        assert_metric(
          metrics,
          Counter,
          metric_name,
          event_name,
          expected_tag_keys,
          expected_tags,
          sample_metadata
        )

        assert_metric(
          metrics,
          Summary,
          metric_name ++ [:summary],
          event_name,
          expected_tag_keys,
          expected_tags,
          sample_metadata
        )
      end
    end

    test "adds auth lifecycle counters and summaries with bounded tags" do
      metrics = WebTelemetry.metrics()

      for {event_type, result} <- @auth_events do
        metric_name = [:live_canvas, :accounts, :auth, event_type, :count]
        event_name = [:live_canvas, :accounts, :auth, event_type]

        sample_metadata =
          case result do
            :ok -> %{audit_persisted: :ok, metadata: %{"method" => "password"}}
            :error -> %{audit_persisted: :error, metadata: %{"reason" => "invalid_credentials"}}
          end

        expected_tag_keys = [:event_type, :result, :reason, :audit_persisted]

        expected_tags = %{
          event_type: event_type,
          result: result,
          reason: auth_reason(result, sample_metadata),
          audit_persisted: sample_metadata.audit_persisted
        }

        assert_metric(
          metrics,
          Counter,
          metric_name,
          event_name,
          expected_tag_keys,
          expected_tags,
          sample_metadata
        )

        assert_metric(
          metrics,
          Summary,
          metric_name ++ [:summary],
          event_name,
          expected_tag_keys,
          expected_tags,
          sample_metadata
        )
      end
    end
  end

  defp auth_reason(:ok, _metadata), do: :none

  defp auth_reason(:error, %{metadata: %{"reason" => reason}})
       when is_binary(reason) and byte_size(reason) > 0,
       do: reason

  defp auth_reason(:error, _metadata), do: :unknown

  defp assert_metric(
         metrics,
         module,
         name,
         event_name,
         expected_tag_keys,
         expected_tags,
         sample_metadata
       ) do
    metric = fetch_metric(metrics, module, name)

    assert metric.event_name == event_name
    assert metric.measurement == :count
    assert metric.tags == expected_tag_keys
    assert metric.tag_values.(sample_metadata) == expected_tags
  end

  defp fetch_metric(metrics, module, name) do
    Enum.find(metrics, fn metric ->
      match?(%{__struct__: ^module, name: ^name}, metric)
    end) || flunk("expected #{inspect(module)} metric #{inspect(name)} to exist")
  end
end

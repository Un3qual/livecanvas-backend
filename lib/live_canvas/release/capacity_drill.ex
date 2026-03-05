defmodule LC.Release.CapacityDrill do
  @moduledoc """
  Builds and executes deterministic operator steps for capacity verification drills.
  """

  alias LC.{Accounts, Content, Feed, Live}
  alias Phoenix.PubSub

  @default_probes [:feed, :channel, :live]
  @default_feed_iterations 200
  @default_fanout_viewers 50
  @default_concurrency_viewers 30

  @default_feed_mean_latency_ms 120.0
  @default_feed_p95_latency_ms 180.0
  @default_channel_min_delivery_rate 1.0
  @default_channel_p95_latency_ms 200.0
  @default_live_min_success_rate 1.0
  @default_live_p95_latency_ms 300.0

  @default_probe_timeout_ms 2_000
  @p95_percentile 95.0
  @feed_seed_authors 3
  @feed_seed_posts_per_author 3

  @type probe :: :feed | :channel | :live
  @type drill_step :: %{
          probe: probe(),
          name: String.t(),
          command: String.t(),
          success_criteria: String.t()
        }

  @type drill_failure :: %{step: drill_step(), reason: term()}

  @type probe_thresholds :: %{
          feed_mean_latency_ms: float(),
          feed_p95_latency_ms: float(),
          channel_min_delivery_rate: float(),
          channel_p95_latency_ms: float(),
          live_min_success_rate: float(),
          live_p95_latency_ms: float()
        }

  @type probe_report :: %{
          probe: probe(),
          sample_size: pos_integer(),
          success_rate: float(),
          mean_latency_ms: float(),
          p95_latency_ms: float(),
          threshold: map(),
          passed?: boolean(),
          failure_reasons: [String.t()]
        }

  @type report :: %{
          evaluated_at: DateTime.t(),
          feed_iterations: pos_integer(),
          fanout_viewers: pos_integer(),
          concurrency_viewers: pos_integer(),
          probes: [probe_report()],
          passed?: boolean()
        }

  @type run_error ::
          :invalid_feed_iterations
          | :invalid_fanout_viewers
          | :invalid_concurrency_viewers
          | :invalid_feed_mean_latency_ms
          | :invalid_feed_p95_latency_ms
          | :invalid_channel_min_delivery_rate
          | :invalid_channel_p95_latency_ms
          | :invalid_live_min_success_rate
          | :invalid_live_p95_latency_ms
          | :invalid_probe_timeout_ms
          | :invalid_probes
          | :confirmation_required
          | drill_failure()

  @spec command_plan(pos_integer(), pos_integer(), pos_integer()) :: [drill_step()]
  def command_plan(feed_iterations, fanout_viewers, concurrency_viewers)
      when is_integer(feed_iterations) and feed_iterations > 0 and is_integer(fanout_viewers) and
             fanout_viewers > 0 and is_integer(concurrency_viewers) and concurrency_viewers > 0 do
    command_plan(feed_iterations, fanout_viewers, concurrency_viewers, @default_probes)
  end

  @spec run(keyword()) :: {:ok, report()} | {:dry_run, [drill_step()]} | {:error, run_error()}
  def run(opts \\ []) when is_list(opts) do
    env = Keyword.get(opts, :env, Mix.env())
    confirm? = Keyword.get(opts, :confirm, false)
    dry_run? = Keyword.get(opts, :dry_run, false)

    feed_iterations = Keyword.get(opts, :feed_iterations, @default_feed_iterations)
    fanout_viewers = Keyword.get(opts, :fanout_viewers, @default_fanout_viewers)
    concurrency_viewers = Keyword.get(opts, :concurrency_viewers, @default_concurrency_viewers)
    probe_timeout_ms = Keyword.get(opts, :probe_timeout_ms, @default_probe_timeout_ms)

    thresholds = %{
      feed_mean_latency_ms:
        Keyword.get(opts, :feed_mean_latency_ms, @default_feed_mean_latency_ms),
      feed_p95_latency_ms: Keyword.get(opts, :feed_p95_latency_ms, @default_feed_p95_latency_ms),
      channel_min_delivery_rate:
        Keyword.get(opts, :channel_min_delivery_rate, @default_channel_min_delivery_rate),
      channel_p95_latency_ms:
        Keyword.get(opts, :channel_p95_latency_ms, @default_channel_p95_latency_ms),
      live_min_success_rate:
        Keyword.get(opts, :live_min_success_rate, @default_live_min_success_rate),
      live_p95_latency_ms: Keyword.get(opts, :live_p95_latency_ms, @default_live_p95_latency_ms)
    }

    with :ok <- validate_positive_integer(feed_iterations, :invalid_feed_iterations),
         :ok <- validate_positive_integer(fanout_viewers, :invalid_fanout_viewers),
         :ok <- validate_positive_integer(concurrency_viewers, :invalid_concurrency_viewers),
         :ok <- validate_positive_integer(probe_timeout_ms, :invalid_probe_timeout_ms),
         {:ok, probes} <- normalize_probes(Keyword.get(opts, :probes, @default_probes)),
         :ok <- validate_thresholds(thresholds),
         :ok <- validate_confirmation(env, confirm?) do
      steps = command_plan(feed_iterations, fanout_viewers, concurrency_viewers, probes)

      if dry_run? do
        {:dry_run, steps}
      else
        execute_steps(
          steps,
          %{
            feed_iterations: feed_iterations,
            fanout_viewers: fanout_viewers,
            concurrency_viewers: concurrency_viewers,
            probe_timeout_ms: probe_timeout_ms,
            thresholds: thresholds,
            evaluated_at: normalize_now(Keyword.get(opts, :now))
          },
          []
        )
      end
    end
  end

  @spec format_step(drill_step()) :: String.t()
  def format_step(%{name: name, command: command, success_criteria: success_criteria}) do
    "#{name}: #{command} (success: #{success_criteria})"
  end

  @spec command_plan(pos_integer(), pos_integer(), pos_integer(), [probe()]) :: [drill_step()]
  defp command_plan(feed_iterations, fanout_viewers, concurrency_viewers, probes)
       when is_integer(feed_iterations) and feed_iterations > 0 and is_integer(fanout_viewers) and
              fanout_viewers > 0 and is_integer(concurrency_viewers) and concurrency_viewers > 0 and
              is_list(probes) do
    step_by_probe = %{
      feed: %{
        probe: :feed,
        name: "Feed query load probe",
        command:
          "Run feed query probe with feed_iterations=#{feed_iterations} and capture p95/mean query latency.",
        success_criteria:
          "Feed probe completes without failures and stays within configured latency thresholds."
      },
      channel: %{
        probe: :channel,
        name: "Channel fanout probe",
        command:
          "Run channel fanout probe with fanout_viewers=#{fanout_viewers} subscribers and measure broadcast delivery latency.",
        success_criteria: "All subscribers receive fanout payloads with no dropped deliveries."
      },
      live: %{
        probe: :live,
        name: "Live-session concurrency probe",
        command:
          "Run live join probe with concurrency_viewers=#{concurrency_viewers} concurrent join attempts and measure completion latency.",
        success_criteria:
          "Join attempts complete without authorization/runtime ownership regressions."
      }
    }

    Enum.map(probes, &Map.fetch!(step_by_probe, &1))
  end

  @spec execute_steps([drill_step()], map(), [probe_report()]) ::
          {:ok, report()} | {:error, drill_failure()}
  defp execute_steps([], context, probe_reports) do
    probes = Enum.reverse(probe_reports)

    {:ok,
     %{
       evaluated_at: context.evaluated_at,
       feed_iterations: context.feed_iterations,
       fanout_viewers: context.fanout_viewers,
       concurrency_viewers: context.concurrency_viewers,
       probes: probes,
       passed?: Enum.all?(probes, & &1.passed?)
     }}
  end

  defp execute_steps([step | remaining], context, probe_reports) do
    case run_probe(Map.fetch!(step, :probe), context) do
      {:ok, metrics} ->
        probe_report = build_probe_report(step.probe, metrics, context.thresholds)

        if probe_report.passed? do
          execute_steps(remaining, context, [probe_report | probe_reports])
        else
          {:error, %{step: step, reason: {:threshold_failed, probe_report}}}
        end

      {:error, reason} ->
        {:error, %{step: step, reason: {:probe_failed, step.probe, reason}}}
    end
  end

  defp run_probe(:feed, context), do: run_feed_probe(context)
  defp run_probe(:channel, context), do: run_channel_probe(context)
  defp run_probe(:live, context), do: run_live_probe(context)

  defp run_feed_probe(%{feed_iterations: feed_iterations}) when is_integer(feed_iterations) do
    with {:ok, viewer} <- seed_feed_probe_data(),
         {:ok, latency_ms} <- collect_feed_query_latencies(viewer, feed_iterations, []) do
      {:ok,
       %{sample_size: feed_iterations, success_count: feed_iterations, latency_ms: latency_ms}}
    end
  end

  @spec collect_feed_query_latencies(struct(), pos_integer(), [float()]) ::
          {:ok, [float()]} | {:error, term()}
  defp collect_feed_query_latencies(_viewer, 0, latencies), do: {:ok, Enum.reverse(latencies)}

  defp collect_feed_query_latencies(viewer, remaining, latencies) when remaining > 0 do
    case timed_feed_query(viewer) do
      {:ok, latency_ms} ->
        collect_feed_query_latencies(viewer, remaining - 1, [latency_ms | latencies])

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp timed_feed_query(viewer) do
    started_at_us = System.monotonic_time(:microsecond)

    _entries = Feed.home_feed(viewer, limit: 25)
    {:ok, monotonic_elapsed_ms(started_at_us)}
  rescue
    error -> {:error, Exception.message(error)}
  catch
    kind, reason -> {:error, {kind, reason}}
  end

  defp run_channel_probe(%{fanout_viewers: fanout_viewers, probe_timeout_ms: timeout_ms})
       when is_integer(fanout_viewers) and is_integer(timeout_ms) do
    probe_ref = make_ref()
    topic = "release-capacity-channel-#{System.unique_integer([:positive, :monotonic])}"
    parent = self()

    Enum.each(1..fanout_viewers, fn _index ->
      spawn_link(fn -> channel_probe_subscriber(parent, probe_ref, topic, timeout_ms) end)
    end)

    with :ok <- await_channel_subscriptions(probe_ref, fanout_viewers, timeout_ms) do
      sent_at_us = System.monotonic_time(:microsecond)
      :ok = PubSub.broadcast(LC.PubSub, topic, {:capacity_channel_probe, probe_ref, sent_at_us})

      {delivery_latencies, timeout_count} =
        collect_channel_probe_results(probe_ref, fanout_viewers, timeout_ms, [], 0)

      {:ok,
       %{
         sample_size: fanout_viewers,
         success_count: fanout_viewers - timeout_count,
         latency_ms: delivery_latencies
       }}
    end
  end

  @spec channel_probe_subscriber(pid(), reference(), String.t(), pos_integer()) :: :ok
  defp channel_probe_subscriber(parent, probe_ref, topic, timeout_ms)
       when is_pid(parent) and is_reference(probe_ref) and is_binary(topic) and
              is_integer(timeout_ms) do
    :ok = PubSub.subscribe(LC.PubSub, topic)
    send(parent, {:capacity_probe_subscribed, probe_ref})

    receive do
      {:capacity_channel_probe, ^probe_ref, sent_at_us} ->
        send(parent, {:capacity_probe_result, probe_ref, monotonic_elapsed_ms(sent_at_us)})
    after
      timeout_ms ->
        send(parent, {:capacity_probe_timeout, probe_ref})
    end

    :ok
  end

  @spec await_channel_subscriptions(reference(), pos_integer(), pos_integer()) ::
          :ok | {:error, :channel_subscribe_timeout}
  defp await_channel_subscriptions(probe_ref, expected_count, timeout_ms)
       when is_reference(probe_ref) and is_integer(expected_count) and is_integer(timeout_ms) do
    wait_for_messages(expected_count, timeout_ms, fn
      {:capacity_probe_subscribed, ^probe_ref} -> true
      _other -> false
    end)
  end

  @spec collect_channel_probe_results(
          reference(),
          pos_integer(),
          pos_integer(),
          [float()],
          non_neg_integer()
        ) ::
          {[float()], non_neg_integer()}
  defp collect_channel_probe_results(
         _probe_ref,
         expected_count,
         _timeout_ms,
         latencies,
         timeout_count
       )
       when length(latencies) + timeout_count >= expected_count do
    {Enum.reverse(latencies), timeout_count}
  end

  defp collect_channel_probe_results(
         probe_ref,
         expected_count,
         timeout_ms,
         latencies,
         timeout_count
       ) do
    receive do
      {:capacity_probe_result, ^probe_ref, latency_ms} ->
        collect_channel_probe_results(
          probe_ref,
          expected_count,
          timeout_ms,
          [latency_ms | latencies],
          timeout_count
        )

      {:capacity_probe_timeout, ^probe_ref} ->
        collect_channel_probe_results(
          probe_ref,
          expected_count,
          timeout_ms,
          latencies,
          timeout_count + 1
        )

      _other ->
        collect_channel_probe_results(
          probe_ref,
          expected_count,
          timeout_ms,
          latencies,
          timeout_count
        )
    after
      timeout_ms ->
        remaining_count = expected_count - length(latencies) - timeout_count
        {Enum.reverse(latencies), timeout_count + max(remaining_count, 0)}
    end
  end

  defp run_live_probe(%{concurrency_viewers: concurrency_viewers, probe_timeout_ms: timeout_ms})
       when is_integer(concurrency_viewers) and is_integer(timeout_ms) do
    with {:ok, host} <- create_probe_user("capacity-live-host"),
         {:ok, session} <- Live.start_live_session(host, %{visibility: :public}),
         {:ok, live_session} <- Live.mark_session_live(session),
         {:ok, viewers} <- create_probe_users("capacity-live-viewer", concurrency_viewers) do
      try do
        stream_opts = [
          max_concurrency: concurrency_viewers,
          ordered: false,
          timeout: timeout_ms,
          on_timeout: :kill_task
        ]

        {latencies, success_count} =
          viewers
          |> Task.async_stream(&timed_live_join(live_session, &1), stream_opts)
          |> Enum.reduce({[], 0}, fn
            {:ok, {:ok, latency_ms}}, {latencies, success_count} ->
              {[latency_ms | latencies], success_count + 1}

            _other, {latencies, success_count} ->
              {latencies, success_count}
          end)

        {:ok,
         %{
           sample_size: concurrency_viewers,
           success_count: success_count,
           latency_ms: Enum.reverse(latencies)
         }}
      after
        _ = Live.end_live_session(live_session)
      end
    end
  end

  @spec timed_live_join(struct(), struct()) :: {:ok, float()} | {:error, term()}
  defp timed_live_join(live_session, viewer) do
    started_at_us = System.monotonic_time(:microsecond)

    case Live.join_live_session(live_session, viewer, :viewer) do
      {:ok, _participant} -> {:ok, monotonic_elapsed_ms(started_at_us)}
      {:error, reason} -> {:error, reason}
    end
  rescue
    error -> {:error, Exception.message(error)}
  catch
    kind, reason -> {:error, {kind, reason}}
  end

  @spec seed_feed_probe_data() :: {:ok, struct()} | {:error, term()}
  defp seed_feed_probe_data do
    # Seed deterministic probe data so feed checks stay repeatable regardless of
    # whichever user-generated content currently exists.
    with {:ok, viewer} <- create_probe_user("capacity-feed-viewer"),
         {:ok, authors} <- create_probe_users("capacity-feed-author", @feed_seed_authors),
         :ok <- seed_public_posts(authors, @feed_seed_posts_per_author) do
      {:ok, viewer}
    end
  end

  @spec seed_public_posts([struct()], pos_integer()) :: :ok | {:error, term()}
  defp seed_public_posts(authors, posts_per_author)
       when is_list(authors) and is_integer(posts_per_author) do
    Enum.reduce_while(authors, :ok, fn author, :ok ->
      case create_public_posts(author, posts_per_author) do
        :ok -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  @spec create_public_posts(struct(), pos_integer()) :: :ok | {:error, term()}
  defp create_public_posts(author, count) when is_integer(count) do
    Enum.reduce_while(1..count, :ok, fn index, :ok ->
      case Content.create_post(author, %{
             kind: :standard,
             visibility: :public,
             body_text: "capacity probe feed post #{index}"
           }) do
        {:ok, _post} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  @spec create_probe_users(String.t(), pos_integer()) :: {:ok, [struct()]} | {:error, term()}
  defp create_probe_users(prefix, count)
       when is_binary(prefix) and is_integer(count) and count > 0 do
    Enum.reduce_while(1..count, {:ok, []}, fn _index, {:ok, users} ->
      case create_probe_user(prefix) do
        {:ok, user} -> {:cont, {:ok, [user | users]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, users} -> {:ok, Enum.reverse(users)}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec create_probe_user(String.t()) :: {:ok, struct()} | {:error, term()}
  defp create_probe_user(prefix) when is_binary(prefix) do
    email = "#{prefix}-#{System.unique_integer([:positive, :monotonic])}@example.com"

    case Accounts.register_user_with_email(%{email: email}) do
      {:ok, user} -> {:ok, user}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec build_probe_report(probe(), map(), probe_thresholds()) :: probe_report()
  defp build_probe_report(:feed, metrics, thresholds) do
    sample_size = Map.fetch!(metrics, :sample_size)
    success_count = Map.fetch!(metrics, :success_count)
    latencies = Map.fetch!(metrics, :latency_ms)

    mean_latency_ms = mean(latencies)
    p95_latency_ms = percentile(latencies, @p95_percentile)
    success_rate = ratio(success_count, sample_size)

    mean_threshold = thresholds.feed_mean_latency_ms
    p95_threshold = thresholds.feed_p95_latency_ms

    failure_reasons =
      []
      |> maybe_add_failure(
        mean_latency_ms > mean_threshold,
        "mean latency #{mean_latency_ms}ms exceeded threshold #{mean_threshold}ms"
      )
      |> maybe_add_failure(
        p95_latency_ms > p95_threshold,
        "p95 latency #{p95_latency_ms}ms exceeded threshold #{p95_threshold}ms"
      )

    %{
      probe: :feed,
      sample_size: sample_size,
      success_rate: success_rate,
      mean_latency_ms: mean_latency_ms,
      p95_latency_ms: p95_latency_ms,
      threshold: %{mean_latency_ms: mean_threshold, p95_latency_ms: p95_threshold},
      passed?: failure_reasons == [],
      failure_reasons: failure_reasons
    }
  end

  defp build_probe_report(:channel, metrics, thresholds) do
    sample_size = Map.fetch!(metrics, :sample_size)
    success_count = Map.fetch!(metrics, :success_count)
    latencies = Map.fetch!(metrics, :latency_ms)

    mean_latency_ms = mean(latencies)
    p95_latency_ms = percentile(latencies, @p95_percentile)
    delivery_rate = ratio(success_count, sample_size)

    min_delivery_rate = thresholds.channel_min_delivery_rate
    p95_threshold = thresholds.channel_p95_latency_ms

    failure_reasons =
      []
      |> maybe_add_failure(
        delivery_rate < min_delivery_rate,
        "delivery rate #{delivery_rate} below threshold #{min_delivery_rate}"
      )
      |> maybe_add_failure(
        p95_latency_ms > p95_threshold,
        "p95 delivery latency #{p95_latency_ms}ms exceeded threshold #{p95_threshold}ms"
      )

    %{
      probe: :channel,
      sample_size: sample_size,
      success_rate: delivery_rate,
      delivery_rate: delivery_rate,
      mean_latency_ms: mean_latency_ms,
      p95_latency_ms: p95_latency_ms,
      threshold: %{min_delivery_rate: min_delivery_rate, p95_latency_ms: p95_threshold},
      passed?: failure_reasons == [],
      failure_reasons: failure_reasons
    }
  end

  defp build_probe_report(:live, metrics, thresholds) do
    sample_size = Map.fetch!(metrics, :sample_size)
    success_count = Map.fetch!(metrics, :success_count)
    latencies = Map.fetch!(metrics, :latency_ms)

    mean_latency_ms = mean(latencies)
    p95_latency_ms = percentile(latencies, @p95_percentile)
    success_rate = ratio(success_count, sample_size)

    min_success_rate = thresholds.live_min_success_rate
    p95_threshold = thresholds.live_p95_latency_ms

    failure_reasons =
      []
      |> maybe_add_failure(
        success_rate < min_success_rate,
        "join success rate #{success_rate} below threshold #{min_success_rate}"
      )
      |> maybe_add_failure(
        p95_latency_ms > p95_threshold,
        "p95 join latency #{p95_latency_ms}ms exceeded threshold #{p95_threshold}ms"
      )

    %{
      probe: :live,
      sample_size: sample_size,
      success_rate: success_rate,
      mean_latency_ms: mean_latency_ms,
      p95_latency_ms: p95_latency_ms,
      threshold: %{min_success_rate: min_success_rate, p95_latency_ms: p95_threshold},
      passed?: failure_reasons == [],
      failure_reasons: failure_reasons
    }
  end

  @spec validate_thresholds(probe_thresholds()) :: :ok | {:error, run_error()}
  defp validate_thresholds(thresholds) when is_map(thresholds) do
    with :ok <-
           validate_positive_number(
             thresholds.feed_mean_latency_ms,
             :invalid_feed_mean_latency_ms
           ),
         :ok <-
           validate_positive_number(thresholds.feed_p95_latency_ms, :invalid_feed_p95_latency_ms),
         :ok <-
           validate_rate(thresholds.channel_min_delivery_rate, :invalid_channel_min_delivery_rate),
         :ok <-
           validate_positive_number(
             thresholds.channel_p95_latency_ms,
             :invalid_channel_p95_latency_ms
           ),
         :ok <- validate_rate(thresholds.live_min_success_rate, :invalid_live_min_success_rate),
         :ok <-
           validate_positive_number(thresholds.live_p95_latency_ms, :invalid_live_p95_latency_ms) do
      :ok
    end
  end

  @spec normalize_probes(term()) :: {:ok, [probe()]} | {:error, :invalid_probes}
  defp normalize_probes(probes) when is_list(probes) do
    normalized = Enum.uniq(probes)

    if normalized != [] and Enum.all?(normalized, &(&1 in @default_probes)) do
      {:ok, normalized}
    else
      {:error, :invalid_probes}
    end
  end

  defp normalize_probes(_probes), do: {:error, :invalid_probes}

  @spec wait_for_messages(pos_integer(), pos_integer(), (term() -> boolean())) ::
          :ok | {:error, :channel_subscribe_timeout}
  defp wait_for_messages(0, _timeout_ms, _matcher), do: :ok

  defp wait_for_messages(expected_count, timeout_ms, matcher)
       when is_integer(expected_count) and expected_count > 0 and is_integer(timeout_ms) and
              is_function(matcher, 1) do
    receive do
      message ->
        if matcher.(message) do
          wait_for_messages(expected_count - 1, timeout_ms, matcher)
        else
          wait_for_messages(expected_count, timeout_ms, matcher)
        end
    after
      timeout_ms ->
        {:error, :channel_subscribe_timeout}
    end
  end

  defp validate_positive_integer(value, _error) when is_integer(value) and value > 0, do: :ok
  defp validate_positive_integer(_value, error), do: {:error, error}

  defp validate_positive_number(value, _error)
       when is_number(value) and value > 0 and not is_boolean(value),
       do: :ok

  defp validate_positive_number(_value, error), do: {:error, error}

  defp validate_rate(value, _error)
       when is_number(value) and value > 0 and value <= 1 and not is_boolean(value),
       do: :ok

  defp validate_rate(_value, error), do: {:error, error}

  @spec normalize_now(term()) :: DateTime.t()
  defp normalize_now(%DateTime{} = now), do: DateTime.truncate(now, :microsecond)
  defp normalize_now(_now), do: utc_now()

  @spec validate_confirmation(atom(), boolean()) :: :ok | {:error, :confirmation_required}
  defp validate_confirmation(:test, _confirm?), do: :ok
  defp validate_confirmation(_env, true), do: :ok
  defp validate_confirmation(_env, false), do: {:error, :confirmation_required}

  @spec maybe_add_failure([String.t()], boolean(), String.t()) :: [String.t()]
  defp maybe_add_failure(reasons, true, reason), do: reasons ++ [reason]
  defp maybe_add_failure(reasons, false, _reason), do: reasons

  @spec mean([float()]) :: float()
  defp mean([]), do: 0.0

  defp mean(values) when is_list(values) do
    values
    |> Enum.sum()
    |> Kernel./(length(values))
    |> Float.round(3)
  end

  @spec percentile([float()], float()) :: float()
  defp percentile([], _percentile), do: 0.0

  defp percentile(values, percentile) when is_list(values) and is_number(percentile) do
    sorted_values = Enum.sort(values)
    rank = percentile / 100 * length(sorted_values)
    index = rank |> Float.ceil() |> trunc() |> max(1) |> Kernel.-(1)

    sorted_values
    |> Enum.at(index, 0.0)
    |> Float.round(3)
  end

  @spec ratio(non_neg_integer(), pos_integer()) :: float()
  defp ratio(numerator, denominator)
       when is_integer(numerator) and is_integer(denominator) and denominator > 0 do
    numerator
    |> Kernel./(denominator)
    |> Float.round(3)
  end

  @spec monotonic_elapsed_ms(integer()) :: float()
  defp monotonic_elapsed_ms(started_at_us) when is_integer(started_at_us) do
    elapsed_us = System.monotonic_time(:microsecond) - started_at_us
    (elapsed_us / 1_000) |> Float.round(3)
  end

  @spec utc_now() :: DateTime.t()
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:microsecond)
end

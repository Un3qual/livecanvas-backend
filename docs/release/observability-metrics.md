# Observability Metrics Runbook

Use this runbook to enable the release-ready metrics surface, scrape it safely, and interpret the exported metric and correlation contract during rollout and incident response.

## Owners

- Release Engineer: enables the scrape surface when needed and records metric evidence in the release ticket.
- On-call Engineer: validates thresholds, triages alert spikes, and captures correlation fields for incidents.
- Auth/Live Owners: review auth, live-session, and channel-specific dashboards when rollout checks degrade.

## Endpoint Contract

- Endpoint: `GET /ops/metrics`
- Default state: disabled
- Enablement env vars:
  - `METRICS_ENDPOINT_ENABLED=true`
  - `METRICS_ENDPOINT_TOKEN=<opaque shared secret>`
- Auth contract: send `Authorization: Bearer <token>`
- Disabled response: `404 not_found`
- Missing or invalid token response: `401 invalid_metrics_token`
- Success response: Prometheus text (`text/plain; version=0.0.4; charset=utf-8`)
- Reporter name: `:live_canvas_prometheus_metrics`

The bearer header is required so rollout secrets stay out of query strings and default Phoenix request logs.

### Smoke Check

```bash
curl -fsS \
  -H "Authorization: Bearer ${METRICS_ENDPOINT_TOKEN}" \
  https://<env-host>/ops/metrics \
  | rg "phoenix_router_dispatch_stop_duration_bucket|live_canvas_live_channel_join_count|live_canvas_accounts_auth_password_login_failed_count"
```

Expected result: at least one HTTP latency family, one live-channel family, and one auth family are present in the scrape output.

## Correlation Contract

### HTTP

- `LCWeb.Plugs.ObservabilityContext` runs immediately after `Plug.RequestId`.
- `x-request-id` is preserved only when it matches the safe `20..200` character `[A-Za-z0-9_-]` contract; otherwise the server replaces it with a generated safe ID.
- `x-trace-id` is preserved when it is either a 32-character lowercase/uppercase hex string or a UUID; otherwise the server replaces it with a generated 32-character lowercase hex ID.
- Both IDs are echoed back in response headers.
- Logger metadata includes `request_id`, `trace_id`, `viewer_id`, and `live_session_id`.

### GraphQL

- `LCGQL.Context` forwards `observability_context` into Absinthe context.
- Resolver-layer correlation fields are:
  - `request_id`
  - `trace_id`
  - `viewer_id`
  - `live_session_id`

### Channels

- Socket clients may pass `request_id` and `trace_id` during `UserSocket` connect.
- `LCWeb.LiveSessionChannel` preserves those IDs through join and `chat:send` flows.
- Channel telemetry emits `session_id`, `user_id`, `request_id`, `trace_id`, `result`, and normalized `reason`.
- Once a join succeeds, logger metadata also carries `live_session_id`.

### Secrets And PII

The observability surface must never expose raw bearer tokens, session tokens, emails, message bodies, or other user content. Metrics and correlation metadata are intentionally limited to scalar IDs, enums, and normalized reason codes.

## Metric Families

All app-specific observability events export:

- a counter series using the exact metric stem listed below
- a histogram series by appending `_summary`, which produces Prometheus series named `<stem>_summary_bucket`, `<stem>_summary_sum`, and `<stem>_summary_count`

### HTTP And Transport Metrics Used During Rollout

| Metric stem | Meaning | Tags |
| --- | --- | --- |
| `phoenix_router_dispatch_stop_duration` | Routed HTTP request latency | `route` |
| `phoenix_router_dispatch_exception_duration` | Routed HTTP exception latency and count | `route` |
| `phoenix_channel_joined_duration` | Phoenix channel join latency | none |
| `phoenix_channel_handled_in_duration` | Phoenix channel event latency | `event` |

### Live Session Lifecycle Metrics

| Metric stem | Meaning | Tags |
| --- | --- | --- |
| `live_canvas_live_session_start_count` | Live-session start outcomes | `event_type`, `result`, `reason` |
| `live_canvas_live_session_join_count` | Live-session join outcomes | `event_type`, `result`, `reason` |
| `live_canvas_live_session_end_count` | Live-session end outcomes | `event_type`, `result`, `reason` |

### Live Channel Metrics

| Metric stem | Meaning | Tags |
| --- | --- | --- |
| `live_canvas_live_channel_join_count` | Channel join outcomes | `event_type`, `result`, `reason` |
| `live_canvas_live_channel_chat_send_count` | Channel chat-send outcomes | `event_type`, `result`, `reason` |

### Auth Lifecycle Metrics

All auth metrics use tags `event_type`, `result`, `reason`, and `audit_persisted`.

Counter stems:

- `live_canvas_accounts_auth_password_login_succeeded_count`
- `live_canvas_accounts_auth_password_login_failed_count`
- `live_canvas_accounts_auth_magic_link_login_succeeded_count`
- `live_canvas_accounts_auth_magic_link_login_failed_count`
- `live_canvas_accounts_auth_refresh_token_revoked_count`
- `live_canvas_accounts_auth_refresh_token_rotation_succeeded_count`
- `live_canvas_accounts_auth_refresh_token_rotation_failed_count`
- `live_canvas_accounts_auth_password_change_succeeded_count`
- `live_canvas_accounts_auth_password_change_failed_count`
- `live_canvas_accounts_auth_email_change_succeeded_count`
- `live_canvas_accounts_auth_email_change_failed_count`
- `live_canvas_accounts_auth_account_recovery_requested_count`
- `live_canvas_accounts_auth_account_recovery_succeeded_count`
- `live_canvas_accounts_auth_account_recovery_failed_count`
- `live_canvas_accounts_auth_provider_identity_unlink_succeeded_count`
- `live_canvas_accounts_auth_provider_identity_unlink_failed_count`

Each auth counter also exports the corresponding histogram family by appending `_summary`.

## Tag Policy

- `event_type`: bounded atom copied from the instrumented event family
- `result`: `ok`, `error`, or `unknown`
- `reason`: normalized low-cardinality reason code such as `none`, `rate_limited`, `not_authorized`, `invalid_body`, `invalid_credentials`, or `unknown`
- `audit_persisted`: `ok`, `error`, or `unknown`

Do not add request IDs, trace IDs, user IDs, session IDs, emails, or token values as metric labels.

## Rollout Queries And Thresholds

Use these metric families for rollout dashboards and release-ticket evidence:

- HTTP p95 latency:

```promql
histogram_quantile(
  0.95,
  sum by (le, route) (rate(phoenix_router_dispatch_stop_duration_bucket[5m]))
)
```

- HTTP exception rate:

```promql
sum(rate(phoenix_router_dispatch_exception_duration_count[5m]))
/
clamp_min(sum(rate(phoenix_router_dispatch_stop_duration_count[5m])), 1)
```

- Live join error rate:

```promql
sum(rate(live_canvas_live_channel_join_count{result="error"}[5m]))
/
clamp_min(sum(rate(live_canvas_live_channel_join_count[5m])), 1)
```

- Live chat-send error rate:

```promql
sum(rate(live_canvas_live_channel_chat_send_count{result="error"}[5m]))
/
clamp_min(sum(rate(live_canvas_live_channel_chat_send_count[5m])), 1)
```

- Auth audit-persistence failure check:

Inspect the concrete auth metric families above and alert if any series reports `audit_persisted="error"` during rollout. Treat any non-zero value as a release blocker until the cause is understood.

## Triage Notes

When a rollout or production check fails, capture these fields before deciding to continue or abort:

- `request_id`
- `trace_id`
- `viewer_id`
- `live_session_id`
- `session_id`
- `user_id`
- `reason`
- `audit_persisted`

Use `request_id` and `trace_id` to pivot from dashboards into logs. Use `viewer_id`, `live_session_id`, `session_id`, and `user_id` to align GraphQL and channel failures with the affected runtime path. For auth incidents, correlate the metric spike with persisted auth audit rows rather than relying on telemetry alone.

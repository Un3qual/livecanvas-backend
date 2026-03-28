# Staged Rollout Runbook

This runbook defines the rollout sequence: `dogfood -> beta -> GA`.

## Owners

- Incident Commander (IC): promotion/abort authority.
- Release Engineer: performs rollout commands.
- On-call Engineer: validates runtime health and error trends.

## Prerequisites

1. Complete all gates in `docs/release/deployment-gates.md`.
2. Prepare candidate image tag and commit SHA.
3. Confirm rollback image tag is available.

## Rollout Phases

| Phase | Target Traffic | Minimum Observation Window | Promotion Owner |
| --- | --- | --- | --- |
| Dogfood | Internal users only | 30 minutes | IC |
| Beta | 10% external traffic | 60 minutes | IC |
| GA | 100% traffic | Ongoing | IC |

## Command And State Checks Required For Promotion

Use these checks at the end of each phase before promoting to the next one.

| Check | Command | Required State |
| --- | --- | --- |
| Rollout completion | `kubectl -n <namespace> rollout status deploy/live-canvas-api --timeout=5m` | Exit `0`; rollout reports `successfully rolled out`. |
| Pod health | `kubectl -n <namespace> get pods -l app=live-canvas-api` | All pods are `Running` and `READY` for the full observation window. |
| Restart stability | `kubectl -n <namespace> get pods -l app=live-canvas-api -o jsonpath='{range .items[*]}{.metadata.name}:{range .status.containerStatuses[*]}{.restartCount}{"\n"}{end}{end}'` | Restart counts do not increase between start and end of the phase window. |
| Health endpoint | `curl -fsS https://<env-host>/healthz` | Exit `0` for three checks spaced 2 minutes apart. |
| Error log scan | `kubectl -n <namespace> logs deploy/live-canvas-api --since=10m | rg -E "(FATAL|panic|\*\* \(.*Error\))"` | No matches. |
| HTTP p95 latency | Observe dashboard built from `phoenix_router_dispatch_stop_duration_bucket` | `histogram_quantile(0.95, sum by (le, route) (rate(phoenix_router_dispatch_stop_duration_bucket[5m]))) <= 500` ms for primary API routes during the full phase window. |
| HTTP exception rate | Observe dashboard built from `phoenix_router_dispatch_exception_duration_count` and `phoenix_router_dispatch_stop_duration_count` | `sum(rate(phoenix_router_dispatch_exception_duration_count[5m])) / clamp_min(sum(rate(phoenix_router_dispatch_stop_duration_count[5m])), 1) <= 0.01` for the full phase window. |
| Live join error rate | Observe dashboard built from `live_canvas_live_channel_join_count{result="error"}` and `live_canvas_live_channel_join_count` | Join error rate <= 1.0% for the full phase window and the top `reason` values remain understood/expected. |
| Live chat-send error rate | Observe dashboard built from `live_canvas_live_channel_chat_send_count{result="error"}` and `live_canvas_live_channel_chat_send_count` | Chat-send error rate <= 1.0% for the full phase window and the top `reason` values remain understood/expected. |
| Auth failure and audit persistence trend | Observe dashboards built from the concrete auth metric families in `docs/release/observability-metrics.md` | Failure ratios remain at or below the environment baseline, and any `audit_persisted="error"` series stays at `0`. |

## Explicit Abort And Rollback Triggers

Abort current phase and start rollback if any condition occurs:

- Rollout command fails or times out.
- Health endpoint fails once during dogfood/beta windows.
- HTTP exception rate exceeds 2.0% for 5 consecutive minutes.
- Live join or live chat-send error rate exceeds 2.0% for 5 consecutive minutes.
- p95 latency exceeds 800 ms for 10 consecutive minutes.
- Any auth metric with `audit_persisted="error"` is non-zero for 5 consecutive minutes.
- Any pod enters `CrashLoopBackOff`.

## Rollout Procedure

1. Deploy candidate image to dogfood environment.
2. Run all command/state checks above for 30 minutes.
3. If all checks pass, promote to beta (10% traffic).
4. Run all checks for 60 minutes.
5. If all checks pass, promote to GA (100% traffic).
6. Monitor GA with the same checks for at least one additional hour.

## Handoff Notes

- IC records phase result and timestamps in the release ticket.
- Capture `request_id`, `trace_id`, `viewer_id`, `live_session_id`, `session_id`, `user_id`, `reason`, and `audit_persisted` for any failed observability check before promoting or aborting.
- If aborted, hand off to `rollback-and-restore.md` immediately.
- Keep all command output snippets in the release ticket for incident forensics.

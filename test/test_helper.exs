peer_runtime_enabled? =
  case System.get_env("LIVE_CANVAS_ENABLE_PEER_RUNTIME_TESTS") do
    "1" -> true
    "true" -> true
    "TRUE" -> true
    _ -> false
  end

excluded_tags = if peer_runtime_enabled?, do: [], else: [:peer_runtime]

ExUnit.start(exclude: excluded_tags)
Ecto.Adapters.SQL.Sandbox.mode(LC.Infra.Repo, :manual)

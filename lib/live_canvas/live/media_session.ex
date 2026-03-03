defmodule LC.Live.MediaSession do
  @moduledoc false

  alias LCSchemas.Live.LiveSession

  @callback start_for_session(LiveSession.t()) :: :ok | {:error, term()}

  @spec start_for_session(LiveSession.t()) :: :ok | {:error, term()}
  def start_for_session(%LiveSession{} = session) do
    # Placeholder seam for later Membrane pipeline startup.
    _ = session
    :ok
  end
end

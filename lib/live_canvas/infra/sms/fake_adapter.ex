defmodule LC.Infra.SMS.FakeAdapter do
  @moduledoc false

  use GenServer

  require Logger

  @behaviour LC.Infra.SMS

  @type state :: %{}

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @impl LC.Infra.SMS
  @spec deliver(LC.Infra.SMS.delivery()) :: :ok | {:error, term()}
  def deliver(delivery), do: GenServer.call(__MODULE__, {:deliver, delivery})

  @impl true
  @spec init(:ok) :: {:ok, state()}
  def init(:ok), do: {:ok, %{}}

  @impl true
  @spec handle_call({:deliver, LC.Infra.SMS.delivery()}, GenServer.from(), state()) ::
          {:reply, :ok, state()}
  def handle_call({:deliver, delivery}, _from, state) do
    # Keep this adapter stateless; it exists to provide a supervised seam and deterministic logs.
    Logger.info(
      "[fake_sms] template=#{delivery[:template]} to=#{delivery.to} body=#{inspect(delivery.body)} metadata=#{inspect(delivery[:metadata])}"
    )

    {:reply, :ok, state}
  end
end

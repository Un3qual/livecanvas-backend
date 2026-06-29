# Phone OTP Fake SMS Service Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a minimal fake SMS delivery path for phone verification that issues real `UserToken` records, logs outbound SMS payloads through a supervised GenServer, and leaves a clean adapter seam for later Oban enqueueing or a real provider.

**Architecture:** Keep `LiveCanvas.Accounts` as the domain entry point, mirroring the existing email delivery wrappers. Introduce a small `LiveCanvas.Infra.SMS` facade plus a supervised fake adapter that accepts normalized delivery payloads and logs them. Add phone-verification wrappers in `Accounts` that normalize the phone number, ensure it belongs to the user, persist a `:phone_verification_token`, and hand the composed message to the infra layer without adding numeric OTP generation, Oban jobs, or external HTTP calls yet.

**Tech Stack:** Elixir 1.15+, OTP GenServer, Ecto, ExUnit, Logger

**Scope Guardrails:** No schema changes, no Oban dependency, no Twilio client, no background job worker, and no human-friendly 6-digit code flow in this slice. The only deliverable is a fake in-process SMS transport plus the minimal `Accounts` wrapper needed to exercise it.

---

## Progress

- [x] Step 1: Add failing tests for the fake SMS transport seam
- [x] Step 2: Implement the supervised fake SMS adapter and config wiring
- [x] Step 3: Add failing tests for phone verification token issuance and delivery
- [x] Step 4: Implement the `Accounts` wrappers and phone SMS notifier
- [x] Step 5: Run focused verification and commit each slice

### Task 1: Add The Fake SMS Infra Seam

**Files:**
- Modify: `config/config.exs`
- Modify: `lib/live_canvas/infra.ex`
- Modify: `lib/live_canvas_app.ex`
- Create: `lib/live_canvas/infra/sms.ex`
- Create: `lib/live_canvas/infra/sms/fake_adapter.ex`
- Create: `test/live_canvas/infra/sms/fake_adapter_test.exs`

**Step 1: Write the failing transport tests first**

Add focused coverage in `test/live_canvas/infra/sms/fake_adapter_test.exs` for the public transport contract:

```elixir
defmodule LiveCanvas.Infra.SMS.FakeAdapterTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  alias LiveCanvas.Infra.SMS

  test "logs a tagged fake SMS delivery and returns :ok" do
    log =
      capture_log([level: :info], fn ->
        assert :ok =
                 SMS.deliver(%{
                   to: "+16502530000",
                   body: "Your LiveCanvas verification token is: token-value",
                   template: :phone_verification,
                   metadata: %{user_id: 123}
                 })
      end)

    assert log =~ "[fake_sms]"
    assert log =~ "+16502530000"
    assert log =~ "phone_verification"
  end
end
```

Keep this test intentionally narrow: assert the contract and log tag, not exact formatting spacing.

**Step 2: Verify RED**

Run: `mix test test/live_canvas/infra/sms/fake_adapter_test.exs --trace`

Expected: FAIL because `LiveCanvas.Infra.SMS` and the fake adapter do not exist yet.

**Step 3: Implement the minimal facade and adapter**

Add a tiny public infra API in `lib/live_canvas/infra/sms.ex`:

```elixir
defmodule LiveCanvas.Infra.SMS do
  @type delivery :: %{
          required(:to) => String.t(),
          required(:body) => String.t(),
          optional(:template) => atom(),
          optional(:metadata) => map()
        }

  @callback deliver(delivery()) :: :ok | {:error, term()}

  def deliver(%{to: to, body: body} = delivery)
      when is_binary(to) and is_binary(body) do
    adapter().deliver(delivery)
  end

  defp adapter do
    Application.fetch_env!(:live_canvas, __MODULE__)[:adapter]
  end
end
```

Implement `lib/live_canvas/infra/sms/fake_adapter.ex` as the current adapter:

```elixir
defmodule LiveCanvas.Infra.SMS.FakeAdapter do
  use GenServer

  require Logger

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  def deliver(delivery) do
    GenServer.call(__MODULE__, {:deliver, delivery})
  end

  @impl true
  def init(:ok), do: {:ok, %{}}

  @impl true
  def handle_call({:deliver, delivery}, _from, state) do
    Logger.info("[fake_sms] template=#{delivery[:template]} to=#{delivery.to} body=#{inspect(delivery.body)}")
    {:reply, :ok, state}
  end
end
```

Do not add queues, persistence, retries, or delivery history. The state can stay empty.

**Step 4: Wire config and supervision**

- Export `SMS` from `lib/live_canvas/infra.ex` so `Accounts` can depend on it through the existing boundary.
- In `config/config.exs`, add:

```elixir
config :live_canvas, LiveCanvas.Infra.SMS,
  adapter: LiveCanvas.Infra.SMS.FakeAdapter
```

- In `lib/live_canvas_app.ex`, add `{LiveCanvas.Infra.SMS.FakeAdapter, []}` to the supervision tree before `LiveCanvasWeb.Endpoint` so request handling always has a live adapter process.

This keeps the stable call site at `LiveCanvas.Infra.SMS.deliver/1` while allowing a future adapter swap to an Oban-enqueuing module or a Twilio-style provider.

**Step 5: Verify GREEN**

Run: `mix test test/live_canvas/infra/sms/fake_adapter_test.exs --trace`

Expected: PASS and the captured log includes the `[fake_sms]` tag.

**Step 6: Commit the infra slice**

Run: `mix format lib/live_canvas/infra.ex lib/live_canvas/infra/sms.ex lib/live_canvas/infra/sms/fake_adapter.ex lib/live_canvas_app.ex test/live_canvas/infra/sms/fake_adapter_test.exs`

Run:

```bash
git add config/config.exs \
  lib/live_canvas/infra.ex \
  lib/live_canvas/infra/sms.ex \
  lib/live_canvas/infra/sms/fake_adapter.ex \
  lib/live_canvas_app.ex \
  test/live_canvas/infra/sms/fake_adapter_test.exs
git commit -m "feat: add fake sms delivery adapter"
```

### Task 2: Integrate Phone Verification Token Issuance With SMS Delivery

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Create: `lib/live_canvas/accounts/phone_notifier.ex`
- Modify: `test/live_canvas/accounts/user_token_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`

**Step 1: Add failing token wrapper tests**

Extend `test/live_canvas/accounts/user_token_test.exs` with coverage for the new public wrapper:

```elixir
test "issue_phone_verification_token/2 normalizes the phone and uses the phone verification context" do
  user = user_fixture()
  {:ok, _join} = Accounts.attach_user_phone_number(user, "(650) 253-0000")

  assert {:ok, %{token: token, user_token: persisted, phone_number: "+16502530000"}} =
           Accounts.issue_phone_verification_token(user, "650-253-0000")

  assert is_binary(token)
  assert persisted.context == :phone_verification_token
  assert persisted.sent_to == "+16502530000"
  assert persisted.user_id == user.id
end
```

Add one failure-path test too:
- invalid phone input returns `{:error, :invalid_phone_number}`
- a normalized phone not attached to that user returns `{:error, :phone_number_not_found}`

**Step 2: Add failing delivery wrapper tests**

Extend `test/live_canvas/accounts_test.exs` with a focused delivery test that mirrors the existing email wrappers:

```elixir
test "deliver_phone_verification_instructions/2 issues a phone verification token and logs SMS" do
  user = user_fixture()
  {:ok, _join} = Accounts.attach_user_phone_number(user, "(650) 253-0000")

  log =
    capture_log([level: :info], fn ->
      assert :ok = Accounts.deliver_phone_verification_instructions(user, "650-253-0000")
    end)

  assert accounts_function_calls_local?(
           :deliver_phone_verification_instructions,
           2,
           :issue_phone_verification_token,
           2
         )

  assert log =~ "[fake_sms]"
  assert log =~ "+16502530000"

  assert user_token =
           Repo.get_by(UserToken, user_id: user.id, context: :phone_verification_token)

  assert user_token.sent_to == "+16502530000"
end
```

Import `ExUnit.CaptureLog` at the top of `test/live_canvas/accounts_test.exs` instead of muting logs globally.

**Step 3: Verify RED**

Run: `mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: FAIL because the phone token wrapper and notifier do not exist yet.

**Step 4: Implement the minimal `Accounts` API**

Add this wrapper in `lib/live_canvas/accounts.ex`:

```elixir
def issue_phone_verification_token(%User{} = user, raw_phone_number) do
  with {:ok, normalized_phone_number} <- normalize_phone_number(raw_phone_number),
       true <- user_has_phone_number?(user.id, normalized_phone_number) ||
                 {:error, :phone_number_not_found},
       {:ok, %{token: token, user_token: persisted}} <-
         issue_user_token(user, :phone_verification_token, sent_to: normalized_phone_number) do
    {:ok, %{token: token, user_token: persisted, phone_number: normalized_phone_number}}
  end
end
```

Add a matching delivery wrapper immediately next to the existing email delivery helpers:

```elixir
def deliver_phone_verification_instructions(%User{} = user, raw_phone_number) do
  with {:ok, %{token: serialized_value, phone_number: phone_number}} <-
         issue_phone_verification_token(user, raw_phone_number) do
    PhoneNotifier.deliver_phone_verification_instructions(phone_number, serialized_value,
      user_id: user.id
    )
  end
end
```

Use a tiny private helper such as `user_has_phone_number?/2` that reuses the existing `user_by_phone_query/1` pattern instead of introducing a new schema module or repo abstraction.

**Step 5: Implement the phone notifier**

Create `lib/live_canvas/accounts/phone_notifier.ex` as the domain-side message composer:

```elixir
defmodule LiveCanvas.Accounts.PhoneNotifier do
  alias LiveCanvas.Infra.SMS

  def deliver_phone_verification_instructions(phone_number, token, opts \\ []) do
    SMS.deliver(%{
      to: phone_number,
      body: "Your LiveCanvas verification token is: #{token}",
      template: :phone_verification,
      metadata: %{user_id: Keyword.get(opts, :user_id)}
    })
  end
end
```

Keep the payload generic:
- `to` is the normalized E.164 destination
- `body` is the only required text payload today
- `template` and `metadata` are the seam future Oban jobs or provider adapters can consume without changing `Accounts`

Do not add a six-digit code generator yet. The serialized token is sufficient for this transport slice, and the later OTP UX can replace the body format without reworking the adapter boundary.

**Step 6: Verify GREEN**

Run: `mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: PASS, with coverage proving:
- phone verification tokens use `:phone_verification_token`
- `sent_to` stores normalized E.164 values
- SMS delivery runs through the fake adapter and logs a tagged message

**Step 7: Commit the accounts slice**

Run: `mix format lib/live_canvas/accounts.ex lib/live_canvas/accounts/phone_notifier.ex test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs`

Run:

```bash
git add lib/live_canvas/accounts.ex \
  lib/live_canvas/accounts/phone_notifier.ex \
  test/live_canvas/accounts/user_token_test.exs \
  test/live_canvas/accounts_test.exs
git commit -m "feat: add phone verification sms delivery"
```

## Final Verification

Run: `mix test test/live_canvas/infra/sms/fake_adapter_test.exs test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs --trace`

Expected: PASS for the new transport seam and the `Accounts` phone verification wrappers.

Run: `mix compile`

Expected: PASS with no boundary or supervision errors after adding the new infra module and child.

## Handoff Notes

- Future Oban work should replace only the adapter configured under `LiveCanvas.Infra.SMS`; `LiveCanvas.Accounts` and `PhoneNotifier` should keep calling `SMS.deliver/1`.
- A real provider adapter should accept the same delivery map, even if it ignores `template` or restructures `metadata`.
- If the product later needs a user-entered numeric OTP, add a separate `issue_phone_one_time_code_token/2` wrapper instead of overloading this verification transport slice.

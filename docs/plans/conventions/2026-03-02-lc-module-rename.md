# LC Module Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the active Elixir namespaces from `LiveCanvas*` to `LC*` while keeping the OTP app name (`:live_canvas`), Phoenix file layout, runtime config behavior, boundary enforcement, and current test behavior intact.

**Architecture:** Treat this as a staged compile-safe refactor, not a global search/replace. First lock Phoenix's generator namespace with `config :live_canvas, namespace: LC`, then rename the core domain/schema namespaces (`LC`, `LC.Accounts`, `LC.Infra`, `LCSchemas`) and all of their call sites, and only then rename the adapter/entrypoint namespaces (`LCWeb`, `LCGQL`, `LCApp`) plus the endpoint config keys. Keep filesystem paths such as `lib/live_canvas.ex`, `lib/live_canvas_web/**`, and `test/live_canvas/**` so Phoenix generators continue writing into the existing app layout.

**Tech Stack:** Elixir 1.15+, Phoenix 1.8, Boundary, Ecto, ExUnit

---

## Guardrails

- Keep these values unchanged: `app: :live_canvas`, `otp_app: :live_canvas`, `from: :live_canvas`, `tailwind live_canvas`, `esbuild live_canvas`, database names, cookie keys, and other runtime strings that are tied to deployment behavior rather than module names.
- Add `config :live_canvas, namespace: LC` so `Mix.Phoenix.base()` becomes `LC`, but `Mix.Phoenix.web_path(:live_canvas)` still resolves to `lib/live_canvas_web`. This preserves future Phoenix generator behavior while the app keeps its current OTP name.
- Rename only module identifiers. Do not blindly replace user-facing brand strings such as `"LiveCanvas"` in `lib/live_canvas/accounts/user_notifier.ex` or `lib/live_canvas_web/components/layouts/root.html.heex` unless branding is a separate approved change.
- `Boundary` declarations must exist only on the canonical `LC*` modules after the cutover. If any temporary legacy shim is added, it must be a thin wrapper and must not call `use Boundary`.
- Nested legacy aliases (`LiveCanvasWeb.Router`, `LiveCanvasGQL.Schema`, `LiveCanvasSchemas.Accounts.User`, and similar) are not practical to maintain one-by-one. Plan for a single in-repo cutover instead of trying to alias the entire tree.
- Recommended exception: leave the existing `priv/repo/migrations/*.exs` module names alone unless strict namespace purity is required. They are historical implementation artifacts and changing them adds churn without runtime benefit.

## Compatibility Risks

- `config/*.exs` stores module atoms. If a module is renamed without updating every config key that points at it, the endpoint, repo, mailer, or scope wiring will boot with missing configuration.
- `use LiveCanvasWeb, :controller` and `use LiveCanvasWeb, :verified_routes` make the web layer compile-time sensitive. Rename the full adapter tree in one pass after the core rename is stable.
- A blanket replacement can accidentally change product copy, migration comments, or generated asset identifiers. Restrict replacements to module names, aliases, and boundary references.
- If another app or deployment script still imports the old root names, add only short-lived root shims after the rename is green. Do not keep both full namespace trees active indefinitely.

## Progress

- [x] Step 1: Lock Phoenix's namespace override and capture the rename inventory
- [ ] Step 2: Rename `LC` and `LCSchemas` plus all in-repo core call sites
- [ ] Step 3: Rename `LCWeb`, `LCGQL`, and `LCApp` plus all adapter/config call sites
- [ ] Step 4: Add temporary root aliases only if an external caller still needs them
- [ ] Step 5: Run full verification, decide on migration exceptions, and clean up docs

### Task 1: Lock Phoenix Generator Conventions Before The Rename

**Files:**
- Modify: `config/config.exs`

- [x] Step 1: Add the namespace override

Insert a compile-time namespace override near the existing general application config:

```elixir
config :live_canvas, namespace: LC
```

Keep the `:live_canvas` OTP app key and the existing `ecto_repos` entry exactly as-is in this task. The new `namespace: LC` is what makes Phoenix generators emit `LC`/`LCWeb` modules while still using the current `live_canvas` directory layout.

- [x] Step 2: Capture the full rename checklist before editing code

Run:

```bash
rg -l "\bLiveCanvas(Web|GQL|Schemas|App|\.|\b)" lib config test mix.exs priv/repo/migrations | sort
```

Expected: the command returns the current rename surface, including `mix.exs`, the `lib/live_canvas*.ex` roots, the `lib/live_canvas_web/**` adapter tree, the `lib/live_canvas_gql/**` tree, test support, and the migration files. Use that output as the authoritative checklist for the later tasks.

- [x] Step 3: Verify the Phoenix namespace behavior before the code rename

Run:

```bash
mix run -e 'base = Mix.Phoenix.base(); IO.inspect(base, label: "base"); IO.inspect(Mix.Phoenix.web_module(base), label: "web"); IO.puts(Mix.Phoenix.web_path(:live_canvas))'
```

Expected:

- `base: "LC"`
- `web: LCWeb`
- `lib/live_canvas_web`

- [x] Step 4: Compile to prove the namespace override is behavior-preserving

Run:

```bash
mix compile
```

Expected: PASS. Adding `namespace: LC` alone should not change runtime behavior.

- [x] Step 5: Commit

```bash
git add config/config.exs
git commit -m "chore: set phoenix namespace to lc"
```

### Task 2: Rename The Core Domain And Schema Namespaces First

**Files:**
- Modify: `lib/live_canvas.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/passwords.ex`
- Modify: `lib/live_canvas/accounts/phone_numbers.ex`
- Modify: `lib/live_canvas/accounts/scope.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Modify: `lib/live_canvas/accounts/user_notifier.ex`
- Modify: `lib/live_canvas/infra.ex`
- Modify: `lib/live_canvas/infra/mailer.ex`
- Modify: `lib/live_canvas/infra/repo.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas_schemas/accounts/email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry_email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry_phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_identity.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_identity_provider.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_privacy_mode.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token_context.ex`
- Modify: `lib/live_canvas_web/controllers/user_registration_controller.ex`
- Modify: `lib/live_canvas_web/controllers/user_session_controller.ex`
- Modify: `lib/live_canvas_web/controllers/user_settings_controller.ex`
- Modify: `lib/live_canvas_web/user_auth.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `config/config.exs`
- Modify: `config/dev.exs`
- Modify: `config/test.exs`
- Modify: `config/runtime.exs`
- Modify: `test/test_helper.exs`
- Modify: `test/support/data_case.ex`
- Modify: `test/support/conn_case.ex`
- Modify: `test/support/fixtures/accounts_fixtures.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/live_canvas/accounts/phone_numbers_test.exs`
- Modify: `test/live_canvas/accounts/user_token_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Modify: `test/live_canvas_web/controllers/user_registration_controller_test.exs`
- Modify: `test/live_canvas_web/controllers/user_session_controller_test.exs`
- Modify: `test/live_canvas_web/controllers/user_settings_controller_test.exs`
- Modify: `test/live_canvas_web/user_auth_test.exs`
- Create: `test/live_canvas/accounts/namespace_smoke_test.exs`

- [ ] Step 1: Add a focused red/green smoke test for the new core namespace

Create a small test that exercises the renamed public boundary and the renamed schema boundary together:

```elixir
defmodule LC.Accounts.NamespaceSmokeTest do
  use LC.DataCase, async: true

  test "LC accounts writes and reads through LCSchemas" do
    assert {:ok, user} = LC.Accounts.register_user_with_email(%{email: "lc@example.com"})
    assert %LCSchemas.Accounts.User{id: ^user.id} = LC.Accounts.get_user!(user.id)
  end
end
```

This should fail immediately because none of the `LC*`/`LCSchemas*` modules exist yet.

- [ ] Step 2: Rename the core modules and all of their consumers in one sweep

Make these changes together:

- `LiveCanvas` becomes `LC` in `lib/live_canvas.ex`.
- `LiveCanvas.Accounts.*` becomes `LC.Accounts.*`.
- `LiveCanvas.Infra.*` becomes `LC.Infra.*`.
- `LiveCanvasSchemas.*` becomes `LCSchemas.*`.
- `test/support/data_case.ex` becomes `LC.DataCase`.
- `test/support/fixtures/accounts_fixtures.ex` becomes `LC.AccountsFixtures`.
- Every current consumer of those modules is updated in the same commit, including config entries like `:scopes`, repo config, test helpers, and the adapter files that alias the core boundary.

The key core root should look like this after the rename:

```elixir
defmodule LC do
  @test_support_exports if Mix.env() == :test, do: [AccountsFixtures, DataCase], else: []

  use Boundary,
    top_level?: true,
    deps: [LCSchemas],
    exports: [Accounts] ++ @test_support_exports

  def repo_module, do: LC.Infra.Repo
end
```

Do not rename `LiveCanvasWeb`, `LiveCanvasGQL`, or `LiveCanvasApp` yet. In this phase, only update their references to point at `LC` and `LCSchemas`.

- [ ] Step 3: Run the focused core tests and verify GREEN

Run:

```bash
mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/phone_numbers_test.exs test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts/namespace_smoke_test.exs --trace
```

Expected: PASS. The new `LC` root, renamed core modules, and renamed test helpers should all compile and behave like the old namespace.

- [ ] Step 4: Verify the boundary graph after the core cutover

Run:

```bash
mix boundary.spec
```

Expected: PASS. The graph should now include `LC` and `LCSchemas`, while `LiveCanvasWeb`, `LiveCanvasGQL`, and `LiveCanvasApp` still exist temporarily and depend on the renamed core boundary.

- [ ] Step 5: Commit

```bash
git add lib/live_canvas.ex lib/live_canvas/accounts.ex lib/live_canvas/accounts/passwords.ex lib/live_canvas/accounts/phone_numbers.ex lib/live_canvas/accounts/scope.ex lib/live_canvas/accounts/tokens.ex lib/live_canvas/accounts/user_changes.ex lib/live_canvas/accounts/user_notifier.ex lib/live_canvas/infra.ex lib/live_canvas/infra/mailer.ex lib/live_canvas/infra/repo.ex lib/live_canvas_schemas.ex lib/live_canvas_schemas/accounts.ex lib/live_canvas_schemas/accounts/email_address.ex lib/live_canvas_schemas/accounts/phone_number.ex lib/live_canvas_schemas/accounts/user.ex lib/live_canvas_schemas/accounts/user_contact_entry.ex lib/live_canvas_schemas/accounts/user_contact_entry_email_address.ex lib/live_canvas_schemas/accounts/user_contact_entry_phone_number.ex lib/live_canvas_schemas/accounts/user_email_address.ex lib/live_canvas_schemas/accounts/user_identity.ex lib/live_canvas_schemas/accounts/user_identity_provider.ex lib/live_canvas_schemas/accounts/user_phone_number.ex lib/live_canvas_schemas/accounts/user_privacy_mode.ex lib/live_canvas_schemas/accounts/user_token.ex lib/live_canvas_schemas/accounts/user_token_context.ex lib/live_canvas_web/controllers/user_registration_controller.ex lib/live_canvas_web/controllers/user_session_controller.ex lib/live_canvas_web/controllers/user_settings_controller.ex lib/live_canvas_web/user_auth.ex lib/live_canvas_gql/accounts/account_resolver.ex config/config.exs config/dev.exs config/test.exs config/runtime.exs test/test_helper.exs test/support/data_case.ex test/support/conn_case.ex test/support/fixtures/accounts_fixtures.ex test/live_canvas/accounts_test.exs test/live_canvas/accounts/phone_numbers_test.exs test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts/namespace_smoke_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_web/controllers/user_registration_controller_test.exs test/live_canvas_web/controllers/user_session_controller_test.exs test/live_canvas_web/controllers/user_settings_controller_test.exs test/live_canvas_web/user_auth_test.exs
git commit -m "refactor: rename core namespaces to lc"
```

### Task 3: Rename The Adapter And OTP Entrypoint Namespaces In One Pass

**Files:**
- Modify: `mix.exs`
- Modify: `lib/live_canvas_app.ex`
- Modify: `lib/live_canvas_web.ex`
- Modify: `lib/live_canvas_web/components/core_components.ex`
- Modify: `lib/live_canvas_web/components/layouts.ex`
- Modify: `lib/live_canvas_web/controllers/error_html.ex`
- Modify: `lib/live_canvas_web/controllers/error_json.ex`
- Modify: `lib/live_canvas_web/controllers/page_controller.ex`
- Modify: `lib/live_canvas_web/controllers/page_html.ex`
- Modify: `lib/live_canvas_web/controllers/user_registration_controller.ex`
- Modify: `lib/live_canvas_web/controllers/user_registration_html.ex`
- Modify: `lib/live_canvas_web/controllers/user_session_controller.ex`
- Modify: `lib/live_canvas_web/controllers/user_session_html.ex`
- Modify: `lib/live_canvas_web/controllers/user_settings_controller.ex`
- Modify: `lib/live_canvas_web/controllers/user_settings_html.ex`
- Modify: `lib/live_canvas_web/endpoint.ex`
- Modify: `lib/live_canvas_web/gettext.ex`
- Modify: `lib/live_canvas_web/router.ex`
- Modify: `lib/live_canvas_web/telemetry.ex`
- Modify: `lib/live_canvas_web/user_auth.ex`
- Modify: `lib/live_canvas_gql/live_canvas_gql.ex`
- Modify: `lib/live_canvas_gql/router.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `config/config.exs`
- Modify: `config/dev.exs`
- Modify: `config/prod.exs`
- Modify: `config/test.exs`
- Modify: `config/runtime.exs`
- Modify: `test/support/conn_case.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Modify: `test/live_canvas_web/controllers/error_html_test.exs`
- Modify: `test/live_canvas_web/controllers/error_json_test.exs`
- Modify: `test/live_canvas_web/controllers/page_controller_test.exs`
- Modify: `test/live_canvas_web/controllers/user_registration_controller_test.exs`
- Modify: `test/live_canvas_web/controllers/user_session_controller_test.exs`
- Modify: `test/live_canvas_web/controllers/user_settings_controller_test.exs`
- Modify: `test/live_canvas_web/user_auth_test.exs`

- [ ] Step 1: Use the existing adapter tests as the red harness

Before touching implementation code, rename the adapter test modules and test support references first so the compile errors are constrained to the adapter surface:

- `LiveCanvasWeb.ConnCase` becomes `LCWeb.ConnCase`
- `LiveCanvasWeb.*Test` modules become `LCWeb.*Test`
- `LiveCanvasGQL.*Test` modules become `LCGQL.*Test`

The tests should fail to compile until the adapter modules are renamed.

- [ ] Step 2: Rename the adapter roots and all config references in the same change set

Make these changes together:

- `LiveCanvasApp` becomes `LCApp`.
- `LiveCanvasWeb.*` becomes `LCWeb.*`.
- `LiveCanvasGQL.*` becomes `LCGQL.*`.
- `LiveCanvas.MixProject` becomes `LC.MixProject`.
- `mix.exs` keeps `app: :live_canvas`, but `application/0` changes to `mod: {LCApp, []}`.
- Every endpoint config key changes from `config :live_canvas, LiveCanvasWeb.Endpoint, ...` to `config :live_canvas, LCWeb.Endpoint, ...`.
- Every router, verified-route, gettext, and plug reference updates to `LCWeb.*`.
- `lib/live_canvas_web/endpoint.ex` keeps `use Phoenix.Endpoint, otp_app: :live_canvas`, but plugs `LCGQL.Router` and `LCWeb.Router`.
- `lib/live_canvas_app.ex` keeps the same children and supervision semantics, but references `LCWeb.Telemetry`, `LC.repo_module()`, `{Phoenix.PubSub, name: LC.PubSub}`, and `LCWeb.Endpoint`.

The OTP application behavior must remain the same after this task: only the module names change.

- [ ] Step 3: Run the adapter slice and verify GREEN

Run:

```bash
mix test test/live_canvas_web test/live_canvas_gql --trace
```

Expected: PASS. The web controllers, verified routes, endpoint config lookup, and GraphQL schema should all run under the new `LCWeb`/`LCGQL` names.

- [ ] Step 4: Run compile and boundary verification

Run:

```bash
mix compile --warnings-as-errors
mix boundary.spec
```

Expected: PASS. The top-level boundary roots should now be `LC`, `LCApp`, `LCWeb`, `LCGQL`, and `LCSchemas`.

- [ ] Step 5: Commit

```bash
git add mix.exs lib/live_canvas_app.ex lib/live_canvas_web.ex lib/live_canvas_web/components/core_components.ex lib/live_canvas_web/components/layouts.ex lib/live_canvas_web/controllers/error_html.ex lib/live_canvas_web/controllers/error_json.ex lib/live_canvas_web/controllers/page_controller.ex lib/live_canvas_web/controllers/page_html.ex lib/live_canvas_web/controllers/user_registration_controller.ex lib/live_canvas_web/controllers/user_registration_html.ex lib/live_canvas_web/controllers/user_session_controller.ex lib/live_canvas_web/controllers/user_session_html.ex lib/live_canvas_web/controllers/user_settings_controller.ex lib/live_canvas_web/controllers/user_settings_html.ex lib/live_canvas_web/endpoint.ex lib/live_canvas_web/gettext.ex lib/live_canvas_web/router.ex lib/live_canvas_web/telemetry.ex lib/live_canvas_web/user_auth.ex lib/live_canvas_gql/live_canvas_gql.ex lib/live_canvas_gql/router.ex lib/live_canvas_gql/schema.ex lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_queries.ex lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/accounts/account_types.ex config/config.exs config/dev.exs config/prod.exs config/test.exs config/runtime.exs test/support/conn_case.ex test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_web/controllers/error_html_test.exs test/live_canvas_web/controllers/error_json_test.exs test/live_canvas_web/controllers/page_controller_test.exs test/live_canvas_web/controllers/user_registration_controller_test.exs test/live_canvas_web/controllers/user_session_controller_test.exs test/live_canvas_web/controllers/user_settings_controller_test.exs test/live_canvas_web/user_auth_test.exs
git commit -m "refactor: rename adapter namespaces to lc"
```

### Task 4: Add Temporary Root Aliases Only If Another Caller Still Needs Them

**Files:**
- Create: `lib/live_canvas_compat.ex`
- Create: `lib/live_canvas_web_compat.ex`
- Create: `lib/live_canvas_gql_compat.ex`
- Create: `lib/live_canvas_schemas_compat.ex`
- Create: `test/live_canvas/legacy_root_aliases_test.exs`

- [ ] Step 1: Confirm an external caller actually needs a compatibility layer

Check deployment scripts, other apps in the mono-repo, or release tooling for imports of the old root names. If nothing outside this app still imports `LiveCanvas*`, skip this task entirely.

- [ ] Step 2: If needed, add only thin root-level shims

If compatibility is required, add only the smallest possible wrappers. For example:

```elixir
defmodule LiveCanvas do
  @deprecated "Use LC instead"

  defdelegate repo_module(), to: LC
  defdelegate local_mail_adapter?(), to: LC
end
```

For `LiveCanvasWeb`, only forward root helpers such as `__using__/1` and `static_paths/0` if an external caller truly needs them. Do not attempt to recreate nested modules such as `LiveCanvasWeb.Router` or `LiveCanvasWeb.Endpoint`. Do not add `use Boundary` to any compat shim.

- [ ] Step 3: Add a narrow compatibility test if shims are introduced

Use a minimal test that proves only the supported root aliases work:

```elixir
defmodule LC.LegacyRootAliasesTest do
  use ExUnit.Case, async: true

  test "LiveCanvas root delegates to LC" do
    assert LiveCanvas.repo_module() == LC.repo_module()
  end
end
```

If you skip the shims, skip this test too.

- [ ] Step 4: Run the focused compatibility test

Run:

```bash
mix test test/live_canvas/legacy_root_aliases_test.exs --trace
```

Expected: PASS if the compat files exist. If this task is skipped, do not create the file and do not run this command.

- [ ] Step 5: Commit

```bash
git add lib/live_canvas_compat.ex lib/live_canvas_web_compat.ex lib/live_canvas_gql_compat.ex lib/live_canvas_schemas_compat.ex test/live_canvas/legacy_root_aliases_test.exs
git commit -m "chore: add temporary livecanvas root aliases"
```

### Task 5: Final Verification, Migration Decision, And Documentation Cleanup

**Files:**
- Verify: `mix.exs`
- Verify: `config/config.exs`
- Verify: `config/dev.exs`
- Verify: `config/prod.exs`
- Verify: `config/test.exs`
- Verify: `config/runtime.exs`
- Verify: `lib/live_canvas.ex`
- Verify: `lib/live_canvas_app.ex`
- Verify: `lib/live_canvas_web.ex`
- Verify: `lib/live_canvas_gql/live_canvas_gql.ex`
- Verify: `lib/live_canvas_schemas.ex`
- Verify: `test/test_helper.exs`
- Optional Modify: `ARCHITECTURE.md`
- Optional Modify: `README.md`
- Optional Modify: `docs/plans/conventions/2026-03-02-conventions-alignment-design.md`
- Optional Modify: `priv/repo/migrations/20260215031653_create_users_auth_tables.exs`
- Optional Modify: `priv/repo/migrations/20260302000000_rebuild_accounts_identity_tables.exs`
- Optional Modify: `priv/repo/migrations/20260302204500_add_user_privacy_mode_to_users.exs`

- [ ] Step 1: Decide explicitly whether migration module names stay legacy

Recommended default: leave the migration module names alone and document them as a legacy exception. If strict namespace purity is required, rename the `defmodule LiveCanvas.Repo.Migrations.*` declarations only after the application code is already green, and do it in a tiny isolated commit.

- [ ] Step 2: Update docs that describe the boundary names

Once the code is green, update architecture and convention docs that refer to the old boundary roots so the written guidance matches the code. Keep user-facing branding strings unchanged unless branding is also changing.

- [ ] Step 3: Run the full verification suite

Run:

```bash
mix format mix.exs config/*.exs lib/live_canvas.ex lib/live_canvas_app.ex lib/live_canvas_web.ex lib/live_canvas_schemas.ex lib/live_canvas/**/*.ex lib/live_canvas_gql/**/*.ex lib/live_canvas_schemas/**/*.ex lib/live_canvas_web/**/*.ex test/test_helper.exs test/support/**/*.ex test/live_canvas/**/*.exs test/live_canvas_gql/**/*.exs test/live_canvas_web/**/*.exs
mix compile --warnings-as-errors
mix boundary.spec
mix test
```

Expected: PASS across the full suite with the renamed namespaces.

- [ ] Step 4: Run a final grep to confirm only intentional legacy hits remain

Run:

```bash
rg -n "\bLiveCanvas(Web|GQL|Schemas|App|\.|\b)" lib config test mix.exs priv/repo/migrations
```

Expected:

- No hits in active app code.
- Optional hits only in compat shim files if Task 4 was required.
- Optional hits only in migration files if you kept the recommended migration exception.

- [ ] Step 5: Commit

Stage only the rename scope. If Task 4 or the optional docs/migration cleanup was skipped, omit those paths from the final `git add`.

```bash
git add mix.exs config/config.exs config/dev.exs config/prod.exs config/test.exs config/runtime.exs lib/live_canvas.ex lib/live_canvas_app.ex lib/live_canvas_web.ex lib/live_canvas_schemas.ex lib/live_canvas/**/*.ex lib/live_canvas_gql/**/*.ex lib/live_canvas_schemas/**/*.ex lib/live_canvas_web/**/*.ex test/test_helper.exs test/support/**/*.ex test/live_canvas/**/*.exs test/live_canvas_gql/**/*.exs test/live_canvas_web/**/*.exs
git commit -m "chore: finalize lc namespace rename"
```

## Execution Notes

- Do not try to do this as one unreviewed search/replace. The phased commits above are the safety net.
- Keep file paths rooted under `live_canvas` even after the rename. With `config :live_canvas, namespace: LC`, that is the correct Phoenix convention for this app.
- If Task 4 is needed, treat the compat shims as a time-boxed bridge. Add a follow-up ticket to remove them after downstream callers migrate.

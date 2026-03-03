# TypeSpec and Dialyzer Rollout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an enforceable strict-typing baseline for this backend: covered public functions must have `@spec`, Dialyzer must run cleanly in local development, and `mix precommit` must fail when typing coverage or Dialyzer health regresses.

**Architecture:** Treat this as a ratchet, not a flag day. First land a small tooling baseline: a repo-local `mix check.typespecs` task, a `mix typecheck` alias, Dialyxir configuration, and a narrow rollout manifest so precommit becomes strict without forcing a same-day annotation pass across the entire tree. Then widen the enforced surface in small commits: add schema `t()` types and shared unions first, expand context/core coverage next, then Phoenix web modules, then the GraphQL entry points, and finally remove the temporary allowlist so the whole `lib/` tree is enforced by default.

**Tech Stack:** Elixir 1.15, Mix tasks/aliases, Dialyxir/Dialyzer, Phoenix 1.8, Ecto, Absinthe, ExUnit

---

## Current Baseline (inspected on 2026-03-02)

- `mix.exs` currently has no `:dialyxir` dependency and no `dialyzer:` project configuration.
- `precommit` currently runs `compile --warnings-as-errors`, `deps.unlock --unused`, `format`, and `test`; it does not run any type-specific gate.
- There is no `.dialyzer_ignore.exs` or other checked-in Dialyzer baseline file today.
- `lib/` currently contains 119 public `def`s and 13 `@spec`s.
- The existing `@spec`s are concentrated in `lib/live_canvas/accounts/phone_numbers.ex` and `lib/live_canvas/accounts/tokens.ex`; the rest of the tree is largely untyped.
- There are currently 0 `@type`, `@opaque`, or `@typep` declarations, so schema structs do not expose `t()` types for downstream specs.
- Rollout surface by area:
  - `lib/live_canvas`: 60 public functions
  - `lib/live_canvas_web`: 43 public functions
  - `lib/live_canvas_gql`: 4 public functions
  - `lib/live_canvas_schemas/accounts/*.ex`: 13 schema/enum files with no public `def`s, but they need type exports so context/web/GQL specs can stay precise

## Progress

- [x] Task 1: Build and test the `mix check.typespecs` gate
- [ ] Task 2: Seed the first enforceable slice
- [ ] Task 3: Add Dialyzer and wire `mix precommit` to `mix typecheck`
- [ ] Task 4: Add schema `t()` and shared enum union types
- [ ] Task 5: Roll typespec enforcement across context/core modules
- [ ] Task 6: Roll typespec enforcement across Phoenix web modules
- [ ] Task 7: Roll typespec enforcement across GraphQL modules
- [ ] Task 8: Remove the temporary allowlist and enforce the full `lib/` tree

## Immediate Tooling Baseline

### Task 1: Build and Test the `mix check.typespecs` Gate

**Files:**
- Create: `lib/mix/tasks/check.typespecs.ex`
- Create: `test/mix/tasks/check.typespecs_test.exs`
- Create: `test/support/fixtures/typespecs/missing_spec.ex`
- Create: `test/support/fixtures/typespecs/with_spec.ex`
- Create: `test/support/fixtures/typespecs/multiclause.ex`
- Create: `test/support/fixtures/typespecs/ignored_defs.ex`
- Create: `test/support/fixtures/typespecs/manifest.txt`

**Step 1: Write the failing task tests**

- Add ExUnit coverage for the new Mix task before writing the task itself.
- Assert that the task exits non-zero and prints `missing @spec` when it scans `missing_spec.ex`.
- Assert that the task passes on `with_spec.ex`.
- Assert that one `@spec` directly above the first clause of a multi-clause function satisfies every clause in `multiclause.ex`.
- Assert that `defp` and `defmacro` forms in `ignored_defs.ex` are ignored.
- Assert that `--manifest test/support/fixtures/typespecs/manifest.txt` loads relative file paths and ignores blank lines plus `#` comments.

**Step 2: Run the focused test to verify RED**

Run: `mix test test/mix/tasks/check.typespecs_test.exs --trace`

Expected: FAIL because `Mix.Tasks.Check.Typespecs` does not exist yet.

**Step 3: Write the minimal task implementation**

- Parse each target file with `Code.string_to_quoted!/2`.
- Walk the AST module-by-module and collect public `def` name/arity pairs with line numbers.
- Track immediately preceding `@spec` declarations and match them to the next public `def`.
- Treat one `@spec` before the first clause as satisfying all clauses of the same function arity.
- Ignore `defp`, `defmacro`, and files that contain zero public `def`s.
- Support both direct file arguments and `--manifest <path>` where the manifest is one repo-relative path per line.
- In strict mode, exit with status `1` and emit one line per missing spec in `path:line missing @spec for function/arity` format.

**Step 4: Run the focused test to verify GREEN**

Run: `mix test test/mix/tasks/check.typespecs_test.exs --trace`

Expected: PASS, with the new task behaving the same way for direct paths and manifest-driven paths.

**Step 5: Commit**

Run:

```bash
git add lib/mix/tasks/check.typespecs.ex test/mix/tasks/check.typespecs_test.exs test/support/fixtures/typespecs
git commit -m "test: add typespec enforcement mix task"
```

### Task 2: Seed the First Enforceable Slice

**Files:**
- Modify: `lib/live_canvas.ex`
- Modify: `lib/live_canvas/accounts/passwords.ex`
- Modify: `lib/live_canvas/accounts/phone_numbers.ex`
- Modify: `lib/live_canvas/accounts/scope.ex`
- Modify: `lib/live_canvas_schemas/accounts/user.ex`
- Create: `priv/quality/typespec_targets.txt`
- Test: `test/live_canvas/accounts_test.exs`
- Test: `test/live_canvas/accounts/phone_numbers_test.exs`

**Task 2 Step Progress**
- [x] Step 1: Create the rollout manifest with a tiny real slice
- [x] Step 2: Run the new gate against the seed slice and verify RED
- [ ] Step 3: Add the minimal real-world specs
- [ ] Step 4: Run compile plus focused regression coverage
- [ ] Step 5: Run the seed gate again to verify GREEN
- [ ] Step 6: Commit

**Step 1: Create the rollout manifest with a tiny real slice**

Seed `priv/quality/typespec_targets.txt` with one path per line:

```text
lib/live_canvas.ex
lib/live_canvas/accounts/passwords.ex
lib/live_canvas/accounts/phone_numbers.ex
lib/live_canvas/accounts/scope.ex
```

Keep this intentionally small so precommit can start enforcing immediately without blocking on the full tree.

**Step 2: Run the new gate against the seed slice and verify RED**

Run: `mix check.typespecs --strict --manifest priv/quality/typespec_targets.txt`

Expected: FAIL for missing specs in `lib/live_canvas.ex`, `lib/live_canvas/accounts/passwords.ex`, and `lib/live_canvas/accounts/scope.ex`. `lib/live_canvas/accounts/phone_numbers.ex` should already satisfy the gate.

**Step 3: Add the minimal real-world specs**

- Add `@type t` to `lib/live_canvas_schemas/accounts/user.ex` so downstream modules can refer to `User.t()`.
- Add `@type t :: %__MODULE__{user: User.t() | nil}` to `lib/live_canvas/accounts/scope.ex`.
- Add `@spec repo_module() :: module()` and `@spec local_mail_adapter?() :: boolean()` to `lib/live_canvas.ex`.
- Add `@spec valid_password?(User.t() | term(), String.t() | term()) :: boolean()` to `lib/live_canvas/accounts/passwords.ex`.
- Leave the existing `PhoneNumbers.normalize/2` spec in place unless Dialyzer forces a tighter adjustment later.

**Step 4: Run compile plus focused regression coverage**

Run: `mix compile --warnings-as-errors`

Expected: PASS, with no syntax or spec-definition warnings.

Run: `mix test test/live_canvas/accounts_test.exs test/live_canvas/accounts/phone_numbers_test.exs --trace`

Expected: PASS, confirming the seed slice still behaves the same.

**Step 5: Run the seed gate again to verify GREEN**

Run: `mix check.typespecs --strict --manifest priv/quality/typespec_targets.txt`

Expected: PASS for the seed files.

**Step 6: Commit**

Run:

```bash
git add lib/live_canvas.ex lib/live_canvas/accounts/passwords.ex lib/live_canvas/accounts/phone_numbers.ex lib/live_canvas/accounts/scope.ex lib/live_canvas_schemas/accounts/user.ex priv/quality/typespec_targets.txt
git commit -m "chore: seed typespec enforcement baseline"
```

### Task 3: Add Dialyzer and Wire `mix precommit` to `mix typecheck`

**Files:**
- Modify: `mix.exs`
- Create: `.dialyzer_ignore.exs`

**Step 1: Add Dialyxir to the project dependencies**

- Add `{:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false}` to `mix.exs` in the dependency group that already holds development-only tooling.
- Keep the dependency isolated to non-production environments.

**Step 2: Add strict-but-usable Dialyzer project configuration**

In `project/0`, add a `dialyzer:` entry that includes:

- `plt_file: {:no_warn, "_build/#{Mix.env()}/dialyzer.plt"}`
- `ignore_warnings: ".dialyzer_ignore.exs"`
- `list_unused_filters: true`
- `flags: [:unmatched_returns, :error_handling, :underspecs]`

Start with that warning set first. Only add more flags after this baseline is clean.

**Step 3: Add a single typing command and make precommit call it**

Update Mix aliases so `mix.exs` contains:

- `typecheck: ["check.typespecs --strict --manifest priv/quality/typespec_targets.txt", "dialyzer --format short"]`
- `precommit: ["compile --warnings-as-errors", "deps.unlock --unused", "format", "test", "typecheck"]`

That keeps one human command (`mix typecheck`) and one enforcement hook (`mix precommit`) in sync.

**Step 4: Add the initial Dialyzer baseline file**

- Create `.dialyzer_ignore.exs` as an empty list first.
- If the first run surfaces a third-party false positive that cannot be fixed in-project, add the narrowest possible ignore entry and comment why it is safe.
- Do not add broad regexes or blanket ignores for your own modules.

**Step 5: Fetch dependencies and build the first typing baseline**

Run: `mix deps.get`

Expected: PASS, with `:dialyxir` added to `mix.lock`.

Run: `mix typecheck`

Expected: PASS. The first run may spend time building the PLT. If Dialyzer reports warnings, fix them in the same task unless they are audited false positives.

**Step 6: Prove the new precommit gate is enforcing typing**

Run: `mix precommit`

Expected: PASS. From this point forward, precommit should fail if the seed slice loses a public-function spec or if Dialyzer starts warning.

**Step 7: Commit**

Run:

```bash
git add mix.exs mix.lock .dialyzer_ignore.exs
git commit -m "chore: add enforced dialyzer baseline"
```

This is the end of the immediate tooling baseline.

## Incremental Typespec Rollout

### Task 4: Add Schema `t()` and Shared Enum Union Types

**Files:**
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas_schemas/accounts/email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry_email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_contact_entry_phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_email_address.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_identity.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_phone_number.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token.ex`
- Test: `test/live_canvas/accounts_test.exs`

**Step 1: Run the schema-focused regression suite first**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: PASS before any schema typing changes land.

**Step 2: Add `@type t` to every Ecto schema module**

- Add a concrete `@type t :: %__MODULE__{...}` to each Ecto schema file listed above.
- Include field types that matter for callers first: ids, timestamps, virtual fields, and association lists.
- Keep association members typed even if the lists default to `Ecto.Association.NotLoaded.t() | [Schema.t()]` where needed.

**Step 3: Centralize enum unions in the namespace module**

Use `lib/live_canvas_schemas/accounts.ex` to define shared aliases such as:

- `@type user_privacy_mode :: :private | :public`
- `@type user_identity_provider :: :apple_provider | :google_provider | :passkey_provider | :snap_provider | :instagram_provider`
- `@type user_token_context :: :email_verification_token | :email_mfa_token | :email_magic_link_token | :email_one_time_code_token | :phone_verification_token | :phone_mfa_token | :phone_magic_link_token | :phone_one_time_code_token | :access_token | :refresh_token`

Leave the three `defenum` files unchanged in this pass; they are macro-only, and the namespace module is the cleanest place for hand-written union types.

**Step 4: Re-run the schema suite plus Dialyzer**

Run: `mix test test/live_canvas/accounts_test.exs --trace`

Expected: PASS, with no runtime changes.

Run: `mix dialyzer --format short`

Expected: PASS, confirming the new type declarations compile cleanly and do not create invalid specs.

**Step 5: Commit**

Run:

```bash
git add lib/live_canvas_schemas/accounts.ex lib/live_canvas_schemas/accounts/*.ex
git commit -m "chore: add schema types for typing rollout"
```

### Task 5: Roll Typespec Enforcement Across Context/Core Modules

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/passwords.ex`
- Modify: `lib/live_canvas/accounts/phone_numbers.ex`
- Modify: `lib/live_canvas/accounts/scope.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Modify: `lib/live_canvas/accounts/user_notifier.ex`
- Modify: `priv/quality/typespec_targets.txt`
- Test: `test/live_canvas/accounts_test.exs`
- Test: `test/live_canvas/accounts/phone_numbers_test.exs`
- Test: `test/live_canvas/accounts/user_token_test.exs`

**Step 1: Widen the manifest to the full context/core slice**

Append every file listed above that has public `def`s to `priv/quality/typespec_targets.txt`.

**Step 2: Run the gate first and verify RED**

Run: `mix check.typespecs --strict --manifest priv/quality/typespec_targets.txt`

Expected: FAIL, primarily for the public APIs in `lib/live_canvas/accounts.ex`, `lib/live_canvas/accounts/user_changes.ex`, and `lib/live_canvas/accounts/user_notifier.ex`.

**Step 3: Add shared aliases, then annotate every public function in the slice**

- Add reusable aliases in `lib/live_canvas/accounts.ex` for common return shapes instead of repeating raw tuples in every spec.
- Tighten the already-existing specs in `lib/live_canvas/accounts/tokens.ex`: replace broad `map()` and `atom()` usage with `User.t()`, `UserToken.t()`, and `LiveCanvasSchemas.Accounts.user_token_context()`.
- Leave `LiveCanvas.Infra`, `LiveCanvas.Infra.Mailer`, and `LiveCanvas.Infra.Repo` unchanged in this pass; they do not define explicit public `def`s that the checker can or should enforce.
- Add missing public `@spec`s to every remaining `def` in the listed modules.
- Leave `defp`s unannotated unless a private helper needs a local `@spec` to keep Dialyzer readable.

**Step 4: Run the context test suite**

Run: `mix test test/live_canvas --trace`

Expected: PASS, covering accounts behavior and the current utility modules.

**Step 5: Run the full typing gate**

Run: `mix typecheck`

Expected: PASS, with the widened manifest fully enforced.

**Step 6: Commit**

Run:

```bash
git add lib/live_canvas/accounts.ex lib/live_canvas/accounts/*.ex priv/quality/typespec_targets.txt
git commit -m "chore: add context typespec coverage"
```

### Task 6: Roll Typespec Enforcement Across Phoenix Web Modules

**Files:**
- Modify: `lib/live_canvas_web.ex`
- Modify: `lib/live_canvas_web/controllers/error_html.ex`
- Modify: `lib/live_canvas_web/controllers/error_json.ex`
- Modify: `lib/live_canvas_web/controllers/page_controller.ex`
- Modify: `lib/live_canvas_web/controllers/user_registration_controller.ex`
- Modify: `lib/live_canvas_web/controllers/user_session_controller.ex`
- Modify: `lib/live_canvas_web/controllers/user_settings_controller.ex`
- Modify: `lib/live_canvas_web/components/core_components.ex`
- Modify: `lib/live_canvas_web/components/layouts.ex`
- Modify: `lib/live_canvas_web/telemetry.ex`
- Modify: `lib/live_canvas_web/user_auth.ex`
- Modify: `priv/quality/typespec_targets.txt`
- Test: `test/live_canvas_web`

**Step 1: Add the web slice to the manifest**

Append every file listed above with public `def`s to `priv/quality/typespec_targets.txt`.

**Step 2: Run the gate first and verify RED**

Run: `mix check.typespecs --strict --manifest priv/quality/typespec_targets.txt`

Expected: FAIL for controllers, components, `LiveCanvasWeb`, `Telemetry`, and `UserAuth`.

**Step 3: Add web-facing specs with framework-native types**

- Controller actions should use `Plug.Conn.t()` inputs and return `Plug.Conn.t()`.
- `lib/live_canvas_web.ex` helper functions that return quoted AST should use `Macro.t()`, while `static_paths/0` should return `[String.t()]`.
- Component helpers in `lib/live_canvas_web/components/core_components.ex` and `lib/live_canvas_web/components/layouts.ex` should share one rendered-output alias that Dialyzer accepts consistently across all function components.
- `show/2` and `hide/2` should use `Phoenix.LiveView.JS.t()` inputs and outputs.
- `Telemetry.start_link/1` and `Telemetry.init/1` should reflect the actual `Supervisor` callback contracts.

**Step 4: Run the web test suite**

Run: `mix test test/live_canvas_web --trace`

Expected: PASS, covering controllers and `UserAuth`.

**Step 5: Re-run the full typing gate**

Run: `mix typecheck`

Expected: PASS for the expanded web slice.

**Step 6: Commit**

Run:

```bash
git add lib/live_canvas_web.ex lib/live_canvas_web/controllers/*.ex lib/live_canvas_web/components/*.ex lib/live_canvas_web/telemetry.ex lib/live_canvas_web/user_auth.ex priv/quality/typespec_targets.txt
git commit -m "chore: add web typespec coverage"
```

### Task 7: Roll Typespec Enforcement Across GraphQL Modules

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/live_canvas_gql.ex`
- Modify: `priv/quality/typespec_targets.txt`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Test: `test/live_canvas_gql/accounts/account_queries_test.exs`

**Step 1: Add the GraphQL public-function files to the manifest**

Append the two files above to `priv/quality/typespec_targets.txt`.

**Step 2: Run the gate first and verify RED**

Run: `mix check.typespecs --strict --manifest priv/quality/typespec_targets.txt`

Expected: FAIL for the public resolver functions and `document_providers/1`.

**Step 3: Add precise resolver specs**

- Resolver entry points in `lib/live_canvas_gql/accounts/account_resolver.ex` should describe the Absinthe resolver tuple shape explicitly.
- `fetch_user/1` and `parse_id/1` should return narrow tagged tuples (`{:ok, integer()}` or `{:error, atom()}`) instead of `term()`.
- `lib/live_canvas_gql/live_canvas_gql.ex` should expose `@spec document_providers(term()) :: [module()]`.
- Leave `lib/live_canvas_gql/schema.ex`, `lib/live_canvas_gql/router.ex`, and the Absinthe macro definition files unchanged unless they gain real `def`s later.

**Step 4: Run the GraphQL test suite**

Run: `mix test test/live_canvas_gql --trace`

Expected: PASS, covering the current query and mutation entry points.

**Step 5: Re-run the full typing gate**

Run: `mix typecheck`

Expected: PASS for the GraphQL slice.

**Step 6: Commit**

Run:

```bash
git add lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/live_canvas_gql.ex priv/quality/typespec_targets.txt
git commit -m "chore: add graphql typespec coverage"
```

### Task 8: Remove the Temporary Allowlist and Enforce the Full `lib/` Tree

**Files:**
- Modify: `lib/mix/tasks/check.typespecs.ex`
- Modify: `mix.exs`
- Delete: `priv/quality/typespec_targets.txt`

**Step 1: Make the checker default to the whole source tree**

- Update `mix check.typespecs` so that when no explicit files or manifest are passed, it scans `lib/**/*.ex`.
- Keep the current manifest support for ad hoc migrations, but stop using it in the default alias once the tree is clean.

**Step 2: Simplify the permanent alias**

Change the alias to:

- `typecheck: ["check.typespecs --strict", "dialyzer --format short"]`

This removes the temporary rollout artifact from daily usage.

**Step 3: Remove the rollout manifest**

- Delete `priv/quality/typespec_targets.txt` once every public-function module is covered and the whole tree passes.

**Step 4: Run the final full-tree checks**

Run: `mix check.typespecs --strict`

Expected: PASS across all of `lib/`.

Run: `mix typecheck`

Expected: PASS, with no unchecked slices remaining.

Run: `mix precommit`

Expected: PASS, now enforcing the final no-allowlist policy.

**Step 5: Commit**

Run:

```bash
git add lib/mix/tasks/check.typespecs.ex mix.exs
git rm priv/quality/typespec_targets.txt
git commit -m "chore: enforce typespecs across lib"
```

## Final Verification Commands

Run these before claiming the rollout is complete:

- `mix test test/mix/tasks/check.typespecs_test.exs --trace`
- `mix test test/live_canvas --trace`
- `mix test test/live_canvas_web --trace`
- `mix test test/live_canvas_gql --trace`
- `mix check.typespecs --strict`
- `mix typecheck`
- `mix precommit`

Every command above should pass without adding new `.dialyzer_ignore.exs` entries for first-party code.

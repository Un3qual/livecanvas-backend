# LiveCanvas Sasa Juric Alignment Implementation Plan

**Goal:** Update the LiveCanvas architecture guidance and the existing v1 backend plan so implementation follows explicit boundaries, compile-time boundary enforcement via the `boundary` library, functional-core/coordinator splits, process-oriented OTP design, and test discipline drawn from Sasa Juric's writing.

**Architecture:** Keep the approved modular monolith, context map, and core platform choices intact. Change how those contexts are implemented: public context modules become interface boundaries enforced by `boundary`, reusable business rules move into pure internal modules, and stateful OTP processes are reserved for explicit runtime entities such as live sessions and async fanout. The result should be the same product scope with a tighter internal design and clearer execution rules.

**Tech Stack:** Markdown design docs, Elixir 1.15+, Phoenix 1.8, Absinthe, Ecto, PostgreSQL, ExUnit, Phoenix Channels, Phoenix Presence, OTP supervisors/processes, `boundary` 0.10.x

---

## Research Summary

The previous version of this plan treated boundaries as a convention. After reviewing the official `boundary` docs and Sasa Juric's Boundary-focused article, this version treats boundaries as an explicit, compile-time-enforced part of the architecture. The broader theme still holds: maintainability in Elixir comes more from deliberate boundaries and code shape than from adding more framework machinery.

### Boundary library (`boundary`) as the enforcement mechanism

**Article:** `Towards Maintainable Elixir: Boundaries`

**Docs:** `https://hexdocs.pm/boundary/Boundary.html`

**Key takeaways:**
- Boundaries are declared with `use Boundary`, not left as a social convention.
- Each boundary declares what it may depend on (`deps`) and what it exposes (`exports`).
- The `boundary` compiler runs after regular Elixir compilation and reports invalid references at compile time.
- Checks can be staged by environment with `check: [in: ...]` while the boundary map is being introduced, but the long-term goal is full checking in normal development.

**Impact on LiveCanvas:**
- `LiveCanvas`, `LiveCanvasWeb`, `LiveCanvasGQL`, and each top-level domain context should become explicit boundaries.
- `LiveCanvasWeb` and `LiveCanvasGQL` should depend inward on domain boundaries only; domain boundaries must not depend back on adapters.
- Adding `:boundary` to the compiler pipeline makes the existing `mix precommit` alias an architectural enforcement point because it already runs `compile --warnings-as-errors`.
- Because `elixirc_paths(:test)` includes `test/support`, the boundary rollout must account for compiled test helpers instead of assuming only `lib/` is checked.

### 1. Core and interface boundary

**Article:** `https://medium.com/erlang-battleground/core-and-interface-boundary-5811d37adaa0`

**Key takeaways:**
- Every externally callable surface needs an explicit boundary where foreign input is normalized.
- The internal core should operate on one stable internal representation, not on raw transport params.
- Boundary logic exists to protect the core, not to become the core.

**Design patterns:**
- Anti-corruption layer at the module boundary
- Thin public API over a stable internal model
- Context-specific boundary functions when different callers need different input contracts

**Impact on LiveCanvas:**
- `LiveCanvas.Accounts`, `LiveCanvas.Social`, `LiveCanvas.Content`, `LiveCanvas.Live`, `LiveCanvas.Chat`, and `LiveCanvas.Feed` should be treated as boundary modules.
- GraphQL resolvers, channel handlers, REST controllers, and jobs should pass only normalized data into those context APIs.
- Internal modules added by the v1 plan should not depend on Absinthe args, `Plug.Conn`, socket payloads, or raw `%{"string" => ...}` maps.

### 2. Anatomy of a function

**Article:** `https://medium.com/erlang-battleground/anatomy-of-a-function-422a216b053c`

**Key takeaways:**
- Most business functions have two jobs: decide what should happen, then coordinate side effects.
- The decision-making part should stay small, deterministic, and easy to test.
- The side-effecting part should sequence persistence, messaging, and notifications around that pure decision.

**Design patterns:**
- Functional core / imperative shell
- Small pure helpers for branching rules
- Thin orchestration wrapper for `Repo`, PubSub, and external I/O

**Impact on LiveCanvas:**
- The current v1 plan over-emphasizes large context modules; it should explicitly require a split between pure domain functions and effectful coordinators.
- In future code, context entry points such as registration, follow approval, post publishing, and session state changes should call a pure rule module first, then execute the resulting writes and broadcasts.
- This should be a default convention for `Accounts`, `Social`, `Content`, and `Feed`, and a strong convention for the synchronous parts of `Live` and `Chat`.

### 3. Unit tests in functional languages

**Article:** `https://medium.com/erlang-battleground/unit-tests-in-functional-languages-39d4e1811054`

**Key takeaways:**
- A useful unit is the smallest behavior slice that communicates intent, not necessarily the smallest function.
- In functional code, many tests can stay simple input/output checks.
- Test doubles should be the exception; most confidence should come from pure tests plus boundary integrations.

**Design patterns:**
- Input/process/output test framing
- Pure core tests with no mocks
- Integration tests concentrated at boundaries and side-effect seams

**Impact on LiveCanvas:**
- The v1 plan should add explicit pure-module tests before GraphQL, channel, or end-to-end coverage.
- Side-effect assertions should stay in context, channel, and integration tests, not leak into every small helper test.
- Avoid designing new abstractions only to make mocking easier; prefer designs that are testable by data flow.

### 4. The soul of Erlang and Elixir - process oriented programming

**Article:** `https://medium.com/erlang-battleground/the-soul-of-erlang-and-elixir-e7c1905f4625`

**Key takeaways:**
- The distinctive tool is not "use concurrency everywhere"; it is "use isolated processes where the runtime model benefits from ownership and isolation."
- Processes work best when they model a real runtime entity or asynchronous concern.
- A process should exist because it owns evolving state or failure boundaries, not because the codebase wants more abstraction.

**Design patterns:**
- Process-per-runtime-entity
- Supervised ownership of transient state
- Message-passing only where async coordination is real

**Impact on LiveCanvas:**
- The existing decision to keep transient session state in supervised processes is correct and should stay.
- `Live` should explicitly own a per-session process (or equivalent runtime entity) for countdown, presence-derived state, and session transitions.
- `Accounts`, `Social`, and `Content` should remain mostly synchronous data/domain layers rather than process-heavy services.
- `Chat` should use processes only where channel throughput or moderation buffering actually needs ownership, not for routine persistence.

### 5. Typical development process

**Article:** `https://medium.com/erlang-battleground/typical-development-process-66dfb0af4f8b`

**Key takeaways:**
- Development should move in small slices: make progress, reshape the code, then continue.
- Refactoring is part of the normal loop, not a separate phase after "real work."
- Code review belongs inside the delivery loop rather than at the very end.

**Design patterns:**
- Small vertical slices
- Refactor-after-green as a mandatory step
- Frequent review checkpoints

**Impact on LiveCanvas:**
- The current v1 plan already uses TDD loops, but it needs explicit "factor the shape before moving on" checkpoints.
- The plan should add a review gate after each context slice (`Accounts`, `Social`, `Content`, `Live`, `Chat`, `Feed`) rather than relying only on final verification.
- This strengthens maintainability without changing the product scope.

## Decision Summary

- Keep the approved modular monolith, GraphQL-first API, Postgres-only storage, and no-Redis rule.
- Use the `boundary` library to turn boundary rules into compile-time checks instead of conventions only.
- Treat `LiveCanvasApp`, `LiveCanvas`, `LiveCanvasWeb`, `LiveCanvasGQL`, and `LiveCanvasSchemas` as the top-level boundary roots.
- Keep domain boundaries nested under `LiveCanvas` (for example:
  `LiveCanvas.Accounts`, `LiveCanvas.Infra`) instead of promoting every
  subsystem to top-level.
- Do not change the current context map.
- Do change the implementation rules so each context has a clear boundary, pure internal logic, and limited side-effect coordination.
- Use OTP processes more intentionally in `Live` and only selectively elsewhere.
- Rebalance the test strategy toward pure-core tests plus boundary integration tests.

## Required Plan Changes

### Task 0: Adopt `boundary` As The Compile-Time Architecture Guardrail

**Files:**
- Modify: `mix.exs`
- Modify: `lib/live_canvas.ex`
- Create: `lib/live_canvas_app.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Create: `lib/live_canvas/infra.ex`
- Create: `lib/live_canvas/infra/repo.ex`
- Create: `lib/live_canvas/infra/mailer.ex`
- Modify: `lib/live_canvas_web.ex`
- Modify: `lib/live_canvas_gql/live_canvas_gql.ex`
- Create: `lib/live_canvas_schemas.ex`
- Create: `lib/live_canvas_schemas/user.ex`
- Create: `lib/live_canvas_schemas/user_token.ex`
- Create: `lib/live_canvas/accounts/user_changes.ex`
- Create: `lib/live_canvas/accounts/passwords.ex`
- Create: `lib/live_canvas/accounts/tokens.ex`
- Reference: `test/support/data_case.ex`
- Reference: `test/support/conn_case.ex`
- Reference: `test/support/fixtures/accounts_fixtures.ex`

**Step 1: Add the dependency and compiler**

Update `mix.exs` so the project installs `boundary` and runs the boundary compiler before the standard Elixir compilers:

```elixir
def project do
  [
    app: :live_canvas,
    version: "0.1.0",
    elixir: "~> 1.15",
    elixirc_paths: elixirc_paths(Mix.env()),
    start_permanent: Mix.env() == :prod,
    aliases: aliases(),
    deps: deps(),
    compilers: [:boundary, :phoenix_live_view] ++ Mix.compilers(),
    listeners: [Phoenix.CodeReloader]
  ]
end

defp misc_deps, do: [
  {:boundary, "~> 0.10", runtime: false},
  {:swoosh, "~> 1.16"},
  {:req, "~> 0.5"},
  {:telemetry_metrics, "~> 1.0"},
  {:telemetry_poller, "~> 1.0"},
  {:jason, "~> 1.2"},
  {:dns_cluster, "~> 0.2.0"},
  {:bandit, "~> 1.5"}
]
```

**Step 2: Turn the current root modules into explicit boundaries**

Use the existing top-level modules as the first boundary declarations, then grow the map from there:

```elixir
defmodule LiveCanvas do
  @test_support_exports if Mix.env() == :test, do: [AccountsFixtures, DataCase], else: []
  use Boundary,
    top_level?: true,
    deps: [LiveCanvasSchemas],
    exports: [Accounts] ++ @test_support_exports
end

defmodule LiveCanvasApp do
  use Boundary,
    top_level?: true,
    deps: [LiveCanvas, LiveCanvasWeb, LiveCanvasGQL]
end

defmodule LiveCanvas.Accounts do
  use Boundary, deps: [LiveCanvas.Infra, LiveCanvasSchemas]
end

defmodule LiveCanvas.Infra do
  use Boundary, exports: [Repo, Mailer]
end

defmodule LiveCanvasSchemas do
  use Boundary, top_level?: true, exports: [User, UserToken]
end

defmodule LiveCanvasWeb do
  use Boundary, top_level?: true, deps: [LiveCanvas, LiveCanvasGQL], exports: [Endpoint, Router, Telemetry, UserAuth]
end

defmodule LiveCanvasGQL do
  use Boundary, top_level?: true, deps: [LiveCanvas], exports: [Schema, Router]
end
```

The architectural direction is fixed: adapters depend inward on `LiveCanvas`,
schema modules live in `LiveCanvasSchemas`, and schema-only modules do not
contain changesets, repo operations, or workflow logic.

**Step 3: Document the test-support rollout explicitly**

Because this project compiles `test/support` in the test environment, the plan must not ignore those modules:

- Keep test support legal under the same boundary graph if the helper truly belongs to that boundary.
- If a boundary needs a staged rollout, use targeted `check: [in: ...]` gating from the `boundary` docs while violations are burned down.
- Do not leave large parts of the graph permanently unchecked.

**Step 4: Verify compile-time enforcement**

Run: `mix compile`

Expected: the `boundary` compiler runs after the Elixir compiler and reports only allowed references.

**Step 5: Verify CI/precommit enforcement**

Run: `mix precommit`

Expected: boundary warnings fail the run because `compile --warnings-as-errors` now includes the `boundary` compiler.

**Step 6: Commit**

```bash
git add mix.exs lib/live_canvas.ex lib/live_canvas_app.ex lib/live_canvas/accounts.ex lib/live_canvas/infra.ex lib/live_canvas/infra lib/live_canvas_web.ex lib/live_canvas_gql/live_canvas_gql.ex lib/live_canvas_schemas.ex lib/live_canvas_schemas lib/live_canvas/accounts/user_changes.ex lib/live_canvas/accounts/passwords.ex lib/live_canvas/accounts/tokens.ex
git commit -m "build: add boundary compile-time architecture checks"
```

### Task 1: Amend `ARCHITECTURE.md` With Cross-Cutting Maintainability Rules

**Files:**
- Modify: `ARCHITECTURE.md`

**Step 1: Add a new section after `## Core Principles`**

Insert this exact section:

```markdown
## Cross-Cutting Maintainability Rules

### Boundary Rules

- Treat each top-level context module as an interface boundary.
- Enforce those boundaries with the `boundary` library instead of relying on convention alone.
- Declare explicit `deps` and `exports` for root boundary modules.
- Normalize transport-specific input at the boundary only.
- Keep internal business logic independent from Absinthe, Plug, Phoenix socket payloads, and controller params.

### Function Anatomy

- Public write paths should split into:
  - pure decision logic
  - effectful coordination
- Pure logic returns domain decisions or normalized change instructions.
- Coordinators perform `Repo`, PubSub, Presence, and external side effects.

### Process Topology

- Use OTP processes only for explicit runtime entities or asynchronous ownership boundaries.
- Prefer plain modules for synchronous domain logic.
- `Live` owns session processes; other contexts stay process-light unless runtime behavior proves otherwise.

### Testing Strategy

- Prefer pure input/output tests for internal business rules.
- Concentrate side-effect assertions in boundary-level integration tests.
- Avoid introducing abstractions whose only purpose is easy mocking.
```

**Step 2: Verify the section exists**

Run: `rg -n "## Cross-Cutting Maintainability Rules|### Boundary Rules|### Function Anatomy|### Process Topology|### Testing Strategy" ARCHITECTURE.md`

Expected: five matches in `ARCHITECTURE.md`

**Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: add maintainability rules to architecture"
```

### Task 2: Keep The Dated Architecture Snapshot In Sync

**Files:**
- Modify: `docs/plans/2026-03-01-backend-architecture-design.md`

**Step 1: Add a new section after `## Testing And Evolution`**

Insert this exact section:

```markdown
## Maintainability Alignment

- Top-level contexts remain the public boundaries of the modular monolith.
- Use the `boundary` library as the compile-time enforcement mechanism for those boundaries.
- Boundary modules normalize external input and shield internal business rules from transport concerns.
- New business rules should prefer pure internal modules plus thin effectful coordinators.
- OTP processes should model runtime entities such as live sessions, not routine CRUD flows.
- Tests should favor pure input/output coverage first, then boundary integrations.
```

**Step 2: Verify the new section exists**

Run: `rg -n "## Maintainability Alignment|pure internal modules|runtime entities such as live sessions" docs/plans/2026-03-01-backend-architecture-design.md`

Expected: three matches in the dated design snapshot

**Step 3: Commit**

```bash
git add docs/plans/2026-03-01-backend-architecture-design.md
git commit -m "docs: sync architecture snapshot with maintainability rules"
```

### Task 3: Amend The V1 Foundations Plan With Shared Implementation Conventions

**Files:**
- Modify: `docs/plans/2026-03-01-v1-backend-foundations.md`

**Step 1: Extend `## Implementation Rules`**

Add these bullets directly under the existing implementation rules:

```markdown
- Treat the root context module for each domain as the interface boundary; transport adapters may call only that boundary.
- Declare each root context module with `use Boundary`, explicit `deps`, and explicit `exports`.
- Keep `LiveCanvasWeb` and `LiveCanvasGQL` as adapter boundaries that depend on exported domain APIs only.
- For each new write path, split the work into pure domain decision code first, then effectful coordination.
- Put transport-agnostic business rules in internal modules that accept normalized data, not raw params maps.
- Add pure unit tests for internal business rules before adding GraphQL, channel, or end-to-end coverage for the same behavior.
- Run `mix compile` after adding or changing a boundary so architectural violations are surfaced immediately.
- After each task reaches green, factor the code shape before moving to the next task.
```

**Step 2: Insert a new task before the current `### Task 1`**

Insert this new task:

````markdown
### Task 0: Establish Shared Domain Conventions Before Adding New Contexts

**Files:**
- Modify: `docs/plans/2026-03-01-v1-backend-foundations.md`
- Reference: `ARCHITECTURE.md`

**Step 1: Record the shared module shape**

Document that each context should follow this pattern:

```elixir
LiveCanvas.Accounts          # boundary API, declared with use Boundary
LiveCanvas.Accounts.Core     # pure business rules
LiveCanvas.Accounts.Changes  # optional data shaping helpers
LiveCanvas.Accounts.Write    # effectful coordination
```

Record that each root module also declares:

```elixir
use Boundary, deps: [...], exports: [...]
```

**Step 2: Record the shared testing shape**

Document this default order:
- pure business-rule tests
- context integration tests
- GraphQL or channel contract tests
- end-to-end regression tests

**Step 3: Verify the conventions are visible before Task 1**

Run: `rg -n "### Task 0: Establish Shared Domain Conventions|LiveCanvas.Accounts.Core|pure business-rule tests" docs/plans/2026-03-01-v1-backend-foundations.md`

Expected: three matches above the existing Accounts work

**Step 4: Commit**

```bash
git add docs/plans/2026-03-01-v1-backend-foundations.md
git commit -m "docs: add shared domain conventions to v1 plan"
```
````

**Step 3: Verify the new rules are present**

Run: `rg -n "interface boundary|pure domain decision code|factor the code shape before moving to the next task" docs/plans/2026-03-01-v1-backend-foundations.md`

Expected: three matches in the implementation rules

**Step 4: Commit**

```bash
git add docs/plans/2026-03-01-v1-backend-foundations.md
git commit -m "docs: add shared implementation conventions to v1 plan"
```

### Task 4: Rewrite Task Expectations In The V1 Plan By Domain

**Files:**
- Modify: `docs/plans/2026-03-01-v1-backend-foundations.md`

**Step 1: Update Tasks 1-5 and Task 8 to require pure-core-first execution**

Add short notes under the task headings for:
- `Accounts`
- `Social`
- `Content`
- `Feed`

Use this exact sentence pattern:

```markdown
Before writing the effectful implementation, add or update a pure internal rule module for the decision-making part of this behavior, then have the boundary module coordinate persistence and external side effects.
```

Also add this exact sentence directly after it:

```markdown
Declare or update the root context module as a `boundary` boundary with explicit `deps` and `exports` before adding new internal modules.
```

**Step 2: Update Tasks 6-7 to clarify process usage**

Add this exact note under `Live` and `Chat`:

```markdown
Use supervised processes only where runtime ownership is necessary (for example: active live session state, async fanout, or backpressure-sensitive chat flow). Keep durable state transitions and validation logic in plain modules.
```

**Step 3: Verify the notes are present in the right tasks**

Run: `rg -n "pure internal rule module|runtime ownership is necessary" docs/plans/2026-03-01-v1-backend-foundations.md`

Expected: at least eight matches across the affected task sections

**Step 4: Commit**

```bash
git add docs/plans/2026-03-01-v1-backend-foundations.md
git commit -m "docs: align task expectations with Juric design rules"
```

### Task 5: Add Review Gates And Refactor Checkpoints To Plan Execution

**Files:**
- Modify: `docs/plans/2026-03-01-v1-backend-foundations.md`

**Step 1: Add a review gate after each domain task**

After each of these tasks:
- `Accounts` (Tasks 1-3)
- `Social` (Task 4)
- `Content` (Task 5)
- `Live` (Task 6)
- `Chat` (Task 7)
- `Feed` (Task 8)

Add this exact checklist:

```markdown
**Refactor And Review Gate**

- Confirm the boundary module still contains coordination, not embedded business rules.
- Confirm new pure internal modules are covered by direct input/output tests.
- Confirm transport adapters still depend on the boundary only.
- Run a focused review before starting the next domain slice.
```

**Step 2: Expand `## Final Verification Checklist`**

Add these commands near the top of the checklist:

```bash
mix compile
mix test
rg -n ":boundary|compilers: .*\\[:boundary\\]" mix.exs
rg -n "Refactor And Review Gate" docs/plans/2026-03-01-v1-backend-foundations.md
rg -n "use Boundary|interface boundary|pure internal rule module" docs/plans/2026-03-01-v1-backend-foundations.md
```

**Step 3: Verify the review gates exist**

Run: `rg -n "Refactor And Review Gate|focused review before starting the next domain slice" docs/plans/2026-03-01-v1-backend-foundations.md`

Expected: repeated matches after each domain slice

**Step 4: Commit**

```bash
git add docs/plans/2026-03-01-v1-backend-foundations.md
git commit -m "docs: add refactor and review gates to v1 plan"
```

## Expected Net Effect

If this plan is applied, LiveCanvas should still ship the same backend scope, but the implementation will change in these important ways:

- Context modules become deliberate boundaries enforced by the compiler instead of large catch-all modules.
- The internal domain logic becomes easier to test and easier to move without transport coupling.
- OTP process usage stays focused on runtime ownership (`Live`) instead of spreading into CRUD-heavy contexts.
- The current v1 plan becomes safer to execute incrementally because every domain slice adds an explicit refactor and review checkpoint.
- The existing `mix precommit` alias becomes an architecture gate as soon as `boundary` is wired into the compiler list.

## Final Verification Checklist

Before calling this alignment complete, run these commands in order:

1. `mix compile`
2. `mix precommit`
3. `rg -n "## Cross-Cutting Maintainability Rules" ARCHITECTURE.md`
4. `rg -n "## Maintainability Alignment" docs/plans/2026-03-01-backend-architecture-design.md`
5. `rg -n "### Task 0: Establish Shared Domain Conventions|use Boundary" docs/plans/2026-03-01-v1-backend-foundations.md`
6. `rg -n "Refactor And Review Gate" docs/plans/2026-03-01-v1-backend-foundations.md`
7. `git diff -- mix.exs lib/live_canvas.ex lib/live_canvas/accounts.ex lib/live_canvas_web.ex lib/live_canvas_gql/live_canvas_gql.ex ARCHITECTURE.md docs/plans/2026-03-01-backend-architecture-design.md docs/plans/2026-03-01-v1-backend-foundations.md`

The goal is not to replace the current architecture. The goal is to tighten the implementation discipline so the approved architecture stays maintainable as the v1 backend grows.

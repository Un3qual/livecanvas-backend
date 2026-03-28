# AI-Slop / Anti-Pattern Quality Audit (2026-03-28)

## Scope

This audit reviews backend code, architecture/planning docs, and execution plans for quality problems commonly introduced by AI coding agents:

- verbose boilerplate and instruction leakage
- dead abstractions / speculative scaffolding
- repetitive patterns without shared helpers
- misleading placeholders that look production-ready
- process/documentation churn that obscures real status

Repository audited: `Un3qual/livecanvas-backend`.

## Method

- Read representative high-signal code and plan files.
- Prioritize files with known risk factors (large modules, stubs, generated templates, plan-heavy docs).
- Flagged only issues with concrete path+line evidence.
- Distinguished true quality issues from acceptable scaffolding.

---

## Findings: Code

### High severity

1. **Deletion flow advertises lifecycle completion while hard-delete is intentionally inert**
   - Evidence:
     - `lib/live_canvas/infra/data_governance/deletion.ex:17-30`
     - `lib/live_canvas/infra/data_governance/deletion.ex:264-321`
   - Why this is AI-slop-adjacent:
     - `@stubbed_purge_order` and completion event logging create a production-like shape, but `purge_user_records/1` is a no-op (`_ = {@stubbed_purge_order, user_id}` then `:ok`).
     - This pattern is typical when AI scaffolds “future-complete” codepaths that appear implemented but intentionally do nothing.
   - Risk:
     - Operators can over-trust completion signals (`account_deletion_completed`) despite no physical deletion.

2. **Retention sweep supports `--apply` semantics that are intentionally non-destructive**
   - Evidence:
     - `lib/live_canvas/infra/data_governance/retention.ex:31-47`
     - `lib/live_canvas/infra/data_governance/retention.ex:55-61`
     - `lib/live_canvas/infra/data_governance/retention.ex:132-135`
   - Why this is AI-slop-adjacent:
     - `:apply` maps to `:stubbed_delete` and report shape hardcodes `deletion_stubbed?: true`.
     - This can be valid rollout strategy, but the interface shape resembles completed behavior while intentionally withholding effects.
   - Risk:
     - Ambiguous operational intent and false confidence in retention enforcement.

### Medium severity

3. **Read-policy helper duplication (join-if-missing pattern repeated across functions)**
   - Evidence:
     - `lib/live_canvas/read_policy.ex:165-221`
   - Why this is AI-slop-adjacent:
     - Four near-identical `maybe_join_*` helpers differ mostly by binding/table specifics.
     - AI-generated refactors often stop at “works now” without extracting repeated join composition.
   - Risk:
     - Higher maintenance burden and drift risk when policy changes.

4. **Over-granular guard layering in hot path policy helpers**
   - Evidence:
     - `lib/live_canvas/read_policy.ex:114-140`
     - `lib/live_canvas/read_policy.ex:177-209`
   - Why this is AI-slop-adjacent:
     - Repeated `when is_integer(...) and is_atom(...)` constraints in adjacent private helpers can be defensive noise rather than meaningful contract checks.
   - Risk:
     - Reduced readability, larger surface for inconsistent edits.

### Low severity

5. **Trivial policy split into a dedicated module with narrow logic footprint**
   - Evidence:
     - `lib/live_canvas/social/relationship_policy.ex:1-31`
   - Why this is AI-slop-adjacent:
     - Very small decision tree in a separate module can indicate abstraction created because an agent “likes layers,” not because complexity demanded it.
   - Risk:
     - Architectural fragmentation if repeated broadly.

6. **Generated component scaffold still carries broad default attribute boilerplate**
   - Evidence:
     - `lib/live_canvas_web/components/core_components.ex:187-190`
   - Why this is AI-slop-adjacent:
     - Not inherently wrong; this is common Phoenix starter code.
     - Included as a mild cleanup candidate where generated defaults remain uncurated.
   - Risk:
     - Low; mostly readability and signal-to-noise.

---

## Findings: Documentation & Plans

### High severity

1. **Prompt-instruction leakage inside plan docs**
   - Evidence:
     - `docs/plans/2026-03-01-sasa-juric-alignment.md:3`
     - `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md:3`
     - `docs/plans/2026-03-18-query-policy-composition-and-reuse.md:3`
   - Issue:
     - Public planning artifacts include LLM execution directives (`For Claude: REQUIRED SUB-SKILL...`).
   - Risk:
     - Documentation quality regression; mixes human plan intent with agent-control syntax.

2. **Plan verbosity and checklist churn obscuring decision signal**
   - Evidence patterns across active plans:
     - “Current State Verification” / “Candidate Status Verification” sections
     - “Task X Step Progress” micro-checklists
     - “Suggested verification command” repeated scaffolding blocks
   - Representative files:
     - `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`
     - `docs/plans/2026-03-18-query-policy-composition-and-reuse.md`
     - `docs/plans/2026-03-22-development-seed-data.md`
   - Issue:
     - Plans contain repeated template structure that can exceed the amount of unique technical intent.
   - Risk:
     - Harder to identify real constraints, current state, and next action.

### Medium severity

3. **Research-heavy narratives that restate generic architecture doctrine**
   - Evidence:
     - `docs/plans/2026-03-01-sasa-juric-alignment.md:13-143`
   - Issue:
     - Extremely long conceptual sections with limited direct mapping to executable deltas.
   - Risk:
     - Inflates planning cycle time and raises staleness risk.

4. **Reference docs with stale lane summaries**
   - Evidence:
      - `docs/plans/README.md:21-23` does not match current backend lane pointer in `docs/plans/backend/NOW.md`.
      - `docs/plans/README.md` still says the backend lane points to
        `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md` -> `Task 2`,
        while `docs/plans/backend/NOW.md` points to
        `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` -> `Task 1`.
   - Issue:
      - Summary mismatch indicates plan-index drift.
   - Risk:
     - New contributors may follow outdated pointers.

---

## False Positives / What should NOT be treated as AI-slop

- Presence of generated Phoenix component code in `core_components.ex` is expected baseline scaffolding.
- Explicitly paused compliance deletion work can justify temporary stubbing if operational docs clearly state non-destructive behavior.
- Strong type specs and detailed tests, even if verbose, are not AI-slop by themselves.

---

## Prioritized Remediation

1. **Remove instruction leakage from plan docs**
   - Delete `For Claude...` preambles from active plans.
   - Keep execution policies in `AGENTS.md`, not in task plans.

2. **Clarify destructive-operation state in data governance codepaths**
   - Rename/annotate completion events or payload fields to avoid implying hard-delete completion.
   - Ensure operational tooling clearly distinguishes “evaluated/stubbed” from “deleted.”

3. **Reduce policy helper repetition**
   - Consolidate repeated `maybe_join_*` patterns where practical into a parameterized helper with explicit bindings.

4. **Trim plan template overhead**
   - Keep one concise state section, one task checklist, and one verification block per plan.
   - Move historical step-by-step progress into archive notes if needed.

5. **Synchronize planning summaries**
   - Keep `docs/plans/README.md` lane snapshot aligned with lane `NOW.md` pointers.

---

## Quick Quality Heuristics For Future AI-Assisted Changes

- If a feature is intentionally non-functional (stubbed), make that impossible to misread in API/event names.
- Reject plan content that includes model/tool invocation instructions.
- Prefer one high-signal decision log over repeated “verification/progress” sections.
- Treat repeated private helper patterns as refactor candidates once behavior is stable.

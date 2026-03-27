# Mobile Lane Execution

Last reviewed: 2026-03-27
Status: active for planning

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `mobile_foundations`
- Source: `docs/plans/mobile/TRACK.md`
- Plan: none yet — create the next detailed plan
- Batch: `Create the next detailed plan for Relay data layer, auth, and session lifecycle`
- Why now: The app shell plan is fully complete (all four tasks green, tsc passes, no auth/Relay/channel leakage). The next slice in the recommended delivery order is Relay data layer and auth/session lifecycle (overview sections 2.1–2.2 and 3.1–3.3).

## Do This Now

- Review `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md` sections 2 and 3 for scope.
- Review the backend GraphQL contracts in `docs/contracts/mobile-graphql-phase2.md` and `ARCHITECTURE.md` for the auth and data layer surfaces the mobile app will consume.
- Create a new detailed implementation plan at `docs/plans/mobile/` covering Relay environment setup, authenticated network layer, auth provider integration, and session lifecycle.
- Update this file to point at the new plan once it is written.
- Keep the work inside `docs/plans/mobile/**`.
- If the plan requires backend contract or schema changes not yet implemented, note them as dependencies rather than editing backend code.

## Verification Scope

Planning batch — no code verification needed until the plan is approved and execution begins.

## Next Up

- Once the Relay/auth plan is written, advance this lane pointer to the first executable batch from that plan.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- the current batch is already complete
- the current batch is blocked
- another mobile slice is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

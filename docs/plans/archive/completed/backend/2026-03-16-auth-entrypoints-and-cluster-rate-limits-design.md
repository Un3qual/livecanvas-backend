# Unified Auth Entry Points And Cluster Rate Limits Design

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

Approved on 2026-03-16.

This file captures the approved design snapshot for unifying client auth entry
points and replacing per-node abuse throttles with cluster-aware OTP
coordination. The canonical architecture constraints remain in
`ARCHITECTURE.md` and `docs/architecture/conventions.md`.

## Goals

- Add mobile-friendly GraphQL auth entry points for `PASSWORD`, `MAGIC_LINK`,
  `GOOGLE`, `APPLE`, and `PASSKEY`.
- Keep signup/login separate from reusable challenge issuance and from
  authenticated identity-management flows.
- Add stable auth-specific error codes without freezing the entire GraphQL API.
- Make rate limits cluster-aware without Redis or PostgreSQL-backed counters.
- Preserve the current browser/session routes and existing token lifecycle
  primitives.

## Non-Goals

- Freeze the full external GraphQL contract in this slice.
- Resume any paused compliance or hard-delete work.
- Introduce Redis, Horde, or libcluster unless the existing `DNSCluster` setup
  proves insufficient during implementation.
- Collapse email confirmation, provider linking, or address-management workflows
  into signup/login mutations.

## Approved Decisions

- Keep auth entry points GraphQL-first.
- Use two terminal auth mutations:
  - `signUp(input: AuthInput!)`
  - `logIn(input: AuthInput!)`
- Use a separate reusable challenge mutation:
  - `beginAuthChallenge(input: AuthChallengeInput!)`
- Keep identity-linking and additional-email flows as separate viewer-scoped
  mutations that can later reuse the same provider-verification and
  challenge-issuance internals.
- Introduce a dedicated `AUTH_PROVIDER` enum for auth entry points instead of
  overloading the current `oauth_provider` shape.
- Add auth-specific machine-readable error codes to auth payload errors only.
- Replace the local ETS-only limiter with owner-node hashing over the existing
  cluster plus `:erpc` forwarding to the owner node.

## Auth Mutation Contract

### `AUTH_PROVIDER`

The auth entry-point enum is exactly:

- `PASSWORD`
- `MAGIC_LINK`
- `GOOGLE`
- `APPLE`
- `PASSKEY`

This enum is distinct from legacy identity-display fields so the client auth
contract can align with the actual launch set without exposing unsupported
providers.

### `beginAuthChallenge`

`beginAuthChallenge` is responsible only for issuing challenge state that a
later terminal auth mutation will consume.

Supported providers in this slice:

- `MAGIC_LINK`
  - issue a signup or login magic-link challenge
- `PASSKEY`
  - issue WebAuthn registration or authentication challenge options

The input carries `provider` plus a purpose/intention field so challenge
issuance remains reusable outside signup/login later. This addresses flows such
as linking another email or provider without forcing those actions into the
signup/login mutations themselves.

### `signUp`

`signUp` creates an account and returns an access/refresh token pair once the
presented proof succeeds.

Provider behavior:

- `PASSWORD`
  - create a new account from email + password
  - keep email confirmation separate from the signup mutation itself
- `MAGIC_LINK`
  - redeem a signup challenge token
  - treat successful redemption as proof of email ownership
- `GOOGLE` / `APPLE`
  - validate the provider token/claims
  - create an account only when no active linked identity already exists
- `PASSKEY`
  - consume a registration challenge and attestation result
  - create the account and register the first passkey credential atomically

### `logIn`

`logIn` authenticates an existing account and returns an access/refresh token
pair.

Provider behavior:

- `PASSWORD`
  - verify email + password
- `MAGIC_LINK`
  - redeem a login challenge token for an existing account
- `GOOGLE` / `APPLE`
  - validate the provider token/claims and require an existing active linked
    identity
- `PASSKEY`
  - consume an authentication challenge and assertion result for an existing
    passkey credential

## Identity Management Split

Signup/login mutations are not responsible for:

- linking an additional Google/Apple identity
- registering a second passkey for an already authenticated user
- adding or confirming another email address
- unlinking an identity

Those remain separate authenticated flows. The new provider verifiers and
challenge helpers should be reusable by those flows later, but they are not
modeled as signup/login phases.

## Accounts Model Changes

### Provider Verification

Google and Apple verification live behind Accounts-owned verifier modules that:

- validate provider tokens and claims
- normalize provider subject data
- return a stable internal shape consumed by `LC.Accounts`

The verifiers should accept injected HTTP/JWKS/config dependencies so tests stay
deterministic.

### Passkeys

Passkey credentials get a dedicated relational table rather than overloading
`user_identities`.

The credential table should:

- use `bigint` primary key + Postgres-generated `entropy_id`
- use `:utc_datetime_usec` timestamps
- reference the owning `user`
- reference the linked `user_identity` one-to-one
- store the credential ID, public-key material, sign counter, transports, and
  last-used metadata

`user_identities` still represents the linked auth identity with
`provider: :passkey_provider`, while the credential row stores WebAuthn-specific
details and counters.

### Challenge State

Magic-link challenges continue to reuse the existing token infrastructure.
Passkey challenge state should also use the existing token model via dedicated
token contexts so challenge issuance, expiry, hashing, and replay protection
follow the same persisted-secret rules already used elsewhere in Accounts.

## Error Model

Auth payload errors gain a `code` field with stable machine-readable values such
as:

- `UNAUTHENTICATED`
- `INVALID_INPUT`
- `INVALID_CREDENTIALS`
- `EMAIL_TAKEN`
- `TOKEN_EXPIRED`
- `TOKEN_REVOKED`
- `UNSUPPORTED_PROVIDER`
- `PROVIDER_VERIFICATION_FAILED`
- `PASSKEY_VERIFICATION_FAILED`

This is scoped to the auth surface only. The broader GraphQL API remains out of
scope for full error-code normalization in this slice.

## Cluster-Aware Rate Limiting

The rate limiter remains OTP-native and stateless at the routing layer.

Approved model:

1. Gather the currently connected node set as `[Node.self() | Node.list()]`.
2. Sort deterministically by node name.
3. Choose the owner node for `{limit_key, subject}` via a stable hash.
4. Forward the `allow/2` decision to that owner via `:erpc`.
5. Keep the authoritative bucket counter local to the owner node in ETS.

This yields one authoritative counter per `(limit_key, subject, time_bucket)`
across a healthy cluster without adding Redis or Postgres write pressure.

### Failure Behavior

- Healthy cluster: limits are cluster-wide.
- Owner-node routing failure or partition: fall back to local-node enforcement
  instead of hard-failing requests.
- Cleanup remains local to each node because only the owner node mutates the
  authoritative bucket for a given key.

### Why Not Horde / PubSub Replication

- Horde adds more moving parts than needed for simple counter ownership.
- PubSub/`:pg` replication would trade correctness for eventual consistency.
- The app already relies on `DNSCluster` and `:erpc` for distributed runtime
  ownership work, so reuse is lower risk than introducing another cluster
  subsystem.

## Testing Strategy

- TDD throughout: failing test first for each mutation/provider/limiter change.
- Add focused Accounts tests for password, magic-link, provider, and passkey
  flows.
- Add focused GraphQL tests for the generic auth mutations and auth error codes.
- Add limiter tests that prove the owner-node routing shape is deterministic and
  that remote-owner failures degrade to local enforcement.
- Preserve `mix typecheck` cleanliness for all new public APIs.

## Rollout Notes

- Keep existing browser auth routes intact while adding the new GraphQL auth
  surface.
- Do not resume compliance work in this slice.
- Update roadmap and plan index only after the implementation plan lands and the
  first code batch is underway.

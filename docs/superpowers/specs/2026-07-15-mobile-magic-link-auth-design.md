# Mobile Magic-Link Authentication Design

Date: 2026-07-15
Status: approved
Owner: backend and mobile lanes

## Goal

Make the existing GraphQL magic-link contract usable end to end from the mobile
sign-in and sign-up screens without exposing raw credentials to HTTP request
paths, referrers, startup snapshots, or Expo Router state.

## Product Flow

The auth entry screen offers an email-link action alongside password and linked
providers. It calls `beginAuthChallenge` with the current sign-in or sign-up
purpose and shows neutral delivery copy after a successful request. Sign-in
continues to avoid account enumeration; sign-up may surface the backend's
existing `EMAIL_TAKEN` error so the user can switch to sign-in.

Delivered links use the configured `LIVE_CANVAS_PUBLIC_ORIGIN` and one of two
non-secret paths:

- `/auth/magic-link/sign-in#token=...`
- `/auth/magic-link/sign-up#token=...`

The token remains in the fragment, so Phoenix, proxies, request telemetry, and
referrers never receive it. A minimal no-store landing page validates the path
and fragment in a dedicated asset, clears the fragment, and offers the exact
matching `livecanvas-mobile://magic-link/<purpose>?token=...` handoff.

## Mobile Credential Boundary

Expo Router's native-intent hook accepts only the exact configured HTTPS origin
or exact custom-scheme authority/path, requires one nonblank token parameter,
and rejects credentials, ports, extra parameters, encoded lookalikes, and
malformed links. It stores `{purpose, token}` in a dedicated fixed SecureStore
slot with a short TTL and returns only `/magic-link?handoff=<opaque-id>`.
Startup redaction maps any recognizable raw magic-link URL to token-free
`/magic-link`, even when storage or parsing fails.

The public magic-link route reads only the opaque handoff ID. It redeems the
stored token through the existing unauthenticated GraphQL client using the
stored purpose, persists the returned auth tokens through `AuthProvider`, then
clears the handoff and replaces the route with `/home`. Definitive invalid or
expired responses clear the handoff; transport failures retain it for retry.
An already authenticated startup never replaces its session from a magic link.

## Boundaries And Non-Goals

- Keep the current `beginAuthChallenge`, `signUp`, and `logIn` schema; no new
  GraphQL fields or token formats are required.
- Do not put magic-link tokens in a query string, path, navigation parameter,
  diagnostic snapshot, log message, or error copy.
- Do not generalize contact-invite storage into a cross-domain abstraction;
  magic links use a separate SecureStore key and lifecycle.
- Do not add passkeys, password-reset delivery changes, automatic browser
  redirects, or authenticated account switching in this batch.
- Operator and physical-device email-link QA remains pending after local gates.

## Verification

Backend tests prove configured fragment-only URL delivery, neutral hardened
landing responses, and exact landing-asset parsing. Mobile unit and RNTL tests
cover request validation/copy, strict link parsing, opaque handoff storage,
startup redaction, login/signup redemption, invalid/expired links, retryable
transport failures, authenticated-session protection, and successful routing.
The batch closes with backend formatting/types/tests plus Relay generation,
mobile quality gates, `nix flake check`, and patch hygiene.

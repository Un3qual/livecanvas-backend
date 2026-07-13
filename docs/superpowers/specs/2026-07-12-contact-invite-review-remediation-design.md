# Contact Invite Review Remediation Design

## Goal

Close the backend, mobile, deployment, and maintainability gaps found in the
end-to-end contact invitation review without expanding the feature beyond its
approved product scope.

## Selected Approach

Delivery becomes contact-driven rather than recipient-driven. Mobile submits
the opaque Relay `ContactMatch` ID. GraphQL decodes that ID, and `LC.Accounts`
loads the viewer-owned contact entry, recomputes its current match state, and
derives the only eligible recipient. Missing, foreign, self-owned, or currently
matched rows fail before a token or email is created. This keeps durable
authorization in the Accounts boundary and makes the client row state advisory.

The rejected alternatives are retaining a raw recipient mutation with a
server-side lookup, which leaves the authority ambiguous when multiple contact
rows share an address, and trusting the mobile row check, which does not protect
direct GraphQL callers or stale rows.

Consumption keeps its existing token-row lock and additionally locks the exact
viewer email join before treating it as proof of recipient ownership. The
post-fragment rollout uses a new `contact_invite_fragment_token` context so a
legacy pod issuing `contact_invite_token` after the migration cannot create a
credential accepted by the new validator. The conversion table indexes both
nullable user foreign keys used by `ON DELETE SET NULL`.

## Configuration And Routing

Backend production-origin validation rejects trailing-dot hosts and ports
outside `1..65535`. Mobile reads every Expo public value through direct
`process.env.EXPO_PUBLIC_*` expressions so Expo can inline them. A production
environment without `EXPO_PUBLIC_APP_ORIGIN` fails instead of silently using
localhost; local and test environments retain the localhost default.

Invite-shaped HTTPS paths are classified broadly enough that `/invites/`,
nested paths, and encoded path variants fail to token-free `/invite`. Only the
exact configured-origin `/invites#token=...` form is accepted.

## Mobile Consumption Semantics

`invalid_contact_invite` is the only payload error that clears the matching
SecureStore handoff. `unauthenticated` retains the handoff and returns the user
to the existing sign-in/create-account state. Unknown payload errors are
retryable and retain the handoff. Successful consumption still clears only the
matching fixed-slot record.

## Public Landing Asset

The public invite page uses a dedicated `contact_invite_landing_entry.js`
bundle containing only the fragment handoff initializer. It no longer imports
the Phoenix/LiveView application bundle and therefore no longer needs a fake
CSRF meta tag. The parser remains a pure unit-tested module.

## Verification

Every behavior change begins with a failing regression test. Backend coverage
includes foreign/matched contact delivery rejection, versioned token rejection,
origin edge cases, row-lock SQL, migration indexes, and genuinely independent
database consumers. Mobile coverage includes Expo's Babel environment rewrite,
missing production origin, malformed invite-shaped paths, unauthenticated
payload retention, and unknown payload retry. Asset verification asserts the
dedicated bundle is built and the landing template no longer loads `app.js`.

# Native Module Import Boundary Design

## Goal

Remove production dynamic imports that exist only to keep Expo native modules
out of Bun unit tests, without changing contact-invite or media-selection
behavior.

## Design

Keep `contactInviteHandoff.ts` and `mediaPostSelection.ts` as the app-facing
native adapters. They statically import their Expo dependencies and delegate to
pure core modules. The cores own the existing behavior and accept storage, ID
generation, or picker dependencies explicitly, so unit tests can exercise them
without loading React Native.

Keep contact-invite parsing and snapshot redaction independent from native
handoff persistence. Only Expo Router's native-intent entry point imports the
native link adapter, preventing ordinary runtime URL helpers from loading
SecureStore transitively.

The media picker remains invoked only when the user selects media; eagerly
loading its module with the rest of the post-composer bundle is acceptable and
matches the repository's other Expo integrations. Storage and picker failures
retain their existing viewer-safe error behavior.

## Verification

Run the focused contact-invite and media-selection tests, mobile typechecks,
lint, and the complete mobile quality suite. Confirm production source contains
no runtime dynamic imports except any independently justified lazy-loading
boundary.

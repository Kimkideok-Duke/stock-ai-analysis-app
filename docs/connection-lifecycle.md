# AI connection lifecycle correction

## Cause

The market-data integration placed AiConnections inside a conditional market.data fragment. Changing symbol or range temporarily cleared the matching market data, unmounting AiConnections and ChatSubscription. The latter correctly revoked its session on unmount, but an unrelated chart selection should never have unmounted it. Personal API connection state was also lost while the parent retained an obsolete connection reference.

## Fix

- Keep AiConnections mounted at a stable sibling position outside chart availability fragments.
- Continue clearing old analysis and cancelling in-flight analysis on symbol/range changes, without clearing the selected account.
- Disable analysis while data for the current symbol/range is missing or has a refresh error. Login and disconnect controls remain independent of market availability.
- Keep API keys and subscription handles in memory only. Reload, explicit disconnect, actual session expiry or server restart may still require reconnecting. No browser persistence of credentials was introduced.

## Verification

- Added a React component lifecycle regression test using react-test-renderer matching React 19.1.0.
- The test drives the real App, AiConnections and ChatSubscription components with mocked native surfaces, market loading and provider responses. It verifies stable component identity, no subscription disconnect while selecting another stock, disabled analysis during loading, and reuse of the same session/API credential for the newly selected stock.
- Full test suite: 22 passing. TypeScript: passing.
- Tests do not perform a real account login or paid analysis. Synthetic credentials only.

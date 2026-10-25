# Market data integration

## Local prototype

- GET /api/market/chart?symbol=NVDA&range=1D runs on the existing server (port 8787).
- Supported symbols: AAPL, TSLA, NVDA, MSFT, 005930 (Yahoo symbol 005930.KS).
- 1D uses one-minute OHLCV. 1M/3M/6M use daily OHLCV.
- The client refreshes every 30 seconds after the preceding request completes, with cancellation on symbol/range changes. Requests time out; the server caches for 25 seconds and coalesces concurrent requests.
- Data comes from the public Yahoo Finance chart endpoint. No market credential is bundled with the client, and no new key was required for this local test.
- This is an unofficial endpoint for a personal prototype, not a licensed production feed or guaranteed exchange-realtime service. Availability and delay vary. Production distribution requires a provider agreement and appropriate exchange entitlements. Do not market polling as guaranteed realtime trading data.
- The UI shows provider, interval, candle start timestamp, receipt time and session status. Session status follows the returned session schedule, not a full exchange calendar. Off-session charts retain the latest trading session; no fabricated candles are added.
- Daily change uses the previous daily candle close; intraday change uses provider previousClose/chartPreviousClose. It does not use the start-of-quarter chart baseline as the previous daily close.
- Null/invalid OHLCV gaps are filtered. Empty, mismatched or unavailable upstream data returns a safe error, never a mock price fallback. After a failed refresh, only last-received data for the same symbol/range can remain visible with a warning.

## Analysis provenance

Technical indicators and split-order scenarios use the fetched OHLCV. The AI request carries source, interval and as-of time. Sample news and financials are explicitly labeled and excluded from AI evidence. AI calls remain manual and are not billed on every market refresh. Existing AI results represent their analysis-time snapshot, not a continuously regenerated forecast.

## Verification

- npm test: 21 tests passing; npm run typecheck: passing.
- Live local API requests verified NVDA and Samsung for both 1D and 3M, returning hundreds of intraday candles and dozens of daily candles.
- Tests cover gaps, invalid data, symbol validation, daily/intraday baseline, Korean symbol mapping, caching/coalescing and safe errors without fake data.
- Browser confirmed actual NVDA price/dated candles, indicators and strategy recalculation. API credentials and local environment files are not published.

Provider reference: https://help.yahoo.com/kb/SLN2352.html

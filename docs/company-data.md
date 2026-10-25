# Actual news and financial statements

## Sources and freshness

- GET /api/market/company?symbol=NVDA serves news and financial statements independently. Existing supported symbols are AAPL, TSLA, NVDA, MSFT, and Samsung (005930.KS).
- News: Google News RSS company queries covering the preceding seven days, sorted by publication time, with source and HTTPS original/aggregator links. At most 12 headlines are shown. Article bodies are not collected and sentiment is not presented as measured fact. No fabricated summaries are inserted.
- Financials: Yahoo financial time series, with up to five actual quarters and three actual annual reports. Same-date quarter and annual reports remain distinct; the quarter is preferred for the latest operating performance.
- These public endpoints are used for the personal local prototype, not a licensed production feed. Access/coverage can change and provider publication can lag an issuer filing. Production needs appropriate provider permissions, and direct SEC/DART reconciliation is not implemented.
- Client refresh: every five minutes; manual refresh available. Server caches successful news for two minutes, financials for fifteen minutes, and coalesces concurrent requests. Symbol changes abort obsolete client requests.
- UI explicitly separates publication time, financial period end, and data receipt time. Filing dates are not provided by this endpoint and are shown as unavailable. Never label a period-end date as the filing date or today's performance.

## Calculations

- Growth: latest revenue versus the same period one year earlier, not versus the previous quarter.
- Operating/net margins: latest quarter (or annual fallback), consistently matched to its revenue.
- Debt/equity: total liabilities divided by stockholders' equity, not interest-bearing debt/assets.
- PER: current fetched chart close divided by the sum of four contiguous reported quarterly basic EPS values. Annual fallback only when the selected latest report is annual. Losses or absent EPS return null, not zero.
- ROE: four-quarter net income divided by average current/year-earlier equity (annual numerator for an annual fallback). No single-quarter x4 annualization.
- PBR: approximate current price times provided ordinary shares divided by reported equity. Share-class differences can make this differ from an official vendor ratio.
- Cash-flow trend compares the same period a year earlier. Missing/invalid denominators and unavailable quarters stay null. No estimates or fake zeros are supplied.
- The pre-existing heuristic score is shown only when every required metric is available. It is not a valuation model or prediction probability.

## AI context

Actual headlines (source/date/link), financial report records and per-resource status are sent when the user starts AI analysis. Catalog sample news and financial metrics are no longer passed from the app. Missing resources or ratios stay absent/null. Prompts prohibit treating missing fields as zero, confusing filing and period dates, claiming the full news article was read, or following instructions embedded in the source data.

## Verification

- All five supported symbols returned real RSS headlines and financial reports through the local API.
- Provider financial period ends observed during verification: NVDA 2026-07-31; AAPL, TSLA, MSFT and Samsung 2026-06-30. These are provider-available dates, not a guarantee that no newer issuer filing exists.
- Tests cover RSS ordering/deduplication/unsafe links/future dates/entity declarations, financial symbol/currency/period alignment, null preservation, quarter preference, contiguous TTM, missing/negative EPS, independent errors/cache, and actual-source AI payload construction.
- Total suite: 27 tests. TypeScript passes. Existing connection lifecycle regression remains covered. No real paid AI invocation was needed.

Reference: https://uk.help.yahoo.com/kb/SLN28276.html

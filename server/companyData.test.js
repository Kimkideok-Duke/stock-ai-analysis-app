const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { parseNews, parseFinancials, createCompanyService } = require('./companyData');
const { analysisPrompt } = require('./aiProviders');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { deriveFinancials } = require('../src/lib/companyModel.ts');
const now = Date.parse('2026-10-26T00:00:00Z');
const rss = `<rss><channel>
<item><title>Older</title><pubDate>Fri, 23 Oct 2026 10:00:00 GMT</pubDate><link>https://example.com/older</link><source>Publisher</source></item>
<item><title>Latest</title><pubDate>Sun, 25 Oct 2026 10:00:00 GMT</pubDate><link>https://example.com/latest</link></item>
<item><title>Latest</title><pubDate>Sun, 25 Oct 2026 10:00:00 GMT</pubDate><link>https://example.com/duplicate</link></item>
<item><title>Unsafe</title><pubDate>Sun, 25 Oct 2026 10:00:00 GMT</pubDate><link>javascript:alert(1)</link></item>
<item><title>Future</title><pubDate>Sun, 25 Oct 2027 10:00:00 GMT</pubDate><link>https://example.com/future</link></item>
</channel></rss>`;
function report(periodEnd, periodType = '3M') { return { periodEnd, periodType, currency: 'USD', revenue: 100, operatingIncome: 20, netIncome: 10, equity: 200, liabilities: 50, freeCashFlow: 5, eps: 1, shares: 100 }; }
function snapshot(records) { return { source: 'Test', url: 'https://example.com', asOf: records[0].periodEnd, fetchedAt: new Date(now).toISOString(), filingDate: null, records }; }

test('RSS sorts newest first, deduplicates, rejects unsafe links, future news and entity declarations', () => {
  const items = parseNews(rss, now);
  assert.deepEqual(items.map(item => item.title), ['Latest', 'Older']);
  assert.equal(items[1].source, 'Publisher');
  assert.equal(items[0].summary, '');
  assert.throws(() => parseNews('<!DOCTYPE rss [<!ENTITY x "bad">]><rss/>', now));
  assert.throws(() => parseNews('<invalid>', now));
  assert.deepEqual(parseNews('<rss><channel/></rss>', now), []);
});

test('financial normalization preserves nulls and prefers quarter when annual has same date', () => {
  const body = { timeseries: { result: ['annual', 'quarterly'].map(prefix => ({ meta: { symbol: ['NVDA'], type: [prefix + 'TotalRevenue'] },
    [prefix + 'TotalRevenue']: [{ asOfDate: '2026-06-30', periodType: prefix === 'annual' ? '12M' : '3M', currencyCode: 'USD', reportedValue: { raw: 100 } }],
  })) } };
  const result = parseFinancials(body, 'NVDA', now);
  assert.equal(result.records[0].periodType, '3M');
  assert.equal(result.records[0].netIncome, null);
  assert.equal(result.filingDate, null);
  assert.throws(() => parseFinancials(body, '005930', now));
});

test('financial ratios use four actual quarters, year-over-year comparisons and no fabricated zero metrics', () => {
  const rows = ['2026-06-30', '2026-03-31', '2025-12-31', '2025-09-30', '2025-06-30'].map(date => report(date));
  rows[4].revenue = 80;
  const data = deriveFinancials(snapshot([report('2026-06-30', '12M'), ...rows]), 20);
  assert.equal(data.latest.periodType, '3M');
  assert.equal(data.metrics.revenueGrowth, 0.25);
  assert.equal(data.metrics.per, 5);
  assert.equal(data.metrics.roe, 0.2);
  assert.ok(data.analysis);
  assert.equal(deriveFinancials(snapshot(rows.slice(0, 2)), 20).metrics.per, null);
  const lostQuarter = [rows[0], rows[2], rows[3], rows[4]];
  assert.equal(deriveFinancials(snapshot(lostQuarter), 20).metrics.per, null);
  rows.forEach(row => { row.eps = -1; });
  assert.equal(deriveFinancials(snapshot(rows), 20).analysis, null);
  assert.equal(deriveFinancials(snapshot(rows), null).metrics.pbr, null);
});

test('company service isolates news failure, caches successful financials and never returns samples', async () => {
  let calls = 0;
  const service = createCompanyService(async url => {
    calls++;
    if (url.includes('news.google')) return { ok: false };
    return { ok: true, json: async () => ({ timeseries: { result: [{ meta: { symbol: ['NVDA'], type: ['quarterlyTotalRevenue'] }, quarterlyTotalRevenue: [{ asOfDate: '2026-06-30', periodType: '3M', currencyCode: 'USD', reportedValue: { raw: 100 } }] }] } }) };
  }, () => now);
  const result = await service('NVDA');
  assert.equal(result.news.status, 'error');
  assert.equal(result.news.data, null);
  assert.equal(result.financials.status, 'ok');
  await service('NVDA'); assert.equal(calls, 3);
  await assert.rejects(service('__proto__'));
  assert.match(analysisPrompt({}), /null.*0/);
});

test('AI request carries actual company sources and null missing scores, not catalog sample news', async () => {
  const { requestAiAnalysis } = require('../src/lib/aiAnalysisClient.ts');
  const { mockStocks } = require('../src/data/mockMarket.ts');
  const { analyzeSeries } = require('../src/lib/indicators.ts');
  const originalFetch = global.fetch;
  const items = parseNews(rss, now);
  const companyContext = { symbol: 'NVDA', news: { status: 'ok', data: { source: 'Test RSS', items } }, financials: { status: 'ok', data: snapshot([report('2026-06-30')]) } };
  let sent;
  global.fetch = async (_url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({ mode: 'openai' }) }; };
  try {
    const analysis = analyzeSeries(mockStocks.NVDA.candles);
    await requestAiAnalysis({ stock: { ...mockStocks.NVDA, news: items }, strategy: analysis.strategy, rsi: analysis.rsi, macdHistogram: analysis.macd.histogram,
      maState: analysis.maState, volumeState: analysis.volumeState, news: { label: '중립', summary: 'Titles only' }, fundamentals: null, companyContext,
    }, { provider: 'openai', model: 'test-model', apiKey: 'synthetic-test-key' });
    assert.equal(sent.fundamentals, null);
    assert.equal(sent.news.items[0].title, 'Latest');
    assert.equal(sent.news.items[0].publishedAt, items[0].publishedAt);
    assert.equal(sent.companyContext.financials.data.records[0].periodEnd, '2026-06-30');
    assert.ok(!JSON.stringify(sent.news).includes('AI accelerator demand remains resilient'));
  } finally { global.fetch = originalFetch; }
});

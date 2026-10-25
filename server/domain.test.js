const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { analyzeSeries, movingAverage } = require('../src/lib/indicators.ts');
const { buildChartModel } = require('../src/lib/chartModel.ts');
const { parseWatchlist } = require('../src/lib/watchlist.ts');
const { mockStocks, searchStocks } = require('../src/data/mockMarket.ts');
const { requestJson } = require('../src/lib/httpClient.ts');

const flat = Array.from({ length: 40 }, (_, i) => ({ time: String(i), open: 100, high: 100, low: 100, close: 100, volume: 0 }));

test('flat prices are neutral RSI; constant volume zero stays finite', () => {
  const result = analyzeSeries(flat);
  assert.equal(result.rsi, 50);
  assert.equal(result.macd.histogram, 0);
  const model = buildChartModel(flat, [], [], [], [], 320);
  assert.ok(model.volumes.every(item => Number.isFinite(item.y) && Number.isFinite(item.height)));
  assert.ok(model.volumes.every(item => item.height === 0));
  assert.ok(model.priceLabels.every(item => item.y >= 0 && item.y <= 220));
  assert.equal(new Set(model.priceLabels.map(item => item.value)).size, 3);
});

test('invalid and empty OHLCV input is rejected before producing price recommendations', () => {
  assert.throws(() => analyzeSeries([]));
  assert.throws(() => analyzeSeries([{ ...flat[0], close: NaN }]));
  assert.throws(() => analyzeSeries([{ ...flat[0], volume: -1 }]));
});

test('buy levels are positive and ordered even for high volatility and flat series', () => {
  for (const candles of [flat, [{ time: 'x', open: 1, close: 1, high: 100, low: 0.01, volume: 0 }], ...Object.values(mockStocks).map(s => s.candles)]) {
    const plan = analyzeSeries(candles).strategy;
    assert.ok(plan.stopLoss > 0 && plan.stopLoss < plan.buyZone.defensive);
    assert.ok(plan.buyZone.aggressive >= plan.buyZone.balanced && plan.buyZone.balanced >= plan.buyZone.defensive);
    assert.ok(plan.sellTargets.first < plan.sellTargets.second && plan.sellTargets.second < plan.sellTargets.final);
    assert.equal(plan.splitBuy.reduce((sum, item) => sum + item.weight, 0), 100);
    assert.equal(plan.splitSell.reduce((sum, item) => sum + item.weight, 0), 100);
  }
});

test('dense candle bodies fit their slots; overlays have valid plot extents', () => {
  const candles = mockStocks.NVDA.candles;
  const result = analyzeSeries(candles);
  for (const width of [280, 900]) {
    const model = buildChartModel(candles, result.ma5, result.ma20, result.ema20, result.bollinger20, width);
    assert.ok(model.candles.every(item => item.bodyWidth < model.slot && item.highY >= 17 && item.lowY <= 203));
    assert.ok(model.candles.at(-1).x < width - 68);
  }
});

test('moving average, search aliases and watchlist corruption handling', () => {
  assert.deepEqual(movingAverage([1, 2, 3, 4], 2), [1, 1.5, 2.5, 3.5]);
  assert.equal(searchStocks('삼성')[0].symbol, '005930');
  assert.equal(searchStocks('not-a-stock').length, 0);
  assert.deepEqual(parseWatchlist('["NVDA","NVDA","unknown","__proto__",42,"AAPL"]'), ['NVDA', 'AAPL']);
  assert.deepEqual(parseWatchlist('{broken'), []);
});

test('client handles malformed JSON, safe server errors, timeout and cancellation', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => { throw Error('HTML'); } });
    await assert.rejects(() => requestJson('http://test'), /서버 응답/);
    global.fetch = async () => ({ ok: false, json: async () => ({ message: 'API 한도' }) });
    await assert.rejects(() => requestJson('http://test'), /API 한도/);
    global.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
      if (signal.aborted) reject(new DOMException('aborted', 'AbortError'));
      else signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
    await assert.rejects(() => requestJson('http://test', {}, undefined, 10), /시간이 초과/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(() => requestJson('http://test', {}, controller.signal), { name: 'AbortError' });
  } finally { global.fetch = original; }
});

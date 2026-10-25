const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeChart, createMarketService, installMarket } = require('./marketData');
const express = require('express');

function fixture(symbol = 'NVDA') {
  return { chart: { result: [{ meta: { symbol, currency: symbol.endsWith('.KS') ? 'KRW' : 'USD', chartPreviousClose: 80, exchangeName: 'TEST' },
    timestamp: [1700000000, 1700000060, 1700000120], indicators: { quote: [{ open: [100, null, 102], high: [105, null, 108], low: [99, null, 101], close: [103, null, 106], volume: [10, null, 20] }] } }] } };
}

test('market normalization filters null gaps, preserves real timestamps and uses previous daily close', () => {
  const data = normalizeChart(fixture(), 'NVDA', '3M', 1700001000000);
  assert.equal(data.candles.length, 2);
  assert.equal(data.candles[1].close, 106);
  assert.equal(data.previousClose, 103);
  assert.equal(data.delay, 'possible');
  assert.equal(normalizeChart(fixture(), 'NVDA', '1D').previousClose, 80);
  assert.equal(normalizeChart(fixture('005930.KS'), '005930', '1D').currency, 'KRW');
  assert.throws(() => normalizeChart(fixture('TSLA'), 'NVDA', '3M'));
  const empty = fixture(); empty.chart.result[0].timestamp = [];
  assert.throws(() => normalizeChart(empty, 'NVDA', '3M'));
});

test('market service coalesces concurrent requests, caches briefly and never falls back to sample data', async () => {
  let calls = 0; let now = 1700001000000;
  const service = createMarketService(async url => {
    calls++; assert.match(url, /NVDA\?range=3mo&interval=1d$/);
    return { ok: true, json: async () => fixture() };
  }, () => now);
  await Promise.all([service('NVDA', '3M'), service('NVDA', '3M')]);
  await service('NVDA', '3M'); assert.equal(calls, 1);
  now += 30000; await service('NVDA', '3M'); assert.equal(calls, 2);
  await assert.rejects(service('__proto__', '3M'));
  const failed = createMarketService(async () => ({ ok: false }));
  await assert.rejects(failed('NVDA', '3M'));
  await assert.rejects(failed('NVDA', '3M'));
});

test('market HTTP route validates symbols and returns safe errors without fake candles', async () => {
  const app = express(); installMarket(app, async () => { throw new Error('private upstream detail'); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/market/chart`;
    assert.equal((await fetch(`${base}?symbol=invalid`)).status, 400);
    const response = await fetch(`${base}?symbol=NVDA&range=1D`);
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.candles, undefined);
    assert.ok(!body.message.includes('private'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

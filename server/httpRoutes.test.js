const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('./aiAnalysisServer');
const output = { headline: 'test', summary: 'test', direction: 'test', riskLevel: 'test', buyScenario: 'test',
  sellScenario: 'test', keyReasons: [], riskWarnings: [], disclaimer: 'test' };
const payload = {
  stock: { symbol: 'TEST', name: 'Test', market: 'US', sector: 'Test', currency: 'USD' },
  technical: { direction: 'test', confidence: 50, rsi: 50, macdHistogram: 0, maState: 'test', volumeState: 'test', currentPrice: 100,
    buyZone: { aggressive: 99, balanced: 98, defensive: 97 }, stopLoss: 95, sellTargets: { first: 101, second: 102, final: 103 } },
  news: { label: 'test', summary: 'test', items: [] },
  fundamentals: { totalScore: 50, rating: 'test', growthScore: 50, profitabilityScore: 50, stabilityScore: 50, valuationScore: 50, highlights: [], risks: [] },
};

test('HTTP routes: three provider analysis paths, credential isolation, validation, safe parser errors', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const original = global.fetch;
  try {
    for (const provider of ['gemini', 'openai', 'anthropic']) {
      const credential = `synthetic-${provider}-only`;
      global.fetch = async (upstream, options) => {
        assert.ok(!upstream.includes(credential));
        assert.ok(!options.body.includes(credential));
        assert.ok(Object.values(options.headers).some(value => value.includes(credential)));
        return { ok: true, json: async () => provider === 'gemini'
          ? { candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] }
          : provider === 'openai' ? { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }
          : { content: [{ type: 'text', text: JSON.stringify(output) }] } };
      };
      const response = await original(`${url}/api/ai-analysis`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ai-api-key': credential },
        body: JSON.stringify({ ...payload, connection: { provider, model: 'test-model' } }) });
      assert.equal(response.status, 200);
      const data = await response.json(); assert.equal(data.mode, provider); assert.deepEqual(data.analysis, output);
    }
    global.fetch = original;
    const post = (body, type = 'application/json') => original(`${url}/api/ai-analysis`, { method: 'POST', headers: { 'Content-Type': type }, body });
    assert.equal((await post(JSON.stringify(payload))).status, 401);
    assert.equal((await post('{}')).status, 400);
    assert.equal((await post('null')).status, 400);
    assert.equal((await post('{}', 'text/plain')).status, 415);
    const malformed = await post('{"key":"synthetic-sensitive-value"');
    assert.equal(malformed.status, 400);
    assert.ok(!(await malformed.text()).includes('synthetic-sensitive-value'));
  } finally { global.fetch = original; await new Promise(resolve => server.close(resolve)); }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generate, analyze, publicError } = require('./aiProviders');

for (const provider of ['gemini', 'openai', 'anthropic']) {
  test(`${provider}: uses the selected user's key and parses response`, async () => {
    const fakeKey = 'test-only-credential';
    const connection = { provider, model: 'test-model' };
    const result = await generate(connection, fakeKey, 'JSON test', async (url, options) => {
      assert.ok(!url.includes(fakeKey));
      assert.ok(!options.body.includes(fakeKey));
      const body = JSON.parse(options.body);
      if (provider === 'openai') {
        assert.equal(options.headers.Authorization, `Bearer ${fakeKey}`);
        assert.equal(body.store, false);
      } else assert.equal(options.headers[provider === 'gemini' ? 'x-goog-api-key' : 'x-api-key'], fakeKey);
      return { ok: true, json: async () => provider === 'gemini'
        ? { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }
        : provider === 'openai' ? { output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] }
        : { content: [{ type: 'text', text: '```json\n{"ok":true}\n```' }] } };
    });
    assert.deepEqual(result, { ok: true });
  });
}

test('upstream errors never reveal API credentials', async () => {
  await assert.rejects(() => generate({ provider: 'openai', model: 'test' }, 'secret', 'JSON',
    async () => ({ ok: false, status: 401, json: async () => ({ message: 'secret' }) })),
    error => !error.message.includes('secret') && publicError(error).includes('API 키'));
});

test('invalid provider and malformed analysis are rejected', async () => {
  await assert.rejects(() => generate({ provider: 'other', model: 'test' }, 'test', 'JSON'));
  await assert.rejects(() => analyze({}, { provider: 'anthropic', model: 'test' }, 'test',
    async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: '{"ok":true}' }] }) })));
});

test('analysis endpoint requires personal credentials, even with a server key configured', async () => {
  const app = require('./aiAnalysisServer');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai-connection/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection: { provider: 'gemini', model: 'test' } }),
    });
    assert.equal(response.status, 400);
    assert.ok(!(await response.text()).includes(process.env.GEMINI_API_KEY ?? 'unlikely-key-value'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

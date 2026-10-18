const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeAuthorization, verifyIdentity, readCompletedStream } = require('./chatgptSubscription');

test('OAuth registration uses separate state, poll credential, PKCE, and exact loopback redirect', () => {
  const { transaction, url } = makeAuthorization('urn:uuid:test', 'http://127.0.0.1:8787/auth/callback');
  const params = new URL(url).searchParams;
  assert.equal(params.get('client_id'), 'dynamic_agent_client');
  assert.equal(params.get('agent_name_hint'), 'Stock Chart Lab');
  assert.equal(params.get('redirect_uri'), transaction.redirectUri);
  assert.equal(params.get('code_challenge_method'), 'S256');
  assert.ok(params.get('scope').includes('chatgpt.tokens.use.direct'));
  assert.notEqual(transaction.poll, transaction.state);
  assert.ok(!url.includes(transaction.verifier) && !url.includes(transaction.poll));
  const returning = new URL(makeAuthorization('urn:uuid:test', transaction.redirectUri,
    { clientId: 'oaiapp_saved', subject: 'test' }).url).searchParams;
  assert.equal(returning.get('client_id'), 'oaiapp_saved');
  assert.equal(returning.has('agent_name_hint'), false);
});

test('OIDC verifies signature, audience, expiration and nonce', async () => {
  const { generateKeyPair, SignJWT } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const token = await new SignJWT({ nonce: 'expected' }).setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://auth.openai.com').setAudience('oaiapp_test').setSubject('test-account')
    .setIssuedAt().setExpirationTime('1h').sign(privateKey);
  assert.equal((await verifyIdentity(token, 'oaiapp_test', 'expected', publicKey)).sub, 'test-account');
  await assert.rejects(() => verifyIdentity(token, 'oaiapp_other', 'expected', publicKey));
  await assert.rejects(() => verifyIdentity(token, 'oaiapp_test', 'wrong', publicKey));
  const wrongKey = (await generateKeyPair('RS256')).publicKey;
  await assert.rejects(() => verifyIdentity(token, 'oaiapp_test', 'expected', wrongKey));
  const expired = await new SignJWT({ nonce: 'expected' }).setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://auth.openai.com').setAudience('oaiapp_test').setSubject('test-account')
    .setIssuedAt().setExpirationTime(1).sign(privateKey);
  await assert.rejects(() => verifyIdentity(expired, 'oaiapp_test', 'expected', publicKey));
});

const analysis = { headline: 'test', summary: 'test', direction: 'test', riskLevel: 'test', buyScenario: 'test',
  sellScenario: 'test', keyReasons: [], riskWarnings: [], disclaimer: 'test' };
function stream(events) {
  const bytes = Buffer.from(events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  return { ok: true, body: (async function* () {
    for (let index = 0; index < bytes.length; index += 7) yield bytes.subarray(index, index + 7);
  })() };
}
test('subscription SSE waits for completion and rejects interrupted or failed streams', async () => {
  const delta = { type: 'response.output_text.delta', delta: JSON.stringify(analysis) };
  assert.deepEqual(await readCompletedStream(stream([delta, { type: 'response.completed' }])), analysis);
  await assert.rejects(() => readCompletedStream(stream([delta])));
  await assert.rejects(() => readCompletedStream(stream([delta, { type: 'response.failed' }])));
});

test('unknown OAuth callback and forged subscription session are rejected', async () => {
  const app = require('./aiAnalysisServer');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${url}/auth/callback?state=untrusted&code=untrusted`)).status, 400);
    const result = await fetch(`${url}/api/subscription/status`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-session' }, body: '{}' });
    assert.equal(result.status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

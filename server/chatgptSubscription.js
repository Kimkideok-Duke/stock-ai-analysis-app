const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { analysisPrompt, resultSchema } = require('./aiProviders');

const issuer = 'https://auth.openai.com';
const resource = 'https://api.openai.com/v1';
const random = () => crypto.randomBytes(32).toString('base64url');

function readHost() {
  const file = path.join(__dirname, '../.localappdata/chatgpt-host.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { return { file, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const data = { hostId: `urn:uuid:${crypto.randomUUID()}` };
  fs.writeFileSync(file, JSON.stringify(data), { flag: 'wx', mode: 0o600 });
  return { file, ...data };
}

function makeAuthorization(hostId, redirectUri, registration) {
  const transaction = { state: random(), poll: random(), verifier: random(), nonce: random(),
    redirectUri, registration, expires: Date.now() + 5 * 60 * 1000, status: 'pending' };
  const params = new URLSearchParams({ client_id: registration?.clientId ?? 'dynamic_agent_client',
    ext_agent_host_id: hostId, response_type: 'code', redirect_uri: redirectUri,
    scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
    resource, state: transaction.state, nonce: transaction.nonce, code_challenge_method: 'S256',
    code_challenge: crypto.createHash('sha256').update(transaction.verifier).digest('base64url') });
  if (!registration) params.set('agent_name_hint', 'Stock Chart Lab');
  return { transaction, url: `${issuer}/api/accounts/authorize?${params}` };
}

async function verifyIdentity(idToken, clientId, nonce, keySet) {
  const { jwtVerify, createRemoteJWKSet } = await import('jose');
  const { payload } = await jwtVerify(idToken, keySet ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)),
    { issuer, audience: clientId, requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5 });
  if (payload.nonce !== nonce || !payload.sub) throw new Error('Invalid identity');
  return payload;
}

async function readCompletedStream(response) {
  if (!response.ok) throw new Error('구독 요청이 거절됐습니다. 계정 권한과 사용 한도를 확인해주세요.');
  let buffer = '', text = '', completed = false;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n');
    let index;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2);
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
      if (!data || data === '[DONE]') continue;
      const event = JSON.parse(data);
      if (event.type === 'response.output_text.delta') text += event.delta;
      if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) throw new Error('구독 분석이 중단됐습니다. 사용 한도 또는 권한을 확인해주세요.');
      if (event.type === 'response.completed') {
        completed = true;
        text = event.response?.output?.filter(p => p.type === 'message').flatMap(p => p.content ?? [])
          .filter(p => p.type === 'output_text').map(p => p.text).join('') || text;
      }
    }
    if (text.length > 100000 || buffer.length > 1000000) throw new Error('Response too large');
  }
  if (!completed) throw new Error('구독 분석 연결이 끊겼습니다. 다시 시도해주세요.');
  return resultSchema.parse(JSON.parse(text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')));
}

function installSubscription(app, port) {
  const attempts = new Map(), sessions = new Map();
  const local = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const bearer = req => req.get('Authorization')?.replace(/^Bearer /, '');
  const sweep = setInterval(() => {
    for (const [key, value] of attempts) if (value.expires < Date.now()) attempts.delete(key);
    for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key);
  }, 60000); sweep.unref();

  app.get('/api/subscription/capabilities', (req, res) => res.json({
    chatgpt: local(req), reason: 'PC 로컬 실행용 · 계정 및 플랜 권한 확인 필요',
    claude: false, gemini: false,
  }));
  app.post('/api/subscription/start', (req, res) => {
    if (!local(req)) return res.status(403).json({ message: 'ChatGPT 구독 연결은 이 PC에서만 사용할 수 있습니다.' });
    try {
      if (attempts.size > 20) return res.status(429).json({ message: '잠시 후 다시 시도해주세요.' });
      const host = readHost();
      const { transaction, url } = makeAuthorization(host.hostId, `http://127.0.0.1:${port}/auth/callback`,
        req.body?.newAccount ? undefined : host.registration);
      attempts.set(transaction.state, transaction);
      res.json({ url, attempt: transaction.poll });
    } catch { res.status(500).json({ message: '로컬 로그인 준비에 실패했습니다.' }); }
  });
  app.get('/auth/callback', async (req, res) => {
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.set('Referrer-Policy', 'no-referrer');
    const attempt = attempts.get(req.query.state);
    if (!local(req) || !attempt || attempt.expires < Date.now() || attempt.status !== 'pending')
      return res.status(400).send('Invalid or expired sign-in. Return to the app and try again.');
    attempt.status = 'exchanging';
    try {
      if (req.query.error || typeof req.query.code !== 'string') throw new Error('Sign-in cancelled');
      const clientId = attempt.registration?.clientId ?? req.query.client_id;
      if (typeof clientId !== 'string' || !clientId.startsWith('oaiapp_') ||
        (attempt.registration && req.query.client_id && clientId !== req.query.client_id)) throw new Error('Invalid client');
      const response = await fetch(`${issuer}/api/accounts/oauth/token`, { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(20000),
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code: req.query.code,
          code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri, resource }) });
      if (!response.ok) throw new Error('Token exchange failed');
      const tokens = await response.json();
      const identity = await verifyIdentity(tokens.id_token, clientId, attempt.nonce);
      if (attempt.registration && identity.sub !== attempt.registration.subject) throw new Error('Account changed');
      const scopes = new Set((tokens.scope ?? '').split(' '));
      if (!scopes.has('chatgpt.tokens.use.direct') || !scopes.has('resource.invoke')) throw new Error('Missing plan permission');
      const catalog = await fetch(`${resource}/models`, { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15000) });
      if (!catalog.ok) throw new Error('Models unavailable');
      const models = (await catalog.json()).models?.filter(m => m.visibility === 'list')
        .map(m => ({ id: m.slug, name: m.display_name }));
      if (!models?.length) throw new Error('No models available');
      if (attempts.get(attempt.state) !== attempt) throw new Error('Sign-in cancelled');
      const host = readHost();
      const registration = { clientId, subject: identity.sub };
      fs.writeFileSync(host.file, JSON.stringify({ hostId: host.hostId, registration }), { mode: 0o600 });
      attempt.session = random(); attempt.models = models; attempt.status = 'connected';
      sessions.set(attempt.session, { accessToken: tokens.access_token, models,
        expires: Date.now() + Math.min(Number(tokens.expires_in) || 3600, 3600) * 1000 });
      // OAuth credentials remain server-side in memory. The UI receives only a local session handle.
      res.type('html').send('<meta charset="utf-8"><h2>ChatGPT 연결 완료</h2><p>앱 탭으로 돌아가 모델을 선택하세요.</p>');
    } catch {
      attempt.status = 'failed';
      res.status(400).type('html').send('<meta charset="utf-8"><h2>연결을 완료하지 못했습니다</h2><p>앱에서 다시 시도해주세요. 구독 권한과 계정 선택을 확인하세요.</p>');
    } finally { delete attempt.verifier; delete attempt.nonce; }
  });
  app.post('/api/subscription/status', (req, res) => {
    const attempt = [...attempts.values()].find(a => a.poll === bearer(req));
    if (!local(req) || !attempt || attempt.expires < Date.now()) return res.status(401).json({ message: '로그인이 만료됐습니다.' });
    res.json({ status: attempt.status, ...(attempt.status === 'connected' ? { session: attempt.session, models: attempt.models } : {}) });
    if (['failed', 'connected'].includes(attempt.status)) attempts.delete(attempt.state);
  });
  app.post('/api/subscription/disconnect', (req, res) => {
    if (!local(req)) return res.sendStatus(403);
    sessions.delete(bearer(req));
    for (const [state, attempt] of attempts) if (attempt.poll === bearer(req)) {
      sessions.delete(attempt.session); attempts.delete(state);
    }
    res.json({ ok: true });
  });
  return { async analyze(req, payload, signal) {
    const session = sessions.get(bearer(req));
    if (!local(req) || !session || session.expires < Date.now()) throw new Error('ChatGPT에 다시 로그인해주세요.');
    const model = req.body.connection?.model;
    if (!session.models.some(m => m.id === model)) throw new Error('계정에서 사용 가능한 모델을 선택해주세요.');
    const response = await fetch(`${resource}/responses`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ model, input: [{ role: 'user', content: analysisPrompt(payload) }], store: false, stream: true }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000) });
    return readCompletedStream(response);
  } };
}

module.exports = { installSubscription, makeAuthorization, verifyIdentity, readCompletedStream };

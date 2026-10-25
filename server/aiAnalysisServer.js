require('dotenv').config({ quiet: true });

const cors = require('cors');
const express = require('express');
const { z } = require('zod');
const { connectionSchema, generate, analyze, publicError } = require('./aiProviders');
const { installSubscription } = require('./chatgptSubscription');
const { installMarket } = require('./marketData');

const app = express();
const port = Number(process.env.AI_SERVER_PORT ?? 8787);

app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ message: 'JSON 요청이 필요합니다.' });
  next();
});
const subscription = installSubscription(app, port);
installMarket(app);

const analysisRequestSchema = z.object({
  marketSource: z.object({ source: z.string(), asOf: z.string(), interval: z.string(), delay: z.string() }).optional(),
  stock: z.object({
    symbol: z.string(),
    name: z.string(),
    market: z.string(),
    sector: z.string(),
    currency: z.enum(['USD', 'KRW']),
  }),
  technical: z.object({
    direction: z.string(),
    confidence: z.number(),
    rsi: z.number(),
    macdHistogram: z.number(),
    maState: z.string(),
    volumeState: z.string(),
    currentPrice: z.number(),
    buyZone: z.object({
      aggressive: z.number(),
      balanced: z.number(),
      defensive: z.number(),
    }),
    stopLoss: z.number(),
    sellTargets: z.object({
      first: z.number(),
      second: z.number(),
      final: z.number(),
    }),
  }),
  news: z.object({
    label: z.string(),
    summary: z.string(),
    items: z.array(
      z.object({
        title: z.string(),
        sentiment: z.string(),
        summary: z.string(),
      }),
    ),
  }),
  fundamentals: z.object({
    totalScore: z.number(),
    rating: z.string(),
    growthScore: z.number(),
    profitabilityScore: z.number(),
    stabilityScore: z.number(),
    valuationScore: z.number(),
    highlights: z.array(z.string()),
    risks: z.array(z.string()),
  }),
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, mode: 'personal-api', providers: ['gemini', 'openai', 'anthropic'] });
});

function readConnection(req) {
  const connection = connectionSchema.safeParse(req.body?.connection);
  const apiKey = req.get('x-ai-api-key');
  if (!connection.success || !apiKey || apiKey.length > 1024 || /[\r\n]/.test(apiKey)) return null;
  return { connection: connection.data, apiKey };
}

function responseSignal(res) {
  const controller = new AbortController();
  res.once('close', () => { if (!res.writableEnded) controller.abort(); });
  return controller.signal;
}

app.post('/api/ai-connection/test', async (req, res) => {
  const input = readConnection(req);
  if (!input) return res.status(400).json({ message: '제공자, 모델 ID, API 키를 확인해주세요.' });
  try {
    await generate(input.connection, input.apiKey, 'Return only JSON: {"ok":true}', undefined, responseSignal(res));
    res.json({ ok: true, provider: input.connection.provider, model: input.connection.model });
  } catch (error) { res.status(502).json({ message: publicError(error) }); }
});

app.post('/api/ai-analysis', async (req, res) => {
  const parsed = analysisRequestSchema.safeParse(req.body);
  const input = readConnection(req);
  if (!parsed.success) return res.status(400).json({ message: '분석 데이터를 확인해주세요.' });
  if (req.body.connection?.authMode === 'subscription') {
    if (req.body.connection?.provider !== 'openai') return res.status(400).json({ message: '지원하지 않는 구독 연결입니다.' });
    try {
      const analysis = await subscription.analyze(req, parsed.data, responseSignal(res));
      return res.json({ mode: 'openai', authMode: 'subscription', model: req.body.connection.model, analysis });
    } catch { return res.status(502).json({ message: 'ChatGPT 구독 분석에 실패했습니다. 다시 로그인하거나 사용 한도를 확인해주세요.' }); }
  }
  if (!input) return res.status(401).json({ message: '개인 AI API 연결이 필요합니다.' });
  try {
    const analysis = await analyze(parsed.data, input.connection, input.apiKey, undefined, responseSignal(res));
    res.json({ mode: input.connection.provider, model: input.connection.model, analysis });
  } catch (error) {
    res.status(502).json({ message: publicError(error) });
  }
});

app.use((error, _req, res, _next) => {
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ message: status === 413 ? '요청 데이터가 너무 큽니다.' : '요청을 처리하지 못했습니다. 입력을 확인해주세요.' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`AI analysis server listening on http://localhost:${port}`);
    console.log('Mode: personal API connections (no server key fallback)');
  });
}
module.exports = app;

require('dotenv').config();

const cors = require('cors');
const express = require('express');
const { z } = require('zod');

const app = express();
const port = Number(process.env.AI_SERVER_PORT ?? 8787);
const geminiApiKey = process.env.GEMINI_API_KEY ?? '';
const model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const analysisRequestSchema = z.object({
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

const responseSchema = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    summary: { type: 'STRING' },
    direction: { type: 'STRING' },
    riskLevel: { type: 'STRING' },
    buyScenario: { type: 'STRING' },
    sellScenario: { type: 'STRING' },
    keyReasons: { type: 'ARRAY', items: { type: 'STRING' } },
    riskWarnings: { type: 'ARRAY', items: { type: 'STRING' } },
    disclaimer: { type: 'STRING' },
  },
  required: [
    'headline',
    'summary',
    'direction',
    'riskLevel',
    'buyScenario',
    'sellScenario',
    'keyReasons',
    'riskWarnings',
    'disclaimer',
  ],
};

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    provider: geminiApiKey ? 'gemini' : 'fallback',
    mode: geminiApiKey ? 'gemini' : 'fallback',
    model: geminiApiKey ? model : null,
  });
});

app.post('/api/ai-analysis', async (req, res) => {
  const parsed = analysisRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
    return;
  }

  const payload = parsed.data;

  if (!geminiApiKey) {
    res.json(buildFallbackAnalysis(payload));
    return;
  }

  try {
    const analysis = await requestGeminiAnalysis(payload);
    res.json({
      mode: 'gemini',
      model,
      analysis,
    });
  } catch (error) {
    res.status(502).json({
      error: 'gemini_request_failed',
      message: error instanceof Error ? error.message : 'Unknown Gemini API error',
      fallback: buildFallbackAnalysis(payload),
    });
  }
});

async function requestGeminiAnalysis(payload) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
  const prompt = [
    '다음 주식 데이터를 바탕으로 한국어 JSON 분석을 작성하세요.',
    '절대 매수/매도 권유로 단정하지 말고, 투자 참고용 시나리오로만 표현하세요.',
    '가격은 제공된 buyZone, stopLoss, sellTargets 값을 활용하세요.',
    '',
    JSON.stringify(payload, null, 2),
  ].join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              'You are a cautious Korean equity analysis assistant. Use scenario language only. Return valid JSON only.',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Gemini request failed with ${response.status}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini response did not include text output');
  }

  return JSON.parse(text);
}

function buildFallbackAnalysis(payload) {
  const { stock, technical, news, fundamentals } = payload;
  const riskLevel = technical.confidence >= 74 && fundamentals.totalScore >= 70 ? '보통' : '주의';

  return {
    mode: 'fallback',
    model: null,
    analysis: {
      headline: `${stock.name}는 ${technical.direction} 시나리오를 우선 검토할 구간입니다.`,
      summary: `${stock.symbol}의 기술적 흐름은 ${technical.maState}, RSI ${technical.rsi.toFixed(
        1,
      )}, 뉴스 흐름은 ${news.label}, 재무 평가는 ${fundamentals.rating}입니다.`,
      direction: technical.direction,
      riskLevel,
      buyScenario: `참고 매수 구간은 ${formatPrice(
        technical.buyZone.balanced,
        stock.currency,
      )} 전후이며, 분할 진입은 조정 구간에서 나누는 접근이 적합합니다.`,
      sellScenario: `1차 목표는 ${formatPrice(
        technical.sellTargets.first,
        stock.currency,
      )}, 최종 목표는 ${formatPrice(technical.sellTargets.final, stock.currency)} 전후로 설정하는 시나리오입니다.`,
      keyReasons: [
        `차트 방향성 신뢰도는 ${technical.confidence.toFixed(0)}%입니다.`,
        `뉴스 요약: ${news.summary}`,
        `재무 종합 점수는 ${fundamentals.totalScore}점입니다.`,
      ],
      riskWarnings: [
        `손절 기준은 ${formatPrice(technical.stopLoss, stock.currency)} 전후로 관리해야 합니다.`,
        ...fundamentals.risks.slice(0, 2),
      ],
      disclaimer: '이 분석은 투자 참고용 시나리오이며 특정 종목의 매수·매도 권유가 아닙니다.',
    },
  };
}

function formatPrice(value, currency) {
  if (currency === 'KRW') {
    return `${Math.round(value).toLocaleString('ko-KR')}원`;
  }
  return `$${value.toFixed(2)}`;
}

app.listen(port, () => {
  console.log(`AI analysis server listening on http://localhost:${port}`);
  console.log(`Mode: ${geminiApiKey ? `gemini (${model})` : 'fallback (GEMINI_API_KEY missing)'}`);
});

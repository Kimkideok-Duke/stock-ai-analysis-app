import type { Stock } from '../data/mockMarket';
import type { FundamentalAnalysis, NewsAnalysis, StrategyPlan } from './indicators';
import { requestJson } from './httpClient';
import type { CompanyData } from './companyModel';

export type AiProvider = 'gemini' | 'openai' | 'anthropic';
export type AiConnection = { provider: AiProvider; model: string; apiKey: string; authMode?: 'subscription'; sessionToken?: string };

export async function subscriptionRequest(path: string, credential?: string, body: object = {}, signal?: AbortSignal) {
  return requestJson(`${aiApiUrl}/api/subscription/${path}`, { method: path === 'capabilities' ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    ...(path === 'capabilities' ? {} : { body: JSON.stringify(body) }),
  }, signal, 15000);
}
export const aiProviders = [
  { id: 'gemini' as const, label: 'Gemini', model: 'gemini-flash-latest', url: 'https://aistudio.google.com/api-keys' },
  { id: 'openai' as const, label: 'GPT', model: 'gpt-4.1-mini', url: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic' as const, label: 'Claude', model: 'claude-sonnet-4-5', url: 'https://platform.claude.com/settings/keys' },
];

export async function testAiConnection(connection: AiConnection, signal?: AbortSignal) {
  return requestJson(`${aiApiUrl}/api/ai-connection/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ai-api-key': connection.apiKey },
    body: JSON.stringify({ connection: { provider: connection.provider, model: connection.model } }),
  }, signal, 65000);
}

export type AiAnalysisResult = {
  headline: string;
  summary: string;
  direction: string;
  riskLevel: string;
  buyScenario: string;
  sellScenario: string;
  keyReasons: string[];
  riskWarnings: string[];
  disclaimer: string;
};

export type AiAnalysisResponse = {
  mode: AiProvider | 'fallback' | 'local';
  authMode?: 'subscription';
  model: string | null;
  analysis: AiAnalysisResult;
};

const aiApiUrl = process.env.EXPO_PUBLIC_AI_API_URL ?? 'http://localhost:8787';

export async function requestAiAnalysis(input: {
  companyContext?: CompanyData | null;
  marketSource?: { source: string; asOf: string; interval: string; delay: string };
  stock: Stock;
  strategy: StrategyPlan;
  rsi: number;
  macdHistogram: number;
  maState: string;
  volumeState: string;
  news: NewsAnalysis | null;
  fundamentals: FundamentalAnalysis | null;
}, connection: AiConnection, signal?: AbortSignal): Promise<AiAnalysisResponse> {
  const body = {
    companyContext: input.companyContext ? { news: input.companyContext.news, financials: input.companyContext.financials } : undefined,
    marketSource: input.marketSource,
    connection: { provider: connection.provider, model: connection.model, authMode: connection.authMode },
    stock: {
      symbol: input.stock.symbol,
      name: input.stock.name,
      market: input.stock.market,
      sector: input.stock.sector,
      currency: input.stock.currency,
    },
    technical: {
      direction: input.strategy.direction,
      confidence: input.strategy.confidence,
      rsi: input.rsi,
      macdHistogram: input.macdHistogram,
      maState: input.maState,
      volumeState: input.volumeState,
      currentPrice: input.strategy.currentPrice,
      buyZone: input.strategy.buyZone,
      stopLoss: input.strategy.stopLoss,
      sellTargets: input.strategy.sellTargets,
    },
    news: input.news ? {
      label: input.news.label,
      summary: input.news.summary,
      items: input.stock.news.map((item) => ({
        title: item.title,
        sentiment: item.sentiment,
        summary: item.summary,
        source: item.source,
        publishedAt: item.publishedAt,
        url: item.url,
      })),
    } : null,
    fundamentals: input.fundamentals ? {
      totalScore: input.fundamentals.totalScore,
      rating: input.fundamentals.rating,
      growthScore: input.fundamentals.growthScore,
      profitabilityScore: input.fundamentals.profitabilityScore,
      stabilityScore: input.fundamentals.stabilityScore,
      valuationScore: input.fundamentals.valuationScore,
      highlights: input.fundamentals.highlights,
      risks: input.fundamentals.risks,
    } : null,
  };

  return requestJson(`${aiApiUrl}/api/ai-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(connection.authMode === 'subscription'
        ? { Authorization: `Bearer ${connection.sessionToken}` }
        : { 'x-ai-api-key': connection.apiKey }),
    },
    body: JSON.stringify(body),
  }, signal) as Promise<AiAnalysisResponse>;
}

export function buildLocalAiFallback(input: {
  stock: Stock;
  strategy: StrategyPlan;
  news: NewsAnalysis;
  fundamentals: FundamentalAnalysis;
}): AiAnalysisResponse {
  return {
    mode: 'local',
    model: null,
    analysis: {
      headline: `${input.stock.name} 종합 분석`,
      summary: `${input.strategy.direction} 흐름이지만 뉴스와 재무 리스크를 함께 확인해야 합니다.`,
      direction: input.strategy.direction,
      riskLevel: '주의',
      buyScenario: '참고 매수 구간은 현재 전략표의 1~3차 분할매수 구간을 기준으로 봅니다.',
      sellScenario: '매도는 1차, 2차, 최종 목표 구간으로 나누어 리스크를 줄이는 방식이 적합합니다.',
      keyReasons: [
        '뉴스 및 재무 데이터 미연결: 분석 근거에서 제외',
        `기술 지표 점수: ${input.strategy.confidence.toFixed(0)}/100 (예측 확률이 아님)`,
      ],
      riskWarnings: ['시세 지연 및 기술 지표 기반 시나리오의 한계에 유의하세요.'],
      disclaimer: '이 분석은 투자 참고용 시나리오이며 특정 종목의 매수·매도 권유가 아닙니다.',
    },
  };
}

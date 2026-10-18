import type { Stock } from '../data/mockMarket';
import type { FundamentalAnalysis, NewsAnalysis, StrategyPlan } from './indicators';

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
  mode: 'gemini' | 'fallback' | 'local';
  model: string | null;
  analysis: AiAnalysisResult;
};

const aiApiUrl = process.env.EXPO_PUBLIC_AI_API_URL ?? 'http://localhost:8787';

export async function requestAiAnalysis(input: {
  stock: Stock;
  strategy: StrategyPlan;
  rsi: number;
  macdHistogram: number;
  maState: string;
  volumeState: string;
  news: NewsAnalysis;
  fundamentals: FundamentalAnalysis;
}): Promise<AiAnalysisResponse> {
  const body = {
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
    news: {
      label: input.news.label,
      summary: input.news.summary,
      items: input.stock.news.map((item) => ({
        title: item.title,
        sentiment: item.sentiment,
        summary: item.summary,
      })),
    },
    fundamentals: {
      totalScore: input.fundamentals.totalScore,
      rating: input.fundamentals.rating,
      growthScore: input.fundamentals.growthScore,
      profitabilityScore: input.fundamentals.profitabilityScore,
      stabilityScore: input.fundamentals.stabilityScore,
      valuationScore: input.fundamentals.valuationScore,
      highlights: input.fundamentals.highlights,
      risks: input.fundamentals.risks,
    },
  };

  const response = await fetch(`${aiApiUrl}/api/ai-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    if (data?.fallback) {
      return data.fallback as AiAnalysisResponse;
    }
    throw new Error(data?.message ?? 'AI analysis request failed');
  }

  return data as AiAnalysisResponse;
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
      riskLevel: input.fundamentals.totalScore >= 70 ? '보통' : '주의',
      buyScenario: '참고 매수 구간은 현재 전략표의 1~3차 분할매수 구간을 기준으로 봅니다.',
      sellScenario: '매도는 1차, 2차, 최종 목표 구간으로 나누어 리스크를 줄이는 방식이 적합합니다.',
      keyReasons: [
        `뉴스 흐름: ${input.news.label}`,
        `재무 평가: ${input.fundamentals.rating}`,
        `차트 신뢰도: ${input.strategy.confidence.toFixed(0)}%`,
      ],
      riskWarnings: input.fundamentals.risks,
      disclaimer: '이 분석은 투자 참고용 시나리오이며 특정 종목의 매수·매도 권유가 아닙니다.',
    },
  };
}

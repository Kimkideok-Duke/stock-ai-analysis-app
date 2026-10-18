import type { Candle, Financials, NewsItem } from '../data/mockMarket';

type MacdResult = {
  macd: number;
  signal: number;
  histogram: number;
};

export type StrategyPlan = {
  direction: '상승 우위' | '중립' | '하락 주의';
  confidence: number;
  currentPrice: number;
  buyZone: {
    aggressive: number;
    balanced: number;
    defensive: number;
  };
  stopLoss: number;
  sellTargets: {
    first: number;
    second: number;
    final: number;
  };
  splitBuy: Array<{
    label: string;
    price: number;
    weight: number;
  }>;
  splitSell: Array<{
    label: string;
    price: number;
    weight: number;
  }>;
  rationale: string[];
  riskNotes: string[];
};

export type FundamentalAnalysis = {
  growthScore: number;
  profitabilityScore: number;
  stabilityScore: number;
  valuationScore: number;
  totalScore: number;
  rating: '우수' | '양호' | '중립' | '주의';
  highlights: string[];
  risks: string[];
};

export type NewsAnalysis = {
  sentimentScore: number;
  label: '긍정 우위' | '중립' | '부정 주의';
  summary: string;
};

export type BollingerBandPoint = {
  upper: number;
  middle: number;
  lower: number;
};

export function analyzeSeries(candles: Candle[]) {
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const latestClose = closes[closes.length - 1] ?? 0;
  const ma5 = movingAverage(closes, 5);
  const ma20 = movingAverage(closes, 20);
  const ema20 = exponentialMovingAverage(closes, 20);
  const bollinger20 = calculateBollingerBands(closes, 20, 2);
  const lastMa5 = last(ma5) ?? latestClose;
  const lastMa20 = last(ma20) ?? latestClose;
  const rsi = calculateRsi(closes, 14);
  const macd = calculateMacd(closes);
  const trendUp = lastMa5 >= lastMa20;
  const recentVolume = last(volumes) ?? 0;
  const averageVolume = average(volumes.slice(-20));
  const volumeRatio = averageVolume === 0 ? 1 : recentVolume / averageVolume;
  const signalTone = trendUp && rsi < 72 ? 'bullish' : 'cautious';
  const strategy = buildStrategyPlan(candles, {
    rsi,
    macd,
    ma5: lastMa5,
    ma20: lastMa20,
    volumeRatio,
  });

  const insights = [
    trendUp
      ? '단기 이동평균선이 중기 이동평균선 위에 있어 상승 추세가 유지되고 있습니다.'
      : '단기 이동평균선이 중기 이동평균선 아래에 있어 추세 확인이 필요합니다.',
    rsi >= 70
      ? 'RSI가 과매수 구간에 가까워 단기 변동성 확대 가능성이 있습니다.'
      : rsi <= 30
        ? 'RSI가 과매도 구간에 가까워 반등 시도를 관찰할 수 있습니다.'
        : 'RSI가 중립 구간에 있어 추세와 거래량 확인이 중요합니다.',
    macd.histogram >= 0
      ? 'MACD 히스토그램이 양수라 모멘텀이 개선되는 흐름입니다.'
      : 'MACD 히스토그램이 음수라 모멘텀 약화 구간입니다.',
  ];

  return {
    ma5,
    ma20,
    ema20,
    bollinger20,
    rsi,
    rsiState: rsi >= 70 ? '과매수' : rsi <= 30 ? '과매도' : '중립',
    macd,
    macdState: macd.histogram >= 0 ? '상승 모멘텀' : '하락 모멘텀',
    maState: trendUp ? '정배열' : '역배열',
    maCaption: `MA5 ${formatCurrency(lastMa5)} / MA20 ${formatCurrency(lastMa20)}`,
    volumeState: volumeRatio >= 1.25 ? '스파이크' : '보통',
    volumeCaption: `${volumeRatio.toFixed(1)}x 평균 거래량`,
    signal: signalTone === 'bullish' ? '상승 우위' : '주의',
    signalTone,
    suggestedAlertPrice: latestClose * (trendUp ? 1.03 : 0.97),
    insights,
    strategy,
  };
}

export function movingAverage(values: number[], period: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    return average(values.slice(start, index + 1));
  });
}

export function analyzeFinancials(financials: Financials): FundamentalAnalysis {
  const growthScore = clampScore(financials.revenueGrowth * 180 + 45);
  const profitabilityScore = clampScore((financials.operatingMargin + financials.netMargin) * 110 + 30);
  const stabilityScore = clampScore(95 - financials.debtRatio * 32);
  const valuationScore = clampScore(86 - Math.max(0, financials.per - 12) * 1.4 - Math.max(0, financials.pbr - 1) * 1.7);
  const totalScore = Math.round(
    growthScore * 0.28 + profitabilityScore * 0.3 + stabilityScore * 0.22 + valuationScore * 0.2,
  );
  const rating = totalScore >= 78 ? '우수' : totalScore >= 66 ? '양호' : totalScore >= 52 ? '중립' : '주의';

  return {
    growthScore,
    profitabilityScore,
    stabilityScore,
    valuationScore,
    totalScore,
    rating,
    highlights: [
      `매출 성장률은 ${(financials.revenueGrowth * 100).toFixed(1)}%로 ${financials.revenueGrowth >= 0.12 ? '성장성이 강한 편' : '보수적으로 확인할 구간'}입니다.`,
      `영업이익률 ${(financials.operatingMargin * 100).toFixed(1)}%, ROE ${(financials.roe * 100).toFixed(1)}% 기준 수익성을 평가했습니다.`,
      `현금흐름 추세는 ${translateCashFlowTrend(financials.freeCashFlowTrend)}입니다.`,
    ],
    risks: [
      financials.per >= 35 ? 'PER이 높아 실적 기대가 꺾일 때 조정 폭이 커질 수 있습니다.' : '밸류에이션 부담은 상대적으로 제한적입니다.',
      financials.debtRatio >= 1 ? '부채비율이 높아 금리와 현금흐름 변수를 확인해야 합니다.' : '부채비율은 관리 가능한 수준입니다.',
    ],
  };
}

export function analyzeNews(news: NewsItem[]): NewsAnalysis {
  const score = news.reduce((sum, item) => {
    if (item.sentiment === 'positive') {
      return sum + 1;
    }
    if (item.sentiment === 'negative') {
      return sum - 1;
    }
    return sum;
  }, 0);
  const sentimentScore = news.length === 0 ? 0 : score / news.length;
  const label = sentimentScore > 0.25 ? '긍정 우위' : sentimentScore < -0.25 ? '부정 주의' : '중립';

  return {
    sentimentScore,
    label,
    summary:
      label === '긍정 우위'
        ? '최근 뉴스 흐름은 실적 또는 업황 기대가 우세합니다.'
        : label === '부정 주의'
          ? '최근 뉴스에는 실적, 규제, 수요 둔화 등 리스크가 더 크게 반영되어 있습니다.'
          : '최근 뉴스는 긍정과 리스크 요인이 혼재되어 있습니다.',
  };
}

function clampScore(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function translateCashFlowTrend(trend: Financials['freeCashFlowTrend']) {
  if (trend === 'improving') {
    return '개선 중';
  }
  if (trend === 'weakening') {
    return '약화 중';
  }
  return '안정적';
}

function calculateBollingerBands(values: number[], period: number, deviationMultiplier: number): BollingerBandPoint[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    const window = values.slice(start, index + 1);
    const middle = average(window);
    const variance = average(window.map((value) => (value - middle) ** 2));
    const deviation = Math.sqrt(variance);

    return {
      upper: middle + deviation * deviationMultiplier,
      middle,
      lower: middle - deviation * deviationMultiplier,
    };
  });
}

function buildStrategyPlan(
  candles: Candle[],
  context: {
    rsi: number;
    macd: MacdResult;
    ma5: number;
    ma20: number;
    volumeRatio: number;
  },
): StrategyPlan {
  const latest = candles[candles.length - 1];
  const currentPrice = latest?.close ?? 0;
  const recent = candles.slice(-24);
  const swingLow = Math.min(...recent.map((candle) => candle.low));
  const swingHigh = Math.max(...recent.map((candle) => candle.high));
  const averageRange = average(recent.map((candle) => candle.high - candle.low));
  const trendScore = (context.ma5 >= context.ma20 ? 1 : -1)
    + (context.macd.histogram >= 0 ? 1 : -1)
    + (context.rsi > 45 && context.rsi < 70 ? 1 : 0)
    + (context.volumeRatio >= 1.15 ? 0.5 : 0);

  const direction =
    trendScore >= 2 ? '상승 우위' : trendScore <= -1 ? '하락 주의' : '중립';
  const confidence = Math.min(82, Math.max(48, 58 + trendScore * 8));
  const pullbackUnit = Math.max(averageRange, currentPrice * 0.012);
  const aggressive = currentPrice - pullbackUnit * 0.35;
  const balanced = Math.max(swingLow, currentPrice - pullbackUnit * 0.85);
  const defensive = Math.max(swingLow * 0.995, currentPrice - pullbackUnit * 1.45);
  const stopLoss = Math.min(defensive - pullbackUnit * 0.75, swingLow - pullbackUnit * 0.35);
  const targetUnit = Math.max(swingHigh - currentPrice, pullbackUnit * 1.8);
  const firstTarget = currentPrice + targetUnit * 0.55;
  const secondTarget = Math.max(swingHigh, currentPrice + targetUnit);
  const finalTarget = currentPrice + targetUnit * 1.45;

  return {
    direction,
    confidence,
    currentPrice,
    buyZone: {
      aggressive,
      balanced,
      defensive,
    },
    stopLoss,
    sellTargets: {
      first: firstTarget,
      second: secondTarget,
      final: finalTarget,
    },
    splitBuy: [
      { label: '1차 진입', price: aggressive, weight: 30 },
      { label: '2차 조정 매수', price: balanced, weight: 40 },
      { label: '3차 지지 확인', price: defensive, weight: 30 },
    ],
    splitSell: [
      { label: '1차 목표', price: firstTarget, weight: 35 },
      { label: '2차 목표', price: secondTarget, weight: 35 },
      { label: '추세 연장 목표', price: finalTarget, weight: 30 },
    ],
    rationale: [
      `MA5가 MA20 ${context.ma5 >= context.ma20 ? '위' : '아래'}에 있어 추세는 ${context.ma5 >= context.ma20 ? '우호적' : '보수적'}으로 봅니다.`,
      `RSI ${context.rsi.toFixed(1)} 기준 ${context.rsi >= 70 ? '과열권 접근' : context.rsi <= 30 ? '과매도권 접근' : '중립 구간'}입니다.`,
      `MACD 히스토그램은 ${context.macd.histogram >= 0 ? '양수' : '음수'}로 모멘텀 ${context.macd.histogram >= 0 ? '개선' : '약화'} 신호입니다.`,
    ],
    riskNotes: [
      '이미지 분석만으로는 거래량 원인, 뉴스, 실적, 시장 리스크를 판단할 수 없습니다.',
      '손절가는 반드시 주문 전에 다시 확인하고, 단일 진입보다 분할 진입을 우선합니다.',
      '이 결과는 투자 참고용 시나리오이며 매수/매도 권유가 아닙니다.',
    ],
  };
}

function calculateRsi(values: number[], period: number) {
  if (values.length <= 1) {
    return 50;
  }

  const start = Math.max(1, values.length - period);
  let gains = 0;
  let losses = 0;

  for (let index = start; index < values.length; index += 1) {
    const current = values[index];
    if (current === undefined) {
      continue;
    }

    const previous = values[index - 1] ?? current;
    const delta = current - previous;
    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;
  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function calculateMacd(values: number[]): MacdResult {
  const ema12 = exponentialMovingAverage(values, 12);
  const ema26 = exponentialMovingAverage(values, 26);
  const macdLine = ema12.map((value, index) => value - (ema26[index] ?? value));
  const signalLine = exponentialMovingAverage(macdLine, 9);
  const macd = last(macdLine) ?? 0;
  const signal = last(signalLine) ?? 0;

  return {
    macd,
    signal,
    histogram: macd - signal,
  };
}

function exponentialMovingAverage(values: number[], period: number) {
  const smoothing = 2 / (period + 1);
  const result: number[] = [];

  values.forEach((value, index) => {
    if (index === 0) {
      result.push(value);
      return;
    }

    const previous = result[index - 1] ?? value;
    result.push(value * smoothing + previous * (1 - smoothing));
  });

  return result;
}

export function formatCurrency(value: number, currency: 'USD' | 'KRW' = 'USD') {
  const absolute = Math.abs(value);
  if (currency === 'KRW') {
    const formatted = Math.round(absolute).toLocaleString('ko-KR');
    return value < 0 ? `-${formatted}원` : `${formatted}원`;
  }

  const prefix = value < 0 ? '-$' : '$';
  return `${prefix}${absolute.toFixed(2)}`;
}

export function formatPercent(value: number) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function last<T>(values: T[]) {
  return values[values.length - 1];
}

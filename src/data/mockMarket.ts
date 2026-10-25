export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type StockSymbol = 'AAPL' | 'TSLA' | 'NVDA' | 'MSFT' | '005930';

export type NewsItem = {
  url?: string;
  title: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
};

export type Financials = {
  revenueGrowth: number;
  operatingMargin: number;
  netMargin: number;
  debtRatio: number;
  per: number;
  pbr: number;
  roe: number;
  freeCashFlowTrend: 'improving' | 'stable' | 'weakening';
};

export type Stock = {
  symbol: StockSymbol;
  name: string;
  market: 'US' | 'KR';
  currency: 'USD' | 'KRW';
  aliases: string[];
  sector: string;
  candles: Candle[];
  news: NewsItem[];
  financials: Financials;
};

function generateCandles(seed: number, base: number, drift: number, volatility: number): Candle[] {
  let price = base;
  const candles: Candle[] = [];

  for (let index = 0; index < 140; index += 1) {
    const cycle = Math.sin((index + seed) / 5) * volatility;
    const pulse = Math.cos((index + seed) / 11) * (volatility * 0.6);
    const open = price;
    const close = Math.max(5, open + drift + cycle * 0.18 + pulse * 0.12);
    const high = Math.max(open, close) + volatility * (0.6 + ((index + seed) % 5) * 0.12);
    const low = Math.min(open, close) - volatility * (0.45 + ((index + seed) % 4) * 0.1);
    const volume = Math.round(900000 + seed * 18000 + index * 7500 + Math.abs(cycle) * 82000);

    candles.push({
      time: `D-${139 - index}`,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume,
    });

    price = close;
  }

  return candles;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export const mockStocks: Record<StockSymbol, Stock> = {
  AAPL: {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    market: 'US',
    currency: 'USD',
    aliases: ['apple', '애플', 'aapl'],
    sector: 'Consumer Electronics',
    candles: generateCandles(3, 198, 0.16, 3.2),
    news: [
      {
        title: 'Apple service revenue remains the key margin driver',
        source: 'Market Desk',
        publishedAt: '2026-07-14',
        sentiment: 'positive',
        summary: '서비스 매출 비중 확대가 전체 마진 방어에 기여하고 있습니다.',
      },
      {
        title: 'Hardware replacement cycle is still the biggest variable',
        source: 'Tech Wire',
        publishedAt: '2026-07-13',
        sentiment: 'neutral',
        summary: '아이폰 교체 수요 회복 속도는 다음 실적의 핵심 변수입니다.',
      },
      {
        title: 'Regulatory pressure continues in app marketplace',
        source: 'Global Markets',
        publishedAt: '2026-07-12',
        sentiment: 'negative',
        summary: '앱스토어 정책 관련 규제 리스크는 밸류에이션 할인 요인입니다.',
      },
    ],
    financials: {
      revenueGrowth: 0.06,
      operatingMargin: 0.31,
      netMargin: 0.25,
      debtRatio: 1.42,
      per: 28.4,
      pbr: 42.1,
      roe: 1.48,
      freeCashFlowTrend: 'stable',
    },
  },
  TSLA: {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    market: 'US',
    currency: 'USD',
    aliases: ['tesla', '테슬라', 'tsla'],
    sector: 'Electric Vehicles',
    candles: generateCandles(11, 276, -0.02, 8.4),
    news: [
      {
        title: 'Tesla delivery guidance remains the focus',
        source: 'Auto Brief',
        publishedAt: '2026-07-14',
        sentiment: 'neutral',
        summary: '인도량 가이던스와 가격 정책이 단기 주가 변동성을 키우고 있습니다.',
      },
      {
        title: 'Energy storage segment offsets EV margin pressure',
        source: 'Energy Watch',
        publishedAt: '2026-07-13',
        sentiment: 'positive',
        summary: '에너지 저장 사업 성장이 전기차 마진 둔화를 일부 보완합니다.',
      },
      {
        title: 'Price competition keeps gross margin under pressure',
        source: 'EV Daily',
        publishedAt: '2026-07-12',
        sentiment: 'negative',
        summary: '가격 경쟁 심화로 자동차 부문 수익성 회복이 지연될 수 있습니다.',
      },
    ],
    financials: {
      revenueGrowth: 0.03,
      operatingMargin: 0.09,
      netMargin: 0.07,
      debtRatio: 0.18,
      per: 72.5,
      pbr: 11.8,
      roe: 0.16,
      freeCashFlowTrend: 'weakening',
    },
  },
  NVDA: {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    market: 'US',
    currency: 'USD',
    aliases: ['nvidia', '엔비디아', 'nvda'],
    sector: 'Semiconductors',
    candles: generateCandles(19, 142, 0.32, 5.7),
    news: [
      {
        title: 'AI accelerator demand remains resilient',
        source: 'Semicap News',
        publishedAt: '2026-07-14',
        sentiment: 'positive',
        summary: 'AI 가속기 수요가 데이터센터 매출 성장의 핵심 동력으로 유지되고 있습니다.',
      },
      {
        title: 'Supply chain capacity is improving gradually',
        source: 'Chip Ledger',
        publishedAt: '2026-07-13',
        sentiment: 'positive',
        summary: '공급 병목 완화가 출하량 증가 기대를 높이고 있습니다.',
      },
      {
        title: 'Valuation sensitivity rises after strong rally',
        source: 'Equity Note',
        publishedAt: '2026-07-12',
        sentiment: 'neutral',
        summary: '강한 상승 이후 실적 기대치가 높아져 밸류에이션 민감도가 커졌습니다.',
      },
    ],
    financials: {
      revenueGrowth: 0.48,
      operatingMargin: 0.57,
      netMargin: 0.51,
      debtRatio: 0.22,
      per: 41.7,
      pbr: 32.4,
      roe: 0.92,
      freeCashFlowTrend: 'improving',
    },
  },
  MSFT: {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    market: 'US',
    currency: 'USD',
    aliases: ['microsoft', '마이크로소프트', 'msft'],
    sector: 'Software & Cloud',
    candles: generateCandles(29, 487, 0.11, 4.2),
    news: [
      {
        title: 'Cloud growth supports recurring revenue quality',
        source: 'Cloud Desk',
        publishedAt: '2026-07-14',
        sentiment: 'positive',
        summary: 'Azure와 구독형 소프트웨어 매출이 안정적인 성장성을 보여주고 있습니다.',
      },
      {
        title: 'AI infrastructure spend remains elevated',
        source: 'Enterprise Tech',
        publishedAt: '2026-07-13',
        sentiment: 'neutral',
        summary: 'AI 인프라 투자는 성장 동력이지만 단기 비용 부담도 함께 키웁니다.',
      },
      {
        title: 'Enterprise demand stays steady',
        source: 'Software Weekly',
        publishedAt: '2026-07-12',
        sentiment: 'positive',
        summary: '기업용 소프트웨어 수요가 경기 둔화에도 비교적 안정적입니다.',
      },
    ],
    financials: {
      revenueGrowth: 0.14,
      operatingMargin: 0.44,
      netMargin: 0.36,
      debtRatio: 0.43,
      per: 34.2,
      pbr: 12.9,
      roe: 0.39,
      freeCashFlowTrend: 'improving',
    },
  },
  '005930': {
    symbol: '005930',
    name: '삼성전자',
    market: 'KR',
    currency: 'KRW',
    aliases: ['samsung electronics', '삼성전자', '삼전', '005930'],
    sector: 'Semiconductors & Devices',
    candles: generateCandles(37, 74000, 55, 900),
    news: [
      {
        title: '메모리 업황 회복 기대가 반도체주 투자심리 개선',
        source: 'Korea Market',
        publishedAt: '2026-07-14',
        sentiment: 'positive',
        summary: 'DRAM 가격 회복과 HBM 수요 기대가 실적 개선 가능성을 높이고 있습니다.',
      },
      {
        title: '스마트폰 출하 경쟁 심화',
        source: 'Tech Korea',
        publishedAt: '2026-07-13',
        sentiment: 'neutral',
        summary: '모바일 부문은 프리미엄 수요와 중저가 경쟁을 함께 확인해야 합니다.',
      },
      {
        title: '환율과 설비투자 부담은 단기 변수',
        source: '증권 리포트',
        publishedAt: '2026-07-12',
        sentiment: 'neutral',
        summary: '환율, 설비투자, 메모리 가격 흐름이 실적 변동성을 좌우합니다.',
      },
    ],
    financials: {
      revenueGrowth: 0.11,
      operatingMargin: 0.16,
      netMargin: 0.12,
      debtRatio: 0.26,
      per: 18.6,
      pbr: 1.42,
      roe: 0.08,
      freeCashFlowTrend: 'improving',
    },
  },
};

export function searchStocks(query: string): Stock[] {
  const normalized = query.trim().toLowerCase();
  const stocks = Object.values(mockStocks);

  if (!normalized) {
    return stocks;
  }

  return stocks.filter((stock) => {
    const searchable = [stock.symbol, stock.name, stock.sector, ...stock.aliases]
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalized);
  });
}

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Candle, StockSymbol } from '../data/mockMarket';
import { requestJson } from './httpClient';

export type MarketRange = '1D' | '1M' | '3M' | '6M';
export type MarketData = {
  symbol: StockSymbol; range: MarketRange; currency: 'USD' | 'KRW'; candles: Candle[];
  previousClose: number | null; source: string; interval: string; delay: 'possible';
  exchange: string; timeZone: string; marketOpen: boolean; asOf: string; fetchedAt: string; notice: string;
};

export function useMarketData(symbol: StockSymbol, range: MarketRange) {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState('');
  const [refreshId, setRefreshId] = useState(0);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(() => setRefreshId(value => value + 1), []);
  useEffect(() => {
    setError('');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      if (controller.signal.aborted) return;
      setLoading(true);
      try {
        const url = process.env.EXPO_PUBLIC_AI_API_URL ?? 'http://localhost:8787';
        const next = await requestJson(`${url}/api/market/chart?symbol=${symbol}&range=${range}`, {}, controller.signal, 15000) as MarketData;
        if (next.symbol !== symbol || next.range !== range || !Array.isArray(next.candles) || next.candles.length < 2) throw new Error('올바르지 않은 시세 응답입니다.');
        if (!controller.signal.aborted) {
          setData(previous => previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
          setError('');
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '시세 연결 실패');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(() => { void load(); }, 30000);
        }
      }
    }
    void load();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => { controller.abort(); clearTimeout(timer); subscription.remove(); };
  }, [symbol, range, refreshId, refresh]);
  return { data: data?.symbol === symbol && data.range === range ? data : null, error, loading, refresh };
}

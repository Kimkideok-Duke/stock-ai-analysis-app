import { useCallback, useEffect, useState } from 'react';
import type { StockSymbol } from '../data/mockMarket';
import type { CompanyData } from './companyModel';
import { requestJson } from './httpClient';

export function useCompanyData(symbol: StockSymbol) {
  const [data, setData] = useState<CompanyData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setError('');
    async function load() {
      setLoading(true);
      try {
        const base = process.env.EXPO_PUBLIC_AI_API_URL ?? 'http://localhost:8787';
        const result = await requestJson(`${base}/api/market/company?symbol=${symbol}`, {}, controller.signal, 20000) as CompanyData;
        if (result.symbol !== symbol || !['ok', 'error'].includes(result.news?.status) || !['ok', 'error'].includes(result.financials?.status)) throw new Error('기업 데이터 응답을 확인하지 못했습니다.');
        if (!controller.signal.aborted) { setData(result); setError(''); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '기업 데이터 연결 실패'); }
      finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(() => { void load(); }, 300000); }
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [symbol, version]);
  return { data: data?.symbol === symbol ? data : null, error, loading, refresh };
}

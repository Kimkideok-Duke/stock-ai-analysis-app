import type { Financials, NewsItem, StockSymbol } from '../data/mockMarket';
import { analyzeFinancials } from './indicators';

export type FinancialRecord = { periodEnd: string; periodType: '3M' | '12M'; currency: 'USD' | 'KRW';
  revenue: number | null; operatingIncome: number | null; netIncome: number | null; equity: number | null;
  liabilities: number | null; freeCashFlow: number | null; eps: number | null; shares: number | null };
export type FinancialSnapshot = { source: string; url: string; asOf: string; filingDate: null; fetchedAt: string; records: FinancialRecord[] };
export type NewsSnapshot = { source: string; asOf: string | null; fetchedAt: string; items: NewsItem[] };
type Resource<T> = { status: 'ok'; data: T } | { status: 'error'; data: null; message: string };
export type CompanyData = { symbol: StockSymbol; news: Resource<NewsSnapshot>; financials: Resource<FinancialSnapshot> };
type Metrics = { [K in keyof Financials]: Financials[K] | null };
const ratio = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 && Number.isFinite(a / b) ? a / b : null;

export function deriveFinancials(snapshot: FinancialSnapshot | null, price: number | null) {
  if (!snapshot?.records.length) return null;
  const records = [...snapshot.records].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.periodType.localeCompare(a.periodType));
  const latest = records[0]!;
  const peers = records.filter(row => row.periodType === latest.periodType);
  const previousYear = peers.find(row => {
    const days = (Date.parse(latest.periodEnd) - Date.parse(row.periodEnd)) / 86400000;
    return days >= 330 && days <= 400;
  });
  const ttm = peers.slice(0, 4);
  const validTtm = latest.periodType === '3M' && ttm.length === 4 && ttm.every((row, i) => !i || ((Date.parse(ttm[i - 1]!.periodEnd) - Date.parse(row.periodEnd)) / 86400000 >= 60 && (Date.parse(ttm[i - 1]!.periodEnd) - Date.parse(row.periodEnd)) / 86400000 <= 120));
  const sum = (field: 'netIncome' | 'eps') => validTtm && ttm.every(row => row[field] !== null) ? ttm.reduce((total, row) => total + row[field]!, 0) : latest.periodType === '12M' ? latest[field] : null;
  const ttmEps = sum('eps');
  const equityAverage = latest.equity !== null && previousYear?.equity !== null && previousYear?.equity !== undefined ? (latest.equity + previousYear.equity) / 2 : null;
  const growth = ratio(latest.revenue, previousYear?.revenue ?? null);
  const metrics: Metrics = {
    revenueGrowth: growth === null ? null : growth - 1,
    operatingMargin: ratio(latest.operatingIncome, latest.revenue),
    netMargin: ratio(latest.netIncome, latest.revenue),
    debtRatio: ratio(latest.liabilities, latest.equity),
    per: ratio(price, ttmEps),
    pbr: ratio(price !== null && latest.shares !== null && latest.shares > 0 ? price * latest.shares : null, latest.equity),
    roe: ratio(sum('netIncome'), equityAverage),
    freeCashFlowTrend: latest.freeCashFlow === null || previousYear?.freeCashFlow === null || previousYear?.freeCashFlow === undefined ? null : latest.freeCashFlow > previousYear.freeCashFlow ? 'improving' : latest.freeCashFlow < previousYear.freeCashFlow ? 'weakening' : 'stable',
  };
  const complete = Object.values(metrics).every(value => value !== null && (typeof value !== 'number' || Number.isFinite(value)));
  return { latest, metrics, earningsBasis: validTtm ? '최근 4개 분기 합계(TTM)' : latest.periodType === '12M' ? '연간 실적' : 'TTM 산출 불가', analysis: complete ? analyzeFinancials(metrics as Financials) : null };
}

import { mockStocks, type StockSymbol } from '../data/mockMarket';

export function parseWatchlist(raw: string | null): StockSymbol[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is StockSymbol => typeof item === 'string' && Object.prototype.hasOwnProperty.call(mockStocks, item)))];
  } catch { return []; }
}

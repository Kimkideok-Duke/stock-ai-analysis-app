import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseWatchlist } from './watchlist';
import type { StockSymbol } from '../data/mockMarket';

const storageKey = 'stock-chart-lab.watchlist.v1';
let pendingSave = Promise.resolve();

export function useWatchlist() {
  const [favorites, setFavorites] = useState<StockSymbol[]>([]);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then(value => { if (active) setFavorites(parseWatchlist(value)); })
      .catch(() => { if (active) { setStorageAvailable(false); setError('관심종목 저장소에 접근할 수 없어 이번 세션에만 유지됩니다.'); } })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready || !storageAvailable) return;
    let active = true;
    pendingSave = pendingSave.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify(favorites)));
    pendingSave.catch(() => { if (active) setError('관심종목 저장에 실패했습니다.'); });
    return () => { active = false; };
  }, [favorites, ready, storageAvailable]);
  return { favorites, ready, error, toggle: (symbol: StockSymbol) => {
    if (ready) setFavorites(previous => previous.includes(symbol) ? previous.filter(item => item !== symbol) : [...previous, symbol]);
  } };
}

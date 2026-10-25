const SYMBOLS = { AAPL: 'AAPL', TSLA: 'TSLA', NVDA: 'NVDA', MSFT: 'MSFT', '005930': '005930.KS' };
const RANGES = { '1D': ['1d', '1m'], '1M': ['1mo', '1d'], '3M': ['3mo', '1d'], '6M': ['6mo', '1d'] };

function normalizeChart(body, symbol, range, now = Date.now()) {
  const result = body?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];
  if (!meta || !quote || meta.symbol !== SYMBOLS[symbol] || !['USD', 'KRW'].includes(meta.currency)) throw new Error('INVALID_MARKET_DATA');
  const candles = [];
  let lastTime = 0;
  for (let i = 0; i < (result.timestamp?.length ?? 0); i++) {
    const timestamp = result.timestamp[i];
    const [open, high, low, close, volume] = ['open', 'high', 'low', 'close', 'volume'].map(key => quote[key]?.[i]);
    if (![timestamp, open, high, low, close, volume].every(Number.isFinite) || timestamp <= lastTime || low <= 0 || low > Math.min(open, close) || high < Math.max(open, close) || volume < 0) continue;
    candles.push({ time: new Date(timestamp * 1000).toISOString(), open, high, low, close, volume });
    lastTime = timestamp;
  }
  if (candles.length < 2) throw new Error('EMPTY_MARKET_DATA');
  const session = meta.currentTradingPeriod?.regular;
  const marketOpen = !!session && now / 1000 >= session.start && now / 1000 < session.end;
  const previousClose = range === '1D' ? (meta.previousClose ?? meta.chartPreviousClose) : candles.at(-2).close;
  return {
    symbol, range, currency: meta.currency, candles,
    previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : null,
    source: 'Yahoo Finance', interval: RANGES[range][1], delay: 'possible',
    exchange: meta.exchangeName ?? '', timeZone: meta.exchangeTimezoneName ?? 'UTC',
    marketOpen, asOf: candles.at(-1).time, fetchedAt: new Date(now).toISOString(),
    notice: '30초 자동 갱신 · 시세 지연 가능 · 거래소 실시간 체결 보장 없음',
  };
}

function createMarketService(fetchImpl = (...args) => fetch(...args), now = Date.now) {
  const cache = new Map();
  const pending = new Map();
  return async function getMarket(symbol, range) {
    if (!Object.hasOwn(SYMBOLS, symbol) || !Object.hasOwn(RANGES, range)) throw new Error('INVALID_QUERY');
    const key = `${symbol}:${range}`;
    const cached = cache.get(key);
    if (cached && now() - cached.at < 25000) return cached.data;
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      const [period, interval] = RANGES[range];
      const response = await fetchImpl(`https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOLS[symbol]}?range=${period}&interval=${interval}`, {
        headers: { 'User-Agent': 'StockStrategyLab/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('MARKET_UNAVAILABLE');
      const data = normalizeChart(await response.json(), symbol, range, now());
      cache.set(key, { at: now(), data });
      return data;
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  };
}

function installMarket(app, getMarket = createMarketService()) {
  app.get('/api/market/chart', async (req, res) => {
    const { symbol = 'NVDA', range = '3M' } = req.query;
    if (typeof symbol !== 'string' || typeof range !== 'string' || !Object.hasOwn(SYMBOLS, symbol) || !Object.hasOwn(RANGES, range)) return res.status(400).json({ message: '지원하지 않는 종목 또는 기간입니다.' });
    try { res.json(await getMarket(symbol, range)); }
    catch { res.status(502).json({ message: '시세 제공자에 연결하지 못했습니다. 잠시 후 다시 시도해주세요. 샘플 시세로 대체하지 않습니다.' }); }
  });
}

module.exports = { normalizeChart, createMarketService, installMarket };

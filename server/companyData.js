const { XMLParser, XMLValidator } = require('fast-xml-parser');
const SYMBOLS = { AAPL: 'AAPL', TSLA: 'TSLA', NVDA: 'NVDA', MSFT: 'MSFT', '005930': '005930.KS' };
const QUERIES = { AAPL: '"Apple" stock', TSLA: '"Tesla" stock', NVDA: '"NVIDIA" stock', MSFT: '"Microsoft" stock', '005930': '삼성전자' };
const FIELDS = { revenue: 'TotalRevenue', operatingIncome: 'OperatingIncome', netIncome: 'NetIncome', equity: 'StockholdersEquity', liabilities: 'TotalLiabilitiesNetMinorityInterest', freeCashFlow: 'FreeCashFlow', eps: 'BasicEPS', shares: 'OrdinarySharesNumber' };
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });

function text(value) { return String(typeof value === 'object' ? value?.['#text'] ?? '' : value ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim().slice(0, 400); }
function safeLink(value) { try { const url = new URL(String(value)); return url.protocol === 'https:' ? url.href : null; } catch { return null; } }
function parseNews(xml, now = Date.now()) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('INVALID_RSS');
  const root = parser.parse(xml)?.rss;
  if (!root || !Object.hasOwn(root, 'channel')) throw new Error('INVALID_RSS');
  const channel = root.channel;
  const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  const seen = new Set();
  return items.map(item => ({ title: text(item.title), source: text(item.source) || 'Google News', url: safeLink(item.link),
    publishedAt: Date.parse(item.pubDate), sentiment: 'neutral', summary: '',
  })).filter(item => {
    if (!item.title || !item.url || !Number.isFinite(item.publishedAt) || item.publishedAt > now + 300000 || now - item.publishedAt > 8 * 86400000 || seen.has(item.title)) return false;
    seen.add(item.title); return true;
  }).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 12).map(item => ({ ...item, publishedAt: new Date(item.publishedAt).toISOString() }));
}

function parseFinancials(body, symbol, now = Date.now()) {
  const currency = symbol === '005930' ? 'KRW' : 'USD';
  const result = body?.timeseries?.result;
  if (!Array.isArray(result) || body.timeseries.error) throw new Error('INVALID_FINANCIALS');
  const records = [];
  for (const prefix of ['quarterly', 'annual']) {
    const rows = new Map();
    for (const [field, suffix] of Object.entries(FIELDS)) {
      const type = prefix + suffix;
      const series = result.find(entry => entry.meta?.symbol?.includes(SYMBOLS[symbol]) && entry.meta?.type?.includes(type));
      for (const item of series?.[type] ?? []) {
        const date = item.asOfDate;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || Date.parse(date) > now || item.periodType !== (prefix === 'quarterly' ? '3M' : '12M') || (field !== 'shares' && item.currencyCode !== currency)) continue;
        if (!rows.has(date)) rows.set(date, { periodEnd: date, periodType: prefix === 'quarterly' ? '3M' : '12M', currency, ...Object.fromEntries(Object.keys(FIELDS).map(key => [key, null])) });
        rows.get(date)[field] = Number.isFinite(item.reportedValue?.raw) ? item.reportedValue.raw : null;
      }
    }
    records.push(...[...rows.values()].filter(row => row.revenue !== null).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).slice(0, prefix === 'quarterly' ? 5 : 3));
  }
  if (!records.length) throw new Error('EMPTY_FINANCIALS');
  records.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.periodType.localeCompare(a.periodType));
  return { source: 'Yahoo Finance financial statements', url: `https://finance.yahoo.com/quote/${SYMBOLS[symbol]}/financials/`, asOf: records[0].periodEnd, filingDate: null, fetchedAt: new Date(now).toISOString(), records };
}

function createCompanyService(fetchImpl = (...args) => fetch(...args), now = Date.now) {
  const cache = new Map(); const pending = new Map();
  async function resource(symbol, kind) {
    const key = `${symbol}:${kind}`; const cached = cache.get(key);
    if (cached && now() - cached.time < (kind === 'news' ? 120000 : 900000)) return cached.data;
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      let url;
      if (kind === 'news') {
        const kr = symbol === '005930';
        url = `https://news.google.com/rss/search?q=${encodeURIComponent(QUERIES[symbol] + ' when:7d')}&hl=${kr ? 'ko' : 'en-US'}&gl=${kr ? 'KR' : 'US'}&ceid=${kr ? 'KR:ko' : 'US:en'}`;
      } else {
        const types = ['quarterly', 'annual'].flatMap(prefix => Object.values(FIELDS).map(field => prefix + field));
        url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${SYMBOLS[symbol]}?symbol=${SYMBOLS[symbol]}&type=${types.join(',')}&period1=${Math.floor((now() - 4 * 366 * 86400000) / 1000)}&period2=${Math.floor(now() / 1000)}`;
      }
      const response = await fetchImpl(url, { headers: { 'User-Agent': 'StockStrategyLab/1.0' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
      let data;
      if (kind === 'news') {
        const items = parseNews(await response.text(), now());
        data = { source: 'Google News RSS · 각 언론사', fetchedAt: new Date(now()).toISOString(), asOf: items[0]?.publishedAt ?? null, items };
      } else data = parseFinancials(await response.json(), symbol, now());
      cache.set(key, { time: now(), data }); return data;
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  }
  return async symbol => {
    if (!Object.hasOwn(SYMBOLS, symbol)) throw new Error('INVALID_SYMBOL');
    const results = await Promise.allSettled([resource(symbol, 'news'), resource(symbol, 'financials')]);
    const response = { symbol };
    ['news', 'financials'].forEach((key, i) => {
      response[key] = results[i].status === 'fulfilled' ? { status: 'ok', data: results[i].value } : { status: 'error', data: null, message: key === 'news' ? '뉴스를 가져오지 못했습니다.' : '재무 데이터를 가져오지 못했습니다.' };
    });
    return response;
  };
}
function installCompany(app, service = createCompanyService()) {
  app.get('/api/market/company', async (req, res) => {
    if (typeof req.query.symbol !== 'string' || !Object.hasOwn(SYMBOLS, req.query.symbol)) return res.status(400).json({ message: '지원하지 않는 종목입니다.' });
    try { res.json(await service(req.query.symbol)); } catch { res.status(502).json({ message: '기업 데이터를 가져오지 못했습니다.' }); }
  });
}
module.exports = { parseNews, parseFinancials, createCompanyService, installCompany };

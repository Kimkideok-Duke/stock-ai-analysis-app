import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { CandlestickChart } from './src/components/CandlestickChart';
import { AiAnalysisPanel } from './src/components/AiAnalysisPanel';
import { AiConnections } from './src/components/AiConnections';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWatchlist } from './src/lib/useWatchlist';
import { useMarketData } from './src/lib/useMarketData';
import { useCompanyData } from './src/lib/useCompanyData';
import { deriveFinancials } from './src/lib/companyModel';
import { CompanyPanels } from './src/components/CompanyPanels';
import { MetricCard } from './src/components/MetricCard';
import { mockStocks, searchStocks, type NewsItem, type StockSymbol } from './src/data/mockMarket';
import { requestAiAnalysis, type AiAnalysisResponse, type AiConnection } from './src/lib/aiAnalysisClient';
import {
  analyzeSeries,
  formatCurrency,
  formatPercent,
} from './src/lib/indicators';

const ranges = ['1D', '1M', '3M', '6M'] as const;
type Range = (typeof ranges)[number];

const rangeWindow: Record<Range, number> = {
  '1D': 390,
  '1M': 36,
  '3M': 72,
  '6M': 120,
};

type IndicatorKey = 'sma' | 'ema' | 'bollinger' | 'volume';

const indicatorLabels: Record<IndicatorKey, string> = {
  sma: 'SMA',
  ema: 'EMA',
  bollinger: 'BB',
  volume: 'VOL',
};

export default function App() {
  const [query, setQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<StockSymbol>('NVDA');
  const [selectedRange, setSelectedRange] = useState<Range>('3M');
  const [visibleIndicators, setVisibleIndicators] = useState<Record<IndicatorKey, boolean>>({
    sma: true,
    ema: true,
    bollinger: true,
    volume: true,
  });
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAsOf, setAiAsOf] = useState('');
  const watchlist = useWatchlist();

  const searchResults = useMemo(() => searchStocks(query), [query]);
  const selectedStock = mockStocks[selectedSymbol];
  const market = useMarketData(selectedSymbol, selectedRange);
  const company = useCompanyData(selectedSymbol);
  const candles = useMemo(
    () => market.data?.candles ?? selectedStock.candles.slice(-rangeWindow[selectedRange]),
    [market.data, selectedRange, selectedStock.candles],
  );
  const analysis = useMemo(() => analyzeSeries(candles), [candles]);
  const latest = candles[candles.length - 1] ?? selectedStock.candles[0]!;
  const companyData = company.error ? null : company.data;
  const actualNews = companyData?.news.status === 'ok' ? companyData.news.data.items : [];
  const financialAnalysis = deriveFinancials(companyData?.financials.status === 'ok' ? companyData.financials.data : null, market.data ? latest.close : null)?.analysis ?? null;
  const previous = { close: market.data?.previousClose ?? candles[candles.length - 2]?.close ?? latest.close };
  const change = latest.close - previous.close;
  const changePercent = previous.close === 0 ? 0 : change / previous.close;
  const money = (value: number) => formatCurrency(value, selectedStock.currency);

  const analysisRequest = useRef<AbortController | null>(null);
  const [connection, setConnection] = useState<AiConnection | null>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    analysisRequest.current?.abort();
    setAiLoading(false); setAiError(''); setAiAsOf('');
    setAiAnalysis(null);
    return () => analysisRequest.current?.abort();
  }, [selectedSymbol, selectedRange, connection]);

  async function runAiAnalysis() {
    if (!connection || aiLoading || !market.data || market.error) return;
    const controller = new AbortController();
    analysisRequest.current?.abort(); analysisRequest.current = controller;
    setAiLoading(true); setAiError('');
    try {
      const result = await requestAiAnalysis({ companyContext: companyData, marketSource: market.data, stock: { ...selectedStock, news: actualNews }, strategy: analysis.strategy,
        rsi: analysis.rsi, macdHistogram: analysis.macd.histogram, maState: analysis.maState,
        volumeState: analysis.volumeState, news: actualNews.length ? { label: '중립', sentimentScore: 0, summary: '실제 뉴스 제목 목록입니다. 감성은 별도 평가하지 않았으며 원문 전체를 수집하지 않았습니다.' } : null, fundamentals: financialAnalysis,
      }, connection, controller.signal);
      if (!controller.signal.aborted) { setAiAnalysis(result); setAiAsOf(market.data.asOf); }
    } catch (error) {
      if (!controller.signal.aborted) setAiError(error instanceof Error && error.message !== 'Failed to fetch'
        ? error.message : '분석 서버에 연결할 수 없습니다.');
    } finally { if (!controller.signal.aborted) setAiLoading(false); }
  }

  const toggleIndicator = (key: IndicatorKey) => {
    setVisibleIndicators((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Stock Strategy Lab</Text>
          <Text style={styles.title}>종목 분석</Text>
          <Text style={styles.subtitle}>검색한 종목의 차트, 뉴스, 재무제표를 한 번에 확인합니다.</Text>
          <Text style={styles.sampleNotice}>실제 시세 API 연결 · 30초 자동 갱신 · 시세 지연 가능</Text>
        </View>

        <View style={styles.searchPanel}>
          <TextInput
            accessibilityLabel="종목 검색"
            value={query}
            onChangeText={setQuery}
            placeholder="종목명 또는 티커 검색: NVDA, 애플, 삼성전자"
            placeholderTextColor="#98A2B3"
            autoCapitalize="none"
            style={styles.searchInput}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.searchResults}>
            {searchResults.map((stock) => {
              const active = stock.symbol === selectedSymbol;
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${stock.name} 선택`}
                  key={stock.symbol}
                  activeOpacity={0.85}
                  onPress={() => setSelectedSymbol(stock.symbol)}
                  style={[styles.resultChip, active && styles.resultChipActive]}
                >
                  <Text style={[styles.resultSymbol, active && styles.resultTextActive]}>{stock.symbol}</Text>
                  <Text style={[styles.resultName, active && styles.resultTextActive]} numberOfLines={1}>
                    {stock.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {searchResults.length === 0 && <Text accessibilityLiveRegion="polite" style={styles.sectionCaption}>검색 결과가 없습니다. 현재 지원하는 5개 종목에서 검색해주세요.</Text>}
        </View>

        <View style={styles.watchlist}>
          <Text style={styles.panelTitle}>관심종목</Text>
          <View style={styles.favoriteRow}>
            {watchlist.favorites.map(symbol => <Pressable key={symbol} accessibilityRole="button" accessibilityLabel={`${symbol} 관심종목 선택`}
              onPress={() => { setSelectedSymbol(symbol); setQuery(''); }} style={styles.favoriteItem}>
              <Text style={styles.resultSymbol}>{symbol}</Text>
            </Pressable>)}
            {watchlist.ready && watchlist.favorites.length === 0 && <Text style={styles.metaText}>등록된 관심종목이 없습니다.</Text>}
          </View>
          {!!watchlist.error && <Text style={styles.sectionCaption}>{watchlist.error}</Text>}
        </View>

        <View style={{ gap: 6, marginBottom: 12 }}>
          <Text accessibilityLiveRegion="polite" style={styles.metaText}>{market.data ? `${market.data.source} · ${market.data.exchange} · ${market.data.marketOpen ? '정규장 시간' : '정규장 외'} · ${market.data.interval}` : market.error ? '시세 연결 실패' : '시세 불러오는 중'}</Text>
          {market.data && <Text style={styles.metaText}>캔들 기준: {new Date(market.data.asOf).toLocaleString('ko-KR')} · 수신: {new Date(market.data.fetchedAt).toLocaleTimeString('ko-KR')}</Text>}
          {!!market.error && <Text accessibilityRole="alert" style={{ color: '#B42318' }}>{market.data ? '갱신 실패: 마지막 수신 데이터를 표시합니다. ' : ''}{market.error}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="시세 새로고침" disabled={market.loading} onPress={market.refresh} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="refresh" size={22} color={market.loading ? '#98A2B3' : '#1261A0'} />
          </Pressable>
        </View>
        {market.data && <>
        <View style={styles.quotePanel}>
          <View style={styles.quoteLeft}>
            <Text style={styles.companyName}>{selectedStock.name}</Text>
            <Text style={styles.metaText}>
              {selectedStock.symbol} · {selectedStock.market} · {selectedStock.sector}
            </Text>
            <Text style={styles.price}>{money(latest.close)}</Text>
          </View>
          <View style={styles.quoteRight}>
            <Pressable accessibilityRole="button" accessibilityLabel={watchlist.favorites.includes(selectedSymbol) ? '관심종목 해제' : '관심종목 추가'}
              accessibilityState={{ disabled: !watchlist.ready }} disabled={!watchlist.ready} onPress={() => watchlist.toggle(selectedSymbol)}
              {...{ title: watchlist.favorites.includes(selectedSymbol) ? '관심종목 해제' : '관심종목 추가' }} style={styles.favoriteButton}>
              <Ionicons name={watchlist.favorites.includes(selectedSymbol) ? 'star' : 'star-outline'} size={22} color="#946A00" />
            </Pressable>
            <Text style={[styles.change, change >= 0 ? styles.up : styles.down]}>
              {change >= 0 ? '+' : ''}
              {money(change)}
            </Text>
            <Text style={[styles.changePercent, changePercent >= 0 ? styles.up : styles.down]}>
              {formatPercent(changePercent)}
            </Text>
          </View>
        </View>

        <View style={styles.controlRow}>
          <View style={styles.rangeTabs}>
            {ranges.map((range) => (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedRange === range }}
                key={range}
                activeOpacity={0.8}
                onPress={() => setSelectedRange(range)}
                style={[styles.rangeButton, selectedRange === range && styles.rangeButtonActive]}
              >
                <Text style={[styles.rangeText, selectedRange === range && styles.rangeTextActive]}>{range}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.indicatorPanel}>
          <Text style={styles.panelTitle}>차트 지표</Text>
          <View style={styles.indicatorToggles}>
            {(Object.keys(indicatorLabels) as IndicatorKey[]).map((key) => (
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityLabel={`${indicatorLabels[key]} 표시`}
                accessibilityState={{ checked: visibleIndicators[key] }}
                key={key}
                activeOpacity={0.8}
                onPress={() => toggleIndicator(key)}
                style={[styles.indicatorToggle, visibleIndicators[key] && styles.indicatorToggleActive]}
              >
                <Text style={[styles.indicatorToggleText, visibleIndicators[key] && styles.indicatorToggleTextActive]}>
                  {indicatorLabels[key]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <CandlestickChart
          key={`${selectedSymbol}-${selectedRange}`}
          candles={candles}
          currency={selectedStock.currency}
          ma5={analysis.ma5}
          ma20={analysis.ma20}
          ema20={analysis.ema20}
          bollinger20={analysis.bollinger20}
          visibleIndicators={visibleIndicators}
        />

        <View style={styles.metricsGrid}>
          <MetricCard label="방향성" value={analysis.strategy.direction} caption={`지표 점수 ${analysis.strategy.confidence.toFixed(0)}/100`} />
          <MetricCard label="RSI 14" value={analysis.rsi.toFixed(1)} caption={analysis.rsiState} />
          <MetricCard label="MACD" value={analysis.macd.histogram.toFixed(2)} caption={analysis.macdState} />
          <MetricCard label="데이터" value={market.data.interval === '1m' ? '분봉' : '일봉'} caption="지연 가능 시세" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>차트 분석</Text>
          {analysis.insights.map((item) => (
            <Bullet key={item} text={item} />
          ))}
        </View>

        </>}
        <AiConnections onChange={setConnection} onAnalyze={runAiAnalysis} loading={aiLoading} analysisDisabled={!market.data || !!market.error} />
        {aiLoading && <Pressable accessibilityRole="button" onPress={() => { analysisRequest.current?.abort(); setAiLoading(false); setAiError('분석을 취소했습니다.'); }} style={{ padding: 12 }}><Text style={{ color: '#1261A0' }}>분석 취소</Text></Pressable>}
        {!!aiError && <Text accessibilityRole="alert" style={{ color: '#B42318', marginTop: 12 }}>{aiError}</Text>}
        {aiAnalysis?.mode !== 'local' && aiAnalysis && <>
          <Text style={styles.metaText}>AI 분석 기준 캔들: {new Date(aiAsOf).toLocaleString('ko-KR')}</Text>
          <AiAnalysisPanel result={aiAnalysis} loading={aiLoading} />
        </>}

        {market.data && <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>분할매수·매도 시나리오</Text>
          <View style={styles.strategySummary}>
            <PriceCell label="참고 매수 구간" value={analysis.strategy.buyZone.balanced} currency={selectedStock.currency} />
            <PriceCell label="손절 기준" value={analysis.strategy.stopLoss} currency={selectedStock.currency} danger />
            <PriceCell label="1차 목표" value={analysis.strategy.sellTargets.first} currency={selectedStock.currency} />
            <PriceCell label="최종 목표" value={analysis.strategy.sellTargets.final} currency={selectedStock.currency} />
          </View>

          <Text style={styles.subsectionTitle}>분할매수</Text>
          {analysis.strategy.splitBuy.map((item) => (
            <PlanRow key={item.label} label={item.label} price={item.price} weight={item.weight} currency={selectedStock.currency} />
          ))}

          <Text style={styles.subsectionTitle}>분할매도</Text>
          {analysis.strategy.splitSell.map((item) => (
            <PlanRow key={item.label} label={item.label} price={item.price} weight={item.weight} currency={selectedStock.currency} />
          ))}
        </View>

        </>}
        <CompanyPanels data={company.data} error={company.error} loading={company.loading} onRefresh={company.refresh} price={market.data ? latest.close : null} />
        <Text style={styles.disclaimer}>
          이 앱의 분석 결과는 투자 참고용 시나리오이며 특정 종목의 매수·매도 권유가 아닙니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.dot, muted && styles.dotMuted]} />
      <Text style={[styles.bulletText, muted && styles.mutedText]}>{text}</Text>
    </View>
  );
}

function PriceCell({
  label,
  value,
  currency,
  danger = false,
}: {
  label: string;
  value: number;
  currency: 'USD' | 'KRW';
  danger?: boolean;
}) {
  return (
    <View style={styles.priceCell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, danger && styles.down]}>{formatCurrency(value, currency)}</Text>
    </View>
  );
}

function PlanRow({
  label,
  price,
  weight,
  currency,
}: {
  label: string;
  price: number;
  weight: number;
  currency: 'USD' | 'KRW';
}) {
  return (
    <View style={styles.planRow}>
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={styles.planPrice}>{formatCurrency(price, currency)}</Text>
      <Text style={styles.planWeight}>{weight}%</Text>
    </View>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const tone = item.sentiment === 'positive' ? styles.positivePill : item.sentiment === 'negative' ? styles.negativePill : styles.neutralPill;
  const label = item.sentiment === 'positive' ? '긍정' : item.sentiment === 'negative' ? '부정' : '중립';

  return (
    <View style={styles.newsCard}>
      <View style={styles.newsTop}>
        <Text style={styles.newsSource}>{item.source} · {item.publishedAt}</Text>
        <View style={[styles.sentimentPill, tone]}>
          <Text style={styles.sentimentText}>{label}</Text>
        </View>
      </View>
      <Text style={styles.newsTitle}>{item.title}</Text>
      <Text style={styles.newsSummary}>{item.summary}</Text>
    </View>
  );
}

function ScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scoreBox}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  screen: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 10,
  },
  header: {
    marginBottom: 14,
  },
  sampleNotice: { color: '#825C13', fontSize: 12, marginTop: 8, lineHeight: 18 },
  watchlist: { marginBottom: 12, gap: 8 },
  favoriteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  favoriteItem: { padding: 10, minHeight: 40, borderBottomWidth: 1, borderColor: '#98A2B3' },
  favoriteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  kicker: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 2,
  },
  subtitle: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 5,
  },
  searchPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E5E7EB',
    borderRadius: 7,
    borderWidth: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchResults: {
    gap: 8,
    paddingTop: 10,
  },
  resultChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    minWidth: 112,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  resultChipActive: {
    backgroundColor: '#111827',
  },
  resultSymbol: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  resultName: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  resultTextActive: {
    color: '#FFFFFF',
  },
  quotePanel: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 16,
  },
  quoteLeft: {
    flex: 1,
  },
  companyName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
  },
  metaText: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  price: {
    color: '#111827',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 8,
  },
  quoteRight: {
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  change: {
    fontSize: 16,
    fontWeight: '900',
  },
  changePercent: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  up: {
    color: '#059669',
  },
  down: {
    color: '#E11D48',
  },
  controlRow: {
    marginBottom: 10,
  },
  rangeTabs: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  rangeButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  rangeButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  rangeText: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '900',
  },
  rangeTextActive: {
    color: '#111827',
  },
  indicatorPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  panelTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  indicatorToggles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  indicatorToggle: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 7,
    minHeight: 34,
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: 10,
  },
  indicatorToggleActive: {
    backgroundColor: '#111827',
  },
  indicatorToggleText: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '900',
  },
  indicatorToggleTextActive: {
    color: '#FFFFFF',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
  },
  sectionCaption: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    marginTop: 11,
  },
  dot: {
    backgroundColor: '#2563EB',
    borderRadius: 4,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  dotMuted: {
    backgroundColor: '#94A3B8',
  },
  bulletText: {
    color: '#374151',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  mutedText: {
    color: '#64748B',
  },
  strategySummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  priceCell: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    flexBasis: '48.5%',
    minHeight: 70,
    justifyContent: 'center',
    padding: 12,
  },
  cellLabel: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '900',
  },
  cellValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
  },
  subsectionTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
    marginTop: 14,
  },
  planRow: {
    alignItems: 'center',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 42,
  },
  planLabel: {
    color: '#374151',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  planPrice: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    width: 88,
  },
  planWeight: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    width: 42,
  },
  newsBadge: {
    backgroundColor: '#ECFDF3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  newsBadgeText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '900',
  },
  newsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginTop: 10,
    padding: 12,
  },
  newsTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  newsSource: {
    color: '#667085',
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  sentimentPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  positivePill: {
    backgroundColor: '#D1FAE5',
  },
  neutralPill: {
    backgroundColor: '#E5E7EB',
  },
  negativePill: {
    backgroundColor: '#FFE4E6',
  },
  sentimentText: {
    color: '#111827',
    fontSize: 10,
    fontWeight: '900',
  },
  newsTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
    marginTop: 9,
  },
  newsSummary: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  scoreBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    flex: 1,
    minHeight: 70,
    justifyContent: 'center',
  },
  scoreLabel: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '900',
  },
  scoreValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  disclaimer: {
    color: '#98A2B3',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
});

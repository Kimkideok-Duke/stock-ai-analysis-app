import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { CompanyData } from '../lib/companyModel';
import { deriveFinancials } from '../lib/companyModel';

export function CompanyPanels({ data, error, loading, onRefresh, price }: {
  data: CompanyData | null; error: string; loading: boolean; onRefresh: () => void; price: number | null;
}) {
  const news = data?.news.status === 'ok' ? data.news.data : null;
  const snapshot = data?.financials.status === 'ok' ? data.financials.data : null;
  const financials = deriveFinancials(snapshot, price);
  const number = (value: number | null | undefined) => value == null ? '미제공' : value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  const percent = (value: number | null | undefined) => value == null ? '산출 불가' : `${(value * 100).toFixed(1)}%`;
  return <>
    <View style={styles.header}>
      <Text style={styles.caption}>뉴스 5분 자동 갱신 · 재무 결산 기준</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="뉴스 및 재무 새로고침" disabled={loading} onPress={onRefresh} style={styles.tool}>
        <Ionicons name="refresh" size={22} color={loading ? '#98A2B3' : '#1261A0'} />
      </Pressable>
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{data ? '마지막 수신 자료 · 갱신 실패: ' : ''}{error}</Text>}
    <View style={styles.section}>
      <Text style={styles.title}>관련 뉴스</Text>
      {news ? <>
        <Text style={styles.caption}>{news.source} · 수신 {new Date(news.fetchedAt).toLocaleString('ko-KR')}</Text>
        {!news.items.length && <Text style={styles.caption}>최근 7일 뉴스가 없습니다.</Text>}
        {news.items.map(item => <Pressable key={item.url} accessibilityRole="link" onPress={() => { if (item.url?.startsWith('https://')) void Linking.openURL(item.url).catch(() => {}); }} style={styles.news}>
          <Text style={styles.caption}>{item.source} · {new Date(item.publishedAt).toLocaleString('ko-KR')}</Text>
          <Text style={styles.headline}>{item.title}</Text>
          <Ionicons name="open-outline" size={16} color="#1261A0" />
        </Pressable>)}
      </> : <Text style={styles.caption}>{data?.news.status === 'error' ? data.news.message : loading ? '뉴스 불러오는 중' : '뉴스 데이터가 없습니다.'}</Text>}
    </View>
    <View style={styles.section}>
      <Text style={styles.title}>재무제표 기반 분석</Text>
      {snapshot && financials ? <>
        <Text style={styles.caption}>{snapshot.source} · 수신 {new Date(snapshot.fetchedAt).toLocaleString('ko-KR')}</Text>
        <Text style={styles.caption}>최근 결산일 {financials.latest.periodEnd} · {financials.latest.periodType === '3M' ? '분기' : '연간'} · {financials.latest.currency} · 공시일 미제공</Text>
        <View style={styles.row}><Text>매출액</Text><Text>{number(financials.latest.revenue)}</Text></View>
        <View style={styles.row}><Text>영업이익</Text><Text>{number(financials.latest.operatingIncome)}</Text></View>
        <View style={styles.row}><Text>순이익</Text><Text>{number(financials.latest.netIncome)}</Text></View>
        <View style={styles.row}><Text>자본 / 부채</Text><Text>{number(financials.latest.equity)} / {number(financials.latest.liabilities)}</Text></View>
        <View style={styles.row}><Text>잉여현금흐름</Text><Text>{number(financials.latest.freeCashFlow)}</Text></View>
        <View style={styles.row}><Text>매출 성장률 (전년 동기)</Text><Text>{percent(financials.metrics.revenueGrowth)}</Text></View>
        <View style={styles.row}><Text>영업이익률 / 순이익률</Text><Text>{percent(financials.metrics.operatingMargin)} / {percent(financials.metrics.netMargin)}</Text></View>
        <View style={styles.row}><Text>부채 / 자본</Text><Text>{percent(financials.metrics.debtRatio)}</Text></View>
        <View style={styles.row}><Text>PER / PBR</Text><Text>{number(financials.metrics.per)} / {number(financials.metrics.pbr)}</Text></View>
        <View style={styles.row}><Text>ROE</Text><Text>{percent(financials.metrics.roe)}</Text></View>
        <Text style={styles.caption}>이익·EPS 기준: {financials.earningsBasis} · ROE: 평균 자기자본 기준 · PBR: 제공 주식수 기준 근사치</Text>
        {financials.analysis ? <>
          <Text style={styles.headline}>재무 지표 점수 {financials.analysis.totalScore}/100 · {financials.analysis.rating}</Text>
          {financials.analysis.highlights.map(line => <Text key={line} style={styles.caption}>{line}</Text>)}
          {financials.analysis.risks.map(line => <Text key={line} style={styles.caption}>{line}</Text>)}
        </> : <Text style={styles.caption}>누락 지표·적자·비교 불가 항목이 있어 종합 점수는 산출하지 않습니다.</Text>}
        <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(snapshot.url).catch(() => {}); }}><Text style={styles.link}>재무 데이터 원문</Text></Pressable>
      </> : <Text style={styles.caption}>{data?.financials.status === 'error' ? data.financials.message : loading ? '재무제표 불러오는 중' : '재무 데이터가 없습니다.'}</Text>}
    </View>
  </>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  tool: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 16, gap: 10, paddingVertical: 14, borderTopWidth: 1, borderColor: '#D6DDE1' },
  title: { fontSize: 18, fontWeight: '800', color: '#172026' },
  caption: { fontSize: 12, lineHeight: 19, color: '#647078', flexShrink: 1 },
  news: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E7EB' },
  headline: { fontSize: 14, lineHeight: 22, color: '#172026', fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  link: { color: '#1261A0', paddingVertical: 12 }, error: { color: '#B42318', fontSize: 13 },
});

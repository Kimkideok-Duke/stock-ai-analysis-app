import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AiAnalysisResponse } from '../lib/aiAnalysisClient';

type AiAnalysisPanelProps = {
  result: AiAnalysisResponse;
  loading: boolean;
};

export function AiAnalysisPanel({ result, loading }: AiAnalysisPanelProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI 종합 분석</Text>
          <Text style={styles.caption}>
            {loading ? '분석 갱신 중' : result.model
              ? `${result.mode === 'openai' ? 'GPT' : result.mode === 'anthropic' ? 'Claude' : 'Gemini'} · ${result.model}`
              : '기본 지표 요약 · AI 미사용'}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{result.analysis.riskLevel}</Text>
        </View>
      </View>

      <Text style={styles.headline}>{result.analysis.headline}</Text>
      <Text style={styles.summary}>{result.analysis.summary}</Text>

      <View style={styles.scenarioBox}>
        <Text style={styles.scenarioTitle}>매수 시나리오</Text>
        <Text style={styles.scenarioText}>{result.analysis.buyScenario}</Text>
      </View>

      <View style={styles.scenarioBox}>
        <Text style={styles.scenarioTitle}>매도 시나리오</Text>
        <Text style={styles.scenarioText}>{result.analysis.sellScenario}</Text>
      </View>

      <Text style={styles.subTitle}>핵심 근거</Text>
      {result.analysis.keyReasons.map((item) => (
        <Text key={item} style={styles.listText}>
          - {item}
        </Text>
      ))}

      <Text style={styles.subTitle}>리스크</Text>
      {result.analysis.riskWarnings.map((item) => (
        <Text key={item} style={styles.listText}>
          - {item}
        </Text>
      ))}

      <Text style={styles.disclaimer}>{result.analysis.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#111827',
    borderRadius: 8,
    marginTop: 12,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  caption: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 25,
    marginTop: 14,
  },
  summary: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
  },
  scenarioBox: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
  },
  scenarioTitle: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '900',
  },
  scenarioText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 5,
  },
  subTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 14,
  },
  listText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },
  disclaimer: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 14,
  },
});

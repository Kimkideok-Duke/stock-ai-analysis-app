import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { StrategyPlan } from '../lib/indicators';
import { formatCurrency } from '../lib/indicators';

type ChartImageAnalyzerProps = {
  strategy: StrategyPlan;
};

export function ChartImageAnalyzer({ strategy }: ChartImageAnalyzerProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0]?.uri ?? null);
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>차트 이미지 분석</Text>
          <Text style={styles.caption}>이미지를 넣으면 현재 지표 기준 전략 초안을 생성합니다.</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>{imageUri ? '변경' : '업로드'}</Text>
        </TouchableOpacity>
      </View>

      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <TouchableOpacity activeOpacity={0.85} style={styles.emptyPreview} onPress={pickImage}>
          <Text style={styles.emptyTitle}>차트 스크린샷 선택</Text>
          <Text style={styles.emptyCaption}>캔들, 거래량, 보조지표가 보이는 이미지를 권장합니다.</Text>
        </TouchableOpacity>
      )}

      <View style={styles.directionRow}>
        <View>
          <Text style={styles.smallLabel}>방향성</Text>
          <Text style={styles.direction}>{strategy.direction}</Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>신뢰도 {strategy.confidence.toFixed(0)}%</Text>
        </View>
      </View>

      <View style={styles.priceGrid}>
        <PriceBox label="참고 매수가" value={strategy.buyZone.balanced} />
        <PriceBox label="손절 기준" value={strategy.stopLoss} danger />
        <PriceBox label="1차 목표가" value={strategy.sellTargets.first} />
        <PriceBox label="최종 목표가" value={strategy.sellTargets.final} />
      </View>

      <View style={styles.strategySection}>
        <Text style={styles.sectionTitle}>분할매수</Text>
        {strategy.splitBuy.map((item) => (
          <StrategyRow key={item.label} label={item.label} price={item.price} weight={item.weight} />
        ))}
      </View>

      <View style={styles.strategySection}>
        <Text style={styles.sectionTitle}>분할매도</Text>
        {strategy.splitSell.map((item) => (
          <StrategyRow key={item.label} label={item.label} price={item.price} weight={item.weight} />
        ))}
      </View>

      <View style={styles.notes}>
        {strategy.rationale.map((item) => (
          <Text key={item} style={styles.noteText}>
            - {item}
          </Text>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        이미지 기반 전략은 참고용 시나리오입니다. 실제 매매 결정은 종목 뉴스, 실적, 시장 상황, 본인 위험 한도를 함께 확인해야 합니다.
      </Text>
    </View>
  );
}

function PriceBox({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={styles.priceBox}>
      <Text style={styles.smallLabel}>{label}</Text>
      <Text style={[styles.priceValue, danger && styles.danger]}>{formatCurrency(value)}</Text>
    </View>
  );
}

function StrategyRow({ label, price, weight }: { label: string; price: number; weight: number }) {
  return (
    <View style={styles.strategyRow}>
      <Text style={styles.strategyLabel}>{label}</Text>
      <Text style={styles.strategyPrice}>{formatCurrency(price)}</Text>
      <Text style={styles.strategyWeight}>{weight}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
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
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
  },
  caption: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  uploadButton: {
    backgroundColor: '#111827',
    borderRadius: 7,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  preview: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    height: 166,
    marginTop: 14,
    width: '100%',
  },
  emptyPreview: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 142,
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyCaption: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  directionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  smallLabel: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
  },
  direction: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  confidenceBadge: {
    backgroundColor: '#ECFDF3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  confidenceText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '900',
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  priceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    flexBasis: '48.5%',
    minHeight: 70,
    justifyContent: 'center',
    padding: 12,
  },
  priceValue: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 4,
  },
  danger: {
    color: '#E11D48',
  },
  strategySection: {
    marginTop: 14,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  strategyRow: {
    alignItems: 'center',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 42,
  },
  strategyLabel: {
    color: '#374151',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  strategyPrice: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    width: 84,
  },
  strategyWeight: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    width: 42,
  },
  notes: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginTop: 14,
    padding: 12,
  },
  noteText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 4,
  },
  disclaimer: {
    color: '#98A2B3',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 12,
  },
});

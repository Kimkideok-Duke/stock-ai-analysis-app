import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { buildChartModel } from '../lib/chartModel';
import Svg, { Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import type { Candle } from '../data/mockMarket';
import type { BollingerBandPoint } from '../lib/indicators';
import { formatCurrency } from '../lib/indicators';

type CandlestickChartProps = {
  candles: Candle[];
  currency: 'USD' | 'KRW';
  ma5: number[];
  ma20: number[];
  ema20: number[];
  bollinger20: BollingerBandPoint[];
  visibleIndicators: {
    sma: boolean;
    ema: boolean;
    bollinger: boolean;
    volume: boolean;
  };
};

const priceHeight = 220;
const volumeHeight = 48;
const chartPadding = 18;
function candleTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function CandlestickChart({
  candles,
  currency,
  ma5,
  ma20,
  ema20,
  bollinger20,
  visibleIndicators,
}: CandlestickChartProps) {
  const [chartWidth, setChartWidth] = useState(344);
  const [windowSize, setWindowSize] = useState(60);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const count = Math.min(candles.length, windowSize);
  const end = candles.length - Math.min(offset, Math.max(0, candles.length - count));
  const start = Math.max(0, end - count);
  const windowCandles = useMemo(() => candles.slice(start, end), [candles, start, end]);
  const selectedIndex = Math.max(0, Math.min(count - 1, selected ?? count - 1));
  const selectedCandle = windowCandles[selectedIndex];
  const model = useMemo(
    () => buildChartModel(windowCandles, visibleIndicators.sma ? ma5.slice(start, end) : [],
      visibleIndicators.sma ? ma20.slice(start, end) : [], visibleIndicators.ema ? ema20.slice(start, end) : [],
      visibleIndicators.bollinger ? bollinger20.slice(start, end) : [], chartWidth),
    [bollinger20, windowCandles, ema20, ma5, ma20, start, end, chartWidth, visibleIndicators],
  );

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>캔들차트</Text>
        <View style={styles.legend}>
          {visibleIndicators.sma && <LegendDot color="#2563EB" label="SMA" />}
          {visibleIndicators.ema && <LegendDot color="#7C3AED" label="EMA" />}
          {visibleIndicators.bollinger && <LegendDot color="#64748B" label="BB" />}
        </View>
      </View>

      <View style={styles.toolbar}>
        <ChartTool name="remove-outline" label="차트 축소" disabled={count >= candles.length} onPress={() => { setWindowSize(Math.min(candles.length, count + 12)); setSelected(null); }} />
        <ChartTool name="add-outline" label="차트 확대" disabled={count <= 12} onPress={() => { setWindowSize(Math.max(12, count - 12)); setSelected(null); }} />
        <ChartTool name="chevron-back" label="이전 캔들 구간" disabled={start === 0} onPress={() => { setOffset(Math.min(candles.length - count, offset + Math.max(1, Math.floor(count / 3)))); setSelected(null); }} />
        <ChartTool name="chevron-forward" label="다음 캔들 구간" disabled={offset === 0} onPress={() => { setOffset(Math.max(0, offset - Math.max(1, Math.floor(count / 3)))); setSelected(null); }} />
        <ChartTool name="play-skip-forward-outline" label="최신 캔들" disabled={offset === 0} onPress={() => { setOffset(0); setSelected(null); }} />
        <Text style={[styles.legendText, { flexShrink: 1 }]}>{count}개 · {candleTime(windowCandles[0]?.time)} ~ {candleTime(windowCandles[count - 1]?.time)}</Text>
      </View>

      <View onLayout={event => setChartWidth(Math.max(240, event.nativeEvent.layout.width))}>
      <Svg accessibilityLabel="가격 및 거래량 캔들 차트" pointerEvents="none" width="100%" height={priceHeight + volumeHeight} viewBox={`0 0 ${chartWidth} ${priceHeight + volumeHeight}`}>
        {[0, 1, 2, 3].map((line) => {
          const y = chartPadding + line * ((priceHeight - chartPadding * 2) / 3);
          return <Line key={line} x1={0} x2={chartWidth} y1={y} y2={y} stroke="#E5E7EB" strokeWidth={1} />;
        })}

        {model.priceLabels.map((label) => (
          <SvgText key={label.value} x={chartWidth - 4} y={label.y - 4} fill="#98A2B3" fontSize={10} textAnchor="end">
            {formatCurrency(label.value, currency)}
          </SvgText>
        ))}

        {model.candles.map((item) => (
          <React.Fragment key={`${item.index}-${item.x}`}>
            <Line x1={item.x} x2={item.x} y1={item.highY} y2={item.lowY} stroke={item.color} strokeWidth={1.4} />
            <Rect
              x={item.x - item.bodyWidth / 2}
              y={item.bodyTop}
              width={item.bodyWidth}
              height={Math.max(2, item.bodyHeight)}
              rx={1.5}
              fill={item.color}
            />
          </React.Fragment>
        ))}

        {visibleIndicators.bollinger && (
          <>
            <Polyline points={model.bbUpperPoints} fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinejoin="round" />
            <Polyline points={model.bbLowerPoints} fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinejoin="round" />
          </>
        )}
        {visibleIndicators.sma && (
          <>
            <Polyline points={model.ma5Points} fill="none" stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" />
            <Polyline points={model.ma20Points} fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinejoin="round" />
          </>
        )}
        {visibleIndicators.ema && (
          <Polyline points={model.ema20Points} fill="none" stroke="#7C3AED" strokeWidth={2} strokeLinejoin="round" />
        )}

        {visibleIndicators.volume &&
          model.volumes.map((item) => (
            <Rect
              key={`v-${item.index}`}
              x={item.x - item.width / 2}
              y={item.y}
              width={item.width}
              height={item.height}
              rx={1}
              fill={item.color}
              opacity={0.55}
            />
          ))}
        {!!selectedCandle && <Line x1={model.slot * (selectedIndex + 0.5)} x2={model.slot * (selectedIndex + 0.5)} y1={0} y2={priceHeight + volumeHeight} stroke="#172026" strokeWidth={1} strokeDasharray="3 3" />}
      </Svg>
      <Pressable accessibilityRole="button" accessibilityLabel="차트 캔들 선택"
        onPress={event => {
          const pointer = event.nativeEvent as typeof event.nativeEvent & { offsetX?: number };
          const index = Math.floor((pointer.locationX ?? pointer.offsetX ?? 0) / model.slot);
          if (Number.isFinite(index)) setSelected(Math.max(0, Math.min(count - 1, index)));
        }}
        style={StyleSheet.absoluteFill} />
      </View>
      {selectedCandle && <View style={styles.details} accessibilityLiveRegion="polite">
        <ChartTool name="chevron-back" label="이전 캔들 상세" disabled={selectedIndex === 0} onPress={() => setSelected(selectedIndex - 1)} />
        <ChartTool name="chevron-forward" label="다음 캔들 상세" disabled={selectedIndex >= count - 1} onPress={() => setSelected(selectedIndex + 1)} />
        <Text style={styles.detailText}>{candleTime(selectedCandle.time)}</Text>
        <Text style={styles.detailText}>시가 {formatCurrency(selectedCandle.open, currency)}</Text>
        <Text style={styles.detailText}>고가 {formatCurrency(selectedCandle.high, currency)}</Text>
        <Text style={styles.detailText}>저가 {formatCurrency(selectedCandle.low, currency)}</Text>
        <Text style={styles.detailText}>종가 {formatCurrency(selectedCandle.close, currency)}</Text>
        <Text style={styles.detailText}>거래량 {selectedCandle.volume.toLocaleString('ko-KR')}</Text>
      </View>}
    </View>
  );
}

function ChartTool({ name, label, disabled, onPress }: { name: React.ComponentProps<typeof Ionicons>['name']; label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    {...{ title: label }} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
    <Ionicons name={name} size={20} color="#172026" />
  </Pressable>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 8, minHeight: 48 },
  detailText: { color: '#344054', fontSize: 12 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  legend: {
    flexDirection: 'row',
    gap: 10,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legendText: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
  },
});

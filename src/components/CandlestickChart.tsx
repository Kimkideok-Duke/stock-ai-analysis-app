import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

const chartWidth = 344;
const priceHeight = 220;
const volumeHeight = 48;
const chartPadding = 18;

export function CandlestickChart({
  candles,
  currency,
  ma5,
  ma20,
  ema20,
  bollinger20,
  visibleIndicators,
}: CandlestickChartProps) {
  const model = useMemo(
    () => buildChartModel(candles, ma5, ma20, ema20, bollinger20),
    [bollinger20, candles, ema20, ma5, ma20],
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

      <Svg width="100%" height={priceHeight + volumeHeight} viewBox={`0 0 ${chartWidth} ${priceHeight + volumeHeight}`}>
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
      </Svg>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function buildChartModel(
  candles: Candle[],
  ma5: number[],
  ma20: number[],
  ema20: number[],
  bollinger20: BollingerBandPoint[],
) {
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const bandHighs = bollinger20.map((band) => band.upper);
  const bandLows = bollinger20.map((band) => band.lower);
  const volumes = candles.map((candle) => candle.volume);
  const maxPrice = Math.max(...highs, ...bandHighs);
  const minPrice = Math.min(...lows, ...bandLows);
  const maxVolume = Math.max(...volumes);
  const priceRange = Math.max(1, maxPrice - minPrice);
  const slot = chartWidth / candles.length;
  const bodyWidth = Math.max(4, Math.min(11, slot * 0.56));

  const yForPrice = (price: number) =>
    chartPadding + ((maxPrice - price) / priceRange) * (priceHeight - chartPadding * 2);
  const xForIndex = (index: number) => slot * index + slot / 2;

  return {
    candles: candles.map((candle, index) => {
      const openY = yForPrice(candle.open);
      const closeY = yForPrice(candle.close);
      const rising = candle.close >= candle.open;
      return {
        index,
        x: xForIndex(index),
        highY: yForPrice(candle.high),
        lowY: yForPrice(candle.low),
        bodyTop: Math.min(openY, closeY),
        bodyHeight: Math.abs(openY - closeY),
        bodyWidth,
        color: rising ? '#0F9F6E' : '#E11D48',
      };
    }),
    ma5Points: ma5.map((price, index) => `${xForIndex(index)},${yForPrice(price)}`).join(' '),
    ma20Points: ma20.map((price, index) => `${xForIndex(index)},${yForPrice(price)}`).join(' '),
    ema20Points: ema20.map((price, index) => `${xForIndex(index)},${yForPrice(price)}`).join(' '),
    bbUpperPoints: bollinger20.map((band, index) => `${xForIndex(index)},${yForPrice(band.upper)}`).join(' '),
    bbLowerPoints: bollinger20.map((band, index) => `${xForIndex(index)},${yForPrice(band.lower)}`).join(' '),
    priceLabels: [maxPrice, minPrice + priceRange / 2, minPrice].map((value) => ({
      value,
      y: yForPrice(value),
    })),
    volumes: candles.map((candle, index) => {
      const height = Math.max(3, (candle.volume / maxVolume) * (volumeHeight - 8));
      const rising = candle.close >= candle.open;
      return {
        index,
        x: xForIndex(index),
        y: priceHeight + volumeHeight - height,
        width: Math.max(3, bodyWidth),
        height,
        color: rising ? '#0F9F6E' : '#E11D48',
      };
    }),
  };
}

const styles = StyleSheet.create({
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

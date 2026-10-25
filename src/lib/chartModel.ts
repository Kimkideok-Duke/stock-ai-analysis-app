import type { Candle } from '../data/mockMarket';
import type { BollingerBandPoint } from './indicators';
const chartPadding = 18;
const priceHeight = 220;
const volumeHeight = 48;

export function buildChartModel(
  candles: Candle[],
  ma5: number[],
  ma20: number[],
  ema20: number[],
  bollinger20: BollingerBandPoint[],
  width = 344,
) {
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const bandHighs = bollinger20.map((band) => band.upper);
  const bandLows = bollinger20.map((band) => band.lower);
  const volumes = candles.map((candle) => candle.volume);
  const overlays = [...ma5, ...ma20, ...ema20].filter(Number.isFinite);
  const prices = [...highs, ...lows, ...bandHighs, ...bandLows, ...overlays].filter(Number.isFinite);
  const upper = prices.length ? Math.max(...prices) : 1;
  const lower = prices.length ? Math.min(...prices) : 0;
  const padding = Math.max((upper - lower) * 0.04, Math.abs(upper) * 0.001, Number.EPSILON);
  const maxPrice = upper + padding;
  const minPrice = lower - padding;
  const maxVolume = Math.max(1, ...volumes);
  const priceRange = Math.max(Number.EPSILON, maxPrice - minPrice);
  const slot = Math.max(1, width - 68) / Math.max(1, candles.length);
  const bodyWidth = Math.max(0.5, Math.min(11, slot * 0.56));

  const yForPrice = (price: number) =>
    chartPadding + ((maxPrice - price) / priceRange) * (priceHeight - chartPadding * 2);
  const xForIndex = (index: number) => slot * index + slot / 2;

  return {
    slot,
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
      const height = candle.volume === 0 ? 0 : Math.max(1, (candle.volume / maxVolume) * (volumeHeight - 8));
      const rising = candle.close >= candle.open;
      return {
        index,
        x: xForIndex(index),
        y: priceHeight + volumeHeight - height,
        width: bodyWidth,
        height,
        color: rising ? '#0F9F6E' : '#E11D48',
      };
    }),
  };
}

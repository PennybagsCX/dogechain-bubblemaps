/**
 * Technical Indicators Utilities
 *
 * Implements common technical analysis indicators:
 * - Simple Moving Average (SMA)
 * - Exponential Moving Average (EMA)
 * - Relative Strength Index (RSI)
 * - Moving Average Convergence Divergence (MACD)
 * - Bollinger Bands
 */

export interface PriceDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
}

export interface IndicatorResult {
  timestamp: number;
  value: number;
  signal?: "buy" | "sell" | "neutral";
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }

  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for first value
  let ema: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    if (ema === null) {
      // Calculate initial SMA
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      ema = sum / period;
    } else {
      const currentValue = data[i];
      if (currentValue !== undefined) {
        ema = (currentValue - ema) * multiplier + ema;
      }
    }

    result.push(ema);
  }

  return result;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const changes: number[] = [];

  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const current = data[i];
    const previous = data[i - 1];
    if (current !== undefined && previous !== undefined) {
      changes.push(current - previous);
    }
  }

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < changes.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    const change = changes[i];
    if (change === undefined) {
      result.push(null);
      continue;
    }

    if (i === period - 1) {
      // First RSI value - use simple average
      const gains = changes.slice(i - period + 1, i + 1).filter((c) => c > 0);
      const losses = changes
        .slice(i - period + 1, i + 1)
        .filter((c) => c < 0)
        .map((c) => Math.abs(c));

      avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
      avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
    } else {
      // Subsequent values - use smoothed average
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      result.push(rsi);
    }
  }

  // Add null for first value
  result.unshift(null);

  return result;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export interface MACDResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine: (number | null)[] = [];

  // Calculate MACD line
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      const fast = fastEMA[i] as number;
      const slow = slowEMA[i] as number;
      macdLine.push(fast - slow);
    }
  }

  // Calculate Signal line (EMA of MACD)
  const signalLine = calculateEMA(
    macdLine.filter((v): v is number => v !== null),
    signalPeriod
  );

  // Combine results
  const result: MACDResult[] = [];
  let signalIdx = 0;

  for (let i = 0; i < data.length; i++) {
    const macd = macdLine[i];
    let signal: number | null = null;

    // Get corresponding signal value
    while (signalIdx < signalLine.length && signalIdx <= i) {
      const sigVal = signalLine[signalIdx];
      if (sigVal !== null && sigVal !== undefined) {
        signal = sigVal;
      }
      signalIdx++;
    }

    const histogram = macd !== null && macd !== undefined && signal !== null ? macd - signal : null;

    result.push({ macd: macd ?? null, signal, histogram });
  }

  return result;
}

/**
 * Calculate Bollinger Bands
 */
export interface BollingerBandsResult {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  bandwidth: number | null;
}

export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBandsResult[] {
  const sma = calculateSMA(data, period);
  const result: BollingerBandsResult[] = [];

  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null || i < period - 1) {
      result.push({ upper: null, middle: null, lower: null, bandwidth: null });
      continue;
    }

    // Calculate standard deviation
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i] as number;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = mean + stdDevMultiplier * stdDev;
    const lower = mean - stdDevMultiplier * stdDev;
    const bandwidth = mean !== 0 ? ((upper - lower) / mean) * 100 : 0;

    result.push({ upper, middle: mean, lower, bandwidth });
  }

  return result;
}

/**
 * Calculate Volume Profile
 */
export interface VolumeProfileBucket {
  priceRange: [number, number];
  volume: number;
  percentage: number;
}

export function calculateVolumeProfile(
  data: PriceDataPoint[],
  buckets: number = 50
): VolumeProfileBucket[] {
  if (data.length === 0) return [];

  // Find price range
  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const bucketSize = priceRange / buckets;

  // Initialize buckets
  const volumeBuckets: { [key: string]: number } = {};

  for (let i = 0; i < buckets; i++) {
    const bucketMin = minPrice + i * bucketSize;
    const bucketMax = bucketMin + bucketSize;
    const key = `${bucketMin.toFixed(8)}-${bucketMax.toFixed(8)}`;
    volumeBuckets[key] = 0;
  }

  // Distribute volume into buckets
  let totalVolume = 0;
  for (const point of data) {
    if (point.volume === undefined) continue;

    const bucketIndex = Math.floor((point.price - minPrice) / bucketSize);
    const bucketMin = minPrice + bucketIndex * bucketSize;
    const bucketMax = bucketMin + bucketSize;
    const key = `${bucketMin.toFixed(8)}-${bucketMax.toFixed(8)}`;

    if (volumeBuckets[key] !== undefined) {
      volumeBuckets[key] += point.volume;
      totalVolume += point.volume;
    }
  }

  // Convert to array with percentages
  const result: VolumeProfileBucket[] = [];

  for (let i = 0; i < buckets; i++) {
    const bucketMin = minPrice + i * bucketSize;
    const bucketMax = bucketMin + bucketSize;
    const key = `${bucketMin.toFixed(8)}-${bucketMax.toFixed(8)}`;
    const volume = volumeBuckets[key] || 0;
    const percentage = totalVolume > 0 ? (volume / totalVolume) * 100 : 0;

    result.push({
      priceRange: [bucketMin, bucketMax],
      volume,
      percentage,
    });
  }

  return result.sort((a, b) => b.volume - a.volume);
}

/**
 * Generate trading signals based on indicators
 */
export function generateTradingSignals(data: {
  price: number;
  rsi?: number;
  macd?: { macd: number | null; signal: number | null };
  bollingerBands?: { upper: number | null; lower: number | null; middle: number | null };
}): "buy" | "sell" | "neutral" {
  const signals: ("buy" | "sell" | "neutral")[] = [];

  // RSI signal
  if (data.rsi !== undefined) {
    if (data.rsi < 30) signals.push("buy");
    else if (data.rsi > 70) signals.push("sell");
    else signals.push("neutral");
  }

  // MACD signal
  if (data.macd && data.macd.macd !== null && data.macd.signal !== null) {
    if (data.macd.macd > data.macd.signal) signals.push("buy");
    else if (data.macd.macd < data.macd.signal) signals.push("sell");
    else signals.push("neutral");
  }

  // Bollinger Bands signal
  if (
    data.bollingerBands &&
    data.bollingerBands.upper !== null &&
    data.bollingerBands.lower !== null
  ) {
    if (data.price < data.bollingerBands.lower) signals.push("buy");
    else if (data.price > data.bollingerBands.upper) signals.push("sell");
    else signals.push("neutral");
  }

  // Consensus: if most signals agree, use that; otherwise neutral
  const buyCount = signals.filter((s) => s === "buy").length;
  const sellCount = signals.filter((s) => s === "sell").length;

  if (buyCount > sellCount) return "buy";
  if (sellCount > buyCount) return "sell";
  return "neutral";
}

/**
 * Calculate all indicators for a dataset
 */
export interface AllIndicators {
  sma20: (number | null)[];
  sma50: (number | null)[];
  ema12: (number | null)[];
  ema26: (number | null)[];
  rsi: (number | null)[];
  macd: MACDResult[];
  bollingerBands: BollingerBandsResult[];
}

export function calculateAllIndicators(prices: number[]): AllIndicators {
  return {
    sma20: calculateSMA(prices, 20),
    sma50: calculateSMA(prices, 50),
    ema12: calculateEMA(prices, 12),
    ema26: calculateEMA(prices, 26),
    rsi: calculateRSI(prices, 14),
    macd: calculateMACD(prices),
    bollingerBands: calculateBollingerBands(prices),
  };
}

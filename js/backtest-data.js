// SwaGGa HQ — Backtesting Candlestick Data Engine
// Contains pre-loaded historical challenges and the Synthetic SMC candle generator.

// --- Historical Session Challenges ---
export const HISTORICAL_CHALLENGES = {
  'gold-nfp': {
    name: '🟡 Gold NFP Liquidity Sweep',
    asset: 'XAU/USD',
    initialBalance: 10000,
    description: 'Gold during Non-Farm Payroll volatility. Trade the massive liquidity sweeps and wait for the structural expansion.',
    candles: [
      { open: 2030.5, high: 2032.1, low: 2029.8, close: 2031.2 },
      { open: 2031.2, high: 2033.4, low: 2030.1, close: 2032.8 },
      { open: 2032.8, high: 2034.0, low: 2032.0, close: 2033.5 },
      { open: 2033.5, high: 2034.5, low: 2031.8, close: 2032.1 },
      { open: 2032.1, high: 2033.0, low: 2029.5, close: 2030.0 }, // accumulation range
      { open: 2030.0, high: 2031.5, low: 2028.9, close: 2030.8 },
      { open: 2030.8, high: 2032.0, low: 2029.2, close: 2030.1 },
      { open: 2030.1, high: 2032.5, low: 2029.9, close: 2031.9 },
      { open: 2031.9, high: 2033.0, low: 2030.8, close: 2031.0 },
      { open: 2031.0, high: 2032.2, low: 2029.5, close: 2030.5 },
      { open: 2030.5, high: 2031.8, low: 2029.0, close: 2031.1 },
      { open: 2031.1, high: 2032.5, low: 2030.0, close: 2030.9 }, // high of range is ~2034, low is ~2028.9
      { open: 2030.9, high: 2037.5, low: 2030.2, close: 2036.8 }, // MANIPULATION: massive sweep up to clear buyers
      { open: 2036.8, high: 2037.0, low: 2022.5, close: 2024.1 }, // SWEEP DOWN: sweeping sell stops below 2028.9
      { open: 2024.1, high: 2028.5, low: 2023.0, close: 2027.8 }, // strong rejection wick starting
      { open: 2027.8, high: 2034.9, low: 2027.0, close: 2034.1 }, // DISTRIBUTION: strong bullish expansion
      { open: 2034.1, high: 2039.2, low: 2033.8, close: 2038.5 }, // leaving FVG between 2028.5 and 2033.8
      { open: 2038.5, high: 2042.0, low: 2037.9, close: 2041.2 },
      { open: 2041.2, high: 2045.5, low: 2040.5, close: 2044.8 },
      { open: 2044.8, high: 2047.0, low: 2043.1, close: 2046.2 },
      { open: 2046.2, high: 2046.8, low: 2041.0, close: 2042.2 }, // brief retracement
      { open: 2042.2, high: 2043.5, low: 2036.5, close: 2038.0 }, // mitigates deep FVG/Order Block area
      { open: 2038.0, high: 2044.1, low: 2037.5, close: 2043.9 }, // support holds, continues up
      { open: 2043.9, high: 2048.5, low: 2043.0, close: 2047.9 },
      { open: 2047.9, high: 2051.8, low: 2047.5, close: 2050.2 },
      { open: 2050.2, high: 2054.0, low: 2049.8, close: 2053.1 },
      { open: 2053.1, high: 2056.5, low: 2052.5, close: 2055.9 },
      { open: 2055.9, high: 2057.2, low: 2054.0, close: 2054.8 },
      { open: 2054.8, high: 2056.0, low: 2051.5, close: 2052.2 },
      { open: 2052.2, high: 2053.9, low: 2049.0, close: 2050.1 },
    ],
  },
  'eurusd-london': {
    name: '🔵 EUR/USD London Judas Swing',
    asset: 'EUR/USD',
    initialBalance: 10000,
    description: 'Spot the London Session fakeout (Judas Swing) that sweeps Asian session liquidity before expanding toward the HTF bias.',
    candles: [
      { open: 1.0850, high: 1.0855, low: 1.0848, close: 1.0852 },
      { open: 1.0852, high: 1.0854, low: 1.0846, close: 1.0849 },
      { open: 1.0849, high: 1.0852, low: 1.0845, close: 1.0847 },
      { open: 1.0847, high: 1.0850, low: 1.0843, close: 1.0845 },
      { open: 1.0845, high: 1.0848, low: 1.0842, close: 1.0846 }, // Asian Range consolidation
      { open: 1.0846, high: 1.0849, low: 1.0844, close: 1.0848 },
      { open: 1.0848, high: 1.0851, low: 1.0846, close: 1.0849 },
      { open: 1.0849, high: 1.0853, low: 1.0847, close: 1.0851 },
      { open: 1.0851, high: 1.0854, low: 1.0849, close: 1.0850 },
      { open: 1.0850, high: 1.0852, low: 1.0844, close: 1.0846 },
      { open: 1.0846, high: 1.0849, low: 1.0843, close: 1.0847 }, // High: 1.0855, Low: 1.0842
      { open: 1.0847, high: 1.0868, low: 1.0845, close: 1.0864 }, // JUDAS SWING: rapid spike up sweeping Asian High
      { open: 1.0864, high: 1.0872, low: 1.0860, close: 1.0868 }, // Rejection top at 1.0872
      { open: 1.0868, high: 1.0870, low: 1.0838, close: 1.0842 }, // Major bearish drop sweeping sell stops
      { open: 1.0842, high: 1.0845, low: 1.0825, close: 1.0829 }, // Reaching HTF Daily Order Block at 1.0825
      { open: 1.0829, high: 1.0839, low: 1.0822, close: 1.0837 }, // Bullish CHOCH starting on LTF
      { open: 1.0837, high: 1.0852, low: 1.0835, close: 1.0850 }, // strong bullish displacement
      { open: 1.0850, high: 1.0864, low: 1.0848, close: 1.0861 },
      { open: 1.0861, high: 1.0875, low: 1.0859, close: 1.0873 },
      { open: 1.0873, high: 1.0888, low: 1.0871, close: 1.0884 },
      { open: 1.0884, high: 1.0890, low: 1.0880, close: 1.0882 }, // consolidation
      { open: 1.0882, high: 1.0885, low: 1.0865, close: 1.0870 }, // pull back into mitigation zone
      { open: 1.0870, high: 1.0889, low: 1.0868, close: 1.0885 },
      { open: 1.0885, high: 1.0905, low: 1.0883, close: 1.0901 },
      { open: 1.0901, high: 1.0915, low: 1.0899, close: 1.0912 },
    ],
  },
};

// --- Synthetic Price Action Generator ---
// Generates infinite realistic candles modeling SMC Accumulation-Manipulation-Distribution
export function generateSMCCandles(count = 50) {
  const candles = [];
  let currentPrice = 100.0;
  
  // Decide session direction randomly
  const trendDirection = Math.random() > 0.5 ? 1 : -1;
  const tick = () => (Math.random() - 0.5) * 0.4;
  const spread = 0.5;

  // Step 1: Accumulation (Sideways range for ~40% of the session)
  const accumCount = Math.floor(count * 0.35);
  const accumRange = { min: 99999, max: -99999 };

  for (let i = 0; i < accumCount; i++) {
    const change = tick() * 0.5;
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * spread;
    const low = Math.min(open, close) - Math.random() * spread;
    
    currentPrice = close;
    accumRange.min = Math.min(accumRange.min, low);
    accumRange.max = Math.max(accumRange.max, high);
    
    candles.push({ open, high, low, close });
  }

  // Step 2: Manipulation (Stop sweep - moves rapidly against final trend for ~10% of session)
  const manipCount = Math.floor(count * 0.1);
  const sweepTarget = trendDirection === 1 
    ? accumRange.min - (1.5 + Math.random() * 2) 
    : accumRange.max + (1.5 + Math.random() * 2);

  const startPrice = currentPrice;
  const step = (sweepTarget - startPrice) / manipCount;

  for (let i = 0; i < manipCount; i++) {
    const open = currentPrice;
    const close = startPrice + step * (i + 1);
    
    // Add realistic wicks to the manipulation
    const high = Math.max(open, close) + Math.random() * 0.3;
    const low = Math.min(open, close) - Math.random() * 0.3;
    
    currentPrice = close;
    candles.push({ open, high, low, close });
  }

  // Final candle of manipulation does the massive sweep rejection wick
  const finalManip = candles[candles.length - 1];
  if (trendDirection === 1) {
    finalManip.low = sweepTarget - 1.0; // long lower wick
  } else {
    finalManip.high = sweepTarget + 1.0; // long upper wick
  }

  // Step 3: Distribution (Fast structural breakout trend in main direction for ~40% of session)
  const distCount = Math.floor(count * 0.4);
  const targetTrendPrice = trendDirection === 1
    ? accumRange.max + (4.0 + Math.random() * 6.0)
    : accumRange.min - (4.0 + Math.random() * 6.0);

  const startDistPrice = currentPrice;
  const distStep = (targetTrendPrice - startDistPrice) / distCount;

  for (let i = 0; i < distCount; i++) {
    const open = currentPrice;
    const close = startDistPrice + distStep * (i + 1) + (Math.random() - 0.5) * 0.5;
    
    // Create clear displacement / small wicks for institutional order flow
    const high = Math.max(open, close) + Math.random() * 0.2;
    const low = Math.min(open, close) - Math.random() * 0.2;
    
    currentPrice = close;
    candles.push({ open, high, low, close });
  }

  // Step 4: Retracement / Mitigation (Last 15% retraces slightly to mitigate imbalances)
  const retraceCount = count - candles.length;
  const startRetracePrice = currentPrice;
  const retraceTarget = trendDirection === 1
    ? currentPrice - (targetTrendPrice - startDistPrice) * 0.35
    : currentPrice + (startDistPrice - targetTrendPrice) * 0.35;

  const retraceStep = (retraceTarget - startRetracePrice) / retraceCount;

  for (let i = 0; i < retraceCount; i++) {
    const open = currentPrice;
    const close = startRetracePrice + retraceStep * (i + 1) + (Math.random() - 0.5) * 0.3;
    const high = Math.max(open, close) + Math.random() * 0.4;
    const low = Math.min(open, close) - Math.random() * 0.4;
    
    currentPrice = close;
    candles.push({ open, high, low, close });
  }

  // Round values nicely to 2 decimals
  return candles.map(c => ({
    open: parseFloat(c.open.toFixed(2)),
    high: parseFloat(c.high.toFixed(2)),
    low: parseFloat(c.low.toFixed(2)),
    close: parseFloat(c.close.toFixed(2))
  }));
}

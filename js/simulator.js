/**
 * SwaGGa HQ — Trading Simulator Module
 * Built with premium canvas rendering, interactive risk corridors, and persistency.
 * SECURITY: Built strictly using document.createElement + textContent. No innerHTML.
 */

import storage from './storage.js';
import { formatCurrency, generateId, showNotificationToast } from './utils.js';
import { playSynthSound } from './audio.js';
import { addXP } from './xp.js';
import { saveTrade, getAssetConfig, createSpinnerInput } from './trading.js';

// --- Curated Scenario Data ---
const SIM_SCENARIOS = [
  {
    id: 'ep7-demand',
    title: 'Ep 7: Bullish Order Block Mitigation (Long)',
    asset: 'EUR/USD',
    description: 'An aggressive breakout left behind a powerful institutional Demand Zone (Order Block). Wait for the price to retrace and mitigate this zone before entering a long position.',
    optimalDirection: 'long',
    initialBalance: 10000,
    historyCount: 7, // Show first 7 candles initially
    zones: [
      { type: 'ob', name: '🛡️ Bullish Order Block (Demand Zone)', priceMin: 1.0815, priceMax: 1.0820, color: 'rgba(57, 255, 20, 0.04)', strokeColor: '#39ff14', startCandle: 2, endCandle: 9 }
    ],
    candles: [
      { open: 1.0820, high: 1.0828, low: 1.0818, close: 1.0825 }, // 1. Base consolidation
      { open: 1.0825, high: 1.0830, low: 1.0822, close: 1.0824 }, // 2. Inside bar
      { open: 1.0824, high: 1.0826, low: 1.0815, close: 1.0817 }, // 3. Minor sweep down (Order Block base)
      { open: 1.0817, high: 1.0848, low: 1.0816, close: 1.0844 }, // 4. Expansion Breakout (Ep 5 BOS!)
      { open: 1.0844, high: 1.0855, low: 1.0840, close: 1.0850 }, // 5. Expansion continues
      { open: 1.0850, high: 1.0858, low: 1.0845, close: 1.0852 }, // 6. High point reached
      { open: 1.0852, high: 1.0854, low: 1.0838, close: 1.0840 }, // 7. Retracement begins (CONTEXT ENDS HERE)
      { open: 1.0840, high: 1.0842, low: 1.0826, close: 1.0828 }, // 8. Tapping down towards Demand Zone
      { open: 1.0828, high: 1.0830, low: 1.0818, close: 1.0820 }, // 9. MITIGATION: Taps exactly into the Order Block (1.0815-1.0820)!
      { open: 1.0820, high: 1.0838, low: 1.0818, close: 1.0835 }, // 10. Rejection pin-bar forms (Trigger Entry!)
      { open: 1.0835, high: 1.0848, low: 1.0832, close: 1.0845 }, // 11. Bullish momentum returns
      { open: 1.0845, high: 1.0858, low: 1.0842, close: 1.0856 }, // 12. Retesting previous highs
      { open: 1.0856, high: 1.0872, low: 1.0854, close: 1.0868 }, // 13. Expanding upward
      { open: 1.0868, high: 1.0885, low: 1.0865, close: 1.0882 }, // 14. Target Take-Profit (1.0880) Tapped!
      { open: 1.0882, high: 1.0890, low: 1.0878, close: 1.0884 }, // 15. Safe exit expansion
    ]
  },
  {
    id: 'ep7-supply',
    title: 'Ep 7: Bearish Supply Zone Mitigation (Short)',
    asset: 'EUR/USD',
    description: 'An aggressive breakout to the downside left behind a powerful institutional Supply Zone (Bearish Order Block). Wait for the price to retrace and mitigate this zone before entering a short position.',
    optimalDirection: 'short',
    initialBalance: 10000,
    historyCount: 6,
    zones: [
      { type: 'ob', name: '🛡️ Bearish Order Block (Supply Zone)', priceMin: 1.0915, priceMax: 1.0922, color: 'rgba(255, 59, 59, 0.04)', strokeColor: '#ff3b3b', startCandle: 1, endCandle: 8 }
    ],
    candles: [
      { open: 1.0920, high: 1.0925, low: 1.0915, close: 1.0918 }, // 1. Base consolidation
      { open: 1.0918, high: 1.0922, low: 1.0912, close: 1.0921 }, // 2. Minor up wick sweep before drop
      { open: 1.0921, high: 1.0923, low: 1.0888, close: 1.0892 }, // 3. Bearish Displacement breakout (BOS!)
      { open: 1.0892, high: 1.0898, low: 1.0880, close: 1.0884 }, // 4. Expansion continues
      { open: 1.0884, high: 1.0890, low: 1.0878, close: 1.0880 }, // 5. Low consolidation (CONTEXT ENDS HERE)
      { open: 1.0880, high: 1.0892, low: 1.0876, close: 1.0890 }, // 6. Pullback commences
      { open: 1.0890, high: 1.0902, low: 1.0888, close: 1.0900 }, // 7. Drifting higher towards Supply Zone
      { open: 1.0900, high: 1.0922, low: 1.0896, close: 1.0918 }, // 8. MITIGATION: Taps directly into the Bearish OB (1.0915-1.0922)!
      { open: 1.0918, high: 1.0924, low: 1.0902, close: 1.0905 }, // 9. Bearish rejection pin-bar forms (Trigger Entry!)
      { open: 1.0905, high: 1.0912, low: 1.0885, close: 1.0888 }, // 10. Bearish momentum expands down
      { open: 1.0888, high: 1.0894, low: 1.0868, close: 1.0872 }, // 11. Breaching swing lows
      { open: 1.0872, high: 1.0878, low: 1.0845, close: 1.0848 }, // 12. Taps short Take Profit target at 1.0850!
      { open: 1.0848, high: 1.0855, low: 1.0842, close: 1.0845 }, // 13. Consolidation
    ]
  },
  {
    id: 'ep9-fvg',
    title: 'Ep 9: Bullish Fair Value Gap Retracement (Long)',
    asset: 'GBP/USD',
    description: 'A massive high-volume news candle created a prominent 3-bar Fair Value Gap (imbalance) on the M15 chart. Wait for price to pull back, fill the FVG inefficiency, and reverse in alignment with our HTF bias.',
    optimalDirection: 'long',
    initialBalance: 10000,
    historyCount: 6,
    zones: [
      { type: 'fvg', name: '🧩 Bullish Fair Value Gap (FVG)', priceMin: 1.2588, priceMax: 1.2630, color: 'rgba(0, 212, 255, 0.04)', strokeColor: '#00d4ff', startCandle: 2, endCandle: 8 }
    ],
    candles: [
      { open: 1.2580, high: 1.2590, low: 1.2578, close: 1.2585 }, // 1. Quiet pre-news range
      { open: 1.2585, high: 1.2588, low: 1.2572, close: 1.2574 }, // 2. Quiet down bar (Candle 1 of FVG)
      { open: 1.2574, high: 1.2648, low: 1.2572, close: 1.2642 }, // 3. News Expansion (Candle 2 - Imbalance!)
      { open: 1.2642, high: 1.2655, low: 1.2630, close: 1.2650 }, // 4. Extension high (Candle 3 - FVG established between 1.2588 and 1.2630)
      { open: 1.2650, high: 1.2652, low: 1.2625, close: 1.2628 }, // 5. Top consolidation begins (CONTEXT ENDS HERE)
      { open: 1.2628, high: 1.2635, low: 1.2612, close: 1.2616 }, // 6. Pullback commences
      { open: 1.2616, high: 1.2622, low: 1.2598, close: 1.2602 }, // 7. Price enters upper FVG corridor (50% equilibrium tap)
      { open: 1.2602, high: 1.2608, low: 1.2586, close: 1.2590 }, // 8. FULL FVG FILL: Deep tap into the FVG imbalance zone!
      { open: 1.2590, high: 1.2615, low: 1.2582, close: 1.2612 }, // 9. Immediate rejection and strong close back up (Trigger entry!)
      { open: 1.2612, high: 1.2638, low: 1.2608, close: 1.2632 }, // 10. Secondary expansion
      { open: 1.2632, high: 1.2655, low: 1.2628, close: 1.2650 }, // 11. Retesting the highs
      { open: 1.2650, high: 1.2682, low: 1.2645, close: 1.2678 }, // 12. Full structural expansion to TP (1.2670) target!
      { open: 1.2678, high: 1.2688, low: 1.2665, close: 1.2670 }, // 13. High consolidation
    ]
  },
  {
    id: 'ep9-bearish-fvg',
    title: 'Ep 9: Bearish Fair Value Gap Retracement (Short)',
    asset: 'GBP/USD',
    description: 'A high-volume news event caused an aggressive bearish expansion, creating a prominent M15 Fair Value Gap (imbalance) pointing downwards. Wait for price to retrace, fill the FVG inefficiency, and reverse.',
    optimalDirection: 'short',
    initialBalance: 10000,
    historyCount: 6,
    zones: [
      { type: 'fvg', name: '🧩 Bearish Fair Value Gap (FVG)', priceMin: 1.2605, priceMax: 1.2645, color: 'rgba(0, 212, 255, 0.04)', strokeColor: '#00d4ff', startCandle: 2, endCandle: 8 }
    ],
    candles: [
      { open: 1.2650, high: 1.2658, low: 1.2642, close: 1.2648 }, // 1. Quiet pre-news range
      { open: 1.2648, high: 1.2655, low: 1.2645, close: 1.2652 }, // 2. Quiet up bar (Candle 1 of FVG)
      { open: 1.2652, high: 1.2655, low: 1.2585, close: 1.2590 }, // 3. News Bearish Expansion - Candle 2
      { open: 1.2590, high: 1.2605, low: 1.2575, close: 1.2580 }, // 4. News extension - Candle 3, FVG open between 1.2645 and 1.2605
      { open: 1.2580, high: 1.2592, low: 1.2572, close: 1.2590 }, // 5. Bottom consolidation (CONTEXT ENDS HERE)
      { open: 1.2590, high: 1.2612, low: 1.2588, close: 1.2610 }, // 6. Pullback commences
      { open: 1.2610, high: 1.2628, low: 1.2602, close: 1.2625 }, // 7. Enters FVG upper boundary
      { open: 1.2625, high: 1.2642, low: 1.2615, close: 1.2638 }, // 8. FULL FVG FILL: Deep tap into FVG imbalance!
      { open: 1.2638, high: 1.2645, low: 1.2610, close: 1.2614 }, // 9. Immediate bearish rejection close (Trigger Entry!)
      { open: 1.2614, high: 1.2620, low: 1.2588, close: 1.2592 }, // 10. Re-expansion down
      { open: 1.2592, high: 1.2600, low: 1.2562, close: 1.2566 }, // 11. Breaching lows
      { open: 1.2566, high: 1.2572, low: 1.2542, close: 1.2546 }, // 12. Hits short Take Profit target at 1.2550!
      { open: 1.2546, high: 1.2552, low: 1.2540, close: 1.2542 }, // 13. Consolidation
    ]
  },
  {
    id: 'ep14-flip',
    title: 'Ep 14: Failed Zone & Flip Zone Mitigation (Long)',
    asset: 'USD/CAD',
    description: 'An aggressive bearish supply zone was broken through with massive momentum, flipping it into a highly active Demand Zone. Watch for a retracement to mitigate the Flip Zone boundary before timing a high-R long entry.',
    optimalDirection: 'long',
    initialBalance: 10000,
    historyCount: 7,
    zones: [
      { type: 'flip', name: '🔁 Broken Supply ➔ Demand Flip Zone', priceMin: 1.3665, priceMax: 1.3672, color: 'rgba(168, 85, 247, 0.04)', strokeColor: '#a855f7', startCandle: 3, endCandle: 8 }
    ],
    candles: [
      { open: 1.3650, high: 1.3665, low: 1.3648, close: 1.3660 }, // 1. Bullish approach
      { open: 1.3660, high: 1.3672, low: 1.3655, close: 1.3670 }, // 2. Taps into supply zone
      { open: 1.3670, high: 1.3675, low: 1.3645, close: 1.3648 }, // 3. Rejection from supply zone (Down candle)
      { open: 1.3648, high: 1.3695, low: 1.3642, close: 1.3690 }, // 4. Supply Broken! Impulsive displacement upward (Flip Zone established at 1.3670!)
      { open: 1.3690, high: 1.3705, low: 1.3685, close: 1.3700 }, // 5. Expansion continues
      { open: 1.3700, high: 1.3708, low: 1.3690, close: 1.3694 }, // 6. Profit taking consolidation
      { open: 1.3694, high: 1.3698, low: 1.3678, close: 1.3680 }, // 7. Retracement begins (CONTEXT ENDS HERE)
      { open: 1.3680, high: 1.3682, low: 1.3668, close: 1.3672 }, // 8. MITIGATION: Retests the exact broken supply flip boundary!
      { open: 1.3672, high: 1.3688, low: 1.3666, close: 1.3684 }, // 9. Bullish rejection wick engulfing forms!
      { open: 1.3684, high: 1.3698, low: 1.3680, close: 1.3695 }, // 10. Re-expansion
      { open: 1.3695, high: 1.3712, low: 1.3692, close: 1.3708 }, // 11. Breaching local swing high structure
      { open: 1.3708, high: 1.3725, low: 1.3702, close: 1.3722 }, // 12. Rises strongly to our TP (1.3720) target!
      { open: 1.3722, high: 1.3730, low: 1.3715, close: 1.3720 }, // 13. Consolidation
    ]
  },
  {
    id: 'ep14-bearish-flip',
    title: 'Ep 14: Failed Zone & Flip Zone Mitigation (Short)',
    asset: 'USD/CAD',
    description: 'An aggressive bullish demand zone was broken through with high momentum, flipping it into an active Bearish Supply (Flip Zone). Wait for price to pull back to mitigate the flip zone boundary before entering a short position.',
    optimalDirection: 'short',
    initialBalance: 10000,
    historyCount: 6,
    zones: [
      { type: 'flip', name: '🔁 Broken Demand ➔ Supply Flip Zone', priceMin: 1.3750, priceMax: 1.3758, color: 'rgba(168, 85, 247, 0.04)', strokeColor: '#a855f7', startCandle: 2, endCandle: 8 }
    ],
    candles: [
      { open: 1.3750, high: 1.3762, low: 1.3748, close: 1.3758 }, // 1. Bullish approach
      { open: 1.3758, high: 1.3768, low: 1.3752, close: 1.3765 }, // 2. Demand zone established
      { open: 1.3765, high: 1.3768, low: 1.3732, close: 1.3736 }, // 3. Aggressive bearish break - Demand fails!
      { open: 1.3736, high: 1.3742, low: 1.3715, close: 1.3720 }, // 4. Expansion down - Flip zone boundary established at 1.3755
      { open: 1.3720, high: 1.3728, low: 1.3712, close: 1.3724 }, // 5. Consolidation (CONTEXT ENDS HERE)
      { open: 1.3724, high: 1.3738, low: 1.3720, close: 1.3735 }, // 6. Retracement begins
      { open: 1.3735, high: 1.3748, low: 1.3730, close: 1.3746 }, // 7. Pullback continues
      { open: 1.3746, high: 1.3758, low: 1.3742, close: 1.3754 }, // 8. MITIGATION: Price taps the failed demand Flip boundary at 1.3755!
      { open: 1.3754, high: 1.3760, low: 1.3738, close: 1.3740 }, // 9. Bearish rejection candle forms (Trigger Entry!)
      { open: 1.3740, high: 1.3746, low: 1.3718, close: 1.3722 }, // 10. Expanding down
      { open: 1.3722, high: 1.3728, low: 1.3695, close: 1.3698 }, // 11. Aggressive structural break
      { open: 1.3698, high: 1.3704, low: 1.3675, close: 1.3678 }, // 12. Hits short Take Profit target at 1.3680!
      { open: 1.3678, high: 1.3685, low: 1.3672, close: 1.3674 }, // 13. Consolidation
    ]
  },
  {
    id: 'ep12-judas-swing',
    title: 'Ep 12: London Judas Swing (Short)',
    asset: 'GBP/USD',
    description: 'Enforce session timing discipline. During London Open, price often runs a fake stop-hunt breakout (Judas Swing) above the Asian Session High to sweep liquidity. Identify the sweep and enter a high-probability short when the rejection candle prints.',
    optimalDirection: 'short',
    initialBalance: 10000,
    historyCount: 6,
    zones: [
      { type: 'liquidity', name: '⚡ Asian Session High Liquidity Pool', priceMin: 1.2528, priceMax: 1.2532, color: 'rgba(255, 71, 87, 0.04)', strokeColor: '#ff4757', startCandle: 1, endCandle: 7 }
    ],
    candles: [
      { open: 1.2520, high: 1.2525, low: 1.2515, close: 1.2522 }, // 1. Asian session consolidation
      { open: 1.2522, high: 1.2528, low: 1.2518, close: 1.2525 }, // 2. Asian High forms at 1.2528
      { open: 1.2525, high: 1.2526, low: 1.2516, close: 1.2520 }, // 3. Minor range
      { open: 1.2520, high: 1.2522, low: 1.2512, close: 1.2515 }, // 4. Asian Low forms at 1.2512
      { open: 1.2515, high: 1.2518, low: 1.2514, close: 1.2516 }, // 5. Range bound
      { open: 1.2516, high: 1.2524, low: 1.2515, close: 1.2522 }, // 6. London open approaches (CONTEXT ENDS HERE)
      { open: 1.2522, high: 1.2542, low: 1.2520, close: 1.2540 }, // 7. JUDAS SWING: Impulsive run sweeping Asian High stops!
      { open: 1.2540, high: 1.2545, low: 1.2525, close: 1.2528 }, // 8. MITIGATION / REJECTION: Strong sweep wick, closes back below Asian High (Trigger entry!)
      { open: 1.2528, high: 1.2530, low: 1.2505, close: 1.2508 }, // 9. Aggressive displacement down
      { open: 1.2508, high: 1.2512, low: 1.2492, close: 1.2495 }, // 10. Breaking structure
      { open: 1.2495, high: 1.2500, low: 1.2482, close: 1.2484 }, // 11. Expansion to Take Profit target at 1.2485!
      { open: 1.2484, high: 1.2490, low: 1.2480, close: 1.2482 }, // 12. Consolidation
    ]
  }
];

// --- Simulator State Manager ---
let _activeScenario = null;
let _visibleCandles = [];
let _historyIndex = 0;
let _simBalance = 10000;
let _activePosition = null; // { direction, entry, size, sl, tp, openIndex }
let _autoPlayInterval = null;
let _tradeLog = [];
let _objectiveListEl = null;
let _lastResolvedTrade = null;

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

// createSpinnerInput is imported from trading.js to avoid duplication


export function renderSimulatorPage(container) {
  container.replaceChildren();

  // Bug #9 fix: Clear any ghost auto-play interval from previous visits
  if (_autoPlayInterval) {
    clearInterval(_autoPlayInterval);
    _autoPlayInterval = null;
  }
  _activePosition = null;

  // Load persistent simulator ledger
  _simBalance = storage.get('sim_balance', 10000);
  _tradeLog = storage.get('sim_trade_log', []);

  // Header Title
  const pageHeader = el('div', 'page-header');
  pageHeader.appendChild(el('h1', 'page-title', '🎮 SMC / ICT Smart Replay Simulator'));
  container.appendChild(pageHeader);

  // Main columns
  const layout = el('div', 'sim-layout');
  layout.style.display = 'grid';
  layout.style.gridTemplateColumns = '300px 1fr';
  layout.style.gap = 'var(--space-6)';

  // Left Column: Control Dashboard panel
  const controlPanel = el('div', 'overview-panel sim-controls');
  controlPanel.style.display = 'flex';
  controlPanel.style.flexDirection = 'column';
  controlPanel.style.gap = 'var(--space-4)';
  controlPanel.style.alignSelf = 'start';
  layout.appendChild(controlPanel);

  // Right Column: Workspace containing Canvas & Timeline controls
  const workspace = el('div', 'sim-workspace');
  workspace.style.display = 'flex';
  workspace.style.flexDirection = 'column';
  workspace.style.gap = 'var(--space-4)';
  layout.appendChild(workspace);

  // --- Beginner Quick Start Guide Card ---
  const guideCard = el('div', 'overview-panel sim-guide-card glass-card');
  guideCard.style.padding = 'var(--space-4)';
  guideCard.style.border = '1px solid rgba(168, 85, 247, 0.15)';
  
  const guideHeader = el('div', '');
  guideHeader.style.display = 'flex';
  guideHeader.style.justifyContent = 'space-between';
  guideHeader.style.alignItems = 'center';
  guideHeader.style.cursor = 'pointer';

  const guideTitle = el('h4', '', '📖 How to Play Guide (Beginner Friendly)');
  guideTitle.style.fontSize = 'var(--text-sm)';
  guideTitle.style.fontFamily = 'var(--font-heading)';
  guideTitle.style.fontWeight = '700';
  guideTitle.style.color = 'var(--purple)';
  guideHeader.appendChild(guideTitle);

  const toggleIcon = el('span', '', '▼');
  toggleIcon.style.fontSize = '12px';
  toggleIcon.style.color = 'var(--text-muted)';
  guideHeader.appendChild(toggleIcon);
  guideCard.appendChild(guideHeader);

  const guideBody = el('div', 'sim-guide-body');
  const seenGuide = storage.get('sim_guide_seen', false);
  if (!seenGuide) {
    guideBody.style.display = 'block';
    toggleIcon.textContent = '▲';
  } else {
    guideBody.style.display = 'none';
  }
  guideBody.style.marginTop = 'var(--space-3)';
  guideBody.style.borderTop = '1px solid rgba(255,255,255,0.06)';
  guideBody.style.paddingTop = 'var(--space-3)';

  const stepsList = el('ol', '');
  stepsList.style.paddingLeft = 'var(--space-4)';
  stepsList.style.display = 'flex';
  stepsList.style.flexDirection = 'column';
  stepsList.style.gap = 'var(--space-2)';
  stepsList.style.fontSize = 'var(--text-xs)';
  stepsList.style.color = 'var(--text-secondary)';
  stepsList.style.lineHeight = '1.5';

  const steps = [
    'Choose a curriculum scenario from the dropdown on the left and read the details description box.',
    'Click "Step Candle" or "Auto Play" to watch historical candles print candle-by-candle on the vector chart.',
    'Set your Stop Loss and Take Profit prices in the control panel to see the red/green risk corridors adjust on the chart.',
    'When price taps into your zone and prints a rejection candle, click "Buy Long" or "Sell Short" to open a virtual trade.',
    'Auto-play or step through to resolution—the game will automatically count your simulated Win/Loss stats!'
  ];

  steps.forEach(stepText => {
    const li = el('li', '', stepText);
    stepsList.appendChild(li);
  });
  guideBody.appendChild(stepsList);
  guideCard.appendChild(guideBody);

  guideHeader.addEventListener('click', () => {
    const isCollapsed = guideBody.style.display === 'none';
    guideBody.style.display = isCollapsed ? 'block' : 'none';
    toggleIcon.textContent = isCollapsed ? '▲' : '▼';
    storage.set('sim_guide_seen', true);
    playSynthSound('click');
  });

  workspace.appendChild(guideCard);

  container.appendChild(layout);

  // --- Populate Control Panel Panels ---

  // 1. Scenario Selection
  const selectGroup = el('div', 'form-group');
  selectGroup.appendChild(el('label', 'form-label', 'SELECT SCENARIO'));
  const scSelect = document.createElement('select');
  scSelect.className = 'form-select';
  SIM_SCENARIOS.forEach(sc => {
    const opt = el('option', '', sc.title);
    opt.value = sc.id;
    scSelect.appendChild(opt);
  });
  selectGroup.appendChild(scSelect);
  controlPanel.appendChild(selectGroup);

  // Scenario description box
  const descBox = el('div', 'sim-desc-box glass-card');
  descBox.style.padding = 'var(--space-3)';
  descBox.style.borderRadius = 'var(--radius-md)';
  descBox.style.background = 'rgba(255,255,255,0.02)';
  descBox.style.border = '1px solid rgba(255,255,255,0.04)';
  
  const descLabel = el('span', 'sim-desc-label', 'SCENARIO DETAILS');
  descLabel.style.fontSize = '9px';
  descLabel.style.fontWeight = '700';
  descLabel.style.color = 'var(--cyan)';
  descLabel.style.display = 'block';
  descLabel.style.marginBottom = '4px';
  descBox.appendChild(descLabel);
  
  const descText = el('p', 'sim-desc-text', '');
  descText.style.fontSize = 'var(--text-xs)';
  descText.style.color = 'var(--text-secondary)';
  descText.style.lineHeight = '1.4';
  descBox.appendChild(descText);
  controlPanel.appendChild(descBox);

  // 1.5 Objectives Stepper Checklist Card
  const objectiveBox = el('div', 'sim-objective-box glass-card');
  objectiveBox.style.padding = 'var(--space-4)';
  objectiveBox.style.border = '1px solid rgba(57, 255, 20, 0.15)'; // subtle green neon
  objectiveBox.style.background = 'rgba(255, 255, 255, 0.01)';
  
  const objTitle = el('h4', '', '🎯 Mission Objectives');
  objTitle.style.fontSize = 'var(--text-xs)';
  objTitle.style.fontWeight = '800';
  objTitle.style.color = 'var(--neon-green)';
  objTitle.style.marginBottom = 'var(--space-2)';
  objTitle.style.fontFamily = 'var(--font-heading)';
  objTitle.style.textTransform = 'uppercase';
  objTitle.style.letterSpacing = '0.05em';
  objectiveBox.appendChild(objTitle);
  
  _objectiveListEl = el('div', 'sim-objective-list');
  _objectiveListEl.style.display = 'flex';
  _objectiveListEl.style.flexDirection = 'column';
  _objectiveListEl.style.gap = 'var(--space-2)';
  objectiveBox.appendChild(_objectiveListEl);
  controlPanel.appendChild(objectiveBox);

  // 2. Simulated Account stats
  const statsBox = el('div', 'sim-stats-box glass-card');
  statsBox.style.padding = 'var(--space-4)';
  statsBox.style.border = '1px solid rgba(0, 212, 255, 0.1)';
  
  const balRow = el('div', '');
  balRow.style.display = 'flex';
  balRow.style.justifyContent = 'space-between';
  balRow.style.marginBottom = 'var(--space-2)';
  balRow.appendChild(el('span', 'sim-stat-lbl', 'Sim Balance:'));
  const balVal = el('span', 'sim-stat-val val-high', formatCurrency(_simBalance));
  balVal.style.fontWeight = '700';
  balRow.appendChild(balVal);
  statsBox.appendChild(balRow);

  const statsRow = el('div', '');
  statsRow.style.display = 'flex';
  statsRow.style.justifyContent = 'space-between';
  statsRow.style.fontSize = 'var(--text-xs)';
  statsRow.style.color = 'var(--text-muted)';
  
  const wins = _tradeLog.filter(t => t.outcome === 'win').length;
  const totalSim = _tradeLog.length;
  const winRateSim = totalSim > 0 ? Math.round((wins / totalSim) * 100) : 0;
  
  statsRow.appendChild(el('span', '', `Sim Win Rate: ${winRateSim}%`));
  statsRow.appendChild(el('span', '', `Sim Trades: ${totalSim}`));
  statsBox.appendChild(statsRow);
  controlPanel.appendChild(statsBox);

  // 3. Active Position Info
  const posBox = el('div', 'sim-pos-box glass-card');
  posBox.style.padding = 'var(--space-4)';
  posBox.style.background = 'rgba(255, 255, 255, 0.01)';
  posBox.style.border = '1px solid rgba(255,255,255,0.06)';
  
  const posTitle = el('h4', 'sim-pos-title', 'Active Position');
  posTitle.style.fontSize = 'var(--text-xs)';
  posTitle.style.marginBottom = 'var(--space-3)';
  posTitle.style.color = 'var(--text-primary)';
  posBox.appendChild(posTitle);

  const posDetails = el('div', 'sim-pos-details');
  posDetails.appendChild(el('p', 'sim-pos-empty', 'No active positions. Set SL/TP below and Buy/Sell to trigger!'));
  posDetails.querySelector('.sim-pos-empty').style.fontSize = 'var(--text-xs)';
  posDetails.querySelector('.sim-pos-empty').style.color = 'var(--text-muted)';
  posBox.appendChild(posDetails);
  controlPanel.appendChild(posBox);

  // 4. Position parameters adjustment sliders
  const paramBox = el('div', 'sim-params-box');
  paramBox.style.display = 'flex';
  paramBox.style.flexDirection = 'column';
  paramBox.style.gap = 'var(--space-3)';

  // SMC Indicator Overlay Toggle
  const indicatorGroup = el('div', 'form-group');
  indicatorGroup.style.display = 'flex';
  indicatorGroup.style.alignItems = 'center';
  indicatorGroup.style.gap = 'var(--space-2)';
  indicatorGroup.style.background = 'rgba(0, 212, 255, 0.03)';
  indicatorGroup.style.border = '1px solid rgba(0, 212, 255, 0.1)';
  indicatorGroup.style.padding = 'var(--space-2) var(--space-3)';
  indicatorGroup.style.borderRadius = 'var(--radius-md)';
  indicatorGroup.style.marginTop = 'var(--space-1)';
  indicatorGroup.style.marginBottom = 'var(--space-1)';

  const indicatorToggle = document.createElement('input');
  indicatorToggle.type = 'checkbox';
  indicatorToggle.id = 'sim-indicator-toggle';
  indicatorToggle.checked = storage.get('sim_indicator_enabled', true);
  indicatorToggle.addEventListener('change', () => {
    storage.set('sim_indicator_enabled', indicatorToggle.checked);
    drawChart();
  });
  
  const indicatorLabel = el('label', 'form-label', '🔌 SMC Indicator Overlays');
  indicatorLabel.setAttribute('for', 'sim-indicator-toggle');
  indicatorLabel.style.margin = '0';
  indicatorLabel.style.cursor = 'pointer';
  indicatorLabel.style.fontSize = 'var(--text-xs)';
  indicatorLabel.style.fontWeight = '700';

  indicatorGroup.appendChild(indicatorToggle);
  indicatorGroup.appendChild(indicatorLabel);
  paramBox.appendChild(indicatorGroup);

  const getSimAssetConfig = () => {
    const assetName = _activeScenario ? _activeScenario.asset : 'EUR/USD';
    return getAssetConfig(assetName);
  };

  const slGroup = el('div', 'form-group');
  slGroup.appendChild(el('label', 'form-label', '🎯 Stop Loss Level'));
  const slSpinner = createSpinnerInput('stop-loss', '0.0000', '', false, getSimAssetConfig);
  const slInput = slSpinner.input;
  slGroup.appendChild(slSpinner.container);
  paramBox.appendChild(slGroup);

  const tpGroup = el('div', 'form-group');
  tpGroup.appendChild(el('label', 'form-label', '🏆 Take Profit Level'));
  const tpSpinner = createSpinnerInput('take-profit', '0.0000', '', false, getSimAssetConfig);
  const tpInput = tpSpinner.input;
  tpGroup.appendChild(tpSpinner.container);
  paramBox.appendChild(tpGroup);

  controlPanel.appendChild(paramBox);

  // Reset simulated balance option
  const resetBalBtn = el('button', 'btn btn-ghost btn-sm', '🔄 Reset Balance to $10,000');
  resetBalBtn.style.marginTop = 'var(--space-4)';
  resetBalBtn.addEventListener('click', () => {
    _simBalance = 10000;
    _tradeLog = [];
    storage.set('sim_balance', 10000);
    storage.set('sim_trade_log', []);
    balVal.textContent = formatCurrency(10000);
    statsRow.replaceChildren();
    statsRow.appendChild(el('span', '', 'Sim Win Rate: 0%'));
    statsRow.appendChild(el('span', '', 'Sim Trades: 0'));
    playSynthSound('click');
  });
  controlPanel.appendChild(resetBalBtn);

  // --- Populate Workspace ---

  // Canvas Card wrapper
  const chartCard = el('div', 'overview-panel');
  chartCard.style.position = 'relative';
  chartCard.style.padding = 'var(--space-4)';
  chartCard.style.flex = '1';
  chartCard.style.minHeight = '420px';
  chartCard.style.display = 'flex';
  chartCard.style.flexDirection = 'column';

  const chartHeader = el('div', '');
  chartHeader.style.display = 'flex';
  chartHeader.style.justifyContent = 'space-between';
  chartHeader.style.marginBottom = 'var(--space-3)';
  
  const assetBadge = el('span', 'tag', 'EUR/USD');
  assetBadge.style.fontSize = 'var(--text-xs)';
  assetBadge.style.fontWeight = '800';
  chartHeader.appendChild(assetBadge);
  
  const scenarioTitle = el('h3', '', '');
  scenarioTitle.style.fontSize = 'var(--text-sm)';
  scenarioTitle.style.fontFamily = 'var(--font-heading)';
  scenarioTitle.style.fontWeight = '700';
  chartHeader.appendChild(scenarioTitle);

  chartCard.appendChild(chartHeader);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 360;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.background = 'rgba(13, 11, 15, 0.5)';
  canvas.style.borderRadius = 'var(--radius-md)';
  canvas.style.border = '1px solid rgba(255,255,255,0.06)';
  chartCard.appendChild(canvas);
  workspace.appendChild(chartCard);

  // Interactive Action controls Bar below chart
  const actionsBar = el('div', 'overview-panel sim-action-bar');
  actionsBar.style.display = 'flex';
  actionsBar.style.gap = 'var(--space-3)';
  actionsBar.style.justifyContent = 'center';
  actionsBar.style.alignItems = 'center';
  actionsBar.style.flexWrap = 'wrap';

  const stepBtn = el('button', 'btn btn-outline', '⏭️ Step Candle');
  const playBtn = el('button', 'btn btn-outline', '▶ Auto Play');
  const buyBtn = el('button', 'btn btn-primary', '🟢 Buy Long');
  const sellBtn = el('button', 'btn btn-secondary', '🔴 Sell Short');
  const closeBtn = el('button', 'btn btn-outline btn-danger', '❌ Close Position');
  closeBtn.style.display = 'none';

  const resetBtn = el('button', 'btn btn-ghost', '🔄 Restart Scenario');

  actionsBar.appendChild(stepBtn);
  actionsBar.appendChild(playBtn);
  actionsBar.appendChild(buyBtn);
  actionsBar.appendChild(sellBtn);
  actionsBar.appendChild(closeBtn);
  actionsBar.appendChild(resetBtn);
  workspace.appendChild(actionsBar);

  // Transaction Log Drawer
  const logSection = el('div', 'dashboard-section sim-log-section');
  logSection.appendChild(el('h3', 'dashboard-section__title', '📋 Simulation History & Performance Ledger'));
  
  const logList = el('div', 'activity-feed__list');
  logList.style.marginTop = 'var(--space-3)';
  logSection.appendChild(logList);
  workspace.appendChild(logSection);

  // --- Core Simulation Logic Hookups ---

  function updateLogList() {
    logList.replaceChildren();
    if (_tradeLog.length === 0) {
      logList.appendChild(el('p', 'empty-hint', 'No trades logged in the simulator history yet.'));
      return;
    }

    [..._tradeLog].reverse().forEach(t => {
      const row = el('div', 'activity-item');
      
      const dotWrap = el('div', 'activity-item__dot-wrap');
      const dot = el('div', `activity-item__dot activity-item__dot--${t.outcome === 'win' ? 'green' : 'red'}`);
      dotWrap.appendChild(dot);
      row.appendChild(dotWrap);

      const content = el('div', 'activity-item__content');
      content.appendChild(el('div', 'activity-item__title', `${t.asset} · ${t.direction.toUpperCase()} · ${t.scenario}`));
      content.appendChild(el('div', 'activity-item__desc', `Entry: ${t.entry} · Exit: ${t.exit} · P&L: ${t.pnl >= 0 ? '+' : ''}${formatCurrency(t.pnl)}`));
      row.appendChild(content);

      row.appendChild(el('span', 'activity-item__time', t.outcome.toUpperCase()));
      logList.appendChild(row);
    });
  }

  function drawChart() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (_visibleCandles.length === 0) return;

    // Calculate scaling bounds
    let prices = _visibleCandles.flatMap(c => [c.high, c.low]);
    if (_activePosition) {
      prices.push(_activePosition.sl);
      prices.push(_activePosition.tp);
      prices.push(_activePosition.entry);
    } else {
      prices.push(Number(slInput.value) || _visibleCandles[_visibleCandles.length - 1].close);
      prices.push(Number(tpInput.value) || _visibleCandles[_visibleCandles.length - 1].close);
    }

    const minPrice = Math.min(...prices) * 0.9998;
    const maxPrice = Math.max(...prices) * 1.0002;
    const priceRange = maxPrice - minPrice;

    // Scale helpers
    const getX = (index) => {
      const padding = 40;
      const count = _visibleCandles.length;
      const availableWidth = canvas.width - padding * 2;
      // Distribute evenly
      return padding + (index * (availableWidth / Math.max(1, count - 1)));
    };

    const getY = (price) => {
      const padding = 30;
      const availableHeight = canvas.height - padding * 2;
      return canvas.height - padding - ((price - minPrice) / priceRange) * availableHeight;
    };

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    // Y grid
    for (let i = 0; i <= 5; i++) {
      const y = 30 + (i * (canvas.height - 60)) / 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();

      // Draw price labels on right axis
      const priceVal = minPrice + ((canvas.height - 30 - y) / (canvas.height - 60)) * priceRange;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px Outfit, Inter';
      const config = getSimAssetConfig();
      ctx.fillText(priceVal.toFixed(config.decimals), canvas.width - 55, y - 4);
    }

    // Draw active risk corridors before candles so they fall behind wicks
    const slVal = _activePosition ? _activePosition.sl : Number(slInput.value);
    const tpVal = _activePosition ? _activePosition.tp : Number(tpInput.value);
    const entVal = _activePosition ? _activePosition.entry : _visibleCandles[_visibleCandles.length - 1].close;

    if (slVal && tpVal && entVal) {
      const ySl = getY(slVal);
      const yTp = getY(tpVal);
      const yEnt = getY(entVal);

      // Shading regions
      // Target/TP Green region (Always Green for profit zone)
      ctx.fillStyle = 'rgba(57, 255, 20, 0.04)';
      ctx.fillRect(0, Math.min(yEnt, yTp), canvas.width, Math.abs(yEnt - yTp));
      
      // Stop Loss Red region (Always Red for risk zone)
      ctx.fillStyle = 'rgba(255, 59, 59, 0.04)';
      ctx.fillRect(0, Math.min(yEnt, ySl), canvas.width, Math.abs(yEnt - ySl));

      // Draw target/SL horizontal guidelines
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      // Take Profit (Green)
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, yTp);
      ctx.lineTo(canvas.width, yTp);
      ctx.stroke();

      // Stop Loss (Red)
      ctx.strokeStyle = 'rgba(255, 59, 59, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, ySl);
      ctx.lineTo(canvas.width, ySl);
      ctx.stroke();

      // Entry line (White)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, yEnt);
      ctx.lineTo(canvas.width, yEnt);
      ctx.stroke();

      ctx.setLineDash([]); // Reset line dash
    }

    // Draw SMC Indicator Overlays if enabled
    const indicatorChecked = storage.get('sim_indicator_enabled', true);
    if (indicatorChecked && _activeScenario && _activeScenario.zones) {
      _activeScenario.zones.forEach(zone => {
        if (_visibleCandles.length > zone.startCandle) {
          const yMin = getY(zone.priceMin);
          const yMax = getY(zone.priceMax);
          const xStart = getX(zone.startCandle);
          const endIdx = Math.min(zone.endCandle, _visibleCandles.length - 1);
          const xEnd = getX(endIdx);

          if (xEnd >= xStart) {
            // Draw shading
            ctx.fillStyle = zone.color;
            ctx.fillRect(xStart, Math.min(yMin, yMax), xEnd - xStart, Math.abs(yMin - yMax));

            // Draw dashed border
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = zone.strokeColor;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(xStart, Math.min(yMin, yMax), xEnd - xStart, Math.abs(yMin - yMax));
            ctx.setLineDash([]);

            // Draw label
            ctx.fillStyle = zone.strokeColor;
            ctx.font = 'bold 8px var(--font-heading), Inter, sans-serif';
            ctx.fillText(zone.name, xStart + 8, Math.min(yMin, yMax) + 14);
          }
        }
      });
    }

    // Draw Japanese Candlesticks
    const candleWidth = Math.max(6, Math.round(360 / _visibleCandles.length));

    _visibleCandles.forEach((c, idx) => {
      const x = getX(idx);
      const yOpen = getY(c.open);
      const yClose = getY(c.close);
      const yHigh = getY(c.high);
      const yLow = getY(c.low);

      const isGreen = c.close >= c.open;
      const color = isGreen ? '#39ff14' : '#ff3b3b';

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;

      // Draw wick line
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Draw body block
      const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));
      ctx.fillRect(x - candleWidth / 2, Math.min(yOpen, yClose), candleWidth, bodyHeight);
      
      // If green, fill with translucent glow shadow
      if (isGreen) {
        ctx.shadowColor = 'rgba(57,255,20,0.15)';
        ctx.shadowBlur = 4;
      }
    });

    ctx.shadowBlur = 0; // Reset shadow glow
  }

  function loadScenario(scId) {
    const sc = SIM_SCENARIOS.find(s => s.id === scId);
    if (!sc) return;

    _activeScenario = sc;
    _historyIndex = sc.historyCount;
    _visibleCandles = sc.candles.slice(0, _historyIndex);

    assetBadge.textContent = sc.asset;
    scenarioTitle.textContent = sc.title;
    descText.textContent = sc.description;

    // Reset inputs
    const lastClose = _visibleCandles[_visibleCandles.length - 1].close;
    
    // Auto-calculate default SL/TP parameters based on direction
    const config = getAssetConfig(sc.asset);
    const range = config.decimals === 5 ? 0.0035 : (config.decimals === 3 ? 0.35 : 0.0035);
    if (sc.optimalDirection === 'long') {
      slInput.value = (lastClose - range).toFixed(config.decimals);
      tpInput.value = (lastClose + range * 2).toFixed(config.decimals); // 1:2 R:R default
    } else {
      slInput.value = (lastClose + range).toFixed(config.decimals);
      tpInput.value = (lastClose - range * 2).toFixed(config.decimals);
    }

    _activePosition = null;
    _lastResolvedTrade = null;
    posDetails.replaceChildren();
    const emptyMsg = el('p', 'sim-pos-empty', 'No active positions. Set SL/TP below and Buy/Sell to trigger!');
    emptyMsg.style.fontSize = 'var(--text-xs)';
    emptyMsg.style.color = 'var(--text-muted)';
    posDetails.appendChild(emptyMsg);
    
    closeBtn.style.display = 'none';
    buyBtn.style.display = 'inline-flex';
    sellBtn.style.display = 'inline-flex';
    slInput.disabled = false;
    tpInput.disabled = false;

    // Stop play
    stopAutoplay();

    drawChart();
    updateObjectivesUI();
  }

  function advanceOneCandle() {
    if (!_activeScenario) return;

    if (_historyIndex >= _activeScenario.candles.length) {
      stopAutoplay();
      showNotificationToast('Scenario finished! Click "Restart Scenario" to try again. 🏁', '🏁');
      return;
    }

    const nextCandle = _activeScenario.candles[_historyIndex];
    _visibleCandles.push(nextCandle);
    _historyIndex++;

    // Check active positions for collisions
    if (_activePosition) {
      const dir = _activePosition.direction;
      const entry = _activePosition.entry;
      const sl = _activePosition.sl;
      const tp = _activePosition.tp;

      const high = nextCandle.high;
      const low = nextCandle.low;

      let hitSL = false;
      let hitTP = false;

      if (dir === 'long') {
        if (low <= sl) hitSL = true;
        if (high >= tp) hitTP = true;
      } else {
        if (high >= sl) hitSL = true; // sl is higher for short, hit if high wicks to/above it
        if (low <= tp) hitTP = true;  // tp is lower for short, hit if low wicks to/below it
      }

      if (hitSL && hitTP) {
        // High volatility candle hit both! Resolve in favor of SL for discipline conservatism
        resolveTrade(sl, 'loss');
      } else if (hitSL) {
        resolveTrade(sl, 'loss');
      } else if (hitTP) {
        resolveTrade(tp, 'win');
      } else {
        // Still active, update floating P&L display
        updateActivePositionUI();
      }
    }

    drawChart();
    updateObjectivesUI();
  }

  function openPosition(direction) {
    if (_activePosition) return;

    const entryPrice = _visibleCandles[_visibleCandles.length - 1].close;
    const slPrice = Number(slInput.value);
    const tpPrice = Number(tpInput.value);

    if (!slPrice || !tpPrice) {
      showNotificationToast('Please set Stop Loss and Take Profit levels first! 🎯', '⚠️');
      return;
    }

    // Risk validation
    if (direction === 'long') {
      if (slPrice >= entryPrice) {
        showNotificationToast('Stop Loss must be below Entry Price for Long buys! 📉', '⚠️');
        return;
      }
      if (tpPrice <= entryPrice) {
        showNotificationToast('Take Profit must be above Entry Price for Long buys! 📈', '⚠️');
        return;
      }
    } else {
      if (slPrice <= entryPrice) {
        showNotificationToast('Stop Loss must be above Entry Price for Short sells! 📈', '⚠️');
        return;
      }
      if (tpPrice >= entryPrice) {
        showNotificationToast('Take Profit must be below Entry Price for Short sells! 📉', '⚠️');
        return;
      }
    }

    _activePosition = {
      direction,
      entry: entryPrice,
      sl: slPrice,
      tp: tpPrice,
      openIndex: _historyIndex,
      size: 1 // default standard size
    };

    playSynthSound('click');
    const config = getSimAssetConfig();
    showNotificationToast(`Opened ${direction.toUpperCase()} trade at ${entryPrice.toFixed(config.decimals)} 🟢`);

    // UI state updates
    buyBtn.style.display = 'none';
    sellBtn.style.display = 'none';
    closeBtn.style.display = 'inline-flex';
    slInput.disabled = true;
    tpInput.disabled = true;

    updateActivePositionUI();
    drawChart();
    updateObjectivesUI();
  }

  function updateActivePositionUI() {
    posDetails.replaceChildren();
    if (!_activePosition) {
      if (_lastResolvedTrade) {
        const card = el('div', 'sim-resolution-card');
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = 'var(--space-2)';
        card.style.fontSize = 'var(--text-xs)';

        const statusLabel = el('div', '', '🏁 Trade Resolved!');
        statusLabel.style.fontWeight = '700';
        statusLabel.style.color = 'var(--text-primary)';
        card.appendChild(statusLabel);

        const outcomeBadge = el('span', `tag ${_lastResolvedTrade.outcome === 'win' ? 'tag-unlocked' : 'tag-locked'}`);
        outcomeBadge.textContent = `${_lastResolvedTrade.outcome.toUpperCase()} (${_lastResolvedTrade.pnl >= 0 ? '+' : ''}${formatCurrency(_lastResolvedTrade.pnl)})`;
        outcomeBadge.style.fontWeight = '700';
        outcomeBadge.style.alignSelf = 'start';
        card.appendChild(outcomeBadge);

        card.appendChild(el('div', 'val-muted', `Asset: ${_lastResolvedTrade.asset}`));
        card.appendChild(el('div', 'val-muted', `Pips/Gain: ${((_lastResolvedTrade.exit - _lastResolvedTrade.entry) * (_lastResolvedTrade.direction === 'long' ? 1 : -1)).toFixed(5)}`));

        // Export button
        const exportBtn = el('button', 'btn btn-primary btn-sm', '📤 Export to Journal');
        exportBtn.style.marginTop = 'var(--space-2)';
        exportBtn.addEventListener('click', () => {
          exportSimTradeToJournal(_lastResolvedTrade);
          exportBtn.disabled = true;
          exportBtn.textContent = '✅ Exported';
          exportBtn.classList.remove('btn-primary');
          exportBtn.classList.add('btn-ghost');
        });
        card.appendChild(exportBtn);

        posDetails.appendChild(card);
      } else {
        const emptyMsg = el('p', 'sim-pos-empty', 'No active positions. Set SL/TP below and Buy/Sell to trigger!');
        emptyMsg.style.fontSize = 'var(--text-xs)';
        emptyMsg.style.color = 'var(--text-muted)';
        posDetails.appendChild(emptyMsg);
      }
      return;
    }

    const currentPrice = _visibleCandles[_visibleCandles.length - 1].close;
    const diff = currentPrice - _activePosition.entry;
    
    // Standard pip size multiplier fallback
    const isLong = _activePosition.direction === 'long';
    const pnlMultiplier = isLong ? 1 : -1;
    const riskDistance = Math.abs(_activePosition.entry - _activePosition.sl);
    const riskCash = 200; // Risk $200 baseline per trade
    
    const floatingPnl = (diff / riskDistance) * riskCash * pnlMultiplier;

    const row = el('div', '');
    row.style.fontSize = 'var(--text-xs)';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '4px';

    const header = el('div', '');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.appendChild(el('span', '', `Type: ${_activePosition.direction.toUpperCase()}`));
    
    const pnlBadge = el('span', `tag ${floatingPnl >= 0 ? 'tag-unlocked' : 'tag-locked'}`);
    pnlBadge.textContent = `${floatingPnl >= 0 ? '+' : ''}${formatCurrency(floatingPnl)}`;
    pnlBadge.style.fontWeight = '700';
    header.appendChild(pnlBadge);
    row.appendChild(header);

    const config = getSimAssetConfig();
    row.appendChild(el('span', 'val-muted', `Entry: ${_activePosition.entry.toFixed(config.decimals)}`));
    row.appendChild(el('span', 'val-muted', `Stop: ${_activePosition.sl.toFixed(config.decimals)}`));
    row.appendChild(el('span', 'val-muted', `Target: ${_activePosition.tp.toFixed(config.decimals)}`));

    posDetails.appendChild(row);
  }

  function exportSimTradeToJournal(simTrade) {
    const journalTrade = {
      date: simTrade.timestamp.slice(0, 10),
      asset: simTrade.asset,
      direction: simTrade.direction,
      entry: simTrade.entry,
      exit: simTrade.exit,
      stop: simTrade.direction === 'long' ? simTrade.entry - 0.0035 : simTrade.entry + 0.0035,
      pnl: simTrade.pnl,
      outcome: simTrade.outcome,
      session: 'London',
      timeframe: 'M15',
      notes: `Simulated trade practice from scenario: "${simTrade.scenario}"`,
      confluences: ['Supply/Demand Zone [Ep 7]'],
      simulated: true,
      edgeScore: simTrade.outcome === 'win' ? 100 : 75,
      guardrails: { newsChecked: true, htfBiasAligned: true, killzoneTiming: true, sizeCalculatorUsed: true }
    };

    if (simTrade.scenario.includes('FVG')) {
      journalTrade.confluences = ['Fair Value Gaps (FVG) [Ep 9]'];
    } else if (simTrade.scenario.includes('Flip')) {
      journalTrade.confluences = ['Flip Zones / Mitigations [Ep 14]'];
    } else if (simTrade.scenario.includes('Judas')) {
      journalTrade.confluences = ['ICT Killzones Timing [Ep 12]', 'Liquidity Sweeps / Inducements [Ep 13]'];
    }

    saveTrade(journalTrade);
    playSynthSound('success');
    showNotificationToast('Simulated trade exported to your journal ledger! 📓', '📥');
  }

  function resolveTrade(exitPrice, outcome) {
    if (!_activePosition) return;

    const isLong = _activePosition.direction === 'long';
    const pnlMultiplier = isLong ? 1 : -1;
    const diff = exitPrice - _activePosition.entry;
    const riskDistance = Math.abs(_activePosition.entry - _activePosition.sl);
    const riskCash = 200; // standard simulated risk size
    
    const pnl = (diff / riskDistance) * riskCash * pnlMultiplier;
    
    _simBalance += pnl;
    storage.set('sim_balance', _simBalance);

    // Save transaction
    const tradeEntry = {
      id: generateId(),
      asset: _activeScenario.asset,
      scenario: _activeScenario.title,
      direction: _activePosition.direction,
      entry: _activePosition.entry,
      exit: exitPrice,
      pnl: parseFloat(pnl.toFixed(2)),
      outcome,
      timestamp: new Date().toISOString()
    };
    _tradeLog.push(tradeEntry);
    storage.set('sim_trade_log', _tradeLog);

    // Sound and toast feedback
    if (outcome === 'win') {
      playSynthSound('success');
      showNotificationToast(`WIN! Earned +${formatCurrency(pnl)} in Simulated Balance! 🏆`);
      addXP('practice', 30);
    } else {
      playSynthSound('fail');
      showNotificationToast(`Loss. Subtracted ${formatCurrency(Math.abs(pnl))} in Sim Balance. 📉`);
      addXP('practice', 10);
    }

    // Reset controls UI state
    _lastResolvedTrade = tradeEntry;
    _activePosition = null;
    updateActivePositionUI();

    closeBtn.style.display = 'none';
    buyBtn.style.display = 'inline-flex';
    sellBtn.style.display = 'inline-flex';
    slInput.disabled = false;
    tpInput.disabled = false;

    // Refresh balance widgets
    balVal.textContent = formatCurrency(_simBalance);
    const winsCount = _tradeLog.filter(t => t.outcome === 'win').length;
    const totalSimTrades = _tradeLog.length;
    const winRateSimVal = totalSimTrades > 0 ? Math.round((winsCount / totalSimTrades) * 100) : 0;
    statsRow.replaceChildren();
    statsRow.appendChild(el('span', '', `Sim Win Rate: ${winRateSimVal}%`));
    statsRow.appendChild(el('span', '', `Sim Trades: ${totalSimTrades}`));

    stopAutoplay();
    updateLogList();
    drawChart();
    updateObjectivesUI();
  }

  function stopAutoplay() {
    if (_autoPlayInterval) {
      clearInterval(_autoPlayInterval);
      _autoPlayInterval = null;
      playBtn.textContent = '▶ Auto Play';
    }
  }

  function updateObjectivesUI() {
    if (!_objectiveListEl || !_activeScenario) return;

    _objectiveListEl.replaceChildren();

    // Determine current milestone indices
    const isFvgOrFlip = _activeScenario.id.includes('fvg') || _activeScenario.id.includes('flip');
    const isJudas = _activeScenario.id.includes('judas');
    const targetStepIndex = isJudas ? 7 : (isFvgOrFlip ? 8 : 9);
    const targetRejectionIndex = isJudas ? 8 : (isFvgOrFlip ? 9 : 10);
    
    // Step 1: Step to Mitigation candle
    const step1Done = _historyIndex >= targetStepIndex;
    const step1Active = _historyIndex < targetStepIndex;
    
    // Step 2: Spot Rejection
    const step2Done = _historyIndex >= targetRejectionIndex;
    const step2Active = _historyIndex === targetStepIndex;
    
    // Step 3: Place Order
    const hasTradeLog = _tradeLog.some(t => t.scenario === _activeScenario.title);
    const step3Done = _activePosition !== null || hasTradeLog;
    const step3Active = _historyIndex >= targetRejectionIndex && _activePosition === null && !hasTradeLog;
    
    // Step 4: Win Scenario
    const step4Done = hasTradeLog;
    const step4Active = _activePosition !== null;

    const objectives = [
      {
        text: `Step Candle to Candle ${targetStepIndex} (${isFvgOrFlip ? 'Fill FVG / Mitigate Flip' : 'Mitigate Order Block'})`,
        done: step1Done,
        active: step1Active
      },
      {
        text: `Wait for Candle ${targetRejectionIndex} Rejection Trigger`,
        done: step2Done,
        active: step2Active
      },
      {
        text: 'Execute Buy Long / Sell Short order',
        done: step3Done,
        active: step3Active
      },
      {
        text: 'Step to resolution & hit TP target!',
        done: step4Done,
        active: step4Active
      }
    ];

    objectives.forEach(obj => {
      const item = el('div', '');
      item.style.display = 'flex';
      item.style.alignItems = 'start';
      item.style.gap = '8px';
      item.style.fontSize = '11px';
      item.style.lineHeight = '1.4';
      
      const bullet = el('span', '');
      bullet.style.fontWeight = '700';
      
      if (obj.done) {
        bullet.textContent = '✓';
        bullet.style.color = 'var(--neon-green)';
        item.appendChild(bullet);
        
        const txt = el('span', '', obj.text);
        txt.style.color = 'var(--text-muted)';
        txt.style.textDecoration = 'line-through';
        item.appendChild(txt);
      } else if (obj.active) {
        bullet.textContent = '👉';
        bullet.style.color = 'var(--cyan)';
        item.appendChild(bullet);
        
        const txt = el('span', '', obj.text);
        txt.style.color = 'var(--cyan)';
        txt.style.fontWeight = '600';
        item.appendChild(txt);
      } else {
        bullet.textContent = '○';
        bullet.style.color = 'rgba(255,255,255,0.2)';
        item.appendChild(bullet);
        
        const txt = el('span', '', obj.text);
        txt.style.color = 'rgba(255,255,255,0.3)';
        item.appendChild(txt);
      }
      
      _objectiveListEl.appendChild(item);
    });
  }

  // --- Add Event Listeners ---

  scSelect.addEventListener('change', () => {
    loadScenario(scSelect.value);
  });

  stepBtn.addEventListener('click', () => {
    playSynthSound('click');
    advanceOneCandle();
  });

  playBtn.addEventListener('click', () => {
    playSynthSound('click');
    if (_autoPlayInterval) {
      stopAutoplay();
    } else {
      playBtn.textContent = '⏸️ Pause';
      _autoPlayInterval = setInterval(advanceOneCandle, 1500);
    }
  });

  buyBtn.addEventListener('click', () => openPosition('long'));
  sellBtn.addEventListener('click', () => openPosition('short'));

  closeBtn.addEventListener('click', () => {
    if (!_activePosition) return;
    const lastClose = _visibleCandles[_visibleCandles.length - 1].close;
    const isLong = _activePosition.direction === 'long';
    const isProfit = isLong ? (lastClose > _activePosition.entry) : (lastClose < _activePosition.entry);
    resolveTrade(lastClose, isProfit ? 'win' : 'loss');
  });

  resetBtn.addEventListener('click', () => {
    playSynthSound('click');
    loadScenario(scSelect.value);
  });

  // Re-draw chart on custom manual inputs
  slInput.addEventListener('input', drawChart);
  tpInput.addEventListener('input', drawChart);

  // Initialize first scenario
  loadScenario(scSelect.value);
  updateLogList();

  // Clean up autoplay if navigating away from simulator
  const cleanupAutoplay = () => {
    if (window.location.hash !== '#simulator') {
      stopAutoplay();
      window.removeEventListener('hashchange', cleanupAutoplay);
    }
  };
  window.addEventListener('hashchange', cleanupAutoplay);
}

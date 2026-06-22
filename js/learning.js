// SwaGGa HQ — Learning Hub Module (Redesigned)

import storage from './storage.js';
import { generateId, formatDate, sanitizeText, showNotificationToast, triggerConfetti } from './utils.js';
import { addXP } from './xp.js';
import { playSynthSound } from './audio.js';
import { nativeHaptic, nativeHapticNotification } from './native-bridge.js';

// --- Constants ---

export const BRAH_GOH_CURRICULUM = [
  { id: 'ep0',  episode: 0,  title: 'The Trading Mindset',             concepts: ['mindset', 'journey', 'inspiration', 'goal-setting'],                              description: 'Why mindset is everything. Defining your trading journey and setting realistic goals.' },
  { id: 'ep1',  episode: 1,  title: 'Finding Your Edge',               concepts: ['edge', 'discipline', 'professional-habits', 'routine'],                            description: 'What separates profitable traders. Building discipline and professional habits.' },
  { id: 'ep2',  episode: 2,  title: 'Price Action & Order Flow',       concepts: ['price-action', 'order-flow', 'market-mechanics', 'tape-reading'],                  description: 'How price really moves. Order flow, market mechanics, and reading the tape.' },
  { id: 'ep3',  episode: 3,  title: 'Forex Fundamentals',              concepts: ['forex-basics', 'currency-pairs', 'pips', 'lots', 'leverage', 'margin'],            description: 'Forex 101 — pairs, pips, lots, leverage. How the FX market operates.' },
  { id: 'ep4',  episode: 4,  title: 'Trading Psychology',              concepts: ['psychology', 'emotional-control', 'fear', 'greed', 'patience'],                    description: 'Mastering emotions. Managing fear, greed, and patience for consistent execution.' },
  { id: 'ep5',  episode: 5,  title: 'Market Structure',                concepts: ['market-structure', 'BOS', 'CHOCH', 'trend-identification', 'swing-points'],        description: 'Break of Structure, Change of Character, swing highs/lows.' },
  { id: 'ep6',  episode: 6,  title: 'Candlestick Patterns',            concepts: ['candlestick-patterns', 'engulfing', 'pin-bar', 'doji', 'wicks', 'momentum'],       description: 'Key patterns — engulfing, pin bars, dojis. What wicks say about momentum.' },
  { id: 'ep7',  episode: 7,  title: 'Supply & Demand',                 concepts: ['supply-demand', 'zones', 'institutional-order-flow', 'accumulation', 'distribution'], description: 'Institutional supply/demand zones. Accumulation vs distribution.' },
  { id: 'ep8',  episode: 8,  title: 'Premium / Discount & Fibonacci',  concepts: ['premium-discount', 'fibonacci', 'OTE', 'entry-timing', 'retracement'],            description: 'Buying discount, selling premium. Fibonacci for optimal entries.' },
  { id: 'ep9',  episode: 9,  title: 'Fair Value Gaps',                 concepts: ['fair-value-gap', 'imbalance', 'price-inefficiency', 'FVG', 'liquidity-void'],      description: 'Price inefficiencies. How FVGs form and how to trade them.' },
  // Locked episodes (10-32) — user can add details when released
  { id: 'ep10', episode: 10, title: 'Order Blocks & Mitigation', concepts: ['order-block', 'OB', 'mitigation', 'institutional-orders'], description: 'How to identify order blocks on the chart and execute entries when price mitigates them.', videoUrl: 'https://youtu.be/fM1J7dObe3c?si=X1p9xL1Qx7XpWb1b' },
  { id: 'ep11', episode: 11, title: 'Top Down Analysis Strategy', concepts: ['top-down-analysis', 'HTF-bias', 'multi-timeframe', 'fractal-markets'], description: 'How to perform multi-timeframe analysis. Establish HTF bias on D1/H4 and execute on LTF (H1/M15) to avoid noise.', videoUrl: 'https://youtu.be/qtrATSo3-lQ?si=MhuT5JwI_Wkbp5eP' },
  { id: 'ep12', episode: 12, title: 'ICT Killzones', concepts: ['killzones', 'session-timing', 'london-killzone', 'new-york-killzone'], description: 'Understanding session timing and high-volume windows. Exact times for Asian, London, New York, and London Close sessions.', videoUrl: 'https://youtu.be/uLw-qdpV3uk?si=elqDijw5R0RU4MCK' },
  { id: 'ep13', episode: 13, title: 'Liquidity Concepts & Inducements', concepts: ['liquidity', 'inducement', 'liquidity-sweeps', 'retail-traps'], description: 'How smart money engineers traps to lure retail traders into early entries and sweep stop-losses for liquidity.', videoUrl: 'https://youtu.be/TthzSVTzWoE?si=4W_vBI8GGpg--REU' },
  { id: 'ep14', episode: 14, title: 'Flip Zones Strategy', concepts: ['supply-to-demand-flip', 'demand-to-supply-flip', 'failed-zone-mitigation', 'order-flow-transition'], description: 'How supply turns to demand and demand to supply. Spotting failed zone mitigations and identifying key flip zones to time clean structural reversals.', videoUrl: 'https://youtu.be/mdR4xijBaKE?si=vlJ3kGj5qUu0KnRh' },
  { id: 'ep15', episode: 15, title: 'Tape Reading & Order Flow Dynamics', concepts: ['tape-reading', 'market-depth', 'order-book', 'bid-ask'], description: 'Mastering order flow, bid-ask spreads, and learning to read tape momentum to predict breakouts.', videoUrl: 'https://youtu.be/8ZfPIVt4IBs?si=ZVDxJGkZHt-dXrc7' },
  { id: 'ep16', episode: 16, title: 'Why 95% of Traders Fail', concepts: ['emotional-independence', 'discipline', 'revenge-trading', 'consistency-over-excitement'], description: 'Brad Goh details why 95% of retail traders fail: not because the market is rigged, but because they trade for entertainment, cannot handle the pain of losing, and lack the emotional independence to execute their edge consistently.', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  { id: 'ep17', episode: 17, title: 'The Power of Three (AMD Strategy)', concepts: ['accumulation', 'manipulation', 'distribution', 'AMD', 'power-of-three'], description: 'Mastering the classic institutional price cycle: Accumulation during Asia, Manipulation at London open, and Distribution in New York.', videoUrl: 'https://youtu.be/aR5_Gg7cM44?si=1Y9bL1Qx7XpWb2b' },
  { id: 'ep18', episode: 18, title: 'Breaker Blocks vs Mitigation Blocks', concepts: ['breaker-block', 'mitigation-block', 'failed-order-blocks', 'liquidity-sweeps'], description: 'How broken order blocks act as key re-entry points, and how to execute when a mitigation block forms.', videoUrl: 'https://youtu.be/mR4xijBaKE?si=2Y9bL1Qx7XpWb3b' },
  { id: 'ep19', episode: 19, title: 'Advanced Risk Management & Position Sizing', concepts: ['risk-management', 'position-sizing', 'drawdown-control', 'kelly-criterion'], description: 'Formulaic rules for calculating size, maintaining a high risk-to-reward ratio, and implementing drawdown circuit breakers.', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  { id: 'ep20', episode: 20, title: 'Dealing Ranges & Market Maker Models', concepts: ['dealing-range', 'market-maker-model', 'MMBM', 'MMSM', 'smart-money'], description: 'Understanding how price moves within defined high/low boundaries, and the Market Maker Buy and Sell cycles.', videoUrl: 'https://youtu.be/TthzSVTzWoE?si=4W_vBI8GGpg--REU' },
  { id: 'ep21', episode: 21, title: 'Daily Routine & Pre-market Checklists', concepts: ['premarket-routine', 'checklist', 'rules', 'daily-habits', 'process'], description: 'Brad Goh details his pre-market analysis routine: checking economic news, identifying dealing ranges, marking key HTF zones, and running a pre-trade checklist to eliminate emotional errors.', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  { id: 'ep22', episode: 22, title: 'Backtesting & Edge Validation', concepts: ['backtesting', 'historical-data', 'edge-verification', 'win-rate-validation'], description: 'How to validate your trading edge. Brad Goh explains how to collect historical trade samples (100+ trades) to determine your true strategy win rate and R:R ratios.', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  { id: 'ep23', episode: 23, title: 'Journalling Your Trades (EdgeScore)', concepts: ['trade-journaling', 'mistake-tracking', 'confluences', 'edgescore', 'statistics'], description: 'How to build and maintain a professional trading journal. Track your entry confluences, emotions, and mistakes to calculate your EdgeScore and find your statistical edge.', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
  { id: 'ep24', episode: 24, title: 'How to Review Your Day', concepts: ['daily-review', 'reflection', 'inner-work', 'battle-feedback', 'sanctuary'], description: 'Brad Goh explains why reflection is the highest leverage skill in trading. Learn how to review your stats, log qualitative feedback (inner work), and perform a 10-minute meditation sanctuary to reset your nervous system.', videoUrl: 'https://youtu.be/4sN-gnJKRtA?si=makwDSJaJzwhbagr' },
  { id: 'ep25', episode: 25, title: 'Simple Pullback Strategy', concepts: ['pullback-trading', 'market-mechanics', 'trend-continuation', 'sweep-pullbacks', 'aggressive-vs-conservative'], description: 'Brad Goh\'s systematic framework for identifying and trading market pullbacks. Learn fast vs slow vs sweep pullbacks, and aggressive vs conservative entry models.', videoUrl: 'https://youtu.be/Nuorx9oVz8o?si=vkbggcVSvYIcNhJE' },
  { id: 'ep26', episode: 26, title: 'Review Your Trades Like a Pro', concepts: ['trade-review', 'journal-analysis', 'performance-audit', 'leaks-detection'], description: 'Learn how to perform a deep-dive audit on your logged trades to spot psychological leaks, track compliance rates, and refine your setup expectancy.', videoUrl: 'https://youtu.be/xoUlvwdBVJ4' },
  { id: 'ep27', episode: 27, title: 'How to Improve Your Strategy With Data', concepts: ['expectancy', 'strategy-optimization', 'data-driven-trading', 'scorecard-filter'], description: 'How to analyze your setup scorecard, session heatmap, and mistake analyzer to identify your true mathematical edge and optimize your execution.', videoUrl: 'https://youtu.be/IieXTRD15GU' },
  { id: 'ep28', episode: 28, title: 'The Truth About Trading Indicators', concepts: ['indicators', 'lagging-indicators', 'naked-charts', 'price-action-priority'], description: 'Why relying on lagging indicators traps retail traders. Understanding when to use them as tertiary confirmation versus keeping focus on raw price action.', videoUrl: 'https://youtu.be/MKSwk0lEtZ0' },
  { id: 'ep29', episode: 29, title: 'How to Use AI for Trading', concepts: ['ai-trading', 'llm-coaching', 'automation', 'journal-analysis'], description: 'Using Large Language Models and AI journaling assistants to review trades, draft daily plans, and highlight blind spots in execution.', videoUrl: 'https://youtu.be/iGORytFiDnU' },
  { id: 'ep30', episode: 30, title: 'Trading High Impact News', concepts: ['news-events', 'volatility-control', 'slippage', 'risk-mitigation'], description: 'Guidelines for surviving NFP, FOMC, and CPI releases. Position sizing adjustments, pre-news checklists, and managing floating drawdown.', videoUrl: 'https://youtu.be/jl9t6KMoiHg' },
  { id: 'ep31', episode: 31, title: 'How to Pass Prop Firm Challenges', concepts: ['prop-firm', 'funded-account', 'drawdown-rules', 'compounding'], description: 'The exact 3-tier risk framework and psychological guidelines required to pass evaluations and keep funded capital without breaching drawdown limits.', videoUrl: 'https://youtu.be/kRYQFKysfis' },
  { id: 'ep32', episode: 32, title: 'Become a Disciplined Trader in 21 Days', concepts: ['discipline', 'habits-loop', 'consistency', 'routine-lockout'], description: 'A step-by-step habit loop challenge to build non-negotiable off-chart routines, enforce daily limits, and lock in professional discipline.', videoUrl: 'https://www.youtube.com/watch?v=IM9MYudJSxs' },
  { id: 'ep33', episode: 33, title: 'Graduation — Lessons From Making Millions', concepts: ['graduation', 'trading-philosophy', 'reflection', 'skill-building', 'long-term-mindset'], description: 'The final graduation episode of the Market Mechanics Mentorship. Brad Goh shares key lessons learned from making millions, shifting focus from learning to execution, and building a sustainable trading career.', videoUrl: 'https://youtu.be/3rtET_1E040?si=jvSB-jxKapbGah8Q' },
];

const QUIZ_BANK = [
  { concept: 'BOS',                q: 'What does BOS stand for?',                                      choices: ['Break of Structure', 'Balance of Supply', 'Base of Support', 'Band of Strength'],       answer: 0 },
  { concept: 'CHOCH',              q: 'What does CHOCH indicate?',                                     choices: ['Change of Character', 'Channel of Charts', 'Close of High/Open/Close/High', 'Check of Channel'], answer: 0 },
  { concept: 'fair-value-gap',     q: 'A Fair Value Gap is created by:',                               choices: ['Three candles with a gap between candle 1 and 3', 'Two equal highs', 'A single doji candle', 'A news event'], answer: 0 },
  { concept: 'engulfing',          q: 'An engulfing candle:',                                           choices: ['Completely covers the previous candle body', 'Has very long wicks', 'Is always green', 'Forms at market open only'], answer: 0 },
  { concept: 'pin-bar',            q: 'A pin bar is characterised by:',                                choices: ['A long wick and small body', 'Two equal bodies', 'No wick at all', 'A gap up'], answer: 0 },
  { concept: 'supply-demand',      q: 'A demand zone is where:',                                       choices: ['Institutional buyers placed large orders', 'Price always reverses', 'Volume is lowest', 'Spreads are widest'], answer: 0 },
  { concept: 'fibonacci',          q: 'The Optimal Trade Entry (OTE) Fibonacci zone is:',              choices: ['0.618 – 0.786 retracement', '0.0 – 0.236 retracement', '1.0 – 1.618 extension', '0.382 – 0.5 retracement'], answer: 0 },
  { concept: 'premium-discount',   q: 'In ICT terms, "discount" means price is:',                      choices: ['Below the 50% equilibrium level', 'Above the 50% equilibrium level', 'At the highest point', 'In consolidation'], answer: 0 },
  { concept: 'market-structure',   q: 'A higher high followed by a higher low indicates:',             choices: ['Bullish market structure', 'Bearish market structure', 'Consolidation', 'Reversal'], answer: 0 },
  { concept: 'pips',               q: 'How many pips is 1.2350 to 1.2400?',                            choices: ['50 pips', '5 pips', '500 pips', '0.5 pips'], answer: 0 },
  { concept: 'leverage',           q: '1:100 leverage means:',                                          choices: ['$1 controls $100', '$100 controls $1', 'You can only lose $1', 'You get 100% profit'], answer: 0 },
  { concept: 'psychology',         q: 'Revenge trading is caused by:',                                  choices: ['Emotional reaction to a loss', 'A good trading plan', 'Over-preparation', 'Low leverage'], answer: 0 },
  { concept: 'price-action',       q: 'Price action trading primarily uses:',                           choices: ['Raw price movement on charts', 'Only fundamental analysis', 'Only indicators', 'Automated bots'], answer: 0 },
  { concept: 'order-flow',         q: 'Order flow refers to:',                                          choices: ['The stream of buy and sell orders in the market', 'A type of chart pattern', 'A specific indicator', 'A risk management tool'], answer: 0 },
  { concept: 'imbalance',          q: 'An imbalance in price occurs when:',                             choices: ['One side (buyers/sellers) overwhelms the other', 'Price moves sideways', 'Volume is equal', 'Spreads are tight'], answer: 0 },
  { concept: 'liquidity-void',     q: 'A liquidity void is:',                                           choices: ['An area where price moved rapidly with no opposing orders', 'A support level', 'A resistance level', 'A trend line'], answer: 0 },
  { concept: 'discipline',         q: 'Trading discipline means:',                                      choices: ['Following your plan regardless of emotions', 'Taking every trade you see', 'Trading more when winning', 'Ignoring stop losses'], answer: 0 },
  { concept: 'mindset',            q: 'The growth mindset in trading involves:',                        choices: ['Viewing losses as learning opportunities', 'Never losing money', 'Trading without a plan', 'Only taking sure-win trades'], answer: 0 },
  { concept: 'doji',               q: 'A doji candle represents:',                                      choices: ['Indecision between buyers and sellers', 'Strong bullish momentum', 'A guaranteed reversal', 'Low volume'], answer: 0 },
  { concept: 'swing-points',       q: 'Swing highs and swing lows help identify:',                     choices: ['Market structure and trend direction', 'The exact entry price', 'News events', 'Lot sizes'], answer: 0 },
  { concept: 'top-down-analysis',  q: 'What is the primary purpose of top-down analysis?',             choices: ['To establish the overall market bias/direction from higher time frames', 'To find the exact entry down to the millisecond', 'To calculate the spread and commissions', 'To check the economic news calendar'], answer: 0 },
  { concept: 'HTF-bias',           q: 'If the Higher Time Frame (HTF) bias is bullish, you should:',    choices: ['Look strictly for buy setups on lower time frames', 'Look strictly for sell setups on lower time frames', 'Trade counter-trend on micro charts', 'Avoid trading completely'], answer: 0 },
  { concept: 'killzones',          q: 'ICT Killzones refer to:',                                       choices: ['Specific time windows of high institutional activity and volatility', 'Areas where your account is at risk of margin call', 'Support and resistance lines on the chart', 'Price levels where volume is zero'], answer: 0 },
  { concept: 'london-killzone',    q: 'When does the London Killzone occur in New York Time?',         choices: ['2:00 AM – 5:00 AM', '8:00 PM – 12:00 AM', '7:00 AM – 10:00 AM', '12:00 PM – 2:00 PM'], answer: 0 },
  { concept: 'new-york-killzone',   q: 'The New York Killzone is generally active during:',             choices: ['7:00 AM – 10:00 AM NY Time', '2:00 AM – 5:00 AM NY Time', '8:00 PM – 12:00 AM NY Time', '10:00 AM – 12:00 PM NY Time'], answer: 0 },
  { concept: 'inducement',         q: 'In SMC, an inducement (IDM) is defined as:',                    choices: ['A deliberate market trap to lure retail traders and build liquidity', 'An bonus payment from your broker', 'A candlestick patterns that is always green', 'A type of trailing stop loss'], answer: 0 },
  { concept: 'liquidity-sweeps',   q: 'A liquidity sweep occurs when price:',                          choices: ['Clears stop-losses above/below swing points before reversing', 'Moves sideways in low volume consolidation', 'Stays exactly at a key Fibonacci level', 'Breaks out with no retracement'], answer: 0 },
  { concept: 'emotional-independence', q: 'What is "emotional independence" in trading?',             choices: ['Not caring about the outcome of any single trade', 'Trading without checking the news', 'Using a small leverage', 'Never taking a stop loss'], answer: 0 },
  { concept: 'revenge-trading',    q: 'How does Brah Goh suggest stopping revenge trading?',           choices: ['Walking away and implementing a hard cooldown lockout', 'Increasing risk to win it back faster', 'Switching to a different currency pair', 'Adding more technical indicators'], answer: 0 },
  { concept: 'consistency-over-excitement', q: 'Trading for entertainment is a sign of:',              choices: ['A retail/gambling mindset', 'A professional trading career', 'High emotional intelligence', 'An optimized edge'], answer: 0 },
  { concept: 'order-block', q: 'What characterizes a valid institutional Order Block (OB)?', choices: ['The last sell candle before a strong buy impulse (or vice versa)', 'Any daily high or low', 'A period of complete market consolidation with low volume', 'A candle with no wicks at all'], answer: 0 },
  { concept: 'tape-reading', q: 'What is "tape reading" in the context of order flow dynamics?', choices: ['Analyzing time & sales alongside bid-ask depth to sense price velocity', 'Drawing trend lines on historical charts', 'Following advice from newspaper articles', 'Setting up automated stop loss orders'], answer: 0 },
  { concept: 'AMD', q: 'In the Power of Three (AMD Strategy), what do the phases stand for?', choices: ['Accumulation, Manipulation, Distribution', 'Analysis, Mitigation, Drawdown', 'Aggressive, Moderate, Defensive', 'Ask, Median, Bid'], answer: 0 },
  { concept: 'breaker-block', q: 'What is a key difference between a Breaker Block and a Mitigation Block?', choices: ['A Breaker Block sweeps liquidity before structural failure, while a Mitigation Block does not', 'A Mitigation Block is only used on weekly timeframes', 'Breaker Blocks are always bullish and Mitigation Blocks are always bearish', 'Mitigation Blocks require a news release to validate'], answer: 0 },
  { concept: 'dealing-range', q: 'What is a "dealing range" in market maker models?', choices: ['The price boundaries between a defined swing high and swing low where orders are engineered', 'The total spread cost of a transaction', 'The time window of the Asian session', 'A series of custom indicators used for scalping'], answer: 0 },
  { concept: 'risk-management', q: 'What is the recommended max risk per trade in professional trading?', choices: ['1% – 2% of account balance', '5% – 10% of account balance', '50% of account balance', 'Whatever leverage allows'], answer: 0 },
  { concept: 'position-sizing', q: 'Position sizing determines:', choices: ['How many lots or units to trade based on balance and SL distance', 'Which direction the market will go next', 'When high-impact news releases occur', 'The maximum number of trades you can take in a day'], answer: 0 },
  { concept: 'drawdown-control', q: 'A drawdown circuit breaker should trigger when:', choices: ['Your daily loss reaches a predefined maximum limit', 'You lose three trades in a row', 'The market is in consolidation', 'High-impact news is released'], answer: 0 },
  { concept: 'kelly-criterion', q: 'The Kelly Criterion formula calculates:', choices: ['The optimal percentage of capital to risk based on win rate and R:R', 'The exact price level of an institutional Order Block', 'The daily drawdown lockout cooldown duration', 'The average win-to-loss ratio split'], answer: 0 },
  { concept: 'mitigation', q: 'In SMC/ICT, what is "mitigation"?', choices: ['Price returning to an Order Block to close drawing-down positions at break-even', 'Setting a trailing stop loss to lock in profits', 'Diversifying your trading capital across multiple assets', 'A type of automated bot that executes trades'], answer: 0 },
  { concept: 'mitigation-block', q: 'A Mitigation Block is best described as:', choices: ['A broken order block that did not sweep liquidity before a structural break', 'An indicator that overlays daily trading volume', 'A high-impact news event that stops market movement', 'A daily range high that is never revisited'], answer: 0 },
  { concept: 'market-maker-model', q: 'What do MMBM and MMSM represent in Market Maker Models?', choices: ['Market Maker Buy Model and Market Maker Sell Model', 'Momentum Moving Average Buy and Sell Methods', 'Multi-Market Balance Model and Swing Margin', 'Margin Minimum Balance Multiplier'], answer: 0 },
  { concept: 'premarket-routine', q: 'Why is a pre-market routine critical for professional trading?', choices: ['It establishes HTF bias, news filters, and rules to eliminate emotional errors', 'It guarantees that every trade taken will be profitable', 'It allows you to trade without any risk or stop losses', 'It automatically calculates commissions and spreads'], answer: 0 },
  { concept: 'pullback-trading', q: 'In Brad Goh\'s pullback strategy, what are pullbacks considered?', choices: ['Temporary pauses against the main trend that act as market fuel', 'Signs that the trend is completely reversing', 'Retail traps that should never be traded', 'Periods of zero market liquidity'], answer: 0 },
  { concept: 'sweep-pullbacks', q: 'A "sweep pullback" is characterized by price:', choices: ['Retracing to sweep liquidity past a recent swing point before resuming trend', 'Moving in a straight line with no retracement whatsoever', 'Consolidating slowly for days without breaking key levels', 'Executing a clean lower-timeframe double top reversal'], answer: 0 },
  { concept: 'aggressive-vs-conservative', q: 'What is a "conservative entry" in a pullback strategy?', choices: ['Waiting for a lower timeframe market shift (reversal confirmation) inside the zone', 'Setting a limit order directly on the outer edge of a zone', 'Entering immediately as soon as price touches the FVG', 'Trading without a stop loss to give price room to breathe'], answer: 0 }
];

const OPEN_ENDED_TEMPLATES = [
  'In your own words, explain what "{concept}" means and how you would identify it on a chart.',
  'Describe a scenario where "{concept}" would help you make a better trading decision.',
  'How does "{concept}" connect to the other concepts you have learned so far?',
];

export const ASSIGNMENT_TEMPLATES = [
  'Identify 3 {concept} setups on {asset} ({timeframe} chart). Screenshot and annotate each.',
  'Back-test {concept} on {asset} over the last 20 candles on the {timeframe} timeframe. Record win rate.',
  'Mark all {concept} zones on the {asset} {timeframe} chart from the current week.',
  'Write a 100-word summary explaining how {concept} applies to {asset} on the {timeframe} timeframe.',
  'Find a live {concept} setup on {asset} ({timeframe}). Plan entry, stop, and target before it triggers.',
  'Compare {concept} across two timeframes on {asset}. Note differences in clarity.',
  'Journal 3 key observations about {concept} behaviour on {asset} ({timeframe}) during London session.',
  'Create a checklist for trading {concept} setups on {asset}. Include at least 5 criteria.',
];

const STORAGE_LESSONS = 'lessons';
const STORAGE_ASSIGNMENTS = 'assignments';
const STORAGE_JOURNAL = 'extra_study_journal';
const RANDOM_ASSETS = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'BTC/USD', 'NAS100', 'US30', 'GBP/JPY'];
const RANDOM_TIMEFRAMES = ['M15', 'M30', 'H1', 'H4', 'D1'];

const JOURNAL_CATEGORIES = [
  'Order Flow', 'Psychology', 'Risk Management', 'Killzones',
  'Price Action', 'Mindset', 'Market Structure', 'Supply & Demand', 'Other'
];

// --- Data Layer ---

export function getLessons() { return storage.get(STORAGE_LESSONS, []); }

export function saveLessonEntry(lessonData) {
  const lessons = getLessons();
  const entry = { id: generateId(), ...lessonData, notes: sanitizeText(lessonData.notes || '', 2000), createdAt: new Date().toISOString() };
  lessons.push(entry);
  storage.set(STORAGE_LESSONS, lessons);
  

  
  // Check general achievements dynamically to prevent cycle
  try {
    import('./streaks.js').then(({ checkAndUnlockAchievements }) => {
      checkAndUnlockAchievements('lesson');
    });
  } catch (e) {
    console.error(e);
  }
  
  return entry;
}

export function getAssignments() { return storage.get(STORAGE_ASSIGNMENTS, []); }

export function saveAssignment(assignment) {
  const assignments = getAssignments();
  const entry = { id: generateId(), ...assignment, completed: false, createdAt: new Date().toISOString() };
  assignments.push(entry);
  storage.set(STORAGE_ASSIGNMENTS, assignments);
  return entry;
}

function getJournalEntries() { return storage.get(STORAGE_JOURNAL, []); }

function saveJournalEntry(data) {
  const entries = getJournalEntries();

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayKey = `${y}-${m}-${d}`;

  const entry = {
    id: generateId(),
    title: sanitizeText(data.title, 200),
    source: sanitizeText(data.source || 'Brah Goh', 100),
    link: data.link || '',
    takeaways: sanitizeText(data.takeaways, 5000),
    category: data.category || 'Other',
    createdAt: new Date().toISOString(),
    localDate: todayKey,
  };
  entries.push(entry);
  storage.set(STORAGE_JOURNAL, entries);

  // Auto-check the extra_study habit for today
  const habits = storage.get('habits', []);
  const studyHabit = habits.find(h => h.id === 'extra_study');
  if (studyHabit && !(studyHabit.log && studyHabit.log[todayKey])) {
    if (!studyHabit.log) studyHabit.log = {};
    studyHabit.log[todayKey] = true;
    storage.set('habits', habits);
  }

  // Award XP
  addXP('extra_study', 10);

  // Push to cloud
  import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
    if (getCurrentUser()) pushToCloud();
  });

  return entry;
}

export function getConceptLibrary() {
  const lessons = getLessons();
  const conceptSet = new Set();
  
  // Scans logged lessons
  lessons.forEach((l) => { if (Array.isArray(l.concepts)) l.concepts.forEach((c) => conceptSet.add(c)); });
  
  // Scans static curriculum
  BRAH_GOH_CURRICULUM.filter(ep => !ep.locked).forEach((ep) => { ep.concepts.forEach((c) => conceptSet.add(c)); });
  
  // Scans unlocked custom overrides
  const overrides = storage.get('bg_unlocked_lessons', {});
  Object.values(overrides).forEach(lesson => {
    if (Array.isArray(lesson.concepts)) {
      lesson.concepts.forEach(c => conceptSet.add(c));
    }
  });
  
  return [...conceptSet];
}

export function generateCumulativeAssignment(episodeNum, asset, timeframe) {
  const steps = [];

  // Add Top Down if selected >= 11
  if (episodeNum >= 11) {
    steps.push({
      title: 'Top Down Analysis [Ep 11]',
      text: `Analyze the market structure on a Higher Time Frame (e.g., H4) to establish a clear directional bias, then zoom into the ${timeframe} chart to execute.`
    });
  }

  // Always include Market Structure if >= 5
  if (episodeNum >= 5) {
    steps.push({
      title: 'Market Structure [Ep 5]',
      text: `Identify the trend on the ${asset} ${timeframe} chart. Mark the most recent Break of Structure (BOS) or Change of Character (CHOCH), and label swing highs/lows.`
    });
  }

  // Include Supply & Demand if >= 7
  if (episodeNum >= 7) {
    steps.push({
      title: 'Supply & Demand [Ep 7]',
      text: `Locate and mark the institutional Supply or Demand zone (Order Block) responsible for the structural breakout.`
    });
  }

  // Include Premium/Discount if >= 8
  if (episodeNum >= 8) {
    steps.push({
      title: 'Premium / Discount & Fibonacci [Ep 8]',
      text: `Draw a Fibonacci retracement from the swing low to swing high (or vice-versa). Ensure the price is in Discount (for buys) or Premium (for sells) inside the OTE (0.618 - 0.786) region.`
    });
  }

  // Include Fair Value Gaps if >= 9
  if (episodeNum >= 9) {
    steps.push({
      title: 'Fair Value Gaps [Ep 9]',
      text: `Spot any unmitigated Fair Value Gaps (FVG) or imbalances overlapping with your zone of interest.`
    });
  }

  // Include Liquidity & Inducement if >= 13
  if (episodeNum >= 13) {
    steps.push({
      title: 'Liquidity & Inducements [Ep 13]',
      text: `Identify the Inducement (IDM) level / retail trap. Wait for price to sweep the liquidity of that swing high/low before entry.`
    });
  }

  // Include ICT Killzones if >= 12
  if (episodeNum >= 12) {
    steps.push({
      title: 'ICT Killzones [Ep 12]',
      text: `Verify that your trade execution falls strictly within a valid ICT Killzone (London: 2-5 AM, NY: 7-10 AM, or Asian: 8-12 PM New York time).`
    });
  }

  // Always include Candlestick trigger if >= 6
  if (episodeNum >= 6) {
    steps.push({
      title: 'Candlestick Confirmation [Ep 6]',
      text: `Wait for a candlestick rejection confirmation (e.g. bullish/bearish engulfing, pin bar, or strong wick rejection) inside the zone before entry.`
    });
  }

  // Handle any custom dynamic lessons (> 13)
  const overrides = storage.get('bg_unlocked_lessons', {});
  const unlockedList = Object.values(overrides).filter(x => x.episode <= episodeNum);
  unlockedList.forEach(ul => {
    if (ul.episode > 13) {
      if (Array.isArray(ul.concepts)) {
        ul.concepts.forEach(concept => {
          const exists = steps.some(s => s.title.toLowerCase().includes(concept.toLowerCase()));
          if (!exists) {
            const cleanConceptName = concept.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            steps.push({
              title: `${cleanConceptName} [Ep ${ul.episode}]`,
              text: `Locate and verify the ${cleanConceptName} setup on the chart for ${asset}.`
            });
          }
        });
      }
    }
  });

  const text = `Cumulative Trade Setup [Level ${episodeNum}]: Perform a full multi-confluence analysis on ${asset} (${timeframe} chart) integrating all steps from Episode 5 up to Episode ${episodeNum}.`;
  
  return {
    text,
    episodeNum,
    asset,
    timeframe,
    steps
  };
}

export function generateAssignment(conceptLibrary) {
  // Fallback compatibility wrapper
  const asset = RANDOM_ASSETS[Math.floor(Math.random() * RANDOM_ASSETS.length)];
  const timeframe = RANDOM_TIMEFRAMES[Math.floor(Math.random() * RANDOM_TIMEFRAMES.length)];
  return generateCumulativeAssignment(9, asset, timeframe);
}

function openPracticeLevelSelector(onRefresh) {
  const { body, close } = createModal('🎲 Practice Level Selector');

  body.appendChild(el('p', 'unlock-hint', 'Choose your practice level. Level 5 covers Market Structure. Each higher level adds confluences cumulatively (e.g., Level 9 adds FVGs on top of S/D, Fib, and Structure).'));

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Level selection group
  const lvlGroup = el('div', 'form-group');
  lvlGroup.appendChild(el('label', 'form-label', 'Confluence Level'));
  
  const lvlSelect = document.createElement('select');
  lvlSelect.className = 'form-select';
  lvlSelect.name = 'level';
  
  // Find which levels are unlocked
  const overrides = storage.get('bg_unlocked_lessons', {});
  const effectiveCurriculum = BRAH_GOH_CURRICULUM.map(ep => {
    if (overrides[ep.id]) return { ...ep, ...overrides[ep.id], locked: false };
    return ep;
  });

  // Filter episodes >= 5 that are not locked
  const activeLevels = effectiveCurriculum.filter(ep => ep.episode >= 5 && !ep.locked);

  if (activeLevels.length === 0) {
    const opt = el('option', '', 'No levels unlocked yet (need Ep 5+)');
    opt.value = '';
    lvlSelect.appendChild(opt);
  } else {
    activeLevels.forEach(ep => {
      const opt = el('option', '', `Level ${ep.episode}: ${ep.title}`);
      opt.value = String(ep.episode);
      lvlSelect.appendChild(opt);
    });
  }
  lvlGroup.appendChild(lvlSelect);
  form.appendChild(lvlGroup);

  // Asset selection
  const assetGroup = el('div', 'form-group');
  assetGroup.appendChild(el('label', 'form-label', 'Asset Pair (Optional)'));
  const assetSelect = document.createElement('select');
  assetSelect.className = 'form-select';
  assetSelect.name = 'asset';
  const defAssetOpt = el('option', '', '— Random Asset —');
  defAssetOpt.value = '';
  assetSelect.appendChild(defAssetOpt);
  
  RANDOM_ASSETS.forEach(asset => {
    const opt = el('option', '', asset);
    opt.value = asset;
    assetSelect.appendChild(opt);
  });
  assetGroup.appendChild(assetSelect);
  form.appendChild(assetGroup);

  // Timeframe selection
  const tfGroup = el('div', 'form-group');
  tfGroup.appendChild(el('label', 'form-label', 'Timeframe (Optional)'));
  const tfSelect = document.createElement('select');
  tfSelect.className = 'form-select';
  tfSelect.name = 'timeframe';
  const defTfOpt = el('option', '', '— Random Timeframe —');
  defTfOpt.value = '';
  tfSelect.appendChild(defTfOpt);
  
  RANDOM_TIMEFRAMES.forEach(tf => {
    const opt = el('option', '', tf);
    opt.value = tf;
    tfSelect.appendChild(opt);
  });
  tfGroup.appendChild(tfSelect);
  form.appendChild(tfGroup);

  // Submit button
  const submitBtn = el('button', 'btn btn-primary btn-lg', 'Generate Setup ⚡');
  submitBtn.type = 'submit';
  if (activeLevels.length === 0) submitBtn.disabled = true;
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const lvlVal = lvlSelect.value;
    if (!lvlVal) return;

    const level = Number(lvlVal);
    const asset = assetSelect.value || RANDOM_ASSETS[Math.floor(Math.random() * RANDOM_ASSETS.length)];
    const timeframe = tfSelect.value || RANDOM_TIMEFRAMES[Math.floor(Math.random() * RANDOM_TIMEFRAMES.length)];

    const assignment = generateCumulativeAssignment(level, asset, timeframe);
    close();
    openExercisePopup(assignment, onRefresh);
  });

  body.appendChild(form);
}

function compressImage(file, maxSize = 1000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

function openNotesImageModal(title, imageSrc) {
  const { body } = createModal(title);
  
  const img = document.createElement('img');
  img.src = imageSrc;
  img.style.width = '100%';
  img.style.maxHeight = '70vh';
  img.style.objectFit = 'contain';
  img.style.borderRadius = 'var(--radius-md)';
  img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  
  const container = el('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = 'var(--space-3)';
  container.appendChild(img);
  
  const dlLink = el('a', 'btn btn-secondary', '📥 Download Notes');
  dlLink.href = imageSrc;
  dlLink.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.jpg`;
  dlLink.style.width = '100%';
  dlLink.style.justifyContent = 'center';
  dlLink.style.display = 'inline-flex';
  dlLink.style.alignItems = 'center';
  container.appendChild(dlLink);
  
  body.appendChild(container);
}

// --- Dom Helpers ---

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function createModal(title) {
  const overlay = el('div', 'modal-overlay');
  const modal = el('div', 'modal');

  // Mobile sheet grab bar
  const grabHandle = el('div', 'modal-swipe-handle');
  modal.appendChild(grabHandle);

  // Top bar with colored stripe
  const topBar = el('div', 'modal__topbar');
  modal.appendChild(topBar);

  const header = el('div', 'modal__header');
  header.appendChild(el('h2', 'modal__title', title));
  const closeBtn = el('button', 'modal__close', '✕');
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', 'modal__body');
  modal.appendChild(body);

  overlay.appendChild(modal);

  function close() {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);
  return { overlay, modal, body, close };
}

// --- Render Functions ---

/* ---------- Mentor Cards + Profile Popup -------------------------- */

function openMentorProfile(mentor, onViewCurriculum) {
  const { body } = createModal(`${mentor.emoji} ${mentor.name}`);

  const profile = el('div', 'mentor-profile');

  // Avatar — check for custom uploaded photo first, then default, then emoji
  const avatarKey = mentor.key || '';
  const customAvatar = avatarKey ? storage.get(`mentor_avatar_${avatarKey}`, null) : null;
  const avatarSrc = customAvatar || mentor.avatar || null;

  const avatarWrap = el('div', 'mentor-profile__avatar');
  avatarWrap.classList.add('mentor-profile__avatar--clickable');

  if (avatarSrc) {
    const img = document.createElement('img');
    img.src = avatarSrc;
    img.alt = mentor.name;
    img.className = 'mentor-profile__img';
    avatarWrap.appendChild(img);
  } else {
    avatarWrap.appendChild(el('span', 'mentor-profile__emoji', mentor.emoji));
  }

  // Camera overlay hint
  const camHint = el('div', 'mentor-profile__cam-hint');
  camHint.appendChild(el('span', '', '📷'));
  avatarWrap.appendChild(camHint);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Resize any image to 200x200 via canvas to keep localStorage small
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const SIZE = 200;
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      // Crop to center square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, SIZE, SIZE);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const saved = storage.set(`mentor_avatar_${avatarKey}`, dataUrl);

      if (!saved) {
        const warn = el('p', 'mentor-profile__upload-warn', '⚠️ Could not save — storage may be full.');
        profile.insertBefore(warn, profile.children[1]);
        setTimeout(() => warn.remove(), 3000);
        return;
      }

      // Update displayed image immediately
      const existingImg = avatarWrap.querySelector('.mentor-profile__img');
      if (existingImg) {
        existingImg.src = dataUrl;
      } else {
        avatarWrap.replaceChildren();
        const newImg = document.createElement('img');
        newImg.src = dataUrl;
        newImg.alt = mentor.name;
        newImg.className = 'mentor-profile__img';
        avatarWrap.appendChild(newImg);
        avatarWrap.appendChild(camHint);
      }
    };
    img.src = URL.createObjectURL(file);
  });
  avatarWrap.appendChild(fileInput);

  avatarWrap.addEventListener('click', () => fileInput.click());
  profile.appendChild(avatarWrap);

  // Name + role
  profile.appendChild(el('h2', 'mentor-profile__name', mentor.name));
  profile.appendChild(el('p', 'mentor-profile__role', mentor.role));

  // Bio
  const bio = el('p', 'mentor-profile__bio');
  bio.textContent = mentor.bio;
  profile.appendChild(bio);

  // Stats
  if (mentor.stats) {
    const statsRow = el('div', 'mentor-profile__stats');
    mentor.stats.forEach(({ label, value, icon }) => {
      const stat = el('div', 'mentor-profile__stat');
      stat.appendChild(el('span', 'mentor-profile__stat-icon', icon));
      stat.appendChild(el('span', 'mentor-profile__stat-value', value));
      stat.appendChild(el('span', 'mentor-profile__stat-label', label));
      statsRow.appendChild(stat);
    });
    profile.appendChild(statsRow);
  }

  // Teaching style / focus areas
  if (mentor.focusAreas) {
    const tagSection = el('div', 'mentor-profile__focus');
    tagSection.appendChild(el('h4', 'mentor-profile__section-title', 'Focus Areas'));
    const tags = el('div', 'concept-tags');
    mentor.focusAreas.forEach(a => tags.appendChild(el('span', 'tag', a)));
    tagSection.appendChild(tags);
    profile.appendChild(tagSection);
  }

  // Channel links
  if (mentor.channels && mentor.channels.length > 0) {
    const chSection = el('div', 'mentor-profile__focus');
    chSection.appendChild(el('h4', 'mentor-profile__section-title', 'YouTube Channels'));
    const chGrid = el('div', '');
    chGrid.style.display = 'flex';
    chGrid.style.flexDirection = 'column';
    chGrid.style.gap = 'var(--space-2)';
    mentor.channels.forEach(ch => {
      const link = el('a', 'btn btn-ghost');
      link.textContent = `📺 ${ch.label}`;
      link.href = ch.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.justifyContent = 'flex-start';
      link.style.textAlign = 'left';
      link.style.fontSize = 'var(--text-sm)';
      chGrid.appendChild(link);
    });
    chSection.appendChild(chGrid);
    profile.appendChild(chSection);
  }

  // Link (course playlist)
  if (mentor.link) {
    const linkBtn = el('a', 'btn btn-secondary btn-lg mentor-profile__link');
    linkBtn.textContent = `📺 ${mentor.linkLabel || 'Watch Playlist'}`;
    linkBtn.href = mentor.link;
    linkBtn.target = '_blank';
    linkBtn.rel = 'noopener noreferrer';
    profile.appendChild(linkBtn);
  }

  // Action to scroll to curriculum
  if (mentor.hasCurriculum) {
    const scrollBtn = el('button', 'btn btn-outline btn-lg', '📚 View Curriculum');
    scrollBtn.style.marginTop = 'var(--space-3)';
    scrollBtn.style.width = '100%';
    scrollBtn.addEventListener('click', () => {
      body.closest('.modal-overlay').style.opacity = '0';
      setTimeout(() => body.closest('.modal-overlay').remove(), 250);
      
      if (typeof onViewCurriculum === 'function') {
        onViewCurriculum();
      }

      setTimeout(() => {
        const selector = mentor.key === 'bossAckah' ? '.ba-curriculum-section' : '.curriculum-section:not(.ba-curriculum-section)';
        const timeline = document.querySelector(selector);
        if (timeline) timeline.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    });
    profile.appendChild(scrollBtn);
  }

  body.appendChild(profile);
}

const MENTOR_DATA = {
  brahGoh: {
    emoji: '🧠',
    name: 'Brad Goh',
    role: 'ICT / SMC Trading Educator',
    avatar: 'img/brad-goh.png',
    bio: 'Brad Goh is a trading educator running three YouTube channels — @bradgtrades for trade breakdowns and live analysis, @bradgohofficial for personal branding and lifestyle content, and @thetradinggeek for in-depth trading education. His flagship 34-lesson course teaches ICT (Inner Circle Trader) and Smart Money Concepts from the ground up, covering market structure, price action, supply & demand zones, fair value gaps, Fibonacci entries, candlestick patterns, and the psychology behind consistent trading. Known for breaking down complex institutional concepts into practical, step-by-step lessons.',
    focusAreas: ['Market Structure', 'Price Action', 'Supply & Demand', 'Fair Value Gaps', 'Fibonacci / OTE', 'Candlestick Patterns', 'Trading Psychology', 'Order Flow', 'ICT Concepts', 'Smart Money'],
    link: 'https://youtube.com/playlist?list=PLBYSdC_HMWMrXE0cmstpBbcIN5pLgebEm',
    linkLabel: 'Course Playlist',
    hasCurriculum: true,
    channels: [
      { handle: '@bradgtrades', url: 'https://youtube.com/@bradgtrades', label: 'BradG Trades' },
      { handle: '@bradgohofficial', url: 'https://youtube.com/@bradgohofficial', label: 'Brad Goh Official' },
      { handle: '@thetradinggeek', url: 'https://youtube.com/@thetradinggeek', label: 'The Trading Geek' },
    ],
  },
  bossAckah: {
    emoji: '👑',
    name: 'Boss Ackah',
    role: 'Personal Mentor — Professional Skills',
    avatar: 'img/boss-ackah.png',
    bio: '"This is not a gimmick stuff. This is a professional skills acquisition course. It\'s not about the money — the money is embedded in the knowledge and experience. It\'s a very powerful skill to gain but requires a lot of commitment and focus. We will first focus on the mindset. That\'s the most important aspect of this venture because this money printing business — knowing that money clouds the mind if not well managed." — Boss Ackah',
    focusAreas: ['Trading Psychology', 'Mindset', 'Risk Management', 'Professional Skills', 'Discipline', 'Emotional Control'],
    link: null,
    linkLabel: null,
    hasCurriculum: true,
    channels: [],
  },
};

export const BOSS_ACKAH_CURRICULUM = [
  {
    id: 'ba-1',
    lesson: 1,
    title: 'Trading for a Living — Psychology Audio',
    type: 'audio',
    concepts: ['trading-psychology', 'mindset', 'emotional-control', 'discipline', 'focus'],
    description: 'Listen to this audio as if your whole life depends on it. Take notes of the important points that make sense to you. Share your notes after this assignment.',
    resource: 'https://youtu.be/ocHNbkQohMQ?si=iz8rWMTz-dDjwrFn',
    resourceLabel: 'Trading for a Living — Psychology',
    instructions: 'Watch/listen → Take notes → Share notes with Boss Ackah',
  },
];

const STORAGE_BA_LESSONS = 'ba_lessons';
const STORAGE_BA_PROGRESS = 'ba_progress';

function getBaLessons() { return storage.get(STORAGE_BA_LESSONS, []); }
function getBaProgress(lessonId) { return storage.get(`${STORAGE_BA_PROGRESS}_${lessonId}`, { percent: 0, notes: '' }); }
function saveBaProgress(lessonId, data) { storage.set(`${STORAGE_BA_PROGRESS}_${lessonId}`, data); }

let _activeMentor = 'bradGoh';

function renderMentorCards(container, onLessonLogged, curriculumContainer, baCurriculumContainer) {
  container.replaceChildren();
  const grid = el('div', 'mentor-grid');

  // ── Brad Goh card ──
  const completedCount = getLessons().length;
  const totalLessons = BRAH_GOH_CURRICULUM.length;

  const gohCard = el('div', `mentor-card mentor-active${_activeMentor === 'bradGoh' ? ' mentor-selected' : ''}`);
  gohCard.style.cursor = 'pointer';
  gohCard.appendChild(el('span', 'mentor-emoji', '🧠'));
  gohCard.appendChild(el('h3', 'mentor-name', 'Brad Goh'));
  gohCard.appendChild(el('p', 'mentor-status', `${completedCount} of ${totalLessons} lessons logged`));

  const progressWrap = el('div', 'mentor-progress');
  const progressBar = el('div', 'mentor-progress__bar');
  progressBar.style.width = `${(completedCount / totalLessons) * 100}%`;
  progressWrap.appendChild(progressBar);
  gohCard.appendChild(progressWrap);

  gohCard.appendChild(el('p', 'mentor-desc', 'Tap to view curriculum & profile'));

  // Profile on long-press / right-click alternative: small profile icon
  const gohProfileBtn = el('button', 'mentor-profile-btn', 'ℹ️');
  gohProfileBtn.setAttribute('aria-label', 'View profile');
  gohProfileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const gohData = { ...MENTOR_DATA.brahGoh, key: 'brahGoh' };
    gohData.stats = [
      { icon: '📚', label: 'Lessons', value: `${completedCount}/${totalLessons}` },
      { icon: '📝', label: 'Assignments', value: String(getAssignments().length) },
      { icon: '🧩', label: 'Concepts', value: String(getConceptLibrary().length) },
    ];
    openMentorProfile(gohData, () => {
      _activeMentor = 'bradGoh';
      switchCurriculumTab(curriculumContainer, baCurriculumContainer, 'bradGoh');
      grid.querySelectorAll('.mentor-card').forEach(c => c.classList.remove('mentor-selected'));
      gohCard.classList.add('mentor-selected');
    });
  });
  gohCard.appendChild(gohProfileBtn);

  // Click to switch tab
  gohCard.addEventListener('click', () => {
    _activeMentor = 'bradGoh';
    switchCurriculumTab(curriculumContainer, baCurriculumContainer, 'bradGoh');
    // Update selected state
    grid.querySelectorAll('.mentor-card').forEach(c => c.classList.remove('mentor-selected'));
    gohCard.classList.add('mentor-selected');
  });
  grid.appendChild(gohCard);

  // ── Boss Ackah card ──
  const baLessons = getBaLessons();
  const baTotalLessons = BOSS_ACKAH_CURRICULUM.length;
  const baCompletedCount = baLessons.length;

  const ackahCard = el('div', `mentor-card mentor-active${_activeMentor === 'bossAckah' ? ' mentor-selected' : ''}`);
  ackahCard.style.cursor = 'pointer';
  ackahCard.appendChild(el('span', 'mentor-emoji', '👑'));
  ackahCard.appendChild(el('h3', 'mentor-name', 'Boss Ackah'));
  ackahCard.appendChild(el('p', 'mentor-status', `${baCompletedCount} of ${baTotalLessons} lesson${baTotalLessons !== 1 ? 's' : ''} logged`));

  const baProgressWrap = el('div', 'mentor-progress');
  const baProgressBar = el('div', 'mentor-progress__bar');
  baProgressBar.style.width = `${baTotalLessons > 0 ? (baCompletedCount / baTotalLessons) * 100 : 0}%`;
  baProgressBar.style.background = 'linear-gradient(90deg, #8e0e00, #b91c1c)';
  baProgressWrap.appendChild(baProgressBar);
  ackahCard.appendChild(baProgressWrap);

  ackahCard.appendChild(el('p', 'mentor-desc', 'Tap to view curriculum & profile'));

  const ackahProfileBtn = el('button', 'mentor-profile-btn', 'ℹ️');
  ackahProfileBtn.setAttribute('aria-label', 'View profile');
  ackahProfileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ackahData = { ...MENTOR_DATA.bossAckah, key: 'bossAckah' };
    ackahData.stats = [
      { icon: '📚', label: 'Lessons', value: `${baCompletedCount}/${baTotalLessons}` },
      { icon: '🧠', label: 'Focus', value: 'Psychology' },
    ];
    openMentorProfile(ackahData, () => {
      _activeMentor = 'bossAckah';
      switchCurriculumTab(curriculumContainer, baCurriculumContainer, 'bossAckah');
      grid.querySelectorAll('.mentor-card').forEach(c => c.classList.remove('mentor-selected'));
      ackahCard.classList.add('mentor-selected');
    });
  });
  ackahCard.appendChild(ackahProfileBtn);

  ackahCard.addEventListener('click', () => {
    _activeMentor = 'bossAckah';
    switchCurriculumTab(curriculumContainer, baCurriculumContainer, 'bossAckah');
    grid.querySelectorAll('.mentor-card').forEach(c => c.classList.remove('mentor-selected'));
    ackahCard.classList.add('mentor-selected');
  });
  grid.appendChild(ackahCard);

  container.appendChild(grid);

  // Set initial visibility
  switchCurriculumTab(curriculumContainer, baCurriculumContainer, _activeMentor);
}

function switchCurriculumTab(gohContainer, baContainer, active) {
  if (gohContainer) gohContainer.style.display = active === 'bradGoh' ? 'block' : 'none';
  if (baContainer) baContainer.style.display = active === 'bossAckah' ? 'block' : 'none';
}

/* ---------- Curriculum Timeline ----------------------------------- */

function renderCurriculumLog(container) {
  container.replaceChildren();
  const lessons = getLessons();
  const wrapper = el('div', 'curriculum-section');
  wrapper.appendChild(el('h2', 'section-title', '🧠 Brad Goh Curriculum — 34 Lessons'));

  const timeline = el('div', 'curriculum-timeline');
  const loggedEpisodes = new Set(lessons.map((l) => l.episodeId));
  const STORAGE_UNLOCKED = 'bg_unlocked_lessons';

  function getUnlockedOverrides() {
    return storage.get(STORAGE_UNLOCKED, {});
  }

  function getEffectiveCurriculum() {
    const overrides = getUnlockedOverrides();
    return BRAH_GOH_CURRICULUM.map(ep => {
      if (overrides[ep.id]) {
        return { ...ep, ...overrides[ep.id], locked: false };
      }
      return ep;
    });
  }

  const effectiveCurriculum = getEffectiveCurriculum();

  effectiveCurriculum.forEach((ep) => {
    const isLogged = loggedEpisodes.has(ep.id);
    const isLocked = ep.locked;

    const item = el('div', `timeline-item${isLogged ? ' completed' : ''}${isLocked ? ' locked' : ''}`);

    const marker = el('div', 'timeline-marker');
    marker.textContent = isLogged ? '✅' : isLocked ? '🔒' : '⬜';
    item.appendChild(marker);

    const content = el('div', 'timeline-content');
    content.appendChild(el('h4', 'timeline-ep-title', `Ep ${ep.episode}: ${ep.title}`));

    if (!isLocked && ep.description) {
      content.appendChild(el('p', 'timeline-desc', ep.description));

      if (ep.concepts.length) {
        const tagBar = el('div', 'concept-tags');
        ep.concepts.forEach((c) => tagBar.appendChild(el('span', 'tag', c)));
        content.appendChild(tagBar);
      }

      if (ep.videoUrl) {
        const watchBtn = el('button', 'btn btn-secondary btn-sm', '📺 Watch Video');
        watchBtn.style.marginTop = 'var(--space-2)';
        watchBtn.style.marginRight = 'var(--space-2)';
        watchBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openGuidedVideoModal(ep.title, ep.videoUrl);
        });
        content.appendChild(watchBtn);
      }

      if (!isLogged) {
        const logBtn = el('button', 'btn btn-primary btn-sm', '📖 Log Notes');
        logBtn.style.marginTop = 'var(--space-2)';
        logBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openLogLessonPopup(renderCurriculumLog.bind(null, container), ep.id);
        });
        content.appendChild(logBtn);
      }
    } else if (isLocked) {
      const lockRow = el('div', 'timeline-lock-row');
      lockRow.appendChild(el('p', 'timeline-desc timeline-locked-text', 'Not released yet'));

      const unlockBtn = el('button', 'btn btn-sm btn-unlock', '🔓 Unlock');
      unlockBtn.addEventListener('click', () => openUnlockPopup(ep, container));
      lockRow.appendChild(unlockBtn);
      content.appendChild(lockRow);
    }

    // Show logged notes if any
    const lessonEntry = lessons.find(l => l.episodeId === ep.id);
    if (lessonEntry) {
      const noteCard = el('div', 'timeline-note');
      noteCard.appendChild(el('span', 'timeline-note-label', '📝 Your notes:'));
      noteCard.appendChild(el('p', 'timeline-note-text', lessonEntry.notes || 'No notes'));
      
      if (lessonEntry.notesImage) {
        const thumbDiv = el('div', 'timeline-note-image-thumb');
        thumbDiv.style.marginTop = 'var(--space-2)';
        thumbDiv.style.cursor = 'pointer';
        
        const img = document.createElement('img');
        img.src = lessonEntry.notesImage;
        img.style.maxWidth = '120px';
        img.style.maxHeight = '80px';
        img.style.borderRadius = 'var(--radius-sm)';
        img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        img.style.transition = 'transform 0.2s';
        
        img.addEventListener('mouseenter', () => img.style.transform = 'scale(1.05)');
        img.addEventListener('mouseleave', () => img.style.transform = 'scale(1)');
        
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          openNotesImageModal(`Notes — Ep ${ep.episode}: ${ep.title}`, lessonEntry.notesImage);
        });
        
        thumbDiv.appendChild(img);
        noteCard.appendChild(thumbDiv);
      }
      
      noteCard.appendChild(el('span', 'timeline-note-date', formatDate(lessonEntry.createdAt)));
      content.appendChild(noteCard);
    }

    item.appendChild(content);
    timeline.appendChild(item);
  });

  wrapper.appendChild(timeline);
  container.appendChild(wrapper);
}

const CONCEPT_KEYWORDS = {
  'market structure':  'market-structure',
  'bos':              'BOS',
  'choch':            'CHOCH',
  'break of structure': 'BOS',
  'change of character': 'CHOCH',
  'price action':     'price-action',
  'order flow':       'order-flow',
  'order block':      'order-block',
  'fair value gap':   'fair-value-gap',
  'fvg':              'fair-value-gap',
  'imbalance':        'imbalance',
  'supply':           'supply-demand',
  'demand':           'supply-demand',
  'fibonacci':        'fibonacci',
  'fib':              'fibonacci',
  'ote':              'OTE',
  'optimal trade entry': 'OTE',
  'premium':          'premium-discount',
  'discount':         'premium-discount',
  'candlestick':      'candlestick-patterns',
  'candle':           'candlestick-patterns',
  'engulfing':        'engulfing',
  'pin bar':          'pin-bar',
  'doji':             'doji',
  'wick':             'wicks',
  'psychology':       'psychology',
  'mindset':          'mindset',
  'discipline':       'discipline',
  'risk':             'risk-management',
  'money management': 'money-management',
  'forex':            'forex-basics',
  'leverage':         'leverage',
  'pip':              'pips',
  'lot':              'lots',
  'liquidity':        'liquidity',
  'sweep':            'liquidity-sweep',
  'inducement':       'inducement',
  'entry':            'entry-timing',
  'stop loss':        'stop-loss',
  'take profit':      'take-profit',
  'session':          'session-timing',
  'london':           'session-timing',
  'new york':         'session-timing',
  'asia':             'session-timing',
  'backtest':         'backtesting',
  'journal':          'trade-journaling',
  'trend':            'trend-identification',
  'swing':            'swing-points',
  'accumulation':     'accumulation',
  'distribution':     'distribution',
  'smart money':      'smart-money',
  'ict':              'ICT-concepts',
  'wyckoff':          'wyckoff',
  'chart pattern':    'chart-patterns',
  'head and shoulders': 'chart-patterns',
  'double top':       'chart-patterns',
  'double bottom':    'chart-patterns',
  'support':          'support-resistance',
  'resistance':       'support-resistance',
  'breakout':         'breakout',
  'reversal':         'reversal',
  'continuation':     'continuation',
  'momentum':         'momentum',
  'volume':           'volume',
  'gap':              'gaps',
  'range':            'range',
  'consolidation':    'consolidation',
  'news':             'fundamentals',
  'fundamental':      'fundamentals',
  'flip zone':        'flip-zone',
  'flip zones':       'flip-zone',
  'mitigation':       'failed-zone-mitigation',
  'mitigation block': 'mitigation-block',
  'breaker':          'breaker-block',
  'breaker block':    'breaker-block',
  'propulsion':       'propulsion-block',
  'propulsion block': 'propulsion-block',
  'silver bullet':    'silver-bullet',
  'judas swing':      'judas-swing',
  'judas':            'judas-swing',
  'turtle soup':      'turtle-soup',
  'equal highs':      'equal-highs',
  'equal lows':       'equal-lows',
  'bsl':              'buy-side-liquidity',
  'ssl':              'sell-side-liquidity',
  'buy-side liquidity': 'buy-side-liquidity',
  'sell-side liquidity': 'sell-side-liquidity',
  'market structure shift': 'market-structure-shift',
  'mss':              'market-structure-shift',
  'displacement':     'displacement',
  'liquidity void':   'liquidity-void',
  'volume imbalance': 'volume-imbalance',
  'supply to demand flip': 'supply-to-demand-flip',
  'demand to supply flip': 'demand-to-supply-flip',
  'failed zone mitigation': 'failed-zone-mitigation',
  'failed zone':      'failed-zone-mitigation',
  'power of three':   'power-of-three',
  'po3':              'power-of-three',
  'daily bias':       'daily-bias',
  'killzone':         'killzones',
  'killzones':        'killzones',
  'asian range':      'asian-range',
  'macro':            'macro-timing',
  'consequent encroachment': 'consequent-encroachment',
  'mean threshold':   'mean-threshold',
  'institutional order flow': 'institutional-order-flow',
};

function detectConcepts(title) {
  const lower = title.toLowerCase();
  const found = new Set();
  for (const [keyword, concept] of Object.entries(CONCEPT_KEYWORDS)) {
    if (lower.includes(keyword)) {
      found.add(concept);
    }
  }
  return [...found];
}

function generateDescription(title, episode) {
  return `Episode ${episode} of the Brad Goh ICT/SMC trading course: ${title}.`;
}

function openUnlockPopup(ep, curriculumContainer) {
  const { body, close } = createModal(`🔓 Unlock Ep ${ep.episode}`);

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Prevent Enter key submissions unless from the submit button
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.type !== 'submit') {
      e.preventDefault();
    }
  });

  // Instruction
  body.appendChild(el('p', 'unlock-hint', 'Paste the YouTube video link and the lesson details will be generated automatically.'));

  // YouTube URL input
  const urlGroup = el('div', 'form-group');
  urlGroup.appendChild(el('label', 'form-label', 'YouTube Video Link'));
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.className = 'form-input';
  urlInput.placeholder = 'https://youtu.be/... or https://youtube.com/watch?v=...';
  urlInput.required = true;
  urlGroup.appendChild(urlInput);

  // Status / preview area
  const preview = el('div', 'unlock-preview');
  preview.style.display = 'none';
  urlGroup.appendChild(preview);

  form.appendChild(urlGroup);

  // Fetch button
  const fetchBtn = el('button', 'btn btn-outline', '🔍 Fetch Video Info');
  fetchBtn.type = 'button';

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchBtn.click();
    }
  });

  let fetchedTitle = '';
  let fetchedConcepts = [];

  const tagEditorContainer = el('div', 'tag-editor-container');
  tagEditorContainer.style.marginTop = 'var(--space-4)';

  function slugifyConcept(text) {
    return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Persistent Elements for Tag Editor
  tagEditorContainer.appendChild(el('p', 'unlock-preview-label', '🏷️ CURATE CONCEPTS FOR ASSIGNMENTS & JOURNAL:'));

  const tagList = el('div', 'concept-tags');
  tagList.style.marginBottom = 'var(--space-3)';
  tagEditorContainer.appendChild(tagList);

  const inputRow = el('div', '');
  inputRow.style.display = 'flex';
  inputRow.style.gap = 'var(--space-2)';
  inputRow.style.alignItems = 'center';

  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.className = 'form-input';
  addInput.placeholder = 'Add custom concept (e.g. silver-bullet)';
  addInput.style.flex = '1';
  addInput.style.fontSize = 'var(--text-sm)';
  addInput.style.padding = '0.5rem 0.75rem';

  const addBtn = el('button', 'btn btn-outline', '+ Add');
  addBtn.type = 'button';
  addBtn.style.padding = '0.5rem 1rem';
  addBtn.style.fontSize = 'var(--text-sm)';

  const handleAdd = () => {
    const val = addInput.value.trim();
    if (!val) return;
    const slug = slugifyConcept(val);
    if (slug && !fetchedConcepts.includes(slug)) {
      fetchedConcepts.push(slug);
      renderTagsOnly();
    }
    addInput.value = '';
    addInput.focus(); // Keep focus!
  };

  addBtn.addEventListener('click', handleAdd);
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  });

  inputRow.appendChild(addInput);
  inputRow.appendChild(addBtn);
  tagEditorContainer.appendChild(inputRow);

  function renderTagsOnly() {
    tagList.replaceChildren();

    if (fetchedConcepts.length === 0) {
      const emptyHint = el('p', 'unlock-preview-sub', 'No concept tags added yet. Type a concept below to add one.');
      emptyHint.style.fontSize = 'var(--text-xs)';
      tagList.appendChild(emptyHint);
    } else {
      fetchedConcepts.forEach((c, idx) => {
        const cleanConcept = c.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const tag = el('span', 'tag tag-editable', cleanConcept);
        tag.style.display = 'inline-flex';
        tag.style.alignItems = 'center';
        tag.style.gap = 'var(--space-1)';

        const delBtn = el('span', 'tag-delete', '✕');
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontWeight = 'bold';
        delBtn.style.color = 'var(--text-muted)';
        delBtn.addEventListener('mouseenter', () => delBtn.style.color = '#ff4757');
        delBtn.addEventListener('mouseleave', () => delBtn.style.color = 'var(--text-muted)');
        delBtn.addEventListener('click', () => {
          fetchedConcepts.splice(idx, 1);
          renderTagsOnly();
        });

        tag.appendChild(delBtn);
        tagList.appendChild(tag);
      });
    }
  }

  fetchBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    fetchBtn.textContent = '⏳ Fetching...';
    fetchBtn.disabled = true;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const resp = await fetch(oembedUrl);
      if (!resp.ok) throw new Error('Could not fetch video info');
      const data = await resp.json();

      fetchedTitle = data.title || '';
      fetchedConcepts = detectConcepts(fetchedTitle);

      // Show preview
      preview.replaceChildren();
      preview.style.display = 'block';

      preview.appendChild(el('p', 'unlock-preview-label', '📺 VIDEO FOUND:'));
      preview.appendChild(el('p', 'unlock-preview-title', fetchedTitle));
      
      // Render tags and append tag editor
      renderTagsOnly();
      preview.appendChild(tagEditorContainer);

      fetchBtn.textContent = '✅ Fetched!';
      submitBtn.disabled = false;
    } catch (err) {
      preview.replaceChildren();
      preview.style.display = 'block';
      preview.appendChild(el('p', 'unlock-preview-error', '⚠️ Could not fetch. Check the link and try again.'));
      fetchBtn.textContent = '🔍 Fetch Video Info';
      fetchBtn.disabled = false;
    }
  });
  form.appendChild(fetchBtn);

  // Submit button (disabled until fetch succeeds)
  const submitBtn = el('button', 'btn btn-primary', '🔓 Unlock Lesson');
  submitBtn.type = 'submit';
  submitBtn.disabled = true;
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!fetchedTitle) return;

    const overrides = storage.get('bg_unlocked_lessons', {});
    overrides[ep.id] = {
      title: sanitizeText(fetchedTitle),
      description: generateDescription(fetchedTitle, ep.episode),
      concepts: fetchedConcepts,
      videoUrl: urlInput.value.trim(),
    };
    storage.set('bg_unlocked_lessons', overrides);



    close();
    renderCurriculumLog(curriculumContainer);
  });

  body.appendChild(form);
}

/* ---------- Log Lesson POPUP -------------------------------------- */

function openLogLessonPopup(onSaved, preselectedEpisodeId = null) {
  const { body, close } = createModal('📖 Log a Lesson');

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Episode select — unlocked episodes (including user-unlocked)
  const overrides = storage.get('bg_unlocked_lessons', {});
  const effectiveCurriculum = BRAH_GOH_CURRICULUM.map(ep => {
    if (overrides[ep.id]) return { ...ep, ...overrides[ep.id], locked: false };
    return ep;
  });

  const epSelect = document.createElement('select');
  epSelect.name = 'episodeId';
  epSelect.required = true;
  epSelect.classList.add('form-select');
  const defOpt = el('option', '', '— Select Episode —');
  defOpt.value = '';
  epSelect.appendChild(defOpt);
  effectiveCurriculum.filter(ep => !ep.locked).forEach((ep) => {
    const opt = el('option', '', `Ep ${ep.episode}: ${ep.title}`);
    opt.value = ep.id;
    if (preselectedEpisodeId === ep.id) {
      opt.selected = true;
    }
    epSelect.appendChild(opt);
  });
  if (preselectedEpisodeId) {
    epSelect.style.pointerEvents = 'none';
    epSelect.tabIndex = -1;
    epSelect.style.opacity = '0.7';
  }
  const epGroup = el('div', 'form-group');
  epGroup.appendChild(el('label', 'form-label', 'Episode'));
  epGroup.appendChild(epSelect);
  form.appendChild(epGroup);

  // Key takeaways
  const takeawayInput = document.createElement('textarea');
  takeawayInput.name = 'notes';
  takeawayInput.rows = 4;
  takeawayInput.placeholder = 'Key takeaways from this lesson…';
  takeawayInput.classList.add('form-textarea');
  const taGroup = el('div', 'form-group');
  taGroup.appendChild(el('label', 'form-label', 'Takeaways / Notes'));
  taGroup.appendChild(takeawayInput);
  form.appendChild(taGroup);

  // Rating
  const ratingSelect = document.createElement('select');
  ratingSelect.name = 'rating';
  ratingSelect.classList.add('form-select');
  for (let i = 1; i <= 5; i++) {
    const opt = el('option', '', '⭐'.repeat(i));
    opt.value = String(i);
    ratingSelect.appendChild(opt);
  }
  const rGroup = el('div', 'form-group');
  rGroup.appendChild(el('label', 'form-label', 'Understanding'));
  rGroup.appendChild(ratingSelect);
  form.appendChild(rGroup);

  // Notes Image Upload
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.name = 'notesImageFile';
  fileInput.accept = 'image/*';
  fileInput.className = 'form-input';
  
  const filePreview = el('div', 'notes-file-preview');
  filePreview.style.display = 'none';
  filePreview.style.marginTop = 'var(--space-2)';
  
  let notesImageBase64 = null;
  
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || !file.type.startsWith('image/')) {
      filePreview.style.display = 'none';
      notesImageBase64 = null;
      return;
    }
    
    filePreview.replaceChildren();
    filePreview.style.display = 'block';
    filePreview.appendChild(el('p', '', '⏳ Compressing photo of notes...'));
    
    compressImage(file, 1000).then(base64 => {
      notesImageBase64 = base64;
      filePreview.replaceChildren();
      const img = document.createElement('img');
      img.src = base64;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '150px';
      img.style.borderRadius = 'var(--radius-md)';
      img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      filePreview.appendChild(img);
    }).catch(err => {
      filePreview.replaceChildren();
      filePreview.appendChild(el('p', 'pnl-negative', '⚠️ Error reading image file.'));
      notesImageBase64 = null;
    });
  });
  
  const fileGroup = el('div', 'form-group');
  fileGroup.appendChild(el('label', 'form-label', 'Upload Photo of Notes (Optional)'));
  fileGroup.appendChild(fileInput);
  fileGroup.appendChild(filePreview);
  form.appendChild(fileGroup);

  const submitBtn = el('button', 'btn btn-primary btn-lg', 'Save Lesson 📖');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const episodeId = fd.get('episodeId');
    if (!episodeId) { epSelect.focus(); return; }

    const ep = BRAH_GOH_CURRICULUM.find((c) => c.id === episodeId);
    saveLessonEntry({
      episodeId,
      episodeTitle: ep ? ep.title : '',
      concepts: ep ? ep.concepts : [],
      notes: fd.get('notes') || '',
      rating: Number(fd.get('rating')) || 3,
      notesImage: notesImageBase64
    });
    addXP('lesson', 30);

    close();
    if (typeof onSaved === 'function') onSaved();
  });

  body.appendChild(form);
}

/* ---------- Quiz POPUP with MCQ + Open-ended + Submit/Grade ------- */

function openQuizPopup() {
  const concepts = getConceptLibrary();
  if (!concepts.length) {
    const { body } = createModal('🧩 Quiz');
    body.appendChild(el('p', 'modal-empty', 'Log some lessons first to generate quiz questions.'));
    return;
  }

  const { body } = createModal('🧩 Quick Quiz');

  // Pick 5 MCQ questions that match known concepts
  const matchingMCQ = QUIZ_BANK.filter(q => concepts.includes(q.concept));
  const shuffledMCQ = [...matchingMCQ].sort(() => Math.random() - 0.5).slice(0, 5);

  // Pick 3 open-ended
  const shuffledConcepts = [...concepts].sort(() => Math.random() - 0.5).slice(0, 3);
  const openEnded = shuffledConcepts.map(c => {
    const template = OPEN_ENDED_TEMPLATES[Math.floor(Math.random() * OPEN_ENDED_TEMPLATES.length)];
    return { concept: c, question: template.replace('{concept}', c) };
  });

  let mcqScore = 0;
  let mcqAnswered = 0;
  const mcqTotal = shuffledMCQ.length;
  const openTotal = openEnded.length;
  const totalQ = mcqTotal + openTotal;

  const quizContainer = el('div', 'quiz-container');

  // Live score bar
  const scoreBar = el('div', 'quiz-score-bar');
  scoreBar.appendChild(el('span', '', 'Progress: '));
  const scoreText = el('span', 'quiz-score-text', `0 / ${mcqTotal} MCQ answered`);
  scoreBar.appendChild(scoreText);
  quizContainer.appendChild(scoreBar);

  // MCQ Questions
  shuffledMCQ.forEach((q, idx) => {
    const card = el('div', 'quiz-card');
    card.appendChild(el('p', 'quiz-q', `${idx + 1}. ${q.q}`));
    card.appendChild(el('span', 'quiz-concept-tag tag', q.concept));

    const optionsWrap = el('div', 'quiz-options');
    const choiceIndices = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

    choiceIndices.forEach(ci => {
      const optBtn = el('button', 'quiz-option', q.choices[ci]);
      optBtn.addEventListener('click', () => {
        if (card.classList.contains('quiz-answered')) return;
        card.classList.add('quiz-answered');
        mcqAnswered++;

        if (ci === q.answer) {
          optBtn.classList.add('quiz-option--correct');
          mcqScore++;
          nativeHapticNotification('SUCCESS');
        } else {
          optBtn.classList.add('quiz-option--wrong');
          const allOpts = optionsWrap.querySelectorAll('.quiz-option');
          allOpts.forEach(btn => {
            if (btn.textContent === q.choices[q.answer]) btn.classList.add('quiz-option--correct');
          });
          nativeHapticNotification('ERROR');
        }
        scoreText.textContent = `${mcqAnswered} / ${mcqTotal} MCQ answered`;
      });
      optionsWrap.appendChild(optBtn);
    });

    card.appendChild(optionsWrap);
    quizContainer.appendChild(card);
  });

  // Open-ended Questions
  const textareas = [];
  openEnded.forEach((q, idx) => {
    const qNum = mcqTotal + idx + 1;
    const card = el('div', 'quiz-card quiz-card--open');
    card.appendChild(el('p', 'quiz-q', `${qNum}. ${q.question}`));
    card.appendChild(el('span', 'quiz-concept-tag tag', q.concept));
    card.appendChild(el('p', 'quiz-hint', '✍️ Type your answer below (min 20 characters)'));

    const textarea = document.createElement('textarea');
    textarea.classList.add('form-textarea');
    textarea.rows = 3;
    textarea.placeholder = 'Your answer…';
    card.appendChild(textarea);
    textareas.push({ textarea, card, concept: q.concept });

    quizContainer.appendChild(card);
  });

  // Results container (hidden initially)
  const resultsCard = el('div', 'quiz-results');
  resultsCard.style.display = 'none';
  quizContainer.appendChild(resultsCard);

  // Submit Button
  const submitBtn = el('button', 'btn btn-primary btn-lg quiz-submit-btn', '📝 Submit Quiz');
  submitBtn.addEventListener('click', () => {
    // Force-answer any unanswered MCQs as wrong
    const unansweredCards = quizContainer.querySelectorAll('.quiz-card:not(.quiz-answered):not(.quiz-card--open)');
    unansweredCards.forEach(card => {
      card.classList.add('quiz-answered', 'quiz-skipped');
    });

    // Score open-ended: 1 point if >= 20 chars, 0.5 if >= 10 chars
    let openScore = 0;
    textareas.forEach(({ textarea, card }) => {
      const text = textarea.value.trim();
      card.classList.add('quiz-answered');
      if (text.length >= 20) {
        openScore += 1;
        card.classList.add('quiz-card--pass');
      } else if (text.length >= 10) {
        openScore += 0.5;
        card.classList.add('quiz-card--partial');
      } else {
        card.classList.add('quiz-card--fail');
      }
      textarea.readOnly = true;
    });

    // Calculate final grade
    const totalScore = mcqScore + openScore;
    const maxScore = mcqTotal + openTotal;
    const percentage = Math.round((totalScore / maxScore) * 100);

    // Award XP for taking a quiz
    addXP('quiz', 15);

    // Play arpeggio sound based on quiz performance
    if (percentage >= 90) {
      playSynthSound('fanfare');
    } else if (percentage >= 70) {
      playSynthSound('success');
    } else if (percentage < 50) {
      playSynthSound('fail');
    } else {
      playSynthSound('click');
    }

    // Save quiz score for achievements tracking
    const quizScores = storage.get('quiz_scores', []);
    quizScores.push(percentage);
    storage.set('quiz_scores', quizScores);
    
    if (percentage === 100) {
      const currentTokens = storage.get('streak_freeze_tokens', 0);
      if (currentTokens < 3) {
        storage.set('streak_freeze_tokens', currentTokens + 1);
        showNotificationToast('Perfect Score! Earned 1 Streak Freeze ❄️');
        import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
          if (getCurrentUser()) pushToCloud();
        });
      }
    }

    let grade = 'F';
    let gradeColor = '#ff4757';
    let gradeEmoji = '😤';
    if (percentage >= 90) { grade = 'A+'; gradeColor = '#00ff88'; gradeEmoji = '🔥'; }
    else if (percentage >= 80) { grade = 'A'; gradeColor = '#00ff88'; gradeEmoji = '💪'; }
    else if (percentage >= 70) { grade = 'B'; gradeColor = '#00d4ff'; gradeEmoji = '👏'; }
    else if (percentage >= 60) { grade = 'C'; gradeColor = '#FFFC00'; gradeEmoji = '📈'; }
    else if (percentage >= 50) { grade = 'D'; gradeColor = '#ff8800'; gradeEmoji = '🤔'; }
    else { grade = 'F'; gradeColor = '#ff4757'; gradeEmoji = '😤'; }

    // Build results
    resultsCard.replaceChildren();
    resultsCard.style.display = 'block';

    const gradeCircle = el('div', 'quiz-grade-circle');
    gradeCircle.style.borderColor = gradeColor;
    gradeCircle.appendChild(el('span', 'quiz-grade-letter', grade));
    gradeCircle.appendChild(el('span', 'quiz-grade-emoji', gradeEmoji));
    resultsCard.appendChild(gradeCircle);

    resultsCard.appendChild(el('h3', 'quiz-results__title', `You scored ${percentage}%`));
    resultsCard.appendChild(el('p', 'quiz-results__subtitle', `${totalScore} out of ${maxScore} points`));

    // Breakdown
    const breakdown = el('div', 'quiz-breakdown');
    const mcqRow = el('div', 'quiz-breakdown__row');
    mcqRow.appendChild(el('span', '', '📊 Multiple Choice:'));
    mcqRow.appendChild(el('span', 'quiz-breakdown__val', `${mcqScore} / ${mcqTotal}`));
    breakdown.appendChild(mcqRow);

    const openRow = el('div', 'quiz-breakdown__row');
    openRow.appendChild(el('span', '', '✍️ Open-ended:'));
    openRow.appendChild(el('span', 'quiz-breakdown__val', `${openScore} / ${openTotal}`));
    breakdown.appendChild(openRow);

    resultsCard.appendChild(breakdown);

    // Verdict
    let verdict = '';
    if (percentage >= 80) verdict = 'Excellent! You really understand these concepts. Keep pushing!';
    else if (percentage >= 60) verdict = 'Good effort! Review the concepts you missed and try again.';
    else verdict = 'Keep studying! Re-watch the lessons and come back stronger.';
    resultsCard.appendChild(el('p', 'quiz-results__verdict', verdict));

    // Hide submit button
    submitBtn.style.display = 'none';

    // Scroll to results
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  quizContainer.appendChild(submitBtn);
  body.appendChild(quizContainer);
}

/* ---------- Assignments ------------------------------------------- */

let _activeAssignmentTab = 'active';

function renderAssignments(container, onRefresh) {
  container.replaceChildren();
  const wrapper = el('div', 'assignments-section');
  wrapper.appendChild(el('h2', 'section-title', '📝 Assignments'));

  // Split assignments into Active and Completed
  const allAssignments = getAssignments();
  const activeAssignments = allAssignments.filter(a => !a.completed);
  const completedAssignments = allAssignments.filter(a => a.completed);

  // Tab bar container
  const tabContainer = el('div', 'tab-bar');
  tabContainer.style.marginBottom = 'var(--space-4)';

  const activeBtn = el('button', `tab-btn${_activeAssignmentTab === 'active' ? ' active' : ''}`, `🎯 Active (${activeAssignments.length})`);
  activeBtn.addEventListener('click', () => {
    _activeAssignmentTab = 'active';
    renderAssignments(container, onRefresh);
  });
  tabContainer.appendChild(activeBtn);

  const completedBtn = el('button', `tab-btn${_activeAssignmentTab === 'completed' ? ' active' : ''}`, `🏆 History (${completedAssignments.length})`);
  completedBtn.addEventListener('click', () => {
    _activeAssignmentTab = 'completed';
    renderAssignments(container, onRefresh);
  });
  tabContainer.appendChild(completedBtn);

  wrapper.appendChild(tabContainer);

  const genBtn = el('button', 'btn btn-secondary', '🎲 Generate Exercise');
  genBtn.style.marginBottom = 'var(--space-4)';
  genBtn.addEventListener('click', () => {
    openPracticeLevelSelector(onRefresh);
  });
  wrapper.appendChild(genBtn);

  const filteredAssignments = _activeAssignmentTab === 'active' ? activeAssignments : completedAssignments;

  if (!filteredAssignments.length) {
    const hintText = _activeAssignmentTab === 'active' 
      ? 'No active assignments. Click "Generate Exercise" to start practicing! 🎯' 
      : 'No completed assignments in history yet. Finish some exercises to build your track record! 🏆';
    wrapper.appendChild(el('p', 'empty-hint', hintText));
  } else {
    const list = el('div', 'assignment-list');
    [...filteredAssignments].reverse().forEach((a) => {
      const card = el('div', `assignment-card${a.completed ? ' done' : ''}`);
      card.appendChild(el('p', 'assignment-text', a.text));

      const meta = el('div', 'assignment-meta');
      const conceptTag = a.episodeNum ? `Level ${a.episodeNum}` : (a.concept || 'SMC');
      meta.appendChild(el('span', 'tag', conceptTag));
      meta.appendChild(el('span', 'tag', a.asset));
      meta.appendChild(el('span', 'tag', a.timeframe));
      card.appendChild(meta);

      // Action buttons row
      const actions = el('div', 'assignment-actions');

      // Go to Chart button
      if (!a.completed) {
        const chartBtn = el('button', 'btn btn-sm assignment-btn-chart', '📊 Open Chart');
        chartBtn.addEventListener('click', () => {
          import('./trading.js').then(({ loadChartSymbol }) => {
            loadChartSymbol(a.asset);
          });
        });
        actions.appendChild(chartBtn);
      }

      // View Steps button
      if (Array.isArray(a.steps) && a.steps.length > 0) {
        const stepsBtn = el('button', 'btn btn-sm assignment-btn-steps', '📋 View Steps');
        stepsBtn.addEventListener('click', () => openExercisePopup(a, onRefresh));
        actions.appendChild(stepsBtn);
      }

      const toggleBtn = el('button', 'btn btn-sm assignment-btn-toggle', a.completed ? '↩️ Reopen' : '✅ Done');
      toggleBtn.addEventListener('click', () => {
        const all = getAssignments();
        const target = all.find((x) => x.id === a.id);
        if (target) {
          const wasCompleted = target.completed;
          target.completed = !target.completed;
          
          if (!wasCompleted && target.completed) {
            addXP('assignment', 40);
            const currentTokens = storage.get('streak_freeze_tokens', 0);
            if (currentTokens < 3) {
              storage.set('streak_freeze_tokens', currentTokens + 1);
              showNotificationToast('Assignment Completed! Earned 1 Streak Freeze ❄️');
              playSynthSound('fanfare'); // Triumphant arpeggio for earning freeze token!
            } else {
              playSynthSound('success'); // Ascending arpeggio for completing assignment
            }
          } else {
            playSynthSound('click'); // Quick navigation beep on reopening
          }
          
          storage.set(STORAGE_ASSIGNMENTS, all);
          
          import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
            if (getCurrentUser()) pushToCloud();
          });

          if (typeof onRefresh === 'function') onRefresh();
        }
      });
      actions.appendChild(toggleBtn);

      const delBtn = el('button', 'btn btn-sm assignment-btn-delete', '🗑️ Delete');
      delBtn.addEventListener('click', () => {
        const all = getAssignments().filter(x => x.id !== a.id);
        storage.set(STORAGE_ASSIGNMENTS, all);
        if (typeof onRefresh === 'function') onRefresh();
      });
      actions.appendChild(delBtn);

      card.appendChild(actions);
      list.appendChild(card);
    });
    wrapper.appendChild(list);
  }

  container.appendChild(wrapper);
}

/* ---------- Exercise Popup ---------------------------------------- */

function openExercisePopup(assignment, onRefresh) {
  const overlay = el('div', 'exercise-overlay');

  const card = el('div', 'exercise-card');

  // Gradient top strip
  const strip = el('div', 'exercise-strip');
  card.appendChild(strip);

  // Close button
  const closeBtn = el('button', 'exercise-close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.classList.add('exercise-closing');
    setTimeout(() => overlay.remove(), 300);
  });
  card.appendChild(closeBtn);

  // Icon + Title
  card.appendChild(el('span', 'exercise-icon', '🎯'));
  card.appendChild(el('h2', 'exercise-title', 'Chart Exercise'));
  card.appendChild(el('p', 'exercise-subtitle', 'Complete this task on the live chart'));

  // Task box
  const taskBox = el('div', 'exercise-task-box');
  taskBox.appendChild(el('span', 'exercise-task-label', 'YOUR TASK'));
  taskBox.appendChild(el('p', 'exercise-task-text', assignment.text));
  card.appendChild(taskBox);

  // Tags
  const tagRow = el('div', 'exercise-tag-row');
  const levelTag = assignment.episodeNum ? `Level ${assignment.episodeNum}` : (assignment.concept || 'SMC');
  [assignment.asset, assignment.timeframe, levelTag].forEach(t => {
    tagRow.appendChild(el('span', 'exercise-tag', t));
  });
  card.appendChild(tagRow);

  // Steps
  const stepsBox = el('div', 'exercise-steps-box');
  if (Array.isArray(assignment.steps) && assignment.steps.length > 0) {
    stepsBox.appendChild(el('p', 'exercise-steps-title', 'CONFLUENCE CHECKLIST'));
    assignment.steps.forEach((s, idx) => {
      const step = el('div', 'exercise-step-item');
      step.appendChild(el('span', 'exercise-step-num', String(idx + 1)));
      
      const stepTextWrap = el('div', 'exercise-step-text-wrap');
      stepTextWrap.appendChild(el('strong', 'exercise-step-title-inline', s.title + ': '));
      stepTextWrap.appendChild(el('span', '', s.text));
      step.appendChild(stepTextWrap);
      
      stepsBox.appendChild(step);
    });
  } else {
    stepsBox.appendChild(el('p', 'exercise-steps-title', 'HOW TO COMPLETE'));
    const stepData = [
      { num: '1', text: `Open the chart for ${assignment.asset}` },
      { num: '2', text: `Switch to ${assignment.timeframe} timeframe` },
      { num: '3', text: 'Mark & draw your analysis' },
      { num: '4', text: 'Come back and mark as Done ✅' },
    ];
    stepData.forEach(s => {
      const step = el('div', 'exercise-step-item');
      step.appendChild(el('span', 'exercise-step-num', s.num));
      step.appendChild(el('span', 'exercise-step-text', s.text));
      stepsBox.appendChild(step);
    });
  }
  card.appendChild(stepsBox);

  // Actions
  const actions = el('div', 'exercise-actions');
  const isAlreadySaved = !!assignment.id;

  const goBtn = el('button', 'exercise-btn-go', '📊 Go to Chart Now');
  goBtn.addEventListener('click', () => {
    if (!isAlreadySaved) {
      saveAssignment(assignment);
    }
    overlay.classList.add('exercise-closing');
    setTimeout(() => overlay.remove(), 300);
    if (typeof onRefresh === 'function') onRefresh();
    import('./trading.js').then(({ loadChartSymbol }) => {
      loadChartSymbol(assignment.asset);
    });
  });
  actions.appendChild(goBtn);

  if (!isAlreadySaved) {
    const laterBtn = el('button', 'exercise-btn-later', '💾 Save for Later');
    laterBtn.addEventListener('click', () => {
      saveAssignment(assignment);
      overlay.classList.add('exercise-closing');
      setTimeout(() => overlay.remove(), 300);
      if (typeof onRefresh === 'function') onRefresh();
    });
    actions.appendChild(laterBtn);
  }

  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('exercise-visible'));
}

/* ---------- Action Buttons Bar ------------------------------------ */

function renderActionBar(container, onRefresh) {
  container.replaceChildren();
  const bar = el('div', 'learning-action-bar');

  const logBtn = el('button', 'btn btn-primary btn-lg', '📖 Log a Lesson');
  logBtn.addEventListener('click', () => openLogLessonPopup(onRefresh));
  bar.appendChild(logBtn);

  const quizBtn = el('button', 'btn btn-secondary btn-lg', '🧩 Take a Quiz');
  quizBtn.addEventListener('click', () => openQuizPopup());
  bar.appendChild(quizBtn);

  const flashcardBtn = el('button', 'btn btn-outline btn-lg', '🃏 Flashcards');
  flashcardBtn.addEventListener('click', () => renderFlashcardMode());
  bar.appendChild(flashcardBtn);

  container.appendChild(bar);
}

// --- Daily Ict Tips ---

const DAILY_ICT_TIPS = [
  'Always identify the HTF bias before looking for entries on LTF. Never trade against the trend.',
  'FVGs are magnets for price. When you see an unfilled FVG, expect price to return to it.',
  'The best setups happen during Killzones. Avoid trading outside London and New York sessions.',
  'A Break of Structure (BOS) confirms trend continuation. Wait for it before entering.',
  'Change of Character (CHOCH) is the first sign of a reversal. Watch for it at key levels.',
  'The OTE zone (0.618–0.786 Fibonacci retracement) is where smart money enters. Be patient for it.',
  'Supply and demand zones are not the same as support and resistance. S/D zones are one-touch areas.',
  'Liquidity rests above swing highs and below swing lows. Smart money hunts these levels before reversing.',
  'An inducement (IDM) is a trap. When you see one, wait for the sweep before entering.',
  'Always use a stop loss. Risk management is more important than any single trade setup.',
  'The Asian session creates the range. London sweeps it. New York continues or reverses.',
  'Pin bars with long wicks at supply/demand zones are powerful rejection signals.',
  'An engulfing candle at a key zone with confluence is one of the highest probability entries.',
  'Never risk more than 1-2% of your account on a single trade. Consistency beats home runs.',
  'Revenge trading after a loss is a guaranteed way to blow your account. Walk away after 2 losses.',
  'The trend is your friend until the CHOCH at a HTF POI. Then become the trend\'s new friend.',
  'Mark your sessions with vertical lines. Most setups form within the first 2 hours of a Killzone.',
  'A doji at a supply or demand zone shows indecision — wait for the next candle to confirm direction.',
  'Top-down analysis: D1 for bias, H4 for structure, H1 for POI, M15 for entry. Never skip steps.',
  'Fair Value Gaps inside the OTE zone are the highest quality entry points in ICT methodology.',
  'Price always seeks liquidity. If you can see where the stops are, you can predict where price will go.',
  'The London Killzone (2–5 AM NY time) often sets the high or low of the day. Trade accordingly.',
  'The New York Killzone (7–10 AM NY time) is where the most volume and best setups occur.',
  'Accumulation happens in a range. Distribution follows the trend. Learn to tell the difference.',
  'Your trading journal is your most valuable tool. Log every trade — winners AND losers.',
  'Backtesting builds confidence. Test your strategy on 100+ setups before trading it live.',
  'A clean chart is a clear mind. Remove unnecessary indicators and trust price action.',
  'Wicks tell stories. A long lower wick means buyers stepped in. A long upper wick means sellers rejected.',
  'Confluence is king: S/D zone + FVG + OTE + Killzone timing = high probability trade.',
  'Premium vs Discount: buy in discount (below 50% of range), sell in premium (above 50%).',
  'Smart money doesn\'t chase. They wait for price to come to their level. Learn to be patient.',
  'The Sunday candle open and the Monday range often set the tone for the entire week.',
  'When in doubt, stay out. No trade is better than a bad trade. Protect your capital always.',
  // — Brad Goh "Market Mechanics" Inspired Tips —
  'Trading is a mechanical process. Build rules, follow rules, trust the process. Emotions are the enemy of consistency.',
  'Your Point of Interest (POI) is where you expect smart money to react. Mark it on the HTF, refine it on the LTF.',
  'Success in trading is non-linear. You will have losing weeks. What matters is the long-term equity curve going up.',
  'Stop looking for the "holy grail" setup. One edge, mastered and backtested, is all you need to be profitable.',
  'The market doesn\'t care about your feelings. It only cares about liquidity. Learn to think like the market maker.',
  'Draw liquidity pools on your chart like magnets. Price is always moving toward the nearest cluster of stop losses.',
  'Do the work. 500 hours of screen time is the minimum before you should expect consistency. There are no shortcuts.',
  'Your win rate doesn\'t need to be 80%. A 40% win rate with 1:3 risk-to-reward is highly profitable. Do the math.',
  'The market moves in 3 phases: expansion, retracement, and continuation. Learn to identify which phase you\'re in.',
  'Order blocks are the last candle before a strong move. They represent institutional entry points. Trade with them, not against them.',
  'Every loss is tuition. If you journaled it, reviewed it, and found the mistake — it wasn\'t a loss, it was a lesson.',
  'Patience is not waiting for a setup. Patience is watching a setup form, waiting for confirmation, and THEN entering.',
  'Don\'t trade every day. The best traders wait for A+ setups and skip everything else. Quality over quantity.',
  'Before entering any trade, ask: "Where is the liquidity?" If you can\'t answer that, you shouldn\'t be trading.',
  'Fractal markets: what happens on D1 also happens on M15. The same patterns repeat across all timeframes.',
  'The goal is not to make money — the goal is to execute your plan perfectly. The money follows the discipline.',
];

function renderDailyTip(container) {
  container.replaceChildren();
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const tipIndex = dayOfYear % DAILY_ICT_TIPS.length;
  const tip = DAILY_ICT_TIPS[tipIndex];

  const card = el('div', 'daily-tip-card');

  const header = el('div', 'daily-tip-header');
  header.appendChild(el('span', 'daily-tip-icon', '💡'));
  header.appendChild(el('span', 'daily-tip-label', 'Daily ICT Tip'));
  card.appendChild(header);

  card.appendChild(el('p', 'daily-tip-text', tip));

  const footer = el('p', 'daily-tip-footer');
  footer.textContent = 'Tip #' + (tipIndex + 1) + ' of ' + DAILY_ICT_TIPS.length + ' — refreshes daily';
  card.appendChild(footer);

  container.appendChild(card);
}

// --- Progress Milestones & Badges ---

const MILESTONES = [
  { id: 'first-steps',     emoji: '🥉', name: 'First Steps',         desc: 'Complete 1 lesson',       check: () => getLessons().length >= 1 },
  { id: 'getting-serious', emoji: '🏅', name: 'Getting Serious',     desc: 'Complete 5 lessons',      check: () => getLessons().length >= 5 },
  { id: 'halfway',         emoji: '🥈', name: 'Halfway There',       desc: 'Complete 10 lessons',     check: () => getLessons().length >= 10 },
  { id: 'almost-pro',      emoji: '🥇', name: 'Almost Pro',          desc: 'Complete 20 lessons',     check: () => getLessons().length >= 20 },
  { id: 'graduate',        emoji: '🏆', name: 'Brah Goh Graduate',   desc: 'Complete all 33 lessons', check: () => getLessons().length >= 33 },
  { id: 'assignment-ace',  emoji: '📝', name: 'Assignment Ace',      desc: 'Complete 5 assignments',  check: () => getAssignments().filter(a => a.completed).length >= 5 },
  { id: 'quiz-master',     emoji: '🎯', name: 'Quiz Master',         desc: 'Score 80%+ on 10 quizzes', check: () => {
    const quizScores = storage.get('quiz_scores', []);
    return quizScores.filter(s => s >= 80).length >= 10;
  }},
  { id: 'streak-warrior',  emoji: '🔥', name: 'Streak Warrior',      desc: '7-day lesson streak',     check: () => {
    const lessons = getLessons();
    if (lessons.length < 7) return false;
    const dates = lessons.map(l => new Date(l.createdAt).toDateString());
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) { streak++; if (streak >= 7) return true; }
      else { streak = 1; }
    }
    return streak >= 7;
  }},
];

function renderMilestones(container) {
  container.replaceChildren();
  const section = el('div', 'milestones-section');
  section.appendChild(el('h2', 'section-title', '🏅 Milestones & Badges'));

  const scroll = el('div', 'milestones-scroll');

  MILESTONES.forEach(m => {
    const unlocked = m.check();
    const badge = el('div', 'milestone-badge ' + (unlocked ? 'milestone-badge--unlocked' : 'milestone-badge--locked'));

    badge.appendChild(el('span', 'milestone-emoji', m.emoji));
    badge.appendChild(el('span', 'milestone-name', m.name));
    badge.appendChild(el('span', 'milestone-desc', m.desc));

    if (unlocked) {
      badge.appendChild(el('span', 'milestone-check', '✅'));
    } else {
      const lock = el('span', 'milestone-lock-overlay', '🔒');
      badge.appendChild(lock);
    }

    scroll.appendChild(badge);
  });

  section.appendChild(scroll);
  container.appendChild(section);
}

// --- Flashcard Quiz Mode ---

const FLASHCARD_DATA = [
  { emoji: '📊', concept: 'Break of Structure (BOS)', answer: 'BOS occurs when price breaks a previous swing high (in an uptrend) or swing low (in a downtrend), confirming the current trend direction. It is the primary signal for trend continuation in ICT methodology.' },
  { emoji: '🔄', concept: 'Change of Character (CHOCH)', answer: 'CHOCH is the first break of structure in the opposite direction, signaling a potential trend reversal. For example, in an uptrend, CHOCH happens when price breaks below the most recent higher low.' },
  { emoji: '📦', concept: 'Fair Value Gap (FVG)', answer: 'An FVG is a three-candle pattern where the wicks of candle 1 and candle 3 do not overlap, creating a price inefficiency. Price tends to return to fill these gaps before continuing.' },
  { emoji: '🏦', concept: 'Supply & Demand Zones', answer: 'Supply zones are areas where institutional sellers placed large orders (price dropped from). Demand zones are where institutional buyers placed large orders (price rallied from). These are one-touch zones, unlike support/resistance.' },
  { emoji: '🎯', concept: 'Optimal Trade Entry (OTE)', answer: 'The OTE is the 0.618–0.786 Fibonacci retracement zone. Smart money typically enters positions in this zone during pullbacks, making it the highest probability entry area.' },
  { emoji: '💰', concept: 'Premium vs Discount', answer: 'Divide any range into two halves using the 50% equilibrium level. Above 50% is Premium (sell zone), below 50% is Discount (buy zone). Always buy in discount and sell in premium.' },
  { emoji: '🕐', concept: 'ICT Killzones', answer: 'Killzones are specific time windows of high institutional activity: Asian (8 PM–12 AM NY), London (2–5 AM NY), New York (7–10 AM NY), and London Close (10 AM–12 PM NY). Best setups form within these windows.' },
  { emoji: '💧', concept: 'Liquidity', answer: 'Liquidity is the collection of stop-loss orders resting above swing highs (buy-side liquidity) and below swing lows (sell-side liquidity). Smart money drives price to these levels to fill large orders.' },
  { emoji: '🪤', concept: 'Inducement (IDM)', answer: 'An inducement is a deliberate market trap designed to lure retail traders into early entries. Smart money creates these traps to build liquidity before the real move. Wait for the sweep before entering.' },
  { emoji: '🕯️', concept: 'Engulfing Candle', answer: 'An engulfing candle completely covers the body of the previous candle. Bullish engulfing at demand zones and bearish engulfing at supply zones are powerful reversal/continuation signals.' },
  { emoji: '📌', concept: 'Pin Bar', answer: 'A pin bar has a long wick and small body, showing strong rejection at a price level. The long wick indicates that price was pushed back aggressively, signaling potential reversal.' },
  { emoji: '⚖️', concept: 'Doji Candle', answer: 'A doji has nearly equal open and close prices, creating a cross shape. It represents indecision between buyers and sellers. At key zones, it signals a potential reversal — wait for the next candle to confirm.' },
  { emoji: '📐', concept: 'Fibonacci Retracement', answer: 'Fibonacci retracement levels (0.236, 0.382, 0.5, 0.618, 0.786) help identify potential reversal zones during pullbacks. The 0.618–0.786 zone is the most important for ICT entries.' },
  { emoji: '🧠', concept: 'Trading Psychology', answer: 'Mastering emotions is the #1 factor in trading success. Fear causes early exits, greed causes overtrading, and impatience causes bad entries. Develop a plan and follow it mechanically.' },
  { emoji: '📈', concept: 'Market Structure', answer: 'Market structure is defined by swing highs and swing lows. Higher highs + higher lows = bullish. Lower highs + lower lows = bearish. Always identify structure before placing any trade.' },
  { emoji: '🔝', concept: 'Top-Down Analysis', answer: 'Start from the highest timeframe (D1/W1) to establish directional bias, then move to H4 for structure, H1 for POI identification, and M15/M5 for precise entries. Never trade without HTF context.' },
  { emoji: '💹', concept: 'Order Flow', answer: 'Order flow is the stream of buy and sell orders that drives price movement. Understanding who is buying/selling and at what levels gives you an edge over retail traders who only see price.' },
  { emoji: '⚡', concept: 'Price Action', answer: 'Price action is the study of raw price movement without indicators. Candle patterns, structure, and S/D zones are all price action tools. It reveals the true story of supply and demand in real time.' },
  { emoji: '🎰', concept: 'Risk Management', answer: 'Never risk more than 1-2% per trade. Use proper position sizing. A 1:3 risk-to-reward ratio means you only need to win 25% of trades to be profitable. Protect capital above all else.' },
  { emoji: '🧊', concept: 'Liquidity Sweep', answer: 'A liquidity sweep occurs when price pushes past a swing point to trigger stop-losses, then reverses sharply. This is smart money collecting orders. The reversal after a sweep is a high-probability entry.' },
  { emoji: '📏', concept: 'Position Sizing (Ep 19)', answer: 'How to calculate lot size based on account balance, risk %, and stop loss distance. Professional traders always size their position so that hitting the stop loss results in losing exactly the risk percentage defined.' },
  { emoji: '🛑', concept: 'Drawdown Circuit Breaker (Ep 19)', answer: 'A maximum loss limit (e.g. 5% daily limit) that, when hit, immediately locks you out of trading for the day to prevent emotional revenge trading and protect capital.' },
  { emoji: '📊', concept: 'Kelly Criterion (Ep 19)', answer: 'A mathematical formula [K% = W - ((1-W)/R)] that determines optimal trade size based on win rate (W) and Risk-to-Reward ratio (R) to maximize long-term account growth.' },
  { emoji: '🔁', concept: 'Flip Zones (Ep 14)', answer: 'A zone where supply fails and flips into demand, or demand fails and flips into supply, showing a clear transition of institutional order flow.' },
  { emoji: '📼', concept: 'Tape Reading (Ep 15)', answer: 'Analyzing the time & sales logs and market depth (bid-ask) in real time to sense buying/selling momentum and predict breakouts.' },
  { emoji: '🔺', concept: 'Power of Three / AMD (Ep 17)', answer: 'The institutional daily price cycle consisting of Accumulation during the Asian session, Manipulation during London Open, and Distribution in New York.' },
  { emoji: '⚡', concept: 'Breaker Block (Ep 18)', answer: 'A failed order block that was broken during a liquidity sweep and has flipped into a key support or resistance POI for a re-entry.' },
  { emoji: '🎯', concept: 'Dealing Range (Ep 20)', answer: 'The price boundary defined by a major swing high and swing low where institutional orders are engineered and run.' },
  { emoji: '🧪', concept: 'Edge Backtesting (Ep 22)', answer: 'Testing a strategy against historical data across 100+ samples to validate the true win rate, average R:R, and statistical expectancy.' },
  { emoji: '🛡️', concept: 'Discipline EdgeScore (Ep 23)', answer: 'A score (0-100%) calculated per trade based on how strictly you followed your checklist rules and stayed emotional-leakage free.' },
  { emoji: '🧘', concept: 'Sanctuary Reset (Ep 24)', answer: 'Brad Goh\'s recommended 10-minute post-trading meditation session to reset the nervous system, release adrenaline, and prevent emotional revenge tendencies.' },
  { emoji: '🧱', concept: 'Order Block (OB) (Ep 10)', answer: 'A validated institutional Order Block is the last opposite candle before a strong impulse leg that breaks structure, representing where bank/institution orders are concentrated.' },
  { emoji: '⏳', concept: 'Mitigation (Ep 10)', answer: 'Mitigation happens when price returns to a previously created Order Block to close out drawing-down positions at break-even before starting the true expansion.' },
  { emoji: '🎯', concept: 'HTF Bias (Ep 11)', answer: 'Directional bias established on Higher Time Frames (like D1 or H4) to determine daily market direction. Always execute in the direction of the HTF bias.' },
  { emoji: '🕸️', concept: 'Retail Traps (Ep 13)', answer: 'Retail traps are chart patterns (like double tops/bottoms, trendlines) engineered by smart money to entice retail traders into early positions so their stops can be swept for liquidity.' },
  { emoji: '🛡️', concept: 'Emotional Independence (Ep 16)', answer: 'The professional state of mind where your emotions are completely detached from individual trade outcomes, allowing mechanical execution of your edge.' },
  { emoji: '⛓️', concept: 'Mitigation Block (Ep 18)', answer: 'A support/resistance level formed when price fails to sweep liquidity before breaking structure, turning the old order block into a mitigation point.' },
  { emoji: '🤖', concept: 'Market Maker Models (Ep 20)', answer: 'The Market Maker Buy Model (MMBM) and Sell Model (MMSM) describe the complete cycle of retail accumulation, smart money manipulation, and final distribution.' },
  { emoji: '📋', concept: 'Pre-market Routine (Ep 21)', answer: 'A structured preparation routine (checking news, identifying HTF zones, marking key ranges) executed before session open to eliminate emotional trading errors.' },
  { emoji: '📈', concept: 'Market Pullbacks (Ep 25)', answer: 'A pullback is a temporary pause or retracement against the main trend. It serves as fuel, allowing smart money to buy at discount or sell at premium before the trend resumes.' },
  { emoji: '⚡', concept: 'Fast vs Slow Pullbacks (Ep 25)', answer: 'Fast pullbacks are rapid retracements (often 1-3 aggressive candles) that mitigate key zones quickly. Slow pullbacks are complex, overlapping consolidations that build liquidity over a longer period.' },
  { emoji: '🧹', concept: 'Sweep Pullbacks (Ep 25)', answer: 'A sweep pullback is a retracement that purposely pushes past a recent short-term swing point to capture resting retail stop-losses (liquidity) before reversing back in the trend direction.' },
  { emoji: '🎯', concept: 'Aggressive Pullback Entry (Ep 25)', answer: 'An aggressive entry model where you set a limit order directly on a key supply or demand zone (e.g. FVG or Order Block) expecting price to tap and reverse immediately.' },
  { emoji: '🛡️', concept: 'Conservative Pullback Entry (Ep 25)', answer: 'A conservative entry model where you wait for price to enter your zone and then shift structure on a lower timeframe (a market shift or CHOCH) before executing the trade.' }
];

function renderFlashcardMode() {
  const reviewed = new Set();
  let currentIndex = 0;
  let isFlipped = false;

  const overlay = el('div', 'flashcard-overlay');

  // Header
  const header = el('div', 'flashcard-header');
  const titleEl = el('span', 'flashcard-title', 'Flashcards 🃏');
  const progressEl = el('span', 'flashcard-progress', '1 of ' + FLASHCARD_DATA.length);
  const closeBtn = el('button', 'flashcard-close', '✕');
  closeBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  });
  header.appendChild(titleEl);
  header.appendChild(progressEl);
  header.appendChild(closeBtn);
  overlay.appendChild(header);

  // Card scene (3D perspective)
  const scene = el('div', 'flashcard-scene');
  const card = el('div', 'flashcard-card');

  // Front face
  const front = el('div', 'flashcard-face flashcard-front');
  const frontEmoji = el('span', 'flashcard-emoji', FLASHCARD_DATA[0].emoji);
  const frontConcept = el('span', 'flashcard-concept', FLASHCARD_DATA[0].concept);
  const frontHint = el('span', 'flashcard-hint', 'Tap to reveal answer');
  front.appendChild(frontEmoji);
  front.appendChild(frontConcept);
  front.appendChild(frontHint);

  // Back face
  const back = el('div', 'flashcard-face flashcard-back');
  const backLabel = el('span', 'flashcard-answer-label', 'Answer');
  const backText = el('p', 'flashcard-answer-text', FLASHCARD_DATA[0].answer);
  back.appendChild(backLabel);
  back.appendChild(backText);

  card.appendChild(front);
  card.appendChild(back);
  scene.appendChild(card);
  overlay.appendChild(scene);

  // Flip handler
  card.addEventListener('click', () => {
    isFlipped = !isFlipped;
    if (isFlipped) {
      card.classList.add('flashcard-card--flipped');
      reviewed.add(currentIndex);
      updateDots();
    } else {
      card.classList.remove('flashcard-card--flipped');
    }
  });

  // Navigation
  const nav = el('div', 'flashcard-nav');
  const prevBtn = el('button', 'flashcard-nav-btn', '◀ Prev');
  const counterEl = el('span', 'flashcard-counter', '1 of ' + FLASHCARD_DATA.length);
  const nextBtn = el('button', 'flashcard-nav-btn', 'Next ▶');
  prevBtn.disabled = true;

  function updateCard() {
    const data = FLASHCARD_DATA[currentIndex];
    frontEmoji.textContent = data.emoji;
    frontConcept.textContent = data.concept;
    backText.textContent = data.answer;
    counterEl.textContent = (currentIndex + 1) + ' of ' + FLASHCARD_DATA.length;
    progressEl.textContent = (currentIndex + 1) + ' of ' + FLASHCARD_DATA.length + ' — ' + reviewed.size + ' reviewed';
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === FLASHCARD_DATA.length - 1;
    // Reset flip
    isFlipped = false;
    card.classList.remove('flashcard-card--flipped');
    updateDots();
  }

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) { currentIndex--; updateCard(); }
  });
  nextBtn.addEventListener('click', () => {
    if (currentIndex < FLASHCARD_DATA.length - 1) { currentIndex++; updateCard(); }
  });

  nav.appendChild(prevBtn);
  nav.appendChild(counterEl);
  nav.appendChild(nextBtn);
  overlay.appendChild(nav);

  // Reviewed dots
  const dotsRow = el('div', 'flashcard-reviewed-row');
  const dots = [];
  for (let i = 0; i < FLASHCARD_DATA.length; i++) {
    const dot = el('span', 'flashcard-dot');
    dots.push(dot);
    dotsRow.appendChild(dot);
  }
  overlay.appendChild(dotsRow);

  function updateDots() {
    dots.forEach((dot, i) => {
      dot.className = 'flashcard-dot';
      if (i === currentIndex) dot.classList.add('flashcard-dot--active');
      if (reviewed.has(i)) dot.classList.add('flashcard-dot--reviewed');
    });
  }
  updateDots();

  // Keyboard navigation
  function handleKeydown(e) {
    if (e.key === 'ArrowLeft' && currentIndex > 0) { currentIndex--; updateCard(); }
    else if (e.key === 'ArrowRight' && currentIndex < FLASHCARD_DATA.length - 1) { currentIndex++; updateCard(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); card.click(); }
    else if (e.key === 'Escape') { closeBtn.click(); }
  }
  document.addEventListener('keydown', handleKeydown);
  // Cleanup keyboard on close
  const origClose = closeBtn.onclick;
  closeBtn.addEventListener('click', () => document.removeEventListener('keydown', handleKeydown));

  document.body.appendChild(overlay);
}

// --- Study Journal ---

function renderStudyJournal(container, onRefresh) {
  container.replaceChildren();
  const entries = getJournalEntries();

  const section = el('div', 'study-journal-section');

  // Header row
  const headerRow = el('div', 'study-journal-header');
  headerRow.style.display = 'flex';
  headerRow.style.justifyContent = 'space-between';
  headerRow.style.alignItems = 'center';
  headerRow.style.marginBottom = 'var(--space-4)';

  const titleWrap = el('div', '');
  const sectionTitle = el('h2', 'section-title', '📓 Study Journal');
  sectionTitle.style.marginBottom = '2px';
  titleWrap.appendChild(sectionTitle);

  const subtitle = el('p', '', `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} logged`);
  subtitle.style.fontSize = 'var(--text-xs)';
  subtitle.style.color = 'var(--text-muted)';
  titleWrap.appendChild(subtitle);
  headerRow.appendChild(titleWrap);

  const addBtn = el('button', 'btn btn-primary btn-sm', '+ Log New Study');
  addBtn.style.whiteSpace = 'nowrap';
  addBtn.addEventListener('click', () => openLogStudyPopup(onRefresh));
  headerRow.appendChild(addBtn);

  section.appendChild(headerRow);

  // Empty state
  if (entries.length === 0) {
    const emptyCard = el('div', 'overview-panel glass-card');
    emptyCard.style.padding = 'var(--space-8)';
    emptyCard.style.textAlign = 'center';
    emptyCard.style.display = 'flex';
    emptyCard.style.flexDirection = 'column';
    emptyCard.style.alignItems = 'center';
    emptyCard.style.gap = 'var(--space-3)';

    const emptyIcon = el('span', '', '📓');
    emptyIcon.style.fontSize = '2.5rem';
    emptyCard.appendChild(emptyIcon);

    const emptyTitle = el('h3', '', 'No study entries yet');
    emptyTitle.style.color = 'var(--text-primary)';
    emptyTitle.style.fontWeight = '700';
    emptyTitle.style.fontSize = 'var(--text-sm)';
    emptyCard.appendChild(emptyTitle);

    const emptyDesc = el('p', '', 'Log a video, lesson, or concept you learned outside the curriculum to start building your personal knowledge journal.');
    emptyDesc.style.color = 'var(--text-muted)';
    emptyDesc.style.fontSize = 'var(--text-xs)';
    emptyDesc.style.maxWidth = '380px';
    emptyCard.appendChild(emptyDesc);

    const emptyCta = el('button', 'btn btn-primary', '📓 Log Your First Study');
    emptyCta.addEventListener('click', () => openLogStudyPopup(onRefresh));
    emptyCard.appendChild(emptyCta);

    section.appendChild(emptyCard);
  } else {
    // Timeline of entries (newest first)
    const timeline = el('div', 'study-journal-timeline');
    timeline.style.display = 'flex';
    timeline.style.flexDirection = 'column';
    timeline.style.gap = 'var(--space-3)';

    const sorted = [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    sorted.forEach(entry => {
      const card = el('div', 'overview-panel glass-card study-journal-entry');
      card.style.padding = 'var(--space-4)';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = 'var(--space-2)';
      card.style.borderLeft = '3px solid #f59e0b';
      card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 8px 24px rgba(245, 158, 11, 0.12)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '';
      });

      // Top row: title + category tag
      const topRow = el('div', '');
      topRow.style.display = 'flex';
      topRow.style.justifyContent = 'space-between';
      topRow.style.alignItems = 'flex-start';
      topRow.style.gap = 'var(--space-2)';

      const titleEl = el('h4', '', entry.title);
      titleEl.style.fontWeight = '700';
      titleEl.style.fontSize = 'var(--text-sm)';
      titleEl.style.color = '#fff';
      titleEl.style.flex = '1';
      topRow.appendChild(titleEl);

      const categoryTag = el('span', 'tag');
      categoryTag.textContent = entry.category || 'Other';
      categoryTag.style.background = 'rgba(245, 158, 11, 0.12)';
      categoryTag.style.color = '#f59e0b';
      categoryTag.style.border = '1px solid rgba(245, 158, 11, 0.25)';
      categoryTag.style.fontSize = '9px';
      categoryTag.style.padding = '2px 8px';
      categoryTag.style.borderRadius = 'var(--radius-sm)';
      categoryTag.style.whiteSpace = 'nowrap';
      topRow.appendChild(categoryTag);

      card.appendChild(topRow);

      // Source + date meta row
      const metaRow = el('div', '');
      metaRow.style.display = 'flex';
      metaRow.style.gap = 'var(--space-3)';
      metaRow.style.fontSize = 'var(--text-xs)';
      metaRow.style.color = 'var(--text-muted)';

      const sourceMeta = el('span', '', `🎓 ${entry.source || 'Unknown'}`);
      metaRow.appendChild(sourceMeta);

      const dateMeta = el('span', '', `📅 ${formatDate(entry.createdAt)}`);
      metaRow.appendChild(dateMeta);

      card.appendChild(metaRow);

      // Takeaways
      const takeawaysEl = el('p', '', entry.takeaways);
      takeawaysEl.style.fontSize = 'var(--text-xs)';
      takeawaysEl.style.color = 'var(--text-secondary)';
      takeawaysEl.style.lineHeight = '1.5';
      takeawaysEl.style.whiteSpace = 'pre-wrap';
      card.appendChild(takeawaysEl);

      // Link (if provided)
      if (entry.link) {
        const linkEl = document.createElement('a');
        linkEl.href = entry.link;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.textContent = '🔗 View Video / Resource';
        linkEl.style.fontSize = 'var(--text-xs)';
        linkEl.style.color = '#f59e0b';
        linkEl.style.textDecoration = 'none';
        linkEl.style.fontWeight = '600';
        linkEl.style.display = 'inline-flex';
        linkEl.style.alignItems = 'center';
        linkEl.style.gap = 'var(--space-1)';
        linkEl.style.padding = '4px 10px';
        linkEl.style.borderRadius = 'var(--radius-sm)';
        linkEl.style.background = 'rgba(245, 158, 11, 0.08)';
        linkEl.style.border = '1px solid rgba(245, 158, 11, 0.2)';
        linkEl.style.marginTop = 'var(--space-1)';
        linkEl.style.width = 'fit-content';
        card.appendChild(linkEl);
      }

      timeline.appendChild(card);
    });

    section.appendChild(timeline);
  }

  container.appendChild(section);
}

function openLogStudyPopup(onSaved) {
  const { body, close } = createModal('📓 Log New Study');

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Title
  const titleGroup = el('div', 'form-group');
  titleGroup.appendChild(el('label', 'form-label', 'What did you watch / study?'));
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'form-input';
  titleInput.placeholder = 'e.g. ICT Silver Bullet Strategy Explained';
  titleInput.required = true;
  titleGroup.appendChild(titleInput);
  form.appendChild(titleGroup);

  // Source / Mentor
  const sourceGroup = el('div', 'form-group');
  sourceGroup.appendChild(el('label', 'form-label', 'Source / Mentor'));
  const sourceInput = document.createElement('input');
  sourceInput.type = 'text';
  sourceInput.className = 'form-input';
  sourceInput.placeholder = 'Brah Goh';
  sourceInput.value = 'Brah Goh';
  sourceGroup.appendChild(sourceInput);
  form.appendChild(sourceGroup);

  // Link (optional)
  const linkGroup = el('div', 'form-group');
  linkGroup.appendChild(el('label', 'form-label', 'Video / Resource Link (optional)'));
  const linkInput = document.createElement('input');
  linkInput.type = 'url';
  linkInput.className = 'form-input';
  linkInput.placeholder = 'https://youtu.be/...';
  linkGroup.appendChild(linkInput);
  form.appendChild(linkGroup);

  // Key Takeaways
  const takeawaysGroup = el('div', 'form-group');
  takeawaysGroup.appendChild(el('label', 'form-label', 'Key Takeaways — What did you learn?'));
  const takeawaysInput = document.createElement('textarea');
  takeawaysInput.className = 'form-textarea';
  takeawaysInput.rows = 5;
  takeawaysInput.placeholder = 'Write what you learned in your own words...\n\ne.g. "Learned that the Silver Bullet setup targets the FVG created during the 10am-11am NY window..."';
  takeawaysInput.required = true;
  takeawaysGroup.appendChild(takeawaysInput);
  form.appendChild(takeawaysGroup);

  // Category
  const catGroup = el('div', 'form-group');
  catGroup.appendChild(el('label', 'form-label', 'Category'));
  const catSelect = document.createElement('select');
  catSelect.className = 'form-select';
  JOURNAL_CATEGORIES.forEach(cat => {
    const opt = el('option', '', cat);
    opt.value = cat;
    catSelect.appendChild(opt);
  });
  catGroup.appendChild(catSelect);
  form.appendChild(catGroup);

  // Submit
  const submitBtn = el('button', 'btn btn-primary btn-lg', '📓 Save Study Entry (+10 XP)');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const takeaways = takeawaysInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    if (!takeaways) { takeawaysInput.focus(); return; }

    const linkVal = linkInput.value.trim();
    if (linkVal && !linkVal.startsWith('http://') && !linkVal.startsWith('https://')) {
      showNotificationToast('Link must start with http:// or https://');
      linkInput.focus();
      return;
    }

    saveJournalEntry({
      title,
      source: sourceInput.value.trim(),
      link: linkVal,
      takeaways,
      category: catSelect.value,
    });

    playSynthSound('fanfare');
    triggerConfetti();
    showNotificationToast('📓 Study logged! +10 XP! Keep learning! 🔥');

    close();
    if (typeof onSaved === 'function') onSaved();
  });

  body.appendChild(form);
}

// --- Main Render ---

export function renderLearningPage(container) {
  container.replaceChildren();
  container.appendChild(el('h1', 'page-title', '📚 Learning Hub'));

  const dailyTipContainer = el('div');
  const flashcardsContainer = el('div');
  const milestonesContainer = el('div');
  const actionContainer = el('div');
  const playbookContainer = el('div');
  const studyJournalContainer = el('div');
  const mentorContainer = el('div');
  const assignmentContainer = el('div');
  const curriculumContainer = el('div');
  const baCurriculumContainer = el('div');

  // Order: Daily Tip → Flashcards → Milestones → Actions → Playbook → Study Journal → Mentors → Assignments → Curriculum
  container.appendChild(dailyTipContainer);
  container.appendChild(flashcardsContainer);
  container.appendChild(milestonesContainer);
  container.appendChild(actionContainer);
  container.appendChild(playbookContainer);
  container.appendChild(studyJournalContainer);
  container.appendChild(mentorContainer);
  container.appendChild(assignmentContainer);
  container.appendChild(curriculumContainer);
  container.appendChild(baCurriculumContainer);

  function refresh() {
    renderDailyTip(dailyTipContainer);
    renderFlashcards(flashcardsContainer);
    renderMilestones(milestonesContainer);
    renderActionBar(actionContainer, refresh);
    renderPullbackPlaybook(playbookContainer);
    renderStudyJournal(studyJournalContainer, refresh);
    renderMentorCards(mentorContainer, refresh, curriculumContainer, baCurriculumContainer);
    renderCurriculumLog(curriculumContainer);
    renderBossAckahCurriculum(baCurriculumContainer, refresh);
    renderAssignments(assignmentContainer, refresh);
  }

  refresh();
}

// --- Boss Ackah Curriculum Section ---

function renderBossAckahCurriculum(container, onRefresh) {
  container.replaceChildren();
  const wrapper = el('div', 'curriculum-section ba-curriculum-section');
  wrapper.appendChild(el('h2', 'section-title', '👑 Boss Ackah Curriculum'));

  const baLessons = getBaLessons();
  const loggedIds = new Set(baLessons.map(l => l.lessonId));

  const timeline = el('div', 'curriculum-timeline');

  const effectiveBA = getEffectiveBaCurriculum();

  effectiveBA.forEach((lesson) => {
    const isLogged = loggedIds.has(lesson.id);
    const progress = getBaProgress(lesson.id);

    const item = el('div', `timeline-item${isLogged ? ' completed' : ''}`);

    const marker = el('div', 'timeline-marker');
    marker.textContent = isLogged ? '✅' : '📌';
    item.appendChild(marker);

    const content = el('div', 'timeline-content');
    content.appendChild(el('h4', 'timeline-ep-title', `Lesson ${lesson.lesson}: ${lesson.title}`));

    // Type badge
    const typeBadge = el('span', 'ba-type-badge');
    typeBadge.textContent = lesson.type === 'audio' ? '🎧 Audio/Video' : '📝 Session';
    content.appendChild(typeBadge);

    content.appendChild(el('p', 'timeline-desc', lesson.description));

    // Instructions
    if (lesson.instructions) {
      const instrBox = el('div', 'ba-instructions');
      instrBox.appendChild(el('span', 'ba-instructions__label', '📋 Assignment:'));
      instrBox.appendChild(el('p', 'ba-instructions__text', lesson.instructions));
      content.appendChild(instrBox);
    }

    // Concept tags
    if (lesson.concepts.length) {
      const tagBar = el('div', 'concept-tags');
      lesson.concepts.forEach(c => tagBar.appendChild(el('span', 'tag', c)));
      content.appendChild(tagBar);
    }

    // Resource link (YouTube etc)
    if (lesson.resource) {
      const resLink = el('a', 'btn btn-secondary btn-sm');
      resLink.textContent = `🔗 ${lesson.resourceLabel || 'Open Resource'}`;
      resLink.href = lesson.resource;
      resLink.target = '_blank';
      resLink.rel = 'noopener noreferrer';
      content.appendChild(resLink);
    }

    // Progress tracker
    const progressSection = el('div', 'ba-progress-tracker');
    const pLabel = el('span', 'ba-progress-label');
    pLabel.textContent = progress.percent >= 100 ? '✅ Completed' : `Progress: ${progress.percent}%`;
    progressSection.appendChild(pLabel);

    const pBar = el('div', 'ba-progress-bar');
    const pFill = el('div', 'ba-progress-fill');
    pFill.style.width = `${progress.percent}%`;
    pBar.appendChild(pFill);
    progressSection.appendChild(pBar);

    // Quick-tap step buttons instead of slider
    const stepRow = el('div', 'ba-step-buttons');
    const steps = [
      { label: 'Not Started', value: 0 },
      { label: '25%', value: 25 },
      { label: '50%', value: 50 },
      { label: '75%', value: 75 },
      { label: 'Done ✅', value: 100 },
    ];

    steps.forEach(({ label, value }) => {
      const stepBtn = el('button', `ba-step-btn${progress.percent >= value ? ' ba-step-active' : ''}`, label);
      stepBtn.addEventListener('click', () => {
        const existing = getBaProgress(lesson.id);
        saveBaProgress(lesson.id, { ...existing, percent: value });
        pFill.style.width = `${value}%`;
        pLabel.textContent = value >= 100 ? '✅ Completed' : `Progress: ${value}%`;
        // Update active states
        stepRow.querySelectorAll('.ba-step-btn').forEach((b, idx) => {
          b.classList.toggle('ba-step-active', steps[idx].value <= value);
        });
      });
      stepRow.appendChild(stepBtn);
    });
    progressSection.appendChild(stepRow);
    content.appendChild(progressSection);

    // Logged notes
    const lessonEntry = baLessons.find(l => l.lessonId === lesson.id);
    if (lessonEntry) {
      const noteCard = el('div', 'timeline-note');
      noteCard.appendChild(el('span', 'timeline-note-label', '📝 Your notes:'));
      noteCard.appendChild(el('p', 'timeline-note-text', lessonEntry.notes || 'No notes'));
      
      if (lessonEntry.notesImage) {
        const thumbDiv = el('div', 'timeline-note-image-thumb');
        thumbDiv.style.marginTop = 'var(--space-2)';
        thumbDiv.style.cursor = 'pointer';
        
        const img = document.createElement('img');
        img.src = lessonEntry.notesImage;
        img.style.maxWidth = '120px';
        img.style.maxHeight = '80px';
        img.style.borderRadius = 'var(--radius-sm)';
        img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        img.style.transition = 'transform 0.2s';
        
        img.addEventListener('mouseenter', () => img.style.transform = 'scale(1.05)');
        img.addEventListener('mouseleave', () => img.style.transform = 'scale(1)');
        
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          openNotesImageModal(`Notes — Lesson ${lesson.lesson}: ${lesson.title}`, lessonEntry.notesImage);
        });
        
        thumbDiv.appendChild(img);
        noteCard.appendChild(thumbDiv);
      }
      
      noteCard.appendChild(el('span', 'timeline-note-date', formatDate(lessonEntry.createdAt)));
      content.appendChild(noteCard);
    }

    // Log lesson button (if not logged yet)
    if (!isLogged) {
      const logBtn = el('button', 'btn btn-primary btn-sm', '📖 Log Notes for This Lesson');
      logBtn.style.marginTop = 'var(--space-3)';
      logBtn.addEventListener('click', () => openBaLogPopup(lesson, onRefresh));
      content.appendChild(logBtn);
    }

    item.appendChild(content);
    timeline.appendChild(item);
  });

  wrapper.appendChild(timeline);

  // Add Lesson button
  const addBtn = el('button', 'btn btn-outline btn-add-ba-lesson', '➕ Add New Lesson');
  addBtn.addEventListener('click', () => openAddBaLessonPopup(effectiveBA.length + 1, container, onRefresh));
  wrapper.appendChild(addBtn);

  container.appendChild(wrapper);
}

/* ── Boss Ackah — User-Added Lessons ──────────────────────── */

const STORAGE_BA_USER_LESSONS = 'ba_user_lessons';

function getUserBaLessons() {
  return storage.get(STORAGE_BA_USER_LESSONS, []);
}

function getEffectiveBaCurriculum() {
  return [...BOSS_ACKAH_CURRICULUM, ...getUserBaLessons()];
}

function openAddBaLessonPopup(nextNum, currContainer, onRefresh) {
  const { body, close } = createModal('➕ Add Boss Ackah Lesson');

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Title
  const titleGroup = el('div', 'form-group');
  titleGroup.appendChild(el('label', 'form-label', 'Lesson Title'));
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'form-input';
  titleInput.placeholder = 'e.g. Risk Management Fundamentals';
  titleInput.required = true;
  titleGroup.appendChild(titleInput);
  form.appendChild(titleGroup);

  // Type
  const typeGroup = el('div', 'form-group');
  typeGroup.appendChild(el('label', 'form-label', 'Lesson Type'));
  const typeSelect = document.createElement('select');
  typeSelect.className = 'form-select';
  [
    { value: 'audio', label: '🎧 Audio / Video' },
    { value: 'session', label: '📝 Live Session' },
    { value: 'text', label: '📄 Text / Reading' },
    { value: 'assignment', label: '📋 Assignment' },
  ].forEach(opt => {
    const o = el('option', '', opt.label);
    o.value = opt.value;
    typeSelect.appendChild(o);
  });
  typeGroup.appendChild(typeSelect);
  form.appendChild(typeGroup);

  // Description / Boss Ackah's words
  const descGroup = el('div', 'form-group');
  descGroup.appendChild(el('label', 'form-label', 'Description / Boss Ackah\'s Words'));
  const descInput = document.createElement('textarea');
  descInput.className = 'form-textarea';
  descInput.rows = 4;
  descInput.placeholder = 'Paste what Boss Ackah said about this lesson...';
  descInput.required = true;
  descGroup.appendChild(descInput);
  form.appendChild(descGroup);

  // Resource link (optional)
  const linkGroup = el('div', 'form-group');
  linkGroup.appendChild(el('label', 'form-label', 'Resource Link (optional)'));
  const linkInput = document.createElement('input');
  linkInput.type = 'url';
  linkInput.className = 'form-input';
  linkInput.placeholder = 'https://youtu.be/... or any link';
  linkGroup.appendChild(linkInput);
  form.appendChild(linkGroup);

  // Link label
  const linkLabelGroup = el('div', 'form-group');
  linkLabelGroup.appendChild(el('label', 'form-label', 'Resource Label (optional)'));
  const linkLabelInput = document.createElement('input');
  linkLabelInput.type = 'text';
  linkLabelInput.className = 'form-input';
  linkLabelInput.placeholder = 'e.g. Risk Management Video';
  linkLabelGroup.appendChild(linkLabelInput);
  form.appendChild(linkLabelGroup);

  // Instructions
  const instrGroup = el('div', 'form-group');
  instrGroup.appendChild(el('label', 'form-label', 'Instructions (optional)'));
  const instrInput = document.createElement('input');
  instrInput.type = 'text';
  instrInput.className = 'form-input';
  instrInput.placeholder = 'e.g. Watch → Take notes → Share notes';
  instrGroup.appendChild(instrInput);
  form.appendChild(instrGroup);

  // Concepts
  const conceptGroup = el('div', 'form-group');
  conceptGroup.appendChild(el('label', 'form-label', 'Key Concepts (comma separated, optional)'));
  const conceptInput = document.createElement('input');
  conceptInput.type = 'text';
  conceptInput.className = 'form-input';
  conceptInput.placeholder = 'e.g. risk-management, position-sizing';
  conceptGroup.appendChild(conceptInput);
  form.appendChild(conceptGroup);

  const submitBtn = el('button', 'btn btn-primary btn-lg', '➕ Add Lesson');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();

    if (!title || !desc) {
      import('./audio.js').then(({ playSynthSound }) => playSynthSound('error'));
      showNotificationToast('Lesson Title and Description/Words are required! ⚠️', 'warning');
      
      // Focus and scroll first empty required field into view
      if (!title) {
        titleInput.focus();
        titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (!desc) {
        descInput.focus();
        descInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const sanitizedTitle = sanitizeText(title);
    const sanitizedDesc = sanitizeText(desc, 5000);

    const newLesson = {
      id: `ba-${nextNum}`,
      lesson: nextNum,
      title: sanitizedTitle,
      type: typeSelect.value,
      concepts: conceptInput.value.trim()
        ? conceptInput.value.split(',').map(c => sanitizeText(c.trim())).filter(Boolean)
        : [],
      description: sanitizedDesc,
      resource: linkInput.value.trim() || null,
      resourceLabel: sanitizeText(linkLabelInput.value.trim()) || null,
      instructions: sanitizeText(instrInput.value.trim()) || null,
    };

    const userLessons = getUserBaLessons();
    userLessons.push(newLesson);
    storage.set(STORAGE_BA_USER_LESSONS, userLessons);

    // Sync to cloud immediately
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    });

    import('./audio.js').then(({ playSynthSound }) => playSynthSound('success'));
    showNotificationToast('Boss Ackah lesson added successfully! 👑', 'success');

    close();
    if (typeof onRefresh === 'function') onRefresh();
  });

  body.appendChild(form);
}

function openBaLogPopup(lesson, onSaved) {
  const { body, close } = createModal(`📖 Log Notes — Lesson ${lesson.lesson}`);

  const form = el('form', 'modal-form');
  form.setAttribute('novalidate', '');

  // Lesson title (read-only display)
  const titleBox = el('div', 'ba-lesson-title-box');
  titleBox.appendChild(el('h3', '', `Lesson ${lesson.lesson}: ${lesson.title}`));
  titleBox.appendChild(el('p', 'ba-lesson-desc', lesson.description));
  form.appendChild(titleBox);

  // Notes textarea
  const notesInput = document.createElement('textarea');
  notesInput.name = 'notes';
  notesInput.rows = 6;
  notesInput.placeholder = 'Write your key takeaways and important points here…';
  notesInput.classList.add('form-textarea');
  notesInput.required = true;
  const notesGroup = el('div', 'form-group');
  notesGroup.appendChild(el('label', 'form-label', 'Your Notes / Key Takeaways'));
  notesGroup.appendChild(notesInput);
  form.appendChild(notesGroup);

  // Rating
  const ratingSelect = document.createElement('select');
  ratingSelect.name = 'rating';
  ratingSelect.classList.add('form-select');
  for (let i = 1; i <= 5; i++) {
    const opt = el('option', '', '⭐'.repeat(i));
    opt.value = String(i);
    ratingSelect.appendChild(opt);
  }
  const rGroup = el('div', 'form-group');
  rGroup.appendChild(el('label', 'form-label', 'Understanding Level'));
  rGroup.appendChild(ratingSelect);
  form.appendChild(rGroup);

  // Notes Image Upload
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.name = 'notesImageFile';
  fileInput.accept = 'image/*';
  fileInput.className = 'form-input';
  
  const filePreview = el('div', 'notes-file-preview');
  filePreview.style.display = 'none';
  filePreview.style.marginTop = 'var(--space-2)';
  
  let baNotesImageBase64 = null;
  
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || !file.type.startsWith('image/')) {
      filePreview.style.display = 'none';
      baNotesImageBase64 = null;
      return;
    }
    
    filePreview.replaceChildren();
    filePreview.style.display = 'block';
    filePreview.appendChild(el('p', '', '⏳ Compressing photo of notes...'));
    
    compressImage(file, 1000).then(base64 => {
      baNotesImageBase64 = base64;
      filePreview.replaceChildren();
      const img = document.createElement('img');
      img.src = base64;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '150px';
      img.style.borderRadius = 'var(--radius-md)';
      img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      filePreview.appendChild(img);
    }).catch(err => {
      filePreview.replaceChildren();
      filePreview.appendChild(el('p', 'pnl-negative', '⚠️ Error reading image file.'));
      baNotesImageBase64 = null;
    });
  });
  
  const fileGroup = el('div', 'form-group');
  fileGroup.appendChild(el('label', 'form-label', 'Upload Photo of Notes (Optional)'));
  fileGroup.appendChild(fileInput);
  fileGroup.appendChild(filePreview);
  form.appendChild(fileGroup);

  const submitBtn = el('button', 'btn btn-primary btn-lg', 'Save Notes 📖');
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const notes = sanitizeText(notesInput.value, 5000);
    if (!notes) { notesInput.focus(); return; }

    const entry = {
      id: generateId(),
      lessonId: lesson.id,
      lessonNumber: lesson.lesson,
      title: lesson.title,
      notes,
      rating: Number(ratingSelect.value),
      concepts: lesson.concepts,
      notesImage: baNotesImageBase64,
      createdAt: new Date().toISOString(),
    };

    const all = getBaLessons();
    all.push(entry);
    storage.set(STORAGE_BA_LESSONS, all);

    // Mark progress to 100% when logged
    saveBaProgress(lesson.id, { percent: 100, notes });

    close();
    if (typeof onSaved === 'function') onSaved();
  });

  body.appendChild(form);
}



// --- 3d Glassmorphic Flashcards System ---

const FLASHCARD_TERMS = [
  {
    id: 'bos',
    category: 'smc',
    concept: 'BOS',
    title: 'Break of Structure',
    definition: 'A continuation signal where price breaks past a previous swing high (in an uptrend) or swing low (in a downtrend), validating the trend direction.',
    emoji: '📈'
  },
  {
    id: 'choch',
    category: 'smc',
    concept: 'CHOCH',
    title: 'Change of Character',
    definition: 'The first signal of a potential trend reversal. It occurs when price breaks the opposite swing point (e.g., a swing low in a bullish trend).',
    emoji: '🔄'
  },
  {
    id: 'fvg',
    category: 'smc',
    concept: 'FVG',
    title: 'Fair Value Gap',
    definition: 'A 3-candle imbalance. Forms when candle 1\'s wick and candle 3\'s wick do not overlap, leaving a visual "void" that price tends to retrace and fill.',
    emoji: '🧩'
  },
  {
    id: 'sweep',
    category: 'smc',
    concept: 'Sweep',
    title: 'Liquidity Sweep',
    definition: 'A raid where price briefly breaks a key level (e.g., previous highs/lows) to trigger stop-losses and engineering liquidity, before rapidly reversing.',
    emoji: '🧹'
  },
  {
    id: 'ote',
    category: 'smc',
    concept: 'OTE',
    title: 'Optimal Trade Entry',
    definition: 'The high-probability Fibonacci retracement window located strictly between the 61.8% and 78.6% levels, ideal for entering high-confluence setups.',
    emoji: '📐'
  },
  {
    id: 'ob',
    category: 'smc',
    concept: 'OB',
    title: 'Order Block',
    definition: 'The last opposite candle before a strong impulse leg. It represents where institutions placed massive block orders, acting as high-confluence support/resistance.',
    emoji: '🧱'
  },
  {
    id: 'idm',
    category: 'smc',
    concept: 'IDM',
    title: 'Inducement',
    definition: 'A minor swing high or low that acts as a trap. It entices early retail traders to buy or sell, building liquidity for smart money to sweep.',
    emoji: '🪤'
  },
  {
    id: 'flipzone',
    category: 'smc',
    concept: 'Flip Zone',
    title: 'Failed zones',
    definition: 'A zone where supply fails and flips into demand, or demand fails and flips into supply, showing transition of institutional order flow.',
    emoji: '🔁'
  },
  {
    id: 'liquidity',
    category: 'smc',
    concept: 'Liquidity',
    title: 'Resting Orders',
    definition: 'Clusters of stop losses or pending orders lying above key highs or below key lows, acting as the primary fuel for price movements.',
    emoji: '💧'
  },
  {
    id: 'premium',
    category: 'smc',
    concept: 'Premium',
    title: 'Overvalued Zone',
    definition: 'The upper half of a price range (above the 50% equilibrium mark), indicating expensive prices where shorts should be favored.',
    emoji: '💰'
  },
  {
    id: 'discount',
    category: 'smc',
    concept: 'Discount',
    title: 'Undervalued Zone',
    definition: 'The lower half of a price range (below the 50% equilibrium mark), indicating cheap prices where longs should be favored.',
    emoji: '🏷️'
  },
  {
    id: 'pip',
    category: 'forex',
    concept: 'Pip',
    title: 'Percentage in Point',
    definition: 'The standard fourth decimal place unit of measure used in forex to represent the smallest change in price value.',
    emoji: '🪙'
  },
  {
    id: 'leverage',
    category: 'forex',
    concept: 'Leverage',
    title: 'Gearing Capital',
    definition: 'A broker feature allowing traders to control massive market volumes using a small percentage of actual account collateral.',
    emoji: '⚙️'
  },
  {
    id: 'killzones',
    category: 'forex',
    concept: 'Killzones',
    title: 'Timing Windows',
    definition: 'Core session hours (London, NY, London Close) when high-impact liquidity spikes produce high-probability trading setups.',
    emoji: '⏰'
  },
  {
    id: 'london',
    category: 'forex',
    concept: 'London Session',
    title: 'London Killzone',
    definition: 'Active 2:00 AM - 5:00 AM NY time. Typically sees high volatility and often sets the high or low of the daily trading range.',
    emoji: '🇬🇧'
  },
  {
    id: 'newyork',
    category: 'forex',
    concept: 'NY Session',
    title: 'New York Killzone',
    definition: 'Active 7:00 AM - 10:00 AM NY time. Highly volatile due to economic news releases and intersection with London trading.',
    emoji: '🇺🇸'
  },
  {
    id: 'rr',
    category: 'forex',
    concept: 'Risk:Reward',
    title: 'Gauging Returns',
    definition: 'The ratio comparing what you risk on a trade to your potential gain, determining long-term consistency viability.',
    emoji: '⚖️'
  },
  {
    id: 'mindset',
    category: 'psychology',
    concept: 'Mindset',
    title: 'Trading Mindset',
    definition: 'Boss Ackah\'s core psychology: acquiring a powerful professional skill through commitment, emotional control, and not letting the lure of money cloud the mind.',
    emoji: '🕯️'
  },
  {
    id: 'revenge',
    category: 'psychology',
    concept: 'Revenge Trading',
    title: 'Emotional Overtrading',
    definition: 'The urge to enter trades immediately after a loss to win back capital, ignoring setups and rules in an emotional state.',
    emoji: '🔥'
  },
  {
    id: 'discipline',
    category: 'psychology',
    concept: 'Discipline',
    title: 'Adhering to Rules',
    definition: 'Executing trades exactly according to rules, checklists, and position sizing models regardless of current emotions.',
    emoji: '🧘'
  },
  {
    id: 'tapereading',
    category: 'smc',
    concept: 'Tape Reading',
    title: 'Velocity Analysis',
    definition: 'Analyzing the time & sales logs and market depth (bid-ask) in real time to sense buying/selling momentum and predict breakouts.',
    emoji: '📼'
  },
  {
    id: 'amd',
    category: 'smc',
    concept: 'Power of Three',
    title: 'AMD Strategy',
    definition: 'The institutional daily cycle consisting of Accumulation during the Asian session, Manipulation during London Open, and Distribution in New York.',
    emoji: '🔺'
  },
  {
    id: 'breakerblock',
    category: 'smc',
    concept: 'Breaker Block',
    title: 'Swept Order Block',
    definition: 'A failed order block that was broken during a liquidity sweep and has flipped into a key support or resistance POI for a re-entry.',
    emoji: '⚡'
  },
  {
    id: 'positionsizing',
    category: 'forex',
    concept: 'Position Sizing',
    title: 'Sizing Risk',
    definition: 'Calculating the lot size based on stop loss distance and risk target to lose exactly the defined account balance percentage.',
    emoji: '📏'
  },
  {
    id: 'circuitbreaker',
    category: 'psychology',
    concept: 'Circuit Breaker',
    title: 'Drawdown Circuit Breaker',
    definition: 'A hard loss limit (e.g. 5% daily limit) that automatically triggers a cooldown lock, protecting your capital from emotional overtrading.',
    emoji: '🛑'
  },
  {
    id: 'kelly',
    category: 'psychology',
    concept: 'Kelly Criterion',
    title: 'Optimal Sizing',
    definition: 'A mathematical formula [K% = W - ((1-W)/R)] that determines the optimal trade size to maximize long-term geometric account growth.',
    emoji: '📊'
  },
  {
    id: 'dealingrange',
    category: 'smc',
    concept: 'Dealing Range',
    title: 'Range Boundaries',
    definition: 'The price boundary defined by a major swing high and swing low where institutional orders are engineered and run.',
    emoji: '🎯'
  },
  {
    id: 'backtesting',
    category: 'forex',
    concept: 'Edge Backtesting',
    title: 'Edge Validation',
    definition: 'Testing a strategy against historical data across 100+ samples to validate the true win rate, average R:R, and statistical expectancy.',
    emoji: '🧪'
  },
  {
    id: 'edgescore',
    category: 'psychology',
    concept: 'Discipline EdgeScore',
    title: 'Checklist Compliance',
    definition: 'A score (0-100%) calculated per trade based on how strictly you followed your checklist rules and stayed emotional-leakage free.',
    emoji: '🛡️'
  },
  {
    id: 'sanctuary',
    category: 'psychology',
    concept: 'Sanctuary Reset',
    title: 'Meditation Sanctuary',
    definition: 'Brad Goh\'s recommended 10-minute post-trading meditation session to reset the nervous system, release adrenaline, and prevent emotional revenge tendencies.',
    emoji: '🧘'
  },
  {
    id: 'topdown',
    category: 'smc',
    concept: 'Top-Down Analysis',
    title: 'Multi-Timeframe context',
    definition: 'Analyzing charts from highest timeframe (D1) down to lowest (M5) to establish bias, find key zones, and refine entry timing.',
    emoji: '🔝'
  },
  {
    id: 'mitigation',
    category: 'smc',
    concept: 'Mitigation',
    title: 'Reducing Risk',
    definition: 'When price returns to a previously created Order Block to close drawing-down positions at break-even before expanding.',
    emoji: '⏳'
  },
  {
    id: 'htfbias',
    category: 'smc',
    concept: 'HTF Bias',
    title: 'Directional Bias',
    definition: 'The dominant market direction established on Higher Time Frames (D1/H4) that filters trade ideas on lower timeframes.',
    emoji: '🎯'
  },
  {
    id: 'retailtraps',
    category: 'smc',
    concept: 'Retail Traps',
    title: 'Smart Money Traps',
    definition: 'Chart patterns (like double tops/bottoms, trendlines) engineered to lure retail traders so their stops can be swept for liquidity.',
    emoji: '🕸️'
  },
  {
    id: 'emotionalind',
    category: 'psychology',
    concept: 'Emotional Independence',
    title: 'Detached Mindset',
    definition: 'A state of mind where your emotions are completely detached from individual trade outcomes, focusing purely on execution consistency.',
    emoji: '🛡️'
  },
  {
    id: 'mitigationblock',
    category: 'smc',
    concept: 'Mitigation Block',
    title: 'Unswept Re-entry',
    definition: 'A broken order block that failed to sweep liquidity before the structural break, flipping into support/resistance for a clean re-entry.',
    emoji: '⛓️'
  },
  {
    id: 'marketmakermodel',
    category: 'smc',
    concept: 'Market Maker Model',
    title: 'MMBM & MMSM',
    definition: 'The complete cycle of price delivery consisting of retail accumulation, smart money manipulation, and distribution.',
    emoji: '🤖'
  },
  {
    id: 'premarketroutine',
    category: 'forex',
    concept: 'Pre-market Routine',
    title: 'Daily Session Prep',
    definition: 'A structured checklist (checking news, marking key levels, setting risk limits) executed before trading to eliminate emotional execution errors.',
    emoji: '📋'
  },
  {
    id: 'pullbacktrading',
    category: 'smc',
    concept: 'Pullback Trading',
    title: 'Trading Market Retracements',
    definition: 'A pullback is a temporary pause or retracement against the main trend. It acts as fuel, allowing smart money to buy at discount or sell at premium before the trend resumes.',
    emoji: '📈'
  },
  {
    id: 'sweeppullbacks',
    category: 'smc',
    concept: 'Sweep Pullbacks',
    title: 'Liquidity Grab Retracement',
    definition: 'A retracement that purposely pushes past a recent short-term swing point to capture resting retail stop-losses (liquidity) before reversing back in the trend direction.',
    emoji: '🧹'
  },
  {
    id: 'aggressivevsconservative',
    category: 'smc',
    concept: 'Aggressive vs Conservative',
    title: 'Entry Execution Models',
    definition: 'Aggressive entry sets a limit order directly on a key zone (e.g. FVG/OB). Conservative entry waits for price to tap the zone, then shifts structure on a lower timeframe before executing.',
    emoji: '🛡️'
  }
];

export function renderFlashcards(container) {
  container.replaceChildren();

  // Read mastered terms
  let mastered = storage.get('mastered_terms', []);
  const totalCount = FLASHCARD_TERMS.length;

  const section = el('div', 'flashcards-section');

  // Header & Mastery Progress bar
  const headerRow = el('div', 'flashcards-header');
  const title = el('h2', 'section-title', '🎴 Interactive Concept Flashcards');
  headerRow.appendChild(title);

  const progressContainer = el('div', 'flashcards-progress-wrap');
  const progressLabel = el('span', 'flashcards-progress-label');
  progressContainer.appendChild(progressLabel);

  const barTrack = el('div', 'flashcards-progress-track');
  const barFill = el('div', 'flashcards-progress-fill');
  barTrack.appendChild(barFill);
  progressContainer.appendChild(barTrack);
  headerRow.appendChild(progressContainer);
  section.appendChild(headerRow);

  // Update progress bar function
  function updateProgress() {
    mastered = storage.get('mastered_terms', []);
    const masteredCount = mastered.length;
    const percent = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;
    progressLabel.textContent = `🧩 Mastery: ${masteredCount}/${totalCount} (${percent}%)`;
    barFill.style.width = `${percent}%`;
  }
  updateProgress();

  // Search & Filter Panel Container
  const filterPanel = el('div', 'flashcards-filter-panel');
  filterPanel.style.display = 'flex';
  filterPanel.style.flexDirection = 'column';
  filterPanel.style.gap = 'var(--space-3)';
  filterPanel.style.marginBottom = 'var(--space-4)';

  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = '🔍 Search flashcards (e.g. FVG, pip, revenge)...';
  searchInput.className = 'form-input';
  searchInput.style.width = '100%';
  filterPanel.appendChild(searchInput);

  // Categories buttons row
  const tabsRow = el('div', 'flashcard-tabs-row');
  tabsRow.style.display = 'flex';
  tabsRow.style.gap = 'var(--space-2)';
  tabsRow.style.flexWrap = 'wrap';

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'mastered', label: '✅ Mastered' },
    { id: 'unmastered', label: '❌ Unmastered' },
    { id: 'smc', label: 'Smart Money (SMC)' },
    { id: 'forex', label: 'Forex Basics' },
    { id: 'psychology', label: 'Trading Psychology' }
  ];

  let activeCategory = 'all';
  let searchQuery = '';

  const tabButtons = {};
  categories.forEach(cat => {
    const btn = el('button', `btn btn-sm btn-outline${cat.id === activeCategory ? ' active' : ''}`, cat.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      Object.values(tabButtons).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = cat.id;
      rebuildGrid();
    });
    tabButtons[cat.id] = btn;
    tabsRow.appendChild(btn);
  });
  filterPanel.appendChild(tabsRow);
  section.appendChild(filterPanel);

  // Cards Grid
  const grid = el('div', 'flashcards-grid');
  section.appendChild(grid);

  function rebuildGrid() {
    grid.replaceChildren();
    mastered = storage.get('mastered_terms', []);

    const filtered = FLASHCARD_TERMS.filter(item => {
      // 1. Category check
      if (activeCategory === 'mastered' && !mastered.includes(item.id)) return false;
      if (activeCategory === 'unmastered' && mastered.includes(item.id)) return false;
      if (['smc', 'forex', 'psychology'].includes(activeCategory) && item.category !== activeCategory) return false;

      // 2. Search check
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesConcept = item.concept.toLowerCase().includes(query);
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDef = item.definition.toLowerCase().includes(query);
        if (!matchesConcept && !matchesTitle && !matchesDef) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      const emptyMsg = el('p', 'flashcards-empty-msg', 'No matching flashcards found. Try another search or category!');
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.style.gridColumn = '1 / -1';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.padding = 'var(--space-6) 0';
      grid.appendChild(emptyMsg);
      return;
    }

    filtered.forEach(item => {
      const isMastered = mastered.includes(item.id);
      const cardWrap = el('div', 'flashcard-container');
      const card = el('div', 'flashcard-card');
      const cardInner = el('div', 'flashcard-inner');

      // FRONT
      const front = el('div', 'flashcard-front');
      front.appendChild(el('span', 'flashcard-front__emoji', item.emoji));
      front.appendChild(el('h3', 'flashcard-front__concept', item.concept));
      front.appendChild(el('span', 'flashcard-front__title', item.title));
      
      const badge = el('span', `flashcard-category-badge cat-${item.category}`, item.category.toUpperCase());
      badge.style.fontSize = '8px';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '4px';
      badge.style.position = 'absolute';
      badge.style.top = '10px';
      badge.style.right = '10px';
      if (item.category === 'smc') {
        badge.style.background = 'rgba(0, 212, 255, 0.1)';
        badge.style.border = '1px solid rgba(0, 212, 255, 0.3)';
        badge.style.color = 'var(--cyan)';
      } else if (item.category === 'forex') {
        badge.style.background = 'rgba(168, 85, 247, 0.1)';
        badge.style.border = '1px solid rgba(168, 85, 247, 0.3)';
        badge.style.color = 'var(--purple)';
      } else {
        badge.style.background = 'rgba(57, 255, 20, 0.1)';
        badge.style.border = '1px solid rgba(57, 255, 20, 0.3)';
        badge.style.color = 'var(--neon-green)';
      }
      front.appendChild(badge);

      front.appendChild(el('span', 'flashcard-front__hint', '👇 Click to Flip'));

      // BACK
      const back = el('div', 'flashcard-back');
      back.appendChild(el('h4', 'flashcard-back__title', item.title));
      back.appendChild(el('p', 'flashcard-back__def', item.definition));

      const masterBtn = el('button', `btn btn-sm flashcard-back__btn${isMastered ? ' active' : ''}`);
      masterBtn.textContent = isMastered ? '✅ Mastered!' : '🧩 Mark Mastered';
      masterBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent flip bubble
        
        let currentMastered = storage.get('mastered_terms', []);
        if (currentMastered.includes(item.id)) {
          currentMastered = currentMastered.filter(id => id !== item.id);
          masterBtn.textContent = '🧩 Mark Mastered';
          masterBtn.classList.remove('active');
        } else {
          currentMastered.push(item.id);
          masterBtn.textContent = '✅ Mastered!';
          masterBtn.classList.add('active');
          showNotificationToast(`🧩 Mastered term: ${item.concept}! Keep it up! ⚡`);
        }
        storage.set('mastered_terms', currentMastered);
        
        import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
          if (getCurrentUser()) pushToCloud();
        });
        updateProgress();
        
        // If we are currently in "Mastered" or "Unmastered" tab, rebuild grid immediately to filter it out
        if (activeCategory === 'mastered' || activeCategory === 'unmastered') {
          rebuildGrid();
        }
      });
      back.appendChild(masterBtn);

      cardInner.appendChild(front);
      cardInner.appendChild(back);
      card.appendChild(cardInner);

      card.addEventListener('click', () => {
        card.classList.toggle('flipped');
      });

      cardWrap.appendChild(card);
      grid.appendChild(cardWrap);
    });
  }

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    rebuildGrid();
  });

  rebuildGrid();
  container.appendChild(section);
}

// --- Pullback Strategy Playbook & Video Helpers ---

export function getSafeEmbedUrl(url) {
  if (!url) return '';
  let videoId = '';
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (match && match[1]) {
    videoId = match[1];
  }
  if (videoId) {
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  return url;
}

export function openGuidedVideoModal(title, videoUrl) {
  const safeEmbedUrl = getSafeEmbedUrl(videoUrl);
  
  // Extract the video ID for fallback link
  const match = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  const videoId = match ? match[1] : '';
  const youtubeWatchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : videoUrl;

  const overlay = el('div', 'welcome-modal-overlay');
  const modal = el('div', 'welcome-modal');
  modal.style.maxWidth = '600px';
  modal.style.width = '90%';
  modal.style.padding = '0';
  modal.style.overflow = 'hidden';

  // Close on overlay click
  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) overlay.remove();
  });

  const header = el('div', '');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = 'var(--space-4) var(--space-5)';
  header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.06)';
  header.style.background = 'rgba(0, 0, 0, 0.3)';

  const headerTitle = el('h3', '', title);
  headerTitle.style.fontSize = 'var(--text-sm)';
  headerTitle.style.fontWeight = 'bold';
  headerTitle.style.color = '#fff';
  headerTitle.style.margin = '0';

  const closeBtn = el('button', '', '✕');
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = 'var(--text-muted)';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '1.2rem';
  closeBtn.addEventListener('click', () => {
    overlay.remove();
  });

  header.appendChild(headerTitle);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const videoWrap = el('div', '');
  videoWrap.style.position = 'relative';
  videoWrap.style.paddingBottom = '56.25%';
  videoWrap.style.height = '0';
  videoWrap.style.overflow = 'hidden';
  videoWrap.style.background = '#000';

  // Loading indicator
  const loader = el('div', '', '▶️ Loading video...');
  loader.style.position = 'absolute';
  loader.style.top = '50%';
  loader.style.left = '50%';
  loader.style.transform = 'translate(-50%, -50%)';
  loader.style.color = 'var(--text-muted)';
  loader.style.fontSize = 'var(--text-sm)';
  loader.style.textAlign = 'center';
  videoWrap.appendChild(loader);

  const iframe = document.createElement('iframe');
  iframe.src = safeEmbedUrl;
  iframe.style.position = 'absolute';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.loading = 'eager';

  iframe.addEventListener('load', () => {
    loader.style.display = 'none';
  });

  videoWrap.appendChild(iframe);
  modal.appendChild(videoWrap);

  // Fallback link
  const fallbackRow = el('div', '');
  fallbackRow.style.padding = 'var(--space-3) var(--space-5)';
  fallbackRow.style.textAlign = 'center';
  fallbackRow.style.background = 'rgba(0, 0, 0, 0.4)';
  fallbackRow.style.borderTop = '1px solid rgba(255, 255, 255, 0.06)';

  const fallbackLink = document.createElement('a');
  fallbackLink.href = youtubeWatchUrl;
  fallbackLink.target = '_blank';
  fallbackLink.rel = 'noopener noreferrer';
  fallbackLink.textContent = 'Video not loading? Open in YouTube ↗';
  fallbackLink.style.fontSize = 'var(--text-xs)';
  fallbackLink.style.color = 'var(--cyan)';
  fallbackLink.style.textDecoration = 'none';
  fallbackLink.style.opacity = '0.7';
  fallbackLink.addEventListener('mouseenter', () => { fallbackLink.style.opacity = '1'; });
  fallbackLink.addEventListener('mouseleave', () => { fallbackLink.style.opacity = '0.7'; });

  fallbackRow.appendChild(fallbackLink);
  modal.appendChild(fallbackRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

export function renderPullbackPlaybook(container) {
  container.replaceChildren();
  
  const card = el('div', 'playbook-card');
  card.style.background = 'rgba(20, 20, 25, 0.6)';
  card.style.backdropFilter = 'blur(12px)';
  card.style.border = '1px solid rgba(0, 242, 254, 0.15)';
  card.style.borderRadius = 'var(--radius-lg)';
  card.style.padding = 'var(--space-5)';
  card.style.marginBottom = 'var(--space-6)';
  card.style.boxShadow = '0 8px 32px 0 rgba(0, 242, 254, 0.05)';
  card.style.position = 'relative';
  card.style.overflow = 'hidden';

  const glowLine = el('div');
  glowLine.style.position = 'absolute';
  glowLine.style.top = '0';
  glowLine.style.left = '0';
  glowLine.style.width = '100%';
  glowLine.style.height = '3px';
  glowLine.style.background = 'linear-gradient(90deg, var(--cyan), var(--purple))';
  card.appendChild(glowLine);

  const header = el('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = 'var(--space-4)';
  header.style.flexWrap = 'wrap';
  header.style.gap = 'var(--space-2)';

  const titleWrap = el('div');
  const title = el('h3', 'section-title', '📐 EdgeFlo Trading Playbook');
  title.style.margin = '0';
  title.style.fontSize = '1.25rem';
  title.style.color = '#fff';
  titleWrap.appendChild(title);
  
  const subtitle = el('p', '', 'Systematic execution framework & entry models reference');
  subtitle.style.fontSize = 'var(--text-xs)';
  subtitle.style.color = 'var(--text-muted)';
  subtitle.style.margin = '2px 0 0 0';
  titleWrap.appendChild(subtitle);
  
  header.appendChild(titleWrap);

  const videoBtn = el('button', 'btn btn-sm btn-outline', '📺 Watch Lesson Video');
  videoBtn.addEventListener('click', () => {
    openGuidedVideoModal('Simple Pullback Strategy', 'https://youtu.be/Nuorx9oVz8o?si=vkbggcVSvYIcNhJE');
  });
  header.appendChild(videoBtn);
  card.appendChild(header);

  // Playbook Tabs Row
  const tabsRow = el('div', 'playbook-modal-tabs');
  tabsRow.style.marginBottom = 'var(--space-4)';
  tabsRow.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
  tabsRow.style.background = 'rgba(0, 0, 0, 0.2)';
  tabsRow.style.borderRadius = 'var(--radius-md)';
  tabsRow.style.padding = '2px';
  
  const tabBtnChecklist = el('button', 'playbook-tab-btn active', '📋 Pullback Checklist');
  const tabBtnCriteria = el('button', 'playbook-tab-btn', '📐 Entry Models & Criteria');
  const tabBtnUpgrades = el('button', 'playbook-tab-btn', '⭐ A+ Upgrades');
  tabsRow.appendChild(tabBtnChecklist);
  tabsRow.appendChild(tabBtnCriteria);
  tabsRow.appendChild(tabBtnUpgrades);
  card.appendChild(tabsRow);

  // Tab Contents Container
  const tabBody = el('div', 'playbook-tab-body');

  // --- Tab 1 Content: Pullback Checklist (Original Steps) ---
  const contentChecklist = el('div', 'playbook-tab-content active');
  contentChecklist.style.display = 'flex';
  contentChecklist.style.flexDirection = 'column';
  contentChecklist.style.gap = 'var(--space-3)';

  const steps = [
    {
      id: 'step1',
      title: 'Step 1: Check for Trend Bias (HTF Alignment)',
      desc: 'Verify market direction on the Higher Time Frame (e.g. D1 or H4). Only take pullbacks in the direction of the dominant HTF flow (bullish bias = buy pullbacks; bearish bias = sell pullbacks).',
      badge: 'HTF Trend'
    },
    {
      id: 'step2',
      title: 'Step 2: Characterize the Pullback Type',
      desc: 'Analyze the retracement speed and depth. Fast pullbacks (1-3 quick candles) suggest high momentum. Slow pullbacks (complex range consolidation) build liquidity. Sweep pullbacks run past a recent swing point to grab stops before reversing.',
      badge: 'Retracement Character'
    },
    {
      id: 'step3',
      title: 'Step 3: Select Entry Execution Model',
      desc: 'Choose how to enter: Aggressive entry uses a limit order directly at the FVG / Order Block zone. Conservative entry waits for price to tap the zone and shift market structure (CHOCH) on a lower timeframe (e.g., M5/M1) before executing.',
      badge: 'Execution Model'
    }
  ];

  const checkedSteps = storage.get('pullback_playbook_steps', {});

  steps.forEach((step, idx) => {
    const isChecked = !!checkedSteps[step.id];

    const stepItem = el('div', 'playbook-step');
    stepItem.style.display = 'flex';
    stepItem.style.gap = 'var(--space-4)';
    stepItem.style.background = 'rgba(255, 255, 255, 0.02)';
    stepItem.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    stepItem.style.borderRadius = 'var(--radius-md)';
    stepItem.style.padding = 'var(--space-4)';
    stepItem.style.transition = 'all 0.2s ease';
    if (isChecked) {
      stepItem.style.border = '1px solid rgba(57, 255, 20, 0.15)';
      stepItem.style.background = 'rgba(57, 255, 20, 0.01)';
    }

    const checkWrap = el('div');
    checkWrap.style.display = 'flex';
    checkWrap.style.alignItems = 'flex-start';
    checkWrap.style.paddingTop = '2px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.style.cursor = 'pointer';
    checkbox.style.width = '18px';
    checkbox.style.height = '18px';
    checkbox.style.accentColor = 'var(--neon-green)';
    checkbox.addEventListener('change', () => {
      checkedSteps[step.id] = checkbox.checked;
      storage.set('pullback_playbook_steps', checkedSteps);
      
      if (checkbox.checked) {
        stepItem.style.border = '1px solid rgba(57, 255, 20, 0.15)';
        stepItem.style.background = 'rgba(57, 255, 20, 0.01)';
        playSynthSound('click');
        nativeHaptic();
        
        if (Object.values(checkedSteps).filter(Boolean).length === steps.length) {
          triggerConfetti();
          showNotificationToast('🏆 Pullback Strategy Checklist Completed! You are ready to trade pullbacks! ⚡');
        }
      } else {
        stepItem.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        stepItem.style.background = 'rgba(255, 255, 255, 0.02)';
      }
    });
    checkWrap.appendChild(checkbox);
    stepItem.appendChild(checkWrap);

    const textWrap = el('div');
    textWrap.style.display = 'flex';
    textWrap.style.flexDirection = 'column';
    textWrap.style.gap = 'var(--space-1)';

    const titleRow = el('div');
    titleRow.style.display = 'flex';
    titleRow.style.alignItems = 'center';
    titleRow.style.gap = 'var(--space-2)';
    titleRow.style.flexWrap = 'wrap';

    const titleEl = el('h4', '', step.title);
    titleEl.style.fontSize = 'var(--text-sm)';
    titleEl.style.fontWeight = '600';
    titleEl.style.color = '#fff';
    titleEl.style.margin = '0';
    titleRow.appendChild(titleEl);

    const badgeEl = el('span', '', step.badge);
    badgeEl.style.fontSize = '9px';
    badgeEl.style.padding = '2px 6px';
    badgeEl.style.borderRadius = '4px';
    badgeEl.style.background = 'rgba(0, 242, 254, 0.1)';
    badgeEl.style.border = '1px solid rgba(0, 242, 254, 0.2)';
    badgeEl.style.color = 'var(--cyan)';
    titleRow.appendChild(badgeEl);

    textWrap.appendChild(titleRow);

    const descEl = el('p', '', step.desc);
    descEl.style.fontSize = 'var(--text-xs)';
    descEl.style.color = 'var(--text-muted)';
    descEl.style.margin = '0';
    descEl.style.lineHeight = '1.4';
    textWrap.appendChild(descEl);

    stepItem.appendChild(textWrap);
    contentChecklist.appendChild(stepItem);
  });
  tabBody.appendChild(contentChecklist);

  // --- Tab 2 Content: Entry Models & Minimum Criteria ---
  const contentCriteria = el('div', 'playbook-tab-content');
  contentCriteria.style.display = 'none';
  contentCriteria.style.flexDirection = 'column';
  contentCriteria.style.gap = 'var(--space-4)';

  const criteriaTitle = el('h4', '', '📋 Minimum Must-Have Entry Criteria');
  criteriaTitle.style.fontSize = 'var(--text-sm)';
  criteriaTitle.style.color = '#fff';
  criteriaTitle.style.margin = '0';
  contentCriteria.appendChild(criteriaTitle);

  const criteriaList = el('div', 'playbook-criteria-list');
  const rules = [
    'Trend direction confirmed on Higher Timeframe (Daily/H4) 📈',
    'Price is at a valid point of interest (Demand/Supply, Breaker, FVG) 🎯',
    'At least two additional confluences present in setup 🤝',
    'Current session is active (London or New York Killzone) ⏱️',
    'Stop Loss is placed at structural level (not arbitrary pips) 🛑',
    'Risk-to-reward ratio is 3:1 or better before entry 🏆'
  ];
  rules.forEach((rule, idx) => {
    const row = el('div', 'playbook-criteria-row');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'playbook-criteria-checkbox';
    chk.id = `playbook-learning-chk-${idx}`;
    chk.addEventListener('change', () => playSynthSound('click'));
    
    const lbl = el('label', '', rule);
    lbl.setAttribute('for', chk.id);
    lbl.style.cursor = 'pointer';
    
    row.appendChild(chk);
    row.appendChild(lbl);
    criteriaList.appendChild(row);
  });
  contentCriteria.appendChild(criteriaList);

  const modelsTitle = el('h4', '', '📐 Playbook Entry Models');
  modelsTitle.style.fontSize = 'var(--text-sm)';
  modelsTitle.style.color = '#fff';
  modelsTitle.style.margin = 'var(--space-2) 0 0 0';
  contentCriteria.appendChild(modelsTitle);

  const modelsGrid = el('div', 'playbook-models-grid');
  const models = [
    {
      name: '1. Breaker Block Retest',
      tag: 'STRUCTURE SHIFT',
      desc: 'Price sweeps a key liquidity pool, then aggressively breaks structure (BOS/CHOCH) creating a displacement zone. Enter when price retraces back to mitigate the Breaker Block.',
      steps: [
        'Identify HTF direction & draw key liquidity pools.',
        'Wait for liquidity sweep followed by a strong body close breaking structure.',
        'Place limit entry at the breaker zone boundary.',
        'Stop Loss set cleanly behind the sweep candle high/low.'
      ]
    },
    {
      name: '2. FVG Mitigation Sweep',
      tag: 'LIQUIDITY + GAP',
      desc: 'Price sweeps the Asian High or Low, then rapidly mitigates a Higher Timeframe Fair Value Gap (FVG). Enter on M5/M1 CHOCH candle confirmation tapping the FVG.',
      steps: [
        'Mark Asian High/Low as key buy/sell stop targets.',
        'Wait for price to sweep Asian High/Low and tap H4/H1 FVG.',
        'Zoom into M5/M1: wait for structure shift and FVG form.',
        'Enter retest of lower timeframe FVG; SL below structural shift swing.'
      ]
    },
    {
      name: '3. Judas Swing False Breakout',
      tag: 'SESSION MANIPULATION',
      desc: 'Occurs in first 30-60 mins of London session. Price makes a false breakout against HTF bias to grab liquidity before reversing strongly in the HTF direction.',
      steps: [
        'Establish clear daily trend bias before session open.',
        'Wait for early session move running counter to bias.',
        'Confirm false breakout sweep of key structural level.',
        'Enter on engulfing candle rejection; SL past sweep wick.'
      ]
    }
  ];

  models.forEach(m => {
    const card = el('div', 'playbook-model-card');
    
    const titleRow = el('div', 'playbook-model-title-row');
    titleRow.appendChild(el('h4', 'playbook-model-name', m.name));
    titleRow.appendChild(el('span', 'playbook-model-tag', m.tag));
    card.appendChild(titleRow);

    card.appendChild(el('p', 'playbook-model-desc', m.desc));

    const stepsContainer = el('ul', 'playbook-model-steps');
    m.steps.forEach(step => {
      const li = el('li', 'playbook-model-step-item', step);
      stepsContainer.appendChild(li);
    });
    card.appendChild(stepsContainer);
    modelsGrid.appendChild(card);
  });
  contentCriteria.appendChild(modelsGrid);
  tabBody.appendChild(contentCriteria);

  // --- Tab 3 Content: A+ Setup Upgrades ---
  const contentUpgrades = el('div', 'playbook-tab-content');
  contentUpgrades.style.display = 'none';
  contentUpgrades.style.flexDirection = 'column';
  contentUpgrades.style.gap = 'var(--space-3)';

  const upgradesList = el('div', 'playbook-upgrades-list');
  const upgrades = [
    { icon: '💎', title: 'Perfect Triple Alignment', desc: 'Higher timeframe trend direction (D1), point of interest location (H4 FVG), and execution timing (London Open) are fully aligned.' },
    { icon: '⚡', title: 'High displacement volume', desc: 'The candle breaking structure must have a wide range body and high volume, leaving behind a large, clean Fair Value Gap.' },
    { icon: '🧹', title: 'Clear Liquidity Sweep', desc: 'Price must cleanly sweep a major pool (Asian High/Low, Previous Daily High/Low) immediately before hitting the entry zone.' },
    { icon: '📰', title: 'Safe news window', desc: 'No high-impact economic news releases (red folder news) are scheduled within 2 hours of entry.' }
  ];

  upgrades.forEach(up => {
    const card = el('div', 'playbook-upgrade-item');
    card.appendChild(el('span', 'playbook-upgrade-icon', up.icon));
    const textWrap = el('div', 'playbook-upgrade-text-wrap');
    textWrap.appendChild(el('span', 'playbook-upgrade-title', up.title));
    textWrap.appendChild(el('span', 'playbook-upgrade-desc', up.desc));
    card.appendChild(textWrap);
    upgradesList.appendChild(card);
  });
  contentUpgrades.appendChild(upgradesList);
  tabBody.appendChild(contentUpgrades);

  card.appendChild(tabBody);
  container.appendChild(card);

  // Tabs switching logic
  const tabButtons = [
    { btn: tabBtnChecklist, content: contentChecklist },
    { btn: tabBtnCriteria, content: contentCriteria },
    { btn: tabBtnUpgrades, content: contentUpgrades }
  ];

  tabButtons.forEach(t => {
    t.btn.addEventListener('click', () => {
      playSynthSound('click');
      tabButtons.forEach(x => {
        x.btn.classList.remove('active');
        x.content.style.display = 'none';
      });
      t.btn.classList.add('active');
      t.content.style.display = 'flex';
    });
  });
}



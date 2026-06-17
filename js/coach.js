import storage from './storage.js';
import { getTrades, calculateStats } from './trading.js';
import { addXP } from './xp.js';
import { triggerConfetti, showNotificationToast, el } from './utils.js';
import { playSynthSound } from './audio.js';
import { nativeHaptic, nativeHapticNotification } from './native-bridge.js';

// --- Legacy Key Migration ---
function migrateLegacyCoachKeys() {
  const migrations = {
    'swagga_gemini_api_key': 'swagga:gemini_api_key',
    'swagga_claude_api_key': 'swagga:claude_api_key',
    'swagga_ai_kb': 'swagga:ai_kb'
  };
  for (const [oldKey, newKey] of Object.entries(migrations)) {
    const val = localStorage.getItem(oldKey);
    if (val !== null) {
      localStorage.setItem(newKey, val);
      localStorage.removeItem(oldKey);
    }
  }
}
try {
  migrateLegacyCoachKeys();
} catch (e) {
  console.warn('Legacy key migration failed:', e);
}

// --- EdgeFlo Blog Strategy & Psychology Database (Autofill content) ---
const EDGEFLO_KB_CONTENT = `=== EDGEFLO STRATEGY & PSYCHOLOGY RULES ===

[Your Trading Reflects Your Weaknesses: Use That]
Key Topics: The Market Does Not Care About Your Strategy, The Four Mirrors, Fix One Thing at a Time, How EdgeFlo Turns the Mirror Into a Tool, Mirror 1: FOMO (Fear of Missing Out)
The market is a mirror. FOMO, greed, impatience, and control issues all show up in your trades. Learn how to use your journal to diagnose and fix them.
Your Trading Reflects Your Weaknesses: Use That
Most struggling traders think their problem is strategy. They switch indicators, change timeframes, buy courses, and hunt for the perfect setup. But after multiple blown accounts, a pattern emerges that has nothing to do with charts. The real problem is the person sitting at the screen. The market acts like a mirror. It reflects your FOMO, your greed, your impatience, and your need for control right back at you in the form of losing trades. Once you understand this, your trading journal becomes the most powerful diagnostic tool you own.

[Would an Investor Fund You? Score Your Equity Curve]
Key Topics: What Investors Actually Look For, The Five-Point Investor Scorecard, Walkthrough: Scoring a Real Equity Curve, Walkthrough: A Curve That Fails the Test, Why This Test Matters Even If You Never Seek Funding
If a prop firm or investor saw your equity curve, would they trust you with capital? Use this framework to grade yourself honestly.
Would an Investor Fund You? Score Your Equity Curve
Pull up your equity curve right now. Look at the shape of it. Not the dollar amount at the end, not the best month, not the worst day. Just the shape.

[Your P&L Does Not Define Your Worth as a Trader]
Key Topics: Why Smart Traders Still Lose Money, The Identity Trap: Tying Self-Worth to Daily Results, What Your Equity Curve Actually Measures, Separating the Person From the Performance, How EdgeFlo Sanctuary Helps You Reset After a Drawdown
Your equity curve measures execution consistency, not intelligence. Separating self-worth from daily P&L is the psychological shift that sustains trading careers.
Your P&L Does Not Define Your Worth as a Trader
Smart traders lose money. Consistently. The best traders in the world have losing days, losing weeks, and sometimes losing months. A red P&L does not mean you are a bad trader. It means you are a trader.

[Win Rate vs R Multiple: Which Actually Matters]
Key Topics: What Win Rate Actually Tells You, What R Multiple Actually Tells You, Head-to-Head: The Math That Settles It, Why Chasing Win Rate Destroys R Multiple, Expectancy: The Metric That Combines Both
A 60% win rate with 3R average beats an 80% win rate with 1R. Learn the math that proves R multiple matters more than win rate and how to track both.
Win Rate vs R Multiple: Which Actually Matters
You win 8 out of 10 trades. Your friend wins 4 out of 10. You must be the better trader, right?

[Daily Loss Limits: Your Safety Net for Bad Days]
Key Topics: Loss Limits Are Not Just a Kill Switch, What Hitting Your Limit Every Week Actually Means, How Limits Expose a Style Mismatch, Setting Limits That Match Your Timeframe
Daily loss limits do more than protect capital. They reveal whether your trading style fits your emotional capacity. Use limits as diagnostic data.
Daily Loss Limits: Your Safety Net for Bad Days
A daily loss limit is not just a kill switch that protects your capital. It is a diagnostic tool that reveals whether your trading style actually fits your emotional capacity. If you hit your limit once a month, bad luck happens. If you hit it every week, the style is wrong, not just the execution. The limit exposes the mismatch before it drains your account.

[How Your Journal Reveals Your Real Trading Style]
Key Topics: Your Feelings Lie, Your Data Does Not, What 30 Trades Tell You About Your Style, Spotting Your Best Setup, Session, and Timeframe, When the Data Contradicts Your Preference, How EdgeFlo AI Report Surfaces Your Hidden Patterns
Your strengths hide in your trade data, not your feelings. Journal reviews expose which setups, sessions, and timeframes produce real results.
How Your Journal Reveals Your Real Trading Style
Your feelings about your trading style are unreliable. Your data is not. After 30 or more trades, your journal reveals which setups, sessions, and timeframes actually produce results. Most traders pick a style based on what sounds exciting or what a YouTube video recommended. The ones who last pick a style based on what their own numbers prove works for them.

[How to Journal Manipulation Setups]
Key Topics: Why Standard Journal Templates Miss Manipulation Data, The Five Fields Every Manipulation Entry Needs, How to Tag Sweep Type, Direction, and Outcome, Reviewing Your Manipulation Journal for Edge Refinement, How EdgeFlo Auto-Tags Manipulation Patterns in Your Journal
Standard journal templates miss manipulation data. Learn the five fields every manipulation entry needs and how to review sweep patterns to sharpen your edge.
You can study liquidity sweeps, inducements, and institutional manipulation for months. You can watch every YouTube video. You can read every article. But none of that knowledge compounds unless you track what you actually see and trade.
Standard journal templates capture the basics: entry price, exit price, P&L, maybe a note about your emotions. They miss the data that matters most for manipulation-based trading. They do not record whether a sweep happened, what type of liquidity was targeted, or whether your entry was on the first touch or the second.

[The Comfort Trap: When Zero Pain Means Maximum Risk]
Key Topics: Why Comfort Feels Like Mastery but Is Not, The Emotional Sequence from Comfort to Catastrophe, What Healthy Discomfort Looks Like in Trading, Scheduled Check-Ins That Break the Comfort Spell, How EdgeFlo Flags When You Stop Challenging Yourself
When trading feels effortless and pain-free, you are at peak danger. Learn why comfort signals dropped standards and how to break the complacency cycle.
The Comfort Trap: When Zero Pain Means Maximum Risk
There is a moment in every trader's journey that feels like arrival. The wins are stacking up. The system is working. You are not stressed, not worried, not second-guessing. Everything just clicks.

[De-Risk After Drawdown: The 0.5% Recovery Protocol]
Key Topics: When to Cut Risk in Half, The Recovery Math at 0.5%, Why 3R Wins Cover 0.5% Losses Fast, When to Move Back to 1%, How EdgeFlo Automates the Risk Drop
Cut risk from 1% to 0.5% after consecutive losses. See the exact math behind recovery at half risk and when to move back to full size.
De-Risk After Drawdown: The 0.5% Recovery Protocol
Two losses in a row and suddenly the next trade feels heavier than it should. Your stop is the same size. Your setup looks clean. But something shifted. The account is lighter, and every new loss digs a deeper hole.

[Better Entry Location = Better Risk to Reward]
Key Topics: The Middle-of-Nowhere Problem, How Location Transforms Your R:R, Walkthrough: 1:1 vs 3:1 on the Same Setup, Capital Allocation Is About Location Quality, How EdgeFlo Shows Your R Before You Enter
Entering in the middle gives 1:1 R:R. Entering at a demand zone in discount gives 3:1 or better. Same trade idea, wildly different outcomes. Math inside.
Better Entry Location = Better Risk to Reward
Two traders see the same bullish structure on EUR/USD. Same demand zone. Same target. Same week. One makes $1,500. The other makes $300. They took the same trade. The difference is where they clicked buy.

[Funded Challenge Risk Framework: The 3-Tier System]
Key Topics: The 3-Tier Risk System, Tier 1: Start at 1% Risk Per Trade, Tier 2: Drop to 0.5% When You Hit -2%, Tier 3: Optional 2% at +5% (Challenge Only), How Your Equity Curve Shapes the Decision
Pass your funded challenge with the 3-tier risk framework: 1% default, 0.5% de-risk at -2%, optional 2% acceleration at +5%. Step-by-step mechanics.
Funded Challenge Risk Framework: The 3-Tier System
Most traders who fail funded challenges do not fail because of bad entries. They fail because they never adjust their risk as their account balance shifts. They start at 1%, stay at 1% even when they are down 4%, and blow through the drawdown limit on a single bad morning.

[Why 99% of Traders Fail Funded Challenges]
Key Topics: The Real Reasons Challenges Fail (Not Strategy), Reason 1: You Want Excitement, Not Freedom, Reason 2: You Copied an Edge You Cannot Trust, Reason 3: You Cannot Handle Success, Reason 4: You Want the Payout, Not the Process
Most traders fail funded challenges for five reasons that have nothing to do with strategy. Fix these and passing becomes a matter of time.
Why 99% of Traders Fail Funded Challenges
Most traders fail funded challenges for reasons that have nothing to do with their chart analysis. The five real killers are chasing dopamine instead of freedom, copying someone else's edge without proof it works, self-sabotaging after making money, obsessing over the payout instead of the process, and lacking the patience to let the challenge play out. Fix these five problems and passing becomes a matter of time, not luck. Your strategy is probably fine. Your behavior is the bottleneck.

[I Failed 4 Funded Challenges: What Finally Worked]
Key Topics: Failure 1: Rushing In Without Enough Reps, Failure 2: Overtrading to Hit the Profit Target, Failure 3: Not Respecting Funded Drawdown Rules, Failure 4: Forcing Trades When the Market Gives Nothing, The Attempt That Passes: What Is Different
Most traders fail their first funded challenge. Many fail four or five. Learn the common failure patterns and what changes on the attempt that finally passes.
I Failed 4 Funded Challenges: What Finally Worked
Failing a funded challenge feels personal. You paid the fee, you studied the rules, you thought you were ready. And then in week one, your daily loss limit gets breached and the account is gone.

[Consistency Starts Before the Charts: Daily Habits of Profitable Traders]
Key Topics: Why Chart Skills Are Not Enough, The Off-Chart Habits That Drive On-Chart Results, Building a Non-Negotiable Daily Routine, How Physical Discipline Transfers to Trading Discipline, How EdgeFlo Enforces Pre-Market Routines
Trading consistency comes from daily habits, not chart skills. Build the off-chart routine that drives on-chart discipline and stops reactive trading.
Consistency Starts Before the Charts: Daily Habits of Profitable Traders
You know the setups. You have studied the charts. You can identify supply and demand zones, mark structure, and build a daily bias. And yet, you still take emotional trades, break your rules, and give back profits on days when you feel off.

[Trading Drawdown Recovery: The De-Risking Framework]
Key Topics: Why Drawdown Gets Worse Before It Gets Better, The Math: Why Recovery Takes Longer Than You Think, The De-Risking Framework (1% to 0.5% Switch), When to Increase Risk Again, A Drawdown Recovery Walkthrough ($100k Account)
Recover from trading drawdown without revenge trading or overleveraging. Use the 1% to 0.5% de-risking framework to preserve capital and rebuild steadily.
Trading Drawdown Recovery: The De-Risking Framework
Trading drawdown recovery requires cutting your risk, not increasing it. When your account drops from $100,000 to $95,000, the instinct is to trade bigger and "make it back fast." That instinct is wrong. The correct move is to reduce risk from 1% to 0.5% per trade, take fewer positions, and let the math work in your favor. One winning trade at 0.5% risk with a 1:3 risk-to-reward ratio recovers the equivalent of three losing trades at the same level.

[Trading Exit Rules: Stop Loss and Take Profit Methods]
Key Topics: Two Types of Exits Every Plan Needs, Stop Loss Placement: Where and Why, Take Profit Methods: Fixed R vs Technical Targets, Why Consistent Exits Beat Emotional Exits, How EdgeFlo Helps You Stick to Your Exit Rules
Define exit rules for winning and losing trades. Compare fixed R targets vs technical exits with Forex examples so you stop cutting winners short.
Trading Exit Rules: Stop Loss and Take Profit Methods
Trading exit rules define exactly where you get out of a trade, both when it goes wrong and when it goes right. Without them, you end up cutting winning trades early out of fear and letting losing trades run out of hope. Both habits destroy accounts. Exit rules remove the decision from real time and put it back where it belongs: in your plan, written before the trade starts.

[Daily Loss Limit: The 5% Rule That Keeps You in the Game]
Key Topics: What a Daily Loss Limit Actually Protects, How Prop Firms Calculate Daily Loss (Open + Closed Trades), The Hidden Trap: Floating Losses Count, How 0.5% Risk Per Trade Gives You Breathing Room, What to Do When You Hit 2% Down
The 5% daily loss limit protects your funded or live account from blowouts. Learn how it is calculated, why floating losses count, and how to stay well under it.
Daily Loss Limit: The 5% Rule That Keeps You in the Game
A daily loss limit caps how much you can lose in a single trading day, usually at 5% of your account balance. On a $100,000 funded account, that means $5,000. Hit that number and trading stops. On prop firm accounts, breaching it kills the account entirely. On personal accounts, it should trigger a hard stop where you walk away from the screen.

[Liquidity Pools in Forex: Where Resting Orders Sit]
Key Topics: What Liquidity Pools Actually Are, Where Resting Orders Accumulate, Equal Highs and Equal Lows as Magnets, Reading Liquidity on Your Chart, How EdgeFlo Helps Track Zone Reactions
Liquidity pools are clusters of resting orders above highs and below lows. Learn how equal highs and lows create predictable magnets that attract price.
Liquidity Pools in Forex: Where Resting Orders Sit
Liquidity pools are clusters of resting orders stacked at specific price levels. They form above swing highs and below swing lows because that is where retail traders predictably place their stop losses and pending orders. These pools act like magnets, pulling price toward them because the market constantly needs opposing orders to fuel the next move. Knowing where liquidity hides is the difference between entering with the flow and entering against it.

[Lower Timeframe Entry Model: When to Zoom In]
Key Topics: When to Drop to the 15-Minute Chart, The Premature Entry Trap on Lower Timeframes, Breaking the Last Lower High as Confirmation, Walkthrough: 4H Zone to 15m Entry, How EdgeFlo Journals Your Timeframe Discipline
Only drop to the 15-minute chart after price enters your zone on the higher timeframe. Zooming in too early causes premature entries. Here is the exact model.
Lower Timeframe Entry Model: When to Zoom In
The 15-minute chart is the most dangerous timeframe in trading. Not because it is unreliable, but because traders look at it at the wrong time.

[Never Trade the First Mitigation of a Zone]
Key Topics: What Mitigation Means in Smart Money Terms, Why the First Touch Often Fails, The Second Mitigation Entry: When and How, Adding This Rule to Your Execution Checklist, How EdgeFlo Tracks Zone Mitigation Count
The first time price returns to a supply or demand zone, it often fails. Learn the first-mitigation rule and how to wait for the second visit for better entries.
Never Trade the First Mitigation of a Zone
You marked a clean demand zone. Price pulled back to it. You entered on the touch. And then price sliced right through your zone like it was not there.

`;


// --- Configuration Constants ---
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

// Initial chat greeting
const INITIAL_GREETING = {
  sender: 'assistant',
  text: `Welcome back, SwaGGa. I am **SwagAI**, your custom, built-in Trading Mentor.\n\nI am directly connected to your **Pullback Playbook**, your **live trade history**, and your **custom strategy notes** to keep you objective, disciplined, and aligned.\n\nUse the quick pills below or write to me if you are experiencing an emotional trigger, need a pre-session critique, or want to perform a post-session review.`
};

// --- Module State Variables ---
let _activeTab = storage.get('coach_active_tab', 'chat'); // 'chat', 'pre', 'post', 'settings'
let _chatHistory = storage.get('coach_chat_history', [INITIAL_GREETING]);
let _selectedModel = storage.get('coach_selected_model', 'gemini'); // 'gemini', 'claude'
let _activeEmotion = ''; // Revenge, FOMO, Hesitation, Greed, Grounded

// --- Retrieve Local Context Data ---
function getLocalContextString() {
  const trades = getTrades();
  const stats = calculateStats(trades);
  
  // 1. Fetch Pullback Playbook completed steps
  const checkedSteps = storage.get('pullback_playbook_steps', {});
  const completedPlaybookSteps = Object.keys(checkedSteps).filter(k => checkedSteps[k] === true);
  
  // 2. Fetch recent logged mistakes
  const mistakeCounts = {};
  trades.forEach(t => {
    if (t.mistake && t.mistake !== 'none') {
      mistakeCounts[t.mistake] = (mistakeCounts[t.mistake] || 0) + 1;
    }
  });
  const topMistakes = Object.entries(mistakeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, c]) => `${m} (${c} times)`)
    .join(', ');

  // 3. Get Custom Knowledge Base text
  const customKB = getCustomKB() || 'None provided yet.';

  // 4. Create structured context block
  return `
--- USER TRADING CONTEXT & PROFILE ---
Username: SwaGGa
Total Trades Logged: ${stats.totalTrades}
Win Rate: ${stats.winRate}%
Total Profit/Loss: $${stats.totalPnL.toFixed(2)}
Frequent Mistake Tags: ${topMistakes || 'None logged yet'}
Completed Playbook Rules: ${completedPlaybookSteps.length > 0 ? completedPlaybookSteps.join(', ') : 'None marked completed yet'}

--- CUSTOM KNOWLEDGE BASE STRATEGY NOTES ---
${customKB}
--------------------------------------
  `;
}

// --- System Instruction & Prompts ---
const SYSTEM_PROMPT = `You are "SwagAI", SwaGGa's elite in-app personal trading psychologist, risk manager, and Smart Money Concepts (SMC) mentor.

Your goals:
1. Provide extremely clear, calm, and direct advice. Never be verbose. Speak like a senior institutional risk manager.
2. Hold SwaGGa strictly accountable to their rules and performance.
3. Challenge technical biases, warn against revenge trading, and address emotional states immediately.
4. Reference their specific pullback playbook rules, historical win rate, and top mistakes when relevant.
5. If SwaGGa is experiencing high adrenaline, box breathing, or severe FOMO, direct them to use specific video tools in their Mindset Sanctuary (#mindset):
   - For immediate de-escalation: Suggest the "60-Second Reboot" or "Box Breathing (4-4-4-4)" tool.
   - For fear of execution or taking losses: Suggest the "Risk Acceptance Primer" (8 Min) or "P&L Detachment Meditation" (12 Min).
   - For winding down after a tough session: Suggest the "Post-Session Adrenaline Flush" (5 Min) or "Trading Day Closure Routine" (10 Min).
6. Format your responses using clean Markdown, bullets, and bold text. Keep paragraphs short (1-3 sentences).
`;

// TODO(security): Personal API key is stored locally on-device for direct client-to-API calls.
function getApiKey(provider) {
  let val = '';
  if (provider === 'gemini') {
    val = localStorage.getItem('swagga:gemini_api_key') || '';
  } else if (provider === 'claude') {
    val = localStorage.getItem('swagga:claude_api_key') || '';
  }
  
  let cleaned = val.trim();
  // Self-healing migration for double-stringified config keys
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') {
        cleaned = parsed.trim();
        // Save the cleaned key back immediately
        if (provider === 'gemini') localStorage.setItem('swagga:gemini_api_key', cleaned);
        if (provider === 'claude') localStorage.setItem('swagga:claude_api_key', cleaned);
      }
    } catch (e) {
      // ignore
    }
  }

  // Self-healing migration: if the user pasted a blog link or URL as their API key, clear it
  if (cleaned.startsWith('http') || cleaned.includes('.com') || cleaned.includes('/') || cleaned.includes('edgeflo')) {
    if (provider === 'gemini') localStorage.removeItem('swagga_gemini_api_key');
    if (provider === 'claude') localStorage.removeItem('swagga_claude_api_key');
    if (provider === 'gemini') localStorage.removeItem('swagga:gemini_api_key');
    if (provider === 'claude') localStorage.removeItem('swagga:claude_api_key');
    return '';
  }
  return cleaned;
}

function getCustomKB() {
  let val = localStorage.getItem('swagga:ai_kb') || '';
  // Self-healing migration for double-stringified config keys
  if (val.startsWith('"') && val.endsWith('"')) {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'string') {
        val = parsed;
        localStorage.setItem('swagga:ai_kb', val);
      }
    } catch (e) {
      // ignore
    }
  }
  return val;
}

// --- Safe Markdown Text Formatter (No innerHTML) ---
function formatMarkdownText(text) {
  const container = el('div', 'markdown-body');
  const lines = text.split('\n');
  let currentList = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      currentList = null;
      return;
    }

    // Unordered List item
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (!currentList) {
        currentList = el('ul');
        container.appendChild(currentList);
      }
      const li = el('li');
      parseInlineMarkdown(trimmed.substring(2), li);
      currentList.appendChild(li);
      return;
    }

    // Ordered List item
    const matchOrdered = trimmed.match(/^(\d+)\.\s(.*)/);
    if (matchOrdered) {
      if (!currentList) {
        currentList = el('ol');
        container.appendChild(currentList);
      }
      const li = el('li');
      parseInlineMarkdown(matchOrdered[2], li);
      currentList.appendChild(li);
      return;
    }

    // Default Paragraph
    currentList = null;
    const p = el('p');
    parseInlineMarkdown(trimmed, p);
    container.appendChild(p);
  });

  return container;
}

// Sub-parser to process **bold** and `code` tags within lines
function parseInlineMarkdown(text, parentElement) {
  // Regex to match markdown syntax: bold (**), code (`)
  const regex = /(\*\*.*?\*\*|`.*?`|[^\*`]+)/g;
  const matches = text.match(regex);
  
  if (!matches) {
    parentElement.textContent = text;
    return;
  }

  matches.forEach(chunk => {
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      const strong = el('strong', '', chunk.slice(2, -2));
      parentElement.appendChild(strong);
    } else if (chunk.startsWith('`') && chunk.endsWith('`')) {
      const code = el('code', '', chunk.slice(1, -1));
      parentElement.appendChild(code);
    } else {
      const textNode = document.createTextNode(chunk);
      parentElement.appendChild(textNode);
    }
  });
}

// --- Send to API Connectors ---
async function queryAI(userText, mode = 'chat') {
  const model = _selectedModel;
  const apiKey = getApiKey(model);
  const context = getLocalContextString();
  
  const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nHere is SwaGGa's current system state and data to reference:\n${context}`;

  if (!apiKey) {
    return runLocalSimulation(userText, mode);
  }

  try {
    if (model === 'gemini') {
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
      let lastError = null;
      let finalResponse = null;

      for (const modelName of modelsToTry) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userText }] }],
              systemInstruction: { parts: [{ text: fullSystemPrompt }] }
            })
          });
          if (res.ok) {
            finalResponse = res;
            break; // Success!
          } else {
            const body = await res.text();
            let msg = `Gemini API Error ${res.status}`;
            try {
              const json = JSON.parse(body);
              if (json.error && json.error.message) msg = json.error.message;
            } catch (_) {}
            lastError = new Error(`${modelName}: ${msg}`);
          }
        } catch (fetchErr) {
          lastError = new Error(`${modelName}: Network Error - ${fetchErr.message || fetchErr}`);
        }
      }

      if (!finalResponse) {
        // Query ModelService.ListModels to list available models for debug
        let modelsInfo = '';
        try {
          const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          if (listRes.ok) {
            const listData = await listRes.json();
            if (listData && listData.models) {
              const names = listData.models
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', ''))
                .join(', ');
              modelsInfo = `\n\nAvailable models for your API key: ${names}`;
            }
          }
        } catch (_) {}
        throw new Error((lastError ? lastError.message : 'Failed to query Gemini API') + modelsInfo);
      }

      const data = await finalResponse.json();
      return data.candidates[0].content.parts[0].text;
    } else {
      // Claude
      const response = await fetch(CLAUDE_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: fullSystemPrompt,
          messages: [{ role: 'user', content: userText }]
        })
      });
      if (!response.ok) {
        const errBody = await response.text();
        console.error('Claude Error Body:', errBody);
        let parsedErr = `Claude API Error ${response.status}`;
        try {
          const jsonErr = JSON.parse(errBody);
          if (jsonErr.error && jsonErr.error.message) {
            parsedErr = jsonErr.error.message;
          }
        } catch (_) {}
        throw new Error(parsedErr);
      }
      const data = await response.json();
      return data.content[0].text;
    }
  } catch (err) {
    console.error('AI Query Failed:', err);
    return `⚠️ **Error connecting to ${model === 'gemini' ? 'Gemini' : 'Claude'} API: ${err.message || err}**\n\nFallback to Simulation:\n\n${runLocalSimulation(userText, mode)}`;
  }
}

// --- High-Fidelity Local Simulation Engine ---
function runLocalSimulation(text, mode) {
  const trades = getTrades();
  const stats = calculateStats(trades);
  
  if (mode === 'pre') {
    // Extract setup, pair, risk
    const pairMatch = text.match(/Pair:\s*([^\n]+)/i);
    const setupMatch = text.match(/Setup:\s*([^\n]+)/i);
    const riskMatch = text.match(/Risk:\s*([^\n]+)/i);
    
    const pair = pairMatch ? pairMatch[1].trim() : 'Asset';
    const setup = setupMatch ? setupMatch[1].trim() : 'Strategy';
    const risk = riskMatch ? riskMatch[1].trim() : '0.5%';

    return `🌅 **Pre-Session Alignment Audit Complete**
    
    - **POI Checklist:** Acknowledged execution on **${pair}** using **${setup}** layout.
    - **Risk Alert:** Your planned risk parameters (**${risk}**) are within the standard protocol limits.
    - **Strategic Rule:** Remember, since your overall win rate is currently **${stats.winRate}%**, do not chase pullbacks that mitigation zones have already swept. 
    - **Next Step:** Verify the higher timeframe (HTF) displacement candle before taking a limit order. Let's trade cleanly today, SwaGGa!`;
  }
  
  if (mode === 'post') {
    const todayCount = trades.filter(t => {
      const today = new Date().toISOString().slice(0, 10);
      return t.date === today;
    }).length;

    return `🌙 **Post-Session Audit Report**

    - 🔍 **One Pattern:** Logged **${todayCount} trades** today. Watch out for over-trading in the later parts of sessions when liquidity dries up.
    - 💡 **One Lesson:** Keep your focus on displacement blocks rather than standard sweeps. When price sweeps a swing point, let it establish structure first.
    - 🎯 **One Rule for Tomorrow:** Limit yourself to maximum 2 high-probability setups tomorrow. Focus on pullback playbook rules 1 to 3.`;
  }

  // General Chat / Intraday 3-Input
  const lowerText = text.toLowerCase();
  
  if (_activeEmotion === 'fomo' || lowerText.includes('fomo') || lowerText.includes('chasing') || lowerText.includes('missed')) {
    return `📈 **Intervention: FOMO Detected**
    
    You missed the first move on price. Entering here means you are chasing a premium price with double the risk exposure.
    
    - **Pause Charts:** Close the charts for 5 minutes.
    - **Breathe:** Use the **60-Second Reboot** breathing exercise.
    - **Objective Truth:** There will be another pullback. If you chase now, you violate playbook rule #2. Wait for the next displacement zone.`;
  }
  
  if (_activeEmotion === 'revenge' || lowerText.includes('lost') || lowerText.includes('revenge') || lowerText.includes('angry')) {
    return `😤 **Intervention: Revenge Trading Warning**
    
    You are feeling the urge to force a trade to recover a loss. This is standard loss-aversion bias.
    
    - **Nervous System Check:** Your adrenaline is high. 
    - **Action Plan:** Close the trading software completely. Go do the **Box Breathing (4-4-4-4)** exercise under Mindset Sanctuary.
    - **Rule Check:** You are allowed max 2 losses per day. If you reached that, respect the cooldown lockout. Protect your capital, SwaGGa.`;
  }

  if (_activeEmotion === 'hesitation' || lowerText.includes('scared') || lowerText.includes('hesitate') || lowerText.includes('fear')) {
    return `😰 **Intervention: Overcoming Execution Hesitation**
    
    You have analyzed a valid setup, but fear of losing is keeping you from entering.
    
    - **Process Over Result:** Accept that individual trade outcomes are random.
    - **Confluence Check:** Does it fit your **Pullback Playbook** rules? If yes, execute with standard risk.
    - **Grounding Tip:** Trade the plan, not the P&L. Let the system play out.`;
  }

  return `🤖 **SwagAI Advice**
  
  Understood SwaGGa. Based on your current performance stats (Win Rate: **${stats.winRate}%**) and playbook setup, here is your focus checklist:
  
  - Ensure Higher Timeframe bias is clearly marked.
  - Never execute inside consolidations. Wait for the sweeps.
  - Keep your emotional balance steady.
  
  How can I support your next decision?`;
}

// --- Render Page Elements ---
export function renderCoachPage(container) {
  container.replaceChildren();

  // --- Wrapper Container ---
  const coachContainer = el('div', 'coach-container');

  // --- Title and Description ---
  const header = el('div', 'page-header');
  header.style.marginBottom = 'var(--space-4)';
  header.appendChild(el('h1', 'page-title', '🤖 AI Mentor & Coach'));
  
  const subtitle = el('p', '', 'Your customized cognitive psychological assistant. Fed with your strategy notes, playbook rules, and trading journal stats.');
  subtitle.style.fontSize = 'var(--text-xs)';
  subtitle.style.color = 'var(--text-muted)';
  subtitle.style.marginTop = '-4px';
  header.appendChild(subtitle);
  coachContainer.appendChild(header);

  // --- Tab Bar ---
  const tabBar = el('div', 'tab-bar');
  tabBar.style.marginBottom = 'var(--space-5)';

  const tabs = [
    { id: 'chat', label: '💬 Mentor Chat' },
    { id: 'pre', label: '🌅 Pre-Session' },
    { id: 'post', label: '🌙 Post-Session Audit' },
    { id: 'settings', label: '⚙️ AI Settings' }
  ];

  tabs.forEach(t => {
    const btn = el('button', `tab-btn ${t.id === _activeTab ? 'active' : ''}`, t.label);
    btn.addEventListener('click', () => {
      _activeTab = t.id;
      storage.set('coach_active_tab', t.id);
      renderCoachPage(container);
    });
    tabBar.appendChild(btn);
  });
  coachContainer.appendChild(tabBar);

  // --- Layout Grid ---
  const coachLayout = el('div', 'coach-layout');
  const mainCol = el('div', 'coach-main');
  const sideCol = el('div', 'coach-sidebar');
  coachLayout.appendChild(mainCol);
  coachLayout.appendChild(sideCol);
  coachContainer.appendChild(coachLayout);

  container.appendChild(coachContainer);

  // =========================================================================
  // VIEW 1: MENTOR CHAT
  // =========================================================================
  if (_activeTab === 'chat') {
    const consoleCard = el('div', 'chat-console');
    
    // Messages Feed
    const messageFeed = el('div', 'chat-messages');
    _chatHistory.forEach(msg => {
      const bubble = el('div', `message-bubble message-${msg.sender}`);
      const formatNode = formatMarkdownText(msg.text);
      bubble.appendChild(formatNode);
      messageFeed.appendChild(bubble);
    });
    consoleCard.appendChild(messageFeed);

    // Auto-scroll to bottom of feed
    setTimeout(() => { messageFeed.scrollTop = messageFeed.scrollHeight; }, 50);

    // Typing Loader (hidden initially)
    const typingIndicator = el('div', 'typing-indicator');
    typingIndicator.style.display = 'none';
    typingIndicator.appendChild(el('div', 'typing-dot'));
    typingIndicator.appendChild(el('div', 'typing-dot'));
    typingIndicator.appendChild(el('div', 'typing-dot'));
    consoleCard.appendChild(typingIndicator);

    // Input Control Area
    const inputArea = el('div', 'chat-input-area');
    
    // Quick suggest pills
    const pillsRow = el('div', 'preset-pills-row');
    const presets = [
      { text: '🌅 Critique my premarket bias', action: () => handlePillClick('Premarket technical bias critique. Analyze my daily parameters.') },
      { text: '😤 Feeling revengeful after a loss', action: () => { _activeEmotion = 'revenge'; handlePillClick('I just lost a trade and I feel angry. Critique my mindset and guide me.') } },
      { text: '📈 FOMO: price is running without me', action: () => { _activeEmotion = 'fomo'; handlePillClick('Price displacement is aggressive. I feel FOMO and want to enter now.') } },
      { text: '😰 I am hesitating to pull the trigger', action: () => { _activeEmotion = 'hesitation'; handlePillClick('My setup is here but I am scared to execute.') } }
    ];
    presets.forEach(p => {
      const pill = el('button', 'preset-pill', p.text);
      pill.addEventListener('click', () => {
        playSynthSound('click');
        p.action();
      });
      pillsRow.appendChild(pill);
    });
    inputArea.appendChild(pillsRow);

    // Form inputs
    const inputWrapper = el('div', 'chat-input-wrapper');
    const textInput = document.createElement('textarea');
    textInput.className = 'chat-input';
    textInput.placeholder = 'Type to your AI Mentor (e.g. Ask strategy questions)...';
    textInput.rows = 3;
    
    // Enter key triggers submit
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitMessage();
      }
    });

    const sendBtn = el('button', 'btn btn-cyan btn-sm', '🚀 Send');
    sendBtn.style.height = '48px';
    sendBtn.style.padding = '0 var(--space-5)';
    sendBtn.style.borderRadius = '14px';
    sendBtn.style.fontSize = 'var(--text-sm)';
    sendBtn.style.fontWeight = '700';
    sendBtn.style.letterSpacing = '0.02em';
    
    const submitMessage = async () => {
      const userVal = textInput.value.trim();
      if (!userVal) return;
      
      playSynthSound('click');
      nativeHaptic();

      // Add user message
      _chatHistory.push({ sender: 'user', text: userVal });
      textInput.value = '';
      storage.set('coach_chat_history', _chatHistory);
      
      renderCoachPage(container); // Re-render to show message
      
      // Show typing loader
      const liveIndicator = document.querySelector('.typing-indicator');
      if (liveIndicator) {
        liveIndicator.style.display = 'flex';
        const liveFeed = document.querySelector('.chat-messages');
        if (liveFeed) liveFeed.scrollTop = liveFeed.scrollHeight;
      }

      // Query AI
      const aiReply = await queryAI(userVal, 'chat');
      
      // Remove typing loader & Add AI reply
      _chatHistory.push({ sender: 'assistant', text: aiReply });
      storage.set('coach_chat_history', _chatHistory);
      
      // Award minor XP for interactive learning/check-in
      addXP('AI Mentor Chat', 5);
      
      renderCoachPage(container);
    };

    sendBtn.addEventListener('click', submitMessage);

    const handlePillClick = (txt) => {
      textInput.value = txt;
      textInput.focus();
    };

    inputWrapper.appendChild(textInput);
    inputWrapper.appendChild(sendBtn);
    inputArea.appendChild(inputWrapper);
    consoleCard.appendChild(inputArea);
    mainCol.appendChild(consoleCard);

    // SIDEBAR: Knowledge Base Panel
    const kbCard = el('div', 'kb-panel');
    const kbTitle = el('h3', '', '📚 Strategy Knowledge Base');
    kbTitle.style.fontSize = 'var(--text-sm)';
    kbTitle.style.fontWeight = '800';
    kbTitle.style.color = 'var(--cyan)';
    kbCard.appendChild(kbTitle);

    const kbDesc = el('p', '', 'Paste any custom strategy PDF text, study notes, or specific trading book chapters here. The AI Coach will prioritize this material during chats.');
    kbDesc.style.fontSize = '11px';
    kbDesc.style.color = 'var(--text-muted)';
    kbCard.appendChild(kbDesc);

    // Input area for adding new notes one-by-one (it clears on save)
    const newRuleInput = document.createElement('textarea');
    newRuleInput.className = 'kb-textarea';
    newRuleInput.placeholder = 'Paste a new strategy rule or playbook note here...';
    newRuleInput.style.height = '200px';
    kbCard.appendChild(newRuleInput);

    // Save and Clear button
    const addBtn = el('button', 'btn btn-cyan btn-xs', '➕ Add to Knowledge Base');
    addBtn.style.width = '100%';
    addBtn.style.fontSize = '10px';
    addBtn.style.padding = '6px var(--space-2)';
    addBtn.style.borderRadius = 'var(--radius-sm)';
    kbCard.appendChild(addBtn);

    // Collapsible Current KB view/edit details
    const kbDetails = document.createElement('details');
    kbDetails.style.marginTop = 'var(--space-2)';
    kbDetails.style.border = '1px solid rgba(255,255,255,0.06)';
    kbDetails.style.borderRadius = 'var(--radius-md)';
    kbDetails.style.padding = 'var(--space-2)';
    kbDetails.style.background = 'rgba(0,0,0,0.1)';

    const kbSummary = el('summary', '', '📖 View & Edit Full KB');
    kbSummary.style.fontSize = '11px';
    kbSummary.style.fontWeight = '700';
    kbSummary.style.color = 'var(--cyan)';
    kbSummary.style.cursor = 'pointer';
    kbDetails.appendChild(kbSummary);

    const kbDetailsContent = el('div');
    kbDetailsContent.style.marginTop = 'var(--space-2)';
    kbDetailsContent.style.display = 'flex';
    kbDetailsContent.style.flexDirection = 'column';
    kbDetailsContent.style.gap = 'var(--space-2)';

    const fullKbArea = document.createElement('textarea');
    fullKbArea.className = 'kb-textarea';
    fullKbArea.placeholder = 'Your accumulated knowledge base content will appear here...';
    fullKbArea.style.height = '250px';
    fullKbArea.value = getCustomKB();
    kbDetailsContent.appendChild(fullKbArea);

    const charBadge = el('div', '', `Total Chars: ${fullKbArea.value.length}`);
    charBadge.style.fontSize = '10px';
    charBadge.style.color = 'var(--text-muted)';
    charBadge.style.textAlign = 'right';
    kbDetailsContent.appendChild(charBadge);

    // Save full edits
    fullKbArea.addEventListener('input', () => {
      const val = fullKbArea.value;
      localStorage.setItem('swagga:ai_kb', val);
      charBadge.textContent = `Total Chars: ${val.length}`;
    });

    // Clear KB button
    const clearBtn = el('button', 'btn btn-outline-danger btn-xs', '🗑️ Clear Knowledge Base');
    clearBtn.style.width = '100%';
    clearBtn.style.fontSize = '10px';
    clearBtn.style.padding = '4px var(--space-2)';
    clearBtn.style.borderRadius = 'var(--radius-sm)';
    clearBtn.style.borderColor = 'rgba(255, 71, 87, 0.4)';
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear your entire custom AI Knowledge Base? This cannot be undone.')) {
        localStorage.removeItem('swagga:ai_kb');
        fullKbArea.value = '';
        charBadge.textContent = 'Total Chars: 0';
        playSynthSound('click');
        nativeHaptic();
        showNotificationToast('Knowledge Base cleared!');
      }
    });
    kbDetailsContent.appendChild(clearBtn);

    // Load EdgeFlo Blog Rules Button inside details
    const loadBtn = el('button', 'btn btn-cyan btn-xs', '⚡ Load EdgeFlo Blog Rules');
    loadBtn.style.width = '100%';
    loadBtn.style.fontSize = '10px';
    loadBtn.style.padding = '4px var(--space-2)';
    loadBtn.style.borderRadius = 'var(--radius-sm)';
    loadBtn.addEventListener('click', () => {
      if (confirm('Load EdgeFlo Strategy & Psychology rules? This will overwrite the current content.')) {
        fullKbArea.value = EDGEFLO_KB_CONTENT;
        localStorage.setItem('swagga:ai_kb', EDGEFLO_KB_CONTENT);
        charBadge.textContent = `Total Chars: ${EDGEFLO_KB_CONTENT.length}`;
        playSynthSound('click');
        nativeHaptic();
        showNotificationToast('EdgeFlo Rules loaded successfully!');
      }
    });
    kbDetailsContent.appendChild(loadBtn);

    kbDetails.appendChild(kbDetailsContent);
    kbCard.appendChild(kbDetails);

    // Event listener for main "Add" button
    addBtn.addEventListener('click', () => {
      const text = newRuleInput.value.trim();
      if (!text) {
        showNotificationToast('Please paste or write a rule first!');
        return;
      }
      
      let currentKB = getCustomKB();
      if (currentKB) {
        currentKB += `\n\n=== Rule Added: ${new Date().toLocaleDateString()} ===\n` + text;
      } else {
        currentKB = text;
      }
      
      localStorage.setItem('swagga:ai_kb', currentKB);
      newRuleInput.value = ''; // Let it disappear!
      
      charBadge.textContent = `Total Chars: ${currentKB.length}`;
      fullKbArea.value = currentKB;
      
      import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
        if (getCurrentUser()) pushToCloud();
      }).catch(() => {});
      
      playSynthSound('click');
      nativeHaptic();
      showNotificationToast('Rule added to Knowledge Base! 💾');
    });

    sideCol.appendChild(kbCard);
  }

  // =========================================================================
  // VIEW 2: PRE-SESSION ALIGNMENT
  // =========================================================================
  if (_activeTab === 'pre') {
    const card = el('div', 'overview-panel glass-card');
    card.style.padding = 'var(--space-6)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = 'var(--space-4)';

    const cTitle = el('h2', '', '🌅 Pre-Session Strategy Alignment');
    cTitle.style.fontSize = 'var(--text-sm)';
    cTitle.style.fontWeight = '800';
    cTitle.style.color = 'var(--cyan)';
    card.appendChild(cTitle);

    const cDesc = el('p', '', 'Outline today\'s parameters below. The AI Mentor will review confluences against your stats and strategy rules before you enter the market.');
    cDesc.style.fontSize = 'var(--text-xs)';
    cDesc.style.color = 'var(--text-muted)';
    card.appendChild(cDesc);

    // Form fields
    const form = el('div');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = 'var(--space-3)';

    // Pair input
    const pairBox = el('div');
    pairBox.appendChild(el('label', 'form-label', 'Asset / Pair to Trade'));
    const inPair = document.createElement('input');
    inPair.type = 'text';
    inPair.className = 'form-input';
    inPair.placeholder = 'e.g. EURUSD, GBPUSD, BTCUSD';
    inPair.value = storage.get('ai_pre_pair', '');
    pairBox.appendChild(inPair);
    form.appendChild(pairBox);

    // Bias Select
    const biasBox = el('div');
    biasBox.appendChild(el('label', 'form-label', 'Daily Market Bias'));
    const selectBias = document.createElement('select');
    selectBias.className = 'form-input';
    const biases = ['Bullish (Buy Pullbacks)', 'Bearish (Sell Pullbacks)', 'Consolidating / Range Bound'];
    biases.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      selectBias.appendChild(opt);
    });
    selectBias.value = storage.get('ai_pre_bias', biases[0]);
    biasBox.appendChild(selectBias);
    form.appendChild(biasBox);

    // Key technical setup/POI
    const setupBox = el('div');
    setupBox.appendChild(el('label', 'form-label', 'Key Technical Setup / POI'));
    const inSetup = document.createElement('input');
    inSetup.type = 'text';
    inSetup.className = 'form-input';
    inSetup.placeholder = 'e.g. 15m order block sweep, FVG OTE pullback';
    inSetup.value = storage.get('ai_pre_setup', '');
    setupBox.appendChild(inSetup);
    form.appendChild(setupBox);

    // Planned risk
    const riskBox = el('div');
    riskBox.appendChild(el('label', 'form-label', 'Planned Risk Per Trade (%)'));
    const inRisk = document.createElement('input');
    inRisk.type = 'text';
    inRisk.className = 'form-input';
    inRisk.placeholder = 'e.g. 0.5%, 1.0%';
    inRisk.value = storage.get('ai_pre_risk', '0.5%');
    riskBox.appendChild(inRisk);
    form.appendChild(riskBox);

    // Dilemma / Note
    const noteBox = el('div');
    noteBox.appendChild(el('label', 'form-label', 'Any dilemma or psychological warnings?'));
    const textNote = document.createElement('textarea');
    textNote.className = 'form-input';
    textNote.rows = 2;
    textNote.placeholder = 'e.g. Feeling a bit inpatient to start; red folder news in 1 hour...';
    textNote.value = storage.get('ai_pre_note', '');
    noteBox.appendChild(textNote);
    form.appendChild(noteBox);

    // Results container
    const resBox = el('div');
    resBox.style.display = 'none';
    resBox.style.background = 'rgba(0,0,0,0.25)';
    resBox.style.border = '1px solid var(--gray-border)';
    resBox.style.borderRadius = 'var(--radius-md)';
    resBox.style.padding = 'var(--space-4)';
    
    const critBtn = el('button', 'btn btn-cyan', '🔥 Submit Premarket Plan for Critique');
    
    critBtn.addEventListener('click', async () => {
      playSynthSound('click');
      nativeHaptic();
      
      // Save form fields
      storage.set('ai_pre_pair', inPair.value);
      storage.set('ai_pre_bias', selectBias.value);
      storage.set('ai_pre_setup', inSetup.value);
      storage.set('ai_pre_risk', inRisk.value);
      storage.set('ai_pre_note', textNote.value);

      critBtn.textContent = '⏳ Analyzing alignment...';
      critBtn.disabled = true;

      const userText = `
PREMARKET ALIGNMENT CHECK:
Asset/Pair: ${inPair.value}
Daily Bias: ${selectBias.value}
POI/Setup: ${inSetup.value}
Risk: ${inRisk.value}
Additional Note: ${textNote.value}
      `;

      const auditReply = await queryAI(userText, 'pre');
      
      critBtn.textContent = '🔥 Submit Premarket Plan for Critique';
      critBtn.disabled = false;

      // Render results
      resBox.replaceChildren();
      resBox.appendChild(formatMarkdownText(auditReply));
      resBox.style.display = 'block';

      // Push critique to chat history as well
      _chatHistory.push({ sender: 'user', text: `Submitted pre-session check for **${inPair.value}**.` });
      _chatHistory.push({ sender: 'assistant', text: auditReply });
      storage.set('coach_chat_history', _chatHistory);

      addXP('AI Alignment Complete', 25);
      triggerConfetti();
    });

    card.appendChild(form);
    card.appendChild(critBtn);
    card.appendChild(resBox);
    mainCol.appendChild(card);

    // SIDEBAR: Pre-Session requirements
    const reqCard = el('div', 'kb-panel');
    const reqTitle = el('h3', '', '📋 Premium Routine Rules');
    reqTitle.style.fontSize = 'var(--text-sm)';
    reqTitle.style.fontWeight = '800';
    reqTitle.style.color = 'var(--purple)';
    reqCard.appendChild(reqTitle);

    const rules = [
      'HTF direction check is mandatory.',
      'Daily risk must never exceed 2.0% total.',
      'Red Folder news requires closing active trades 10m before.',
      'Always wait for displacement blocks on execution.'
    ];
    rules.forEach(r => {
      const item = el('div', '');
      item.style.fontSize = '11px';
      item.style.color = 'var(--text-secondary)';
      item.style.padding = '4px 0';
      item.textContent = `⚡ ${r}`;
      reqCard.appendChild(item);
    });
    sideCol.appendChild(reqCard);
  }

  // =========================================================================
  // VIEW 3: POST-SESSION AUDIT
  // =========================================================================
  if (_activeTab === 'post') {
    const card = el('div', 'overview-panel glass-card');
    card.style.padding = 'var(--space-6)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = 'var(--space-4)';

    const cTitle = el('h2', '', '🌙 Post-Session Performance Audit');
    cTitle.style.fontSize = 'var(--text-sm)';
    cTitle.style.fontWeight = '800';
    cTitle.style.color = 'var(--cyan)';
    card.appendChild(cTitle);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTrades = getTrades().filter(t => t.date === todayStr);

    const cDesc = el('p', '', `You have logged ${todayTrades.length} trades today (${todayStr}). Let's audit your processes and define tomorrow's rules.`);
    cDesc.style.fontSize = 'var(--text-xs)';
    cDesc.style.color = 'var(--text-muted)';
    card.appendChild(cDesc);

    // Results container
    const auditRes = el('div', 'audit-results-container');
    auditRes.style.display = 'none';

    const auditBtn = el('button', 'btn btn-purple', '🌙 Run Post-Session AI Audit');
    if (todayTrades.length === 0) {
      auditBtn.disabled = true;
      auditBtn.textContent = '❌ No Trades Logged Today to Audit';
      auditBtn.style.opacity = '0.5';
    }

    auditBtn.addEventListener('click', async () => {
      playSynthSound('click');
      nativeHaptic();

      auditBtn.textContent = '⏳ Processing session trades...';
      auditBtn.disabled = true;

      const tradesDetails = todayTrades.map((t, i) => {
        return `Trade #${i+1}: Asset: ${t.pair}, PnL: $${t.pnl}, Setup: ${t.setup}, Mistake: ${t.mistake || 'None'}, Note: ${t.notes || ''}`;
      }).join('\n');

      const userText = `
POST-SESSION AUDIT REQUEST:
Trades Logged Today:
${tradesDetails}
Please review today's session and extract exactly:
1. One Core Pattern
2. One Lesson
3. One Rule for Tomorrow
      `;

      const reply = await queryAI(userText, 'post');
      
      auditBtn.textContent = '🌙 Run Post-Session AI Audit';
      auditBtn.disabled = false;

      // Extract details from AI response
      let pattern = "Observe trading times and volume.";
      let lesson = "Wait for premium zones to mitigate fully.";
      let rule = "Max 2 trades limit per session.";

      // Try basic extraction, fallback to raw reply if structure doesn't match
      const pMatch = reply.match(/(?:Pattern|One Core Pattern|1\.\s)(?::\s*|\s+)?([^\n]+)/i);
      const lMatch = reply.match(/(?:Lesson|One Lesson|2\.\s)(?::\s*|\s+)?([^\n]+)/i);
      const rMatch = reply.match(/(?:Rule|One Rule|3\.\s)(?::\s*|\s+)?([^\n]+)/i);

      if (pMatch) pattern = pMatch[1].trim();
      if (lMatch) lesson = lMatch[1].trim();
      if (rMatch) rule = rMatch[1].trim();

      // Render custom audit result widgets
      auditRes.replaceChildren();
      
      const pItem = el('div', 'audit-item pattern');
      pItem.appendChild(el('div', 'audit-label', '🔍 One Core Pattern'));
      pItem.appendChild(el('div', 'audit-value', pattern));
      
      const lItem = el('div', 'audit-item lesson');
      lItem.appendChild(el('div', 'audit-label', '💡 One Key Lesson'));
      lItem.appendChild(el('div', 'audit-value', lesson));
      
      const rItem = el('div', 'audit-item rule');
      rItem.appendChild(el('div', 'audit-label', '🎯 One Rule for Tomorrow'));
      rItem.appendChild(el('div', 'audit-value', rule));

      const saveRuleBtn = el('button', 'btn btn-cyan btn-sm', '💾 Save Rule as Premarket Ticker');
      saveRuleBtn.style.marginTop = 'var(--space-2)';
      saveRuleBtn.addEventListener('click', () => {
        playSynthSound('click');
        // Save to focus banner ticker
        storage.set('focus_banner_text', `🎯 Tomorrow's Rule: ${rule}`);
        showNotificationToast('Rule saved! It will show at the top of your dashboard tomorrow. 🚀');
        nativeHapticNotification('success');
      });

      auditRes.appendChild(pItem);
      auditRes.appendChild(lItem);
      auditRes.appendChild(rItem);
      auditRes.appendChild(saveRuleBtn);
      auditRes.style.display = 'flex';

      // Push to chat history
      _chatHistory.push({ sender: 'user', text: `Requested post-session audit for ${todayStr}.` });
      _chatHistory.push({ sender: 'assistant', text: reply });
      storage.set('coach_chat_history', _chatHistory);

      addXP('Post-Session AI Audit', 40);
      triggerConfetti();
    });

    card.appendChild(auditBtn);
    card.appendChild(auditRes);
    mainCol.appendChild(card);

    // SIDEBAR: Today's trade overview
    const sumCard = el('div', 'kb-panel');
    const sumTitle = el('h3', '', '📊 Today\'s Summary');
    sumTitle.style.fontSize = 'var(--text-sm)';
    sumTitle.style.fontWeight = '800';
    sumTitle.style.color = 'var(--cyan)';
    sumCard.appendChild(sumTitle);

    const stats = calculateStats(todayTrades);
    const statRows = [
      { l: 'Total Trades', v: todayTrades.length },
      { l: 'Win Rate', v: `${stats.winRate}%` },
      { l: 'Session P&L', v: `$${stats.totalPnL.toFixed(2)}` }
    ];
    statRows.forEach(row => {
      const div = el('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.fontSize = '11px';
      div.style.padding = '4px 0';
      div.appendChild(el('span', '', row.l));
      
      const val = el('span', '', String(row.v));
      val.style.fontWeight = '600';
      if (row.l === 'Session P&L') {
        val.style.color = stats.totalPnL >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
      } else {
        val.style.color = '#fff';
      }
      div.appendChild(val);
      sumCard.appendChild(div);
    });
    sideCol.appendChild(sumCard);
  }

  // =========================================================================
  // VIEW 4: AI SETTINGS
  // =========================================================================
  if (_activeTab === 'settings') {
    const card = el('div', 'overview-panel glass-card');
    card.style.padding = 'var(--space-6)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = 'var(--space-5)';

    const sTitle = el('h2', '', '⚙️ AI Mentor Configurations');
    sTitle.style.fontSize = 'var(--text-sm)';
    sTitle.style.fontWeight = '800';
    sTitle.style.color = 'var(--cyan)';
    card.appendChild(sTitle);

    // Model Selector
    const modelBox = el('div');
    modelBox.appendChild(el('label', 'form-label', 'Active AI Provider'));
    const selModel = document.createElement('select');
    selModel.className = 'form-input';
    const optGemini = document.createElement('option');
    optGemini.value = 'gemini';
    optGemini.textContent = 'Google Gemini 2.0 Flash (Default - Free Tier)';
    const optClaude = document.createElement('option');
    optClaude.value = 'claude';
    optClaude.textContent = 'Anthropic Claude 3.5 Sonnet (Premium Upgrade)';
    selModel.appendChild(optGemini);
    selModel.appendChild(optClaude);
    selModel.value = _selectedModel;
    modelBox.appendChild(selModel);
    card.appendChild(modelBox);

    // API Key inputs
    const keyBox = el('div');
    keyBox.style.display = 'flex';
    keyBox.style.flexDirection = 'column';
    keyBox.style.gap = 'var(--space-3)';

    // Gemini API Key Input
    const gemBox = el('div');
    const gemLabelRow = el('div');
    gemLabelRow.style.display = 'flex';
    gemLabelRow.style.justifyContent = 'space-between';
    gemLabelRow.appendChild(el('label', 'form-label', 'Google Gemini API Key'));
    
    const gemLink = el('a', '', 'Get Free Key');
    gemLink.href = 'https://aistudio.google.com/';
    gemLink.target = '_blank';
    gemLink.style.fontSize = '10px';
    gemLink.style.color = 'var(--cyan)';
    gemLink.style.textDecoration = 'underline';
    gemLabelRow.appendChild(gemLink);
    
    gemBox.appendChild(gemLabelRow);
    const inGemKey = document.createElement('input');
    inGemKey.type = 'password';
    inGemKey.className = 'form-input';
    inGemKey.placeholder = 'Paste your Google Gemini API Key here...';
    inGemKey.value = getApiKey('gemini');
    gemBox.appendChild(inGemKey);
    keyBox.appendChild(gemBox);

    // Claude API Key Input
    const cldBox = el('div');
    const cldLabelRow = el('div');
    cldLabelRow.style.display = 'flex';
    cldLabelRow.style.justifyContent = 'space-between';
    cldLabelRow.appendChild(el('label', 'form-label', 'Anthropic Claude API Key (Optional Upgrade)'));
    
    const cldLink = el('a', '', 'Get Claude Key');
    cldLink.href = 'https://console.anthropic.com/';
    cldLink.target = '_blank';
    cldLink.style.fontSize = '10px';
    cldLink.style.color = 'var(--purple)';
    cldLink.style.textDecoration = 'underline';
    cldLabelRow.appendChild(cldLink);
    
    cldBox.appendChild(cldLabelRow);
    const inCldKey = document.createElement('input');
    inCldKey.type = 'password';
    inCldKey.className = 'form-input';
    inCldKey.placeholder = 'Paste your Anthropic Claude API Key here...';
    inCldKey.value = getApiKey('claude');
    cldBox.appendChild(inCldKey);
    keyBox.appendChild(cldBox);

    card.appendChild(keyBox);

    // Simulated status warning
    const statusBox = el('div', 'welcome-reminder');
    statusBox.style.marginTop = 'var(--space-2)';
    const statusIcon = el('span', 'welcome-reminder-icon', 'ℹ️');
    const statusText = el('span', 'welcome-reminder-text');
    
    const updateStatusText = () => {
      const activeVal = selModel.value;
      const keyVal = activeVal === 'gemini' ? inGemKey.value.trim() : inCldKey.value.trim();
      if (!keyVal) {
        statusText.textContent = `Currently running in FREE Simulated Offline Mode. Enter your ${activeVal === 'gemini' ? 'Gemini' : 'Claude'} key to trigger live intelligence.`;
      } else {
        statusText.textContent = `Connected! App will communicate directly to ${activeVal === 'gemini' ? 'Google AI Studio' : 'Anthropic Console'} on-device.`;
      }
    };
    statusBox.appendChild(statusIcon);
    statusBox.appendChild(statusText);
    card.appendChild(statusBox);

    // Listeners to update status on input
    inGemKey.addEventListener('input', updateStatusText);
    inCldKey.addEventListener('input', updateStatusText);
    selModel.addEventListener('change', updateStatusText);
    updateStatusText();

    // Action Row
    const actionRow = el('div');
    actionRow.style.display = 'flex';
    actionRow.style.gap = 'var(--space-3)';

    const saveBtn = el('button', 'btn btn-cyan', 'Save AI Configurations');
    saveBtn.style.flex = '1';
    saveBtn.addEventListener('click', () => {
      playSynthSound('click');
      nativeHaptic();
      
      _selectedModel = selModel.value;
      storage.set('coach_selected_model', _selectedModel);

      localStorage.setItem('swagga:gemini_api_key', inGemKey.value.trim());
      localStorage.setItem('swagga:claude_api_key', inCldKey.value.trim());

      showNotificationToast('AI Configurations Saved successfully!');
      renderCoachPage(container);
    });

    const resetBtn = el('button', 'btn btn-sm btn-outline-danger', 'Reset Chat History');
    resetBtn.style.borderColor = 'var(--neon-red)';
    resetBtn.style.color = 'var(--neon-red)';
    resetBtn.addEventListener('click', () => {
      playSynthSound('click');
      if (confirm('Are you sure you want to clear your chat history?')) {
        _chatHistory = [INITIAL_GREETING];
        storage.set('coach_chat_history', _chatHistory);
        showNotificationToast('Chat history cleared!');
        renderCoachPage(container);
      }
    });

    actionRow.appendChild(saveBtn);
    actionRow.appendChild(resetBtn);
    card.appendChild(actionRow);

    mainCol.appendChild(card);
  }
}

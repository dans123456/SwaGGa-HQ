import storage from './storage.js';
import { getTrades, calculateStats } from './trading.js';
import { addXP } from './xp.js';
import { triggerConfetti, showNotificationToast, el } from './utils.js';
import { playSynthSound } from './audio.js';
import { nativeHaptic, nativeHapticNotification } from './native-bridge.js';

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
  const customKB = localStorage.getItem('swagga_ai_kb') || 'None provided yet.';

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
  if (provider === 'gemini') {
    return localStorage.getItem('swagga_gemini_api_key') || '';
  } else if (provider === 'claude') {
    return localStorage.getItem('swagga_claude_api_key') || '';
  }
  return '';
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
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }],
          systemInstruction: { parts: [{ text: fullSystemPrompt }] }
        })
      });
      if (!response.ok) {
        const errBody = await response.text();
        console.error('Gemini Error Body:', errBody);
        throw new Error(`Gemini API Error ${response.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await response.json();
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
        throw new Error(`Claude API Error ${response.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await response.json();
      return data.content[0].text;
    }
  } catch (err) {
    console.error('AI Query Failed:', err);
    return `⚠️ **Error connecting to ${model === 'gemini' ? 'Gemini' : 'Claude'} API.**\n\nFallback to Simulation:\n\n${runLocalSimulation(userText, mode)}`;
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
    textInput.rows = 1;
    
    // Enter key triggers submit
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitMessage();
      }
    });

    const sendBtn = el('button', 'btn btn-cyan btn-sm', 'Send');
    sendBtn.style.height = '40px';
    sendBtn.style.padding = '0 var(--space-4)';
    
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

    const kbArea = document.createElement('textarea');
    kbArea.className = 'kb-textarea';
    kbArea.placeholder = 'Paste your strategy rules here (e.g. Pullback displacement rules, reversal studies)...';
    kbArea.value = localStorage.getItem('swagga_ai_kb') || '';
    
    // Character limit badge
    const charBadge = el('div', '', `Chars: ${kbArea.value.length}`);
    charBadge.style.fontSize = '10px';
    charBadge.style.color = 'var(--text-muted)';
    charBadge.style.textAlign = 'right';

    kbArea.addEventListener('input', () => {
      const val = kbArea.value;
      localStorage.setItem('swagga_ai_kb', val);
      charBadge.textContent = `Chars: ${val.length}`;
    });

    kbCard.appendChild(kbArea);
    kbCard.appendChild(charBadge);
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

    const cDesc = el('p', '', `You have logged **${todayTrades.length} trades** today (${todayStr}). Let's audit your processes and define tomorrow's rules.`);
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
    optGemini.textContent = 'Google Gemini 1.5 Flash (Default - Free Tier)';
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

      localStorage.setItem('swagga_gemini_api_key', inGemKey.value.trim());
      localStorage.setItem('swagga_claude_api_key', inCldKey.value.trim());

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

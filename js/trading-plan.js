// SwaGGa HQ — War Room & Confluence Engine Controller
// Handles construction, editing, and real-time execution parameters of your Brad Goh trading plan.

import storage from './storage.js';
import { el, formatCurrency, showNotificationToast } from './utils.js';
import { addXP } from './xp.js';
import { playSynthSound } from './audio.js';

const PLAN_KEY = 'active_trading_plan';

export const DEFAULT_PLAN = {
  version: 1,
  lastUpdated: '',
  focusAssets: ['EURUSD', 'GBPUSD', 'XAUUSD'],
  sessions: ['london', 'newyork'],
  riskPerTrade: 1.0,
  maxDailyLoss: 2.0,
  htfRules: 'Mark H4 BOS/CHOCH and look for Daily order flow alignment.',
  poiRules: 'Wait for 15M Fair Value Gaps (FVG) or Optimal Trade Entry (OTE 62%-79%) inside H1 OB.',
  executionTrigger: 'Wait for 5M CHOCH or inducement sweep confirmation inside session hours.',
  maxTradesPerDay: 3
};

export function getActivePlan() {
  let plan = storage.get(PLAN_KEY, null);
  if (!plan) {
    plan = { ...DEFAULT_PLAN, lastUpdated: new Date().toISOString() };
    storage.set(PLAN_KEY, plan);
  }
  return plan;
}

export function saveActivePlan(plan) {
  plan.lastUpdated = new Date().toISOString();
  storage.set(PLAN_KEY, plan);
}

// Active Confluences for Live Trading Session Checklists
const CONFLUENCES = [
  { id: 'killzone', text: '⏱️ Within Valid Session Killzone (London/NY)' },
  { id: 'htf_bias', text: '🗺️ HTF Bias narrative established & aligned' },
  { id: 'poi_mitigation', text: '🎯 Price mitigated invalidation / POI Zone (OB/FVG/OTE)' },
  { id: 'liquidity_sweep', text: '🧹 Sweep of Session High/Low or retail liquidity pool' },
  { id: 'ltf_choch', text: '⚡ Lower timeframe structure shift (5M CHOCH)' },
  { id: 'inducement', text: '🎣 Inducement sweep confirmed before entry' },
  { id: 'risk_checked', text: '🛡️ Stop Loss set and Position size calculated' }
];

const CONFLUENCE_STATE_KEY = 'war_room_confluence_state';

// Load persisted state or default to false
const savedState = storage.get(CONFLUENCE_STATE_KEY, {});

export let activeConfluenceState = {
  killzone: savedState.killzone || false,
  htf_bias: savedState.htf_bias || false,
  poi_mitigation: savedState.poi_mitigation || false,
  liquidity_sweep: savedState.liquidity_sweep || false,
  ltf_choch: savedState.ltf_choch || false,
  inducement: savedState.inducement || false,
  risk_checked: savedState.risk_checked || false
};

// Help map War Room confluences to Trading Journal confluences options
export const CONFLUENCE_MAP = {
  'killzone': 'ICT Killzones Timing [Ep 12]',
  'htf_bias': 'Top Down Analysis (HTF Bias) [Ep 11]',
  'poi_mitigation': 'Supply/Demand Zone [Ep 7]',
  'liquidity_sweep': 'Liquidity Sweeps / Inducements [Ep 13]',
  'ltf_choch': 'Market Structure (BOS/CHOCH) [Ep 5]'
};

export function resetConfluenceHUDState() {
  Object.keys(activeConfluenceState).forEach(key => {
    activeConfluenceState[key] = false;
  });
  storage.set(CONFLUENCE_STATE_KEY, activeConfluenceState);
}

export function renderTradingPlanPage(container) {
  container.replaceChildren();

  const plan = getActivePlan();

  const root = el('div', 'war-room-container');

  // Hero section
  const hero = el('div', 'war-room-hero');
  hero.appendChild(el('h1', 'war-room-title', '⚔️ The War Room'));
  hero.appendChild(el('p', 'war-room-subtitle', 'Construct your Brad Goh blueprints and check real-time confluences before entry.'));
  root.appendChild(hero);

  // Main columns
  const grid = el('div', 'war-room-grid');

  // Left Column: Active Blueprint display
  const leftCol = el('div', 'blueprint-card');
  leftCol.appendChild(el('h2', 'overview-panel__title', '📋 Active Blueprint'));

  const assetsSec = el('div', 'blueprint-section');
  assetsSec.appendChild(el('span', 'blueprint-section-title', 'Focus Assets & Sessions'));
  assetsSec.appendChild(el('div', 'blueprint-section-content', `Assets: ${plan.focusAssets.join(', ')} | Sessions: ${plan.sessions.map(s => s.toUpperCase()).join(', ')}`));
  leftCol.appendChild(assetsSec);

  const riskSec = el('div', 'blueprint-section');
  riskSec.appendChild(el('span', 'blueprint-section-title', 'Risk Parameters'));
  riskSec.appendChild(el('div', 'blueprint-section-content', `Risk/Trade: ${plan.riskPerTrade}% | Daily Loss Limit: ${plan.maxDailyLoss}% | Max Trades/Day: ${plan.maxTradesPerDay}`));
  leftCol.appendChild(riskSec);

  const htfSec = el('div', 'blueprint-section');
  htfSec.appendChild(el('span', 'blueprint-section-title', 'HTF Bias Rules'));
  htfSec.appendChild(el('div', 'blueprint-section-content', plan.htfRules));
  leftCol.appendChild(htfSec);

  const poiSec = el('div', 'blueprint-section');
  poiSec.appendChild(el('span', 'blueprint-section-title', 'POI Zone Parameters'));
  poiSec.appendChild(el('div', 'blueprint-section-content', plan.poiRules));
  leftCol.appendChild(poiSec);

  const execSec = el('div', 'blueprint-section');
  execSec.appendChild(el('span', 'blueprint-section-title', 'Execution Triggers'));
  execSec.appendChild(el('div', 'blueprint-section-content', plan.executionTrigger));
  leftCol.appendChild(execSec);

  const editBtn = el('button', 'btn btn-secondary btn-block', '🔄 Customize Blueprint');
  editBtn.addEventListener('click', () => {
    playSynthSound('click');
    renderPlanBuilder(container);
  });
  leftCol.appendChild(editBtn);

  grid.appendChild(leftCol);

  // Right Column: Confluence Engine Checklist HUD
  const rightCol = el('div', 'blueprint-card confluence-card');
  
  const confHeader = el('div', 'confluence-header');
  confHeader.appendChild(el('h3', '', '⚡ Confluence Engine'));
  const activeCountEl = el('span', 'badge', '0 / 7 Confluences');
  activeCountEl.style.background = 'rgba(57, 255, 20, 0.15)';
  activeCountEl.style.color = 'var(--neon-green)';
  confHeader.appendChild(activeCountEl);
  rightCol.appendChild(confHeader);

  // Meter progress bar
  const meterTrack = el('div', 'confluence-meter-track');
  const meterFill = el('div', 'confluence-meter-fill');
  meterTrack.appendChild(meterFill);
  rightCol.appendChild(meterTrack);

  const confluenceList = el('div', 'confluence-list');

  const updateHUD = () => {
    let activeCount = 0;
    CONFLUENCES.forEach(c => {
      if (activeConfluenceState[c.id]) activeCount++;
    });
    activeCountEl.textContent = `${activeCount} / 7 Confluences`;
    const pct = Math.round((activeCount / 7) * 100);
    meterFill.style.width = `${pct}%`;

    // Visual indicators updates
    if (activeCount >= 5) {
      meterFill.style.background = 'linear-gradient(90deg, var(--neon-green), var(--cyan))';
      meterFill.style.boxShadow = '0 0 10px rgba(57, 255, 20, 0.6)';
    } else {
      meterFill.style.background = 'var(--cyan)';
      meterFill.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.4)';
    }
  };

  CONFLUENCES.forEach(c => {
    const item = el('div', `confluence-item${activeConfluenceState[c.id] ? ' active' : ''}`);
    const check = el('div', 'confluence-checkbox', activeConfluenceState[c.id] ? '✓' : '');
    const text = el('span', 'confluence-text', c.text);

    item.appendChild(check);
    item.appendChild(text);

    item.addEventListener('click', () => {
      activeConfluenceState[c.id] = !activeConfluenceState[c.id];
      storage.set(CONFLUENCE_STATE_KEY, activeConfluenceState);
      
      if (activeConfluenceState[c.id]) {
        playSynthSound('click');
        item.classList.add('active');
        check.textContent = '✓';
      } else {
        item.classList.remove('active');
        check.textContent = '';
      }
      updateHUD();
    });

    confluenceList.appendChild(item);
  });

  rightCol.appendChild(confluenceList);
  grid.appendChild(rightCol);

  root.appendChild(grid);
  container.appendChild(root);

  updateHUD();
}

function renderPlanBuilder(container) {
  container.replaceChildren();

  const plan = getActivePlan();
  const builder = el('div', 'war-room-container builder-wizard-container');

  // Header
  builder.appendChild(el('h2', 'war-room-title', '⚙️ Plan Blueprint Wizard'));
  builder.appendChild(el('p', 'war-room-subtitle', 'Step-by-step customization based on Brad Goh mechanics.'));

  const form = el('form', 'premarket-form');
  form.addEventListener('submit', (e) => e.preventDefault());

  // Step 1: Assets & Sessions
  const step1 = el('div', 'wizard-step active');
  step1.appendChild(el('h3', 'overview-panel__title', 'Step 1: Focus Markets'));
  
  step1.appendChild(el('label', 'premarket-step-label block', 'Focus Assets (Comma separated)'));
  const assetInput = document.createElement('input');
  assetInput.type = 'text';
  assetInput.className = 'form-input';
  assetInput.value = plan.focusAssets.join(', ');
  step1.appendChild(assetInput);

  step1.appendChild(el('label', 'premarket-step-label block', 'Max Trades Per Day'));
  const maxTradesInput = document.createElement('input');
  maxTradesInput.type = 'number';
  maxTradesInput.className = 'form-input';
  maxTradesInput.value = plan.maxTradesPerDay;
  step1.appendChild(maxTradesInput);
  form.appendChild(step1);

  // Step 2: Rules Narrative
  const step2 = el('div', 'wizard-step active');
  step2.style.display = 'block'; // Simple simplified layout instead of pages
  
  step2.appendChild(el('label', 'premarket-step-label block', 'HTF Structure Bias Logic (D1/H4)'));
  const htfInput = document.createElement('textarea');
  htfInput.className = 'form-input';
  htfInput.style.minHeight = '60px';
  htfInput.value = plan.htfRules;
  step2.appendChild(htfInput);

  step2.appendChild(el('label', 'premarket-step-label block', 'POI / Discount Zone Criteria'));
  const poiInput = document.createElement('textarea');
  poiInput.className = 'form-input';
  poiInput.style.minHeight = '60px';
  poiInput.value = plan.poiRules;
  step2.appendChild(poiInput);

  step2.appendChild(el('label', 'premarket-step-label block', 'LTF Execution Trigger'));
  const execInput = document.createElement('textarea');
  execInput.className = 'form-input';
  execInput.style.minHeight = '60px';
  execInput.value = plan.executionTrigger;
  step2.appendChild(execInput);
  
  // Risk Limits
  step2.appendChild(el('label', 'premarket-step-label block', 'Max Account Risk Per Trade (%)'));
  const riskInput = document.createElement('input');
  riskInput.type = 'number';
  riskInput.step = '0.1';
  riskInput.className = 'form-input';
  riskInput.value = plan.riskPerTrade;
  step2.appendChild(riskInput);

  step2.appendChild(el('label', 'premarket-step-label block', 'Max Daily Drawdown Limit (%)'));
  const lossInput = document.createElement('input');
  lossInput.type = 'number';
  lossInput.step = '0.1';
  lossInput.className = 'form-input';
  lossInput.value = plan.maxDailyLoss;
  step2.appendChild(lossInput);

  form.appendChild(step2);

  // Buttons
  const buttons = el('div', 'wizard-nav');
  const cancelBtn = el('button', 'btn btn-ghost', 'Cancel');
  cancelBtn.addEventListener('click', () => {
    playSynthSound('click');
    renderTradingPlanPage(container);
  });
  buttons.appendChild(cancelBtn);

  const saveBtn = el('button', 'btn btn-primary', '💾 Save Blueprint');
  saveBtn.addEventListener('click', () => {
    const updated = {
      version: plan.version,
      focusAssets: assetInput.value.split(',').map(a => a.trim()).filter(Boolean),
      maxTradesPerDay: parseInt(maxTradesInput.value) || 3,
      htfRules: htfInput.value.trim(),
      poiRules: poiInput.value.trim(),
      executionTrigger: execInput.value.trim(),
      riskPerTrade: parseFloat(riskInput.value) || 1.0,
      maxDailyLoss: parseFloat(lossInput.value) || 2.0,
      sessions: plan.sessions
    };
    saveActivePlan(updated);
    addXP('Saved Custom Trading Plan', 50);
    playSynthSound('success');
    showNotificationToast('Blueprint Saved Successfully! +50 XP 🛡️');
    
    // Sync to cloud
    import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
      if (getCurrentUser()) pushToCloud();
    });

    renderTradingPlanPage(container);
  });
  buttons.appendChild(saveBtn);

  builder.appendChild(form);
  builder.appendChild(buttons);
  container.appendChild(builder);
}

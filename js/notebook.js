/* ========================================================================
   SwaGGa HQ — Trading Session Notebook (Premium Upgrade 5)
   Daily freeform notebook with note templates and homework tracker.
   Uses createElement + textContent for XSS-safe DOM rendering.
   ======================================================================== */

import storage from './storage.js';
import { sanitizeText, showNotificationToast, triggerConfetti } from './utils.js';
import { addXP } from './xp.js';
import { playSynthSound } from './audio.js';

const NOTEBOOK_KEY = 'notebook_entries';

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

// --- Data Layer ---

function getEntries() {
  return storage.get(NOTEBOOK_KEY, {});
}

function saveEntry(dateKey, content, template) {
  const entries = getEntries();
  entries[dateKey] = {
    content: sanitizeText(content, 10000),
    template: template || 'freeform',
    updatedAt: new Date().toISOString(),
  };
  storage.set(NOTEBOOK_KEY, entries);

  import('./firebase-sync.js').then(({ pushToCloud, getCurrentUser }) => {
    if (getCurrentUser()) pushToCloud();
  }).catch(() => {});
}

function getEntry(dateKey) {
  const entries = getEntries();
  return entries[dateKey] || null;
}

// --- Note Templates ---

const TEMPLATES = {
  freeform: {
    label: '📝 Freeform',
    placeholder: 'Write your thoughts, trading reflections, or daily notes here...',
    starter: '',
  },
  post_session: {
    label: '📊 Post-Session',
    placeholder: 'Structured post-session reflection...',
    starter: `SESSION REVIEW
═══════════════

📈 Market Conditions:


🎯 Trades Taken (count):


✅ What went well:


❌ What went wrong:


🧠 Emotional state during session:


📖 Key takeaway:


🎯 Focus for next session:
`,
  },
  lesson_reflection: {
    label: '📚 Lesson Reflection',
    placeholder: 'Reflect on a lesson from The Trading Geek course...',
    starter: `LESSON REFLECTION
═══════════════════

📺 Episode/Topic:


💡 Key concepts learned:


🔗 How this connects to my existing knowledge:


⚡ How I will apply this to my trading:


❓ Questions I still have:
`,
  },
  strategy_notes: {
    label: '🔧 Strategy Notes',
    placeholder: 'Document strategy observations and refinements...',
    starter: `STRATEGY NOTES
════════════════

🏷️ Strategy name / concept:


📐 Entry criteria:


🛑 Exit criteria (TP & SL):


📊 Best performing conditions:


⚠️ When NOT to use this strategy:


📝 Observations and refinements:
`,
  },
  homework: {
    label: '📓 Homework',
    placeholder: 'Complete homework assignments from The Trading Geek course...',
    starter: `HOMEWORK ASSIGNMENT
═════════════════════

📺 Episode reference:


📋 Assignment prompt:


✍️ My response:


📊 Evidence / examples from my trades:


🎯 Action items:
`,
  },
};

// --- Render ---

export function renderNotebookPage(container) {
  container.replaceChildren();

  const header = el('div', 'page-header');
  header.appendChild(el('h1', 'page-title', '📝 Trading Session Notebook'));
  header.appendChild(el('p', 'page-subtitle', 'Daily reflections, homework, and strategy notes. Your personal trading journal.'));
  container.appendChild(header);

  // Main layout
  const layout = el('div', 'notebook-layout');

  // Left: Editor
  const editorCol = el('div', 'notebook-editor-col');

  // Date picker
  const dateRow = el('div', 'notebook-date-row');
  const dateLabel = el('label', 'notebook-date-label', '📅 Entry Date:');
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'form-input notebook-date-input';
  dateInput.value = new Date().toISOString().slice(0, 10);
  dateRow.appendChild(dateLabel);
  dateRow.appendChild(dateInput);

  // Navigation arrows
  const prevBtn = el('button', 'btn btn-ghost btn-sm notebook-nav-btn', '← Prev');
  prevBtn.type = 'button';
  const nextBtn = el('button', 'btn btn-ghost btn-sm notebook-nav-btn', 'Next →');
  nextBtn.type = 'button';
  dateRow.appendChild(prevBtn);
  dateRow.appendChild(nextBtn);

  editorCol.appendChild(dateRow);

  // Template selector
  const templateRow = el('div', 'notebook-template-row');
  templateRow.appendChild(el('span', 'notebook-template-label', 'Template:'));

  let activeTemplate = 'freeform';
  const templateButtons = {};

  Object.entries(TEMPLATES).forEach(([key, tmpl]) => {
    const btn = el('button', `notebook-template-btn${key === activeTemplate ? ' notebook-template-btn--active' : ''}`, tmpl.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      activeTemplate = key;
      Object.values(templateButtons).forEach(b => b.classList.remove('notebook-template-btn--active'));
      btn.classList.add('notebook-template-btn--active');
      playSynthSound('click');

      // Only apply template starter if textarea is empty or matches another template starter
      const currentVal = textarea.value.trim();
      const isTemplateText = Object.values(TEMPLATES).some(t => t.starter.trim() === currentVal);
      if (!currentVal || isTemplateText) {
        textarea.value = tmpl.starter;
        textarea.placeholder = tmpl.placeholder;
      } else {
        textarea.placeholder = tmpl.placeholder;
      }
    });
    templateButtons[key] = btn;
    templateRow.appendChild(btn);
  });

  editorCol.appendChild(templateRow);

  // Editor area
  const editorCard = el('div', 'notebook-editor-card glass-card');

  const statusBar = el('div', 'notebook-status-bar');
  const statusLabel = el('span', 'notebook-status-label', '');
  const charCount = el('span', 'notebook-char-count', '0 chars');
  statusBar.appendChild(statusLabel);
  statusBar.appendChild(charCount);
  editorCard.appendChild(statusBar);

  const textarea = document.createElement('textarea');
  textarea.className = 'form-input notebook-textarea';
  textarea.placeholder = TEMPLATES.freeform.placeholder;
  textarea.rows = 18;
  editorCard.appendChild(textarea);

  // Save button
  const btnRow = el('div', 'notebook-btn-row');
  const saveBtn = el('button', 'btn btn-primary notebook-save-btn', '💾 Save Entry');
  saveBtn.type = 'button';
  btnRow.appendChild(saveBtn);
  editorCard.appendChild(btnRow);

  editorCol.appendChild(editorCard);
  layout.appendChild(editorCol);

  // Right: History sidebar
  const historyCol = el('div', 'notebook-history-col');
  historyCol.appendChild(el('h3', 'notebook-history-title', '📂 Recent Entries'));

  const historyList = el('div', 'notebook-history-list');
  historyCol.appendChild(historyList);
  layout.appendChild(historyCol);

  container.appendChild(layout);

  // --- Event Handlers ---

  function loadEntry(dateKey) {
    const entry = getEntry(dateKey);
    if (entry) {
      textarea.value = entry.content;
      activeTemplate = entry.template || 'freeform';
      Object.entries(templateButtons).forEach(([key, btn]) => {
        if (key === activeTemplate) btn.classList.add('notebook-template-btn--active');
        else btn.classList.remove('notebook-template-btn--active');
      });
      textarea.placeholder = TEMPLATES[activeTemplate] ? TEMPLATES[activeTemplate].placeholder : TEMPLATES.freeform.placeholder;
      statusLabel.textContent = `Last saved: ${new Date(entry.updatedAt).toLocaleTimeString()}`;
      statusLabel.style.color = 'var(--neon-green)';
    } else {
      textarea.value = '';
      activeTemplate = 'freeform';
      Object.entries(templateButtons).forEach(([key, btn]) => {
        if (key === 'freeform') btn.classList.add('notebook-template-btn--active');
        else btn.classList.remove('notebook-template-btn--active');
      });
      textarea.placeholder = TEMPLATES.freeform.placeholder;
      statusLabel.textContent = 'No entry for this date';
      statusLabel.style.color = 'var(--text-muted)';
    }
    charCount.textContent = `${textarea.value.length} chars`;
  }

  dateInput.addEventListener('change', () => {
    loadEntry(dateInput.value);
  });

  prevBtn.addEventListener('click', () => {
    const d = new Date(dateInput.value);
    d.setDate(d.getDate() - 1);
    dateInput.value = d.toISOString().slice(0, 10);
    loadEntry(dateInput.value);
    playSynthSound('click');
  });

  nextBtn.addEventListener('click', () => {
    const d = new Date(dateInput.value);
    d.setDate(d.getDate() + 1);
    dateInput.value = d.toISOString().slice(0, 10);
    loadEntry(dateInput.value);
    playSynthSound('click');
  });

  // Auto-save with debounce
  let debounce = null;
  textarea.addEventListener('input', () => {
    charCount.textContent = `${textarea.value.length} chars`;
    statusLabel.textContent = 'Typing...';
    statusLabel.style.color = 'var(--cyan)';

    clearTimeout(debounce);
    debounce = setTimeout(() => {
      saveEntry(dateInput.value, textarea.value, activeTemplate);
      statusLabel.textContent = 'Auto-saved ✓';
      statusLabel.style.color = 'var(--neon-green)';
      renderHistory();
    }, 2000);
  });

  saveBtn.addEventListener('click', () => {
    if (!textarea.value.trim()) {
      showNotificationToast('Write something first! ✍️');
      return;
    }
    saveEntry(dateInput.value, textarea.value, activeTemplate);
    playSynthSound('success');
    addXP('notebook', 10);
    showNotificationToast('Notebook entry saved! +10 XP 📝');
    statusLabel.textContent = 'Saved ✓';
    statusLabel.style.color = 'var(--neon-green)';
    renderHistory();
  });

  function renderHistory() {
    historyList.replaceChildren();
    const entries = getEntries();
    const sortedDates = Object.keys(entries).sort().reverse().slice(0, 15);

    if (sortedDates.length === 0) {
      historyList.appendChild(el('p', 'notebook-empty-hint', 'No entries yet. Start writing!'));
      return;
    }

    sortedDates.forEach(dateKey => {
      const entry = entries[dateKey];
      const card = el('div', 'notebook-history-card');
      card.addEventListener('click', () => {
        dateInput.value = dateKey;
        loadEntry(dateKey);
        playSynthSound('click');
      });

      const dateEl = el('span', 'notebook-history-date', new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
      card.appendChild(dateEl);

      const tmplLabel = TEMPLATES[entry.template] ? TEMPLATES[entry.template].label : '📝';
      const badge = el('span', 'notebook-history-badge', tmplLabel);
      card.appendChild(badge);

      const preview = el('p', 'notebook-history-preview', entry.content.slice(0, 80) + (entry.content.length > 80 ? '...' : ''));
      card.appendChild(preview);

      historyList.appendChild(card);
    });
  }

  // Initial load
  loadEntry(dateInput.value);
  renderHistory();
}

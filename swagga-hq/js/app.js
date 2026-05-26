/**
 * SwaGGa HQ — Main Application Controller
 *
 * Builds the entire shell DOM (sidebar + page containers) with
 * document.createElement, wires up the router, and kicks off the
 * default page render.
 *
 * SECURITY:
 *  • ALL DOM is constructed via createElement + textContent.
 *  • No innerHTML, outerHTML, document.write, or insertAdjacentHTML.
 *  • No alert(), confirm(), or prompt().
 *  • No sensitive data logged.
 */

import router from './router.js';
import { renderTradingPage } from './trading.js';
import { renderLearningPage } from './learning.js';
import { renderStreaksPage } from './streaks.js';

/* ================================================================== */
/*  DOM HELPER                                                        */
/* ================================================================== */

function el(tag, cls = '', text = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

/* ================================================================== */
/*  NAV DEFINITION                                                    */
/* ================================================================== */

const NAV_ITEMS = [
  { hash: '#dashboard', label: 'Dashboard', icon: '🏠' },
  { hash: '#trading', label: 'Trading', icon: '📊' },
  { hash: '#learning', label: 'Learning', icon: '📚' },
  { hash: '#streaks', label: 'Streaks', icon: '🔥' },
];

/* ================================================================== */
/*  DASHBOARD (simple welcome / summary page)                         */
/* ================================================================== */

function renderDashboard(container) {
  container.replaceChildren();

  const hero = el('div', 'dashboard-hero');
  hero.appendChild(el('h1', 'hero-title', 'Welcome to SwaGGa HQ 🚀'));
  hero.appendChild(
    el(
      'p',
      'hero-subtitle',
      'Your personal command centre for trading, learning, and daily streaks.',
    ),
  );
  container.appendChild(hero);

  // Quick-link cards
  const grid = el('div', 'dashboard-grid');

  const cards = [
    {
      icon: '📊',
      title: 'Trading Journal',
      desc: 'Log trades, track P&L, and analyse your performance.',
      route: '#trading',
    },
    {
      icon: '📚',
      title: 'Learning Hub',
      desc: 'Follow the Brah Goh curriculum and complete assignments.',
      route: '#learning',
    },
    {
      icon: '🔥',
      title: 'Streaks',
      desc: 'Build habits and maintain daily streaks.',
      route: '#streaks',
    },
  ];

  cards.forEach(({ icon, title, desc, route }) => {
    const card = el('div', 'dash-card');
    card.appendChild(el('span', 'dash-card-icon', icon));
    card.appendChild(el('h3', 'dash-card-title', title));
    card.appendChild(el('p', 'dash-card-desc', desc));
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => router.navigate(route));
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

/* ================================================================== */
/*  BUILD APP SHELL                                                   */
/* ================================================================== */

function buildAppShell() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('SwaGGa HQ: #app root element not found');
    return;
  }
  app.replaceChildren();

  // ---- Sidebar ----
  const sidebar = el('div', 'sidebar');
  sidebar.id = 'sidebar';

  // Brand
  const brand = el('div', 'sidebar-brand');
  brand.appendChild(el('span', 'brand-logo', '⚡'));
  brand.appendChild(el('span', 'brand-text', 'SwaGGa HQ'));
  sidebar.appendChild(brand);

  // Nav list
  const nav = el('nav', 'sidebar-nav');
  NAV_ITEMS.forEach(({ hash, label, icon }) => {
    const item = el('button', 'nav-item');
    item.setAttribute('data-route', hash);
    item.setAttribute('aria-label', label);
    item.appendChild(el('span', 'nav-icon', icon));
    item.appendChild(el('span', 'nav-label', label));
    item.addEventListener('click', () => router.navigate(hash));
    nav.appendChild(item);
  });
  sidebar.appendChild(nav);

  // Collapse toggle
  const collapseBtn = el('button', 'sidebar-collapse-btn', '◀');
  collapseBtn.setAttribute('aria-label', 'Toggle sidebar');
  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    collapseBtn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  });
  sidebar.appendChild(collapseBtn);

  app.appendChild(sidebar);

  // ---- Main content area ----
  const main = el('main', 'main-content');
  main.id = 'main-content';

  // Create a page container for each route.
  const pages = ['dashboard', 'trading', 'learning', 'streaks'];
  pages.forEach((page) => {
    const pageEl = el('div', 'page');
    pageEl.id = `page-${page}`;
    main.appendChild(pageEl);
  });

  app.appendChild(main);
}

/* ================================================================== */
/*  INITIALISE                                                        */
/* ================================================================== */

function init() {
  buildAppShell();

  // Register routes.
  router.registerRoute('#dashboard', renderDashboard);
  router.registerRoute('#trading', renderTradingPage);
  router.registerRoute('#learning', renderLearningPage);
  router.registerRoute('#streaks', renderStreaksPage);

  // Start router.
  router.init();
}

// Boot when DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

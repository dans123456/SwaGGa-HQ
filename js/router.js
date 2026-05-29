// hash-based SPA router w/ page transitions

const TRANSITION_MS = 200; // keep in sync w/ CSS

class Router {
  constructor() {

    this._routes = new Map();
    this._currentRoute = '';
    this._defaultRoute = '#dashboard';
    this._initialised = false;
  }

  registerRoute(hash, renderFunction) {
    this._routes.set(hash, { container: null, render: renderFunction, rendered: false });
  }

  navigate(hash) {
    if (!this._routes.has(hash)) {
      hash = this._defaultRoute;
    }
    window.location.hash = hash;
  }

  getCurrentRoute() {
    return this._currentRoute || this._defaultRoute;
  }

  // call after all routes registered and containers in DOM
  init() {
    if (this._initialised) return;
    this._initialised = true;

    for (const [hash, entry] of this._routes) {
      const id = `page-${hash.replace('#', '')}`;
      const el = document.getElementById(id);
      if (el) {
        entry.container = el;
        el.classList.add('page-container');

        el.style.opacity = '0';
        el.style.display = 'none';
      }
    }

    window.addEventListener('hashchange', () => this._onRouteChange());

    const initial = window.location.hash || this._defaultRoute;
    if (window.location.hash !== initial) {
      window.location.hash = initial;
    } else {
      this._onRouteChange();
    }
  }

  // ---- internal ----

  _onRouteChange() {
    let hash = window.location.hash || this._defaultRoute;
    if (!this._routes.has(hash)) {
      hash = this._defaultRoute;
      window.location.hash = hash;
      return; // hashchange will fire again
    }

    this._currentRoute = hash;

    // hide all pages
    for (const [, entry] of this._routes) {
      if (entry.container) {
        entry.container.classList.remove('page-enter');
        entry.container.classList.add('page-exit');

        setTimeout(() => {
          if (entry.container && this._currentRoute !== this._hashFor(entry)) {
            entry.container.style.display = 'none';
            entry.container.classList.remove('page-exit');
          }
        }, TRANSITION_MS);
      }
    }

    // show target
    const target = this._routes.get(hash);
    if (target && target.container) {
      // Render target page container on every navigation to ensure all live stats, confluences, and components update in real-time
      target.render(target.container);
      target.rendered = true;
      target.container.style.display = 'block';
      target.container.classList.remove('page-exit');
      // force reflow
      // eslint-disable-next-line no-unused-expressions
      target.container.offsetHeight;
      target.container.classList.add('page-enter');
      target.container.style.opacity = '1';
    }

    this._updateSidebar(hash);
  }

  _updateSidebar(activeHash) {
    const items = document.querySelectorAll('.nav-item');
    items.forEach((item) => {
      const href = item.getAttribute('data-route');
      if (href === activeHash) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const bottomItems = document.querySelectorAll('.mobile-bottom-nav__item');
    bottomItems.forEach((item) => {
      const href = item.getAttribute('data-bottom-route');
      if (href === activeHash) {
        item.classList.add('mobile-bottom-nav__item--active');
      } else {
        item.classList.remove('mobile-bottom-nav__item--active');
      }
    });
  }

  _hashFor(entry) {
    for (const [hash, e] of this._routes) {
      if (e === entry) return hash;
    }
    return '';
  }
}

const router = new Router();

export default router;
export { Router };

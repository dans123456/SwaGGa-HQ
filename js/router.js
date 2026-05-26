/**
 * SwaGGa HQ — Hash-Based SPA Router
 *
 * Manages page visibility via hash fragments. On route change the router:
 *  1. Hides every page container (fade-out).
 *  2. Shows the matched container (fade-in).
 *  3. Updates the sidebar active class.
 *
 * SECURITY: No user data is injected into the DOM here; route hashes are
 * compared against a pre-registered allow-list.
 */

const TRANSITION_MS = 200; // fade duration — keep in sync with CSS

class Router {
  constructor() {
    /** @type {Map<string, {container: HTMLElement|null, render: Function}>} */
    this._routes = new Map();
    this._currentRoute = '';
    this._defaultRoute = '#dashboard';
    this._initialised = false;
  }

  /* ------------------------------------------------------------------ */
  /*  Registration                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Register a route.
   * @param {string}   hash          - Hash string including '#', e.g. '#trading'.
   * @param {Function} renderFunction - Called once when the page is first shown,
   *                                    receives the page container element.
   */
  registerRoute(hash, renderFunction) {
    this._routes.set(hash, { container: null, render: renderFunction, rendered: false });
  }

  /* ------------------------------------------------------------------ */
  /*  Navigation                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Programmatically navigate to a route.
   * @param {string} hash
   */
  navigate(hash) {
    if (!this._routes.has(hash)) {
      hash = this._defaultRoute;
    }
    window.location.hash = hash;
  }

  /**
   * @returns {string} Current hash (e.g. '#dashboard').
   */
  getCurrentRoute() {
    return this._currentRoute || this._defaultRoute;
  }

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Call after all routes are registered and page containers are in the DOM.
   * Binds the hashchange listener and navigates to the initial route.
   */
  init() {
    if (this._initialised) return;
    this._initialised = true;

    // Resolve container elements for each route.
    for (const [hash, entry] of this._routes) {
      const id = `page-${hash.replace('#', '')}`;
      const el = document.getElementById(id);
      if (el) {
        entry.container = el;
        el.classList.add('page-container');
        // Start hidden.
        el.style.opacity = '0';
        el.style.display = 'none';
      }
    }

    window.addEventListener('hashchange', () => this._onRouteChange());

    // Navigate to initial hash or default.
    const initial = window.location.hash || this._defaultRoute;
    if (window.location.hash !== initial) {
      window.location.hash = initial;
    } else {
      this._onRouteChange();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Internal                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Handle route change: hide all, show target, update sidebar.
   */
  _onRouteChange() {
    let hash = window.location.hash || this._defaultRoute;
    if (!this._routes.has(hash)) {
      hash = this._defaultRoute;
      window.location.hash = hash;
      return; // hashchange will fire again
    }

    this._currentRoute = hash;

    // --- Hide all pages with exit animation ----------------------------
    for (const [, entry] of this._routes) {
      if (entry.container) {
        entry.container.classList.remove('page-enter');
        entry.container.classList.add('page-exit');
        // Delay display:none so the fade plays.
        setTimeout(() => {
          if (entry.container && this._currentRoute !== this._hashFor(entry)) {
            entry.container.style.display = 'none';
            entry.container.classList.remove('page-exit');
          }
        }, TRANSITION_MS);
      }
    }

    // --- Show target page with enter animation -------------------------
    const target = this._routes.get(hash);
    if (target && target.container) {
      // Render once (lazy).
      if (!target.rendered) {
        target.render(target.container);
        target.rendered = true;
      }
      target.container.style.display = 'block';
      target.container.classList.remove('page-exit');
      // Force reflow then animate in.
      // eslint-disable-next-line no-unused-expressions
      target.container.offsetHeight;
      target.container.classList.add('page-enter');
      target.container.style.opacity = '1';
    }

    // --- Update sidebar active state -----------------------------------
    this._updateSidebar(hash);
  }

  /**
   * Toggle 'active' class on sidebar nav items.
   * @param {string} activeHash
   */
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
  }

  /**
   * Find the hash key for a given route entry (reverse lookup).
   * @param {object} entry
   * @returns {string}
   */
  _hashFor(entry) {
    for (const [hash, e] of this._routes) {
      if (e === entry) return hash;
    }
    return '';
  }
}

/** Singleton router instance. */
const router = new Router();

export default router;
export { Router };

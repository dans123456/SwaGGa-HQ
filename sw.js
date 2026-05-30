/*
 * SwaGGa HQ — Service Worker
 * Handles caching for offline support and fast loads.
 * Strategy: Cache-first for static assets, network-first for dynamic.
 */

const CACHE_NAME = 'swagga-hq-v33';

// Core files to cache on install
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/index.css',
  './css/sidebar.css',
  './css/dashboard.css',
  './css/trading.css',
  './css/learning.css',
  './css/streaks.css',
  './js/app.js',
  './js/charts.js',
  './js/learning.js',
  './js/notifications.js',
  './js/router.js',
  './js/storage.js',
  './js/streaks.js',
  './js/trading.js',
  './js/utils.js',
  './js/firebase-sync.js',
  './js/calendar.js',
  './js/audio.js',
  './img/icon-512.png',
  './img/brad-goh.png',
  './img/boss-ackah.png',
];

// Install — cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
  // Activate immediately without waiting for old SW to finish
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch — cache-first for local assets, network-first for external
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // External resources (CDN scripts, Google Fonts, TradingView) — network first, cache fallback
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache a copy for offline
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Local assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached, but also update the cache in the background
        fetch(event.request).then((response) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response);
          });
        }).catch(() => { /* offline, no update */ });
        return cached;
      }
      // Not cached — fetch and cache
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      });
    })
  );
});

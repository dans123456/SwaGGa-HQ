/**
 * SwaGGa HQ — Native Bridge
 * 
 * Thin abstraction layer between the web app and Capacitor native APIs.
 * Safely detects whether we're running inside a native Capacitor shell or
 * a regular browser, and falls back to browser APIs where needed.
 * 
 * Usage in other modules:
 *   import { nativeHaptic, schedulePremarketReminder } from './native-bridge.js';
 */

// ─── Runtime Detection ────────────────────────────────────────────────────────

/**
 * Returns true when running inside the Capacitor Android shell.
 * @returns {boolean}
 */
export function isNative() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

/**
 * Returns true when running on Android specifically.
 * @returns {boolean}
 */
export function isAndroid() {
  return isNative() && window.Capacitor?.getPlatform?.() === 'android';
}

// ─── Haptics ─────────────────────────────────────────────────────────────────

/**
 * Trigger a short impact haptic vibration.
 * Falls back silently on web (no vibration or uses navigator.vibrate if available).
 * @param {'light'|'medium'|'heavy'} style - Impact strength
 */
export async function nativeHaptic(style = 'medium') {
  if (isNative()) {
    try {
      const Haptics = window.Capacitor?.Plugins?.Haptics;
      if (Haptics) {
        const styleMap = {
          light: 'LIGHT',
          medium: 'MEDIUM',
          heavy: 'HEAVY',
        };
        await Haptics.impact({ style: styleMap[style] || 'MEDIUM' });
      }
    } catch (err) {
      console.warn('[NativeBridge] Haptics error:', err);
    }
  } else if (navigator.vibrate) {
    // Web fallback — short buzz
    const durationMap = { light: 30, medium: 60, heavy: 100 };
    navigator.vibrate(durationMap[style] || 60);
  }
}

/**
 * Trigger a notification-style haptic (double tap).
 */
export async function nativeHapticNotification(type = 'SUCCESS') {
  if (isNative()) {
    try {
      const Haptics = window.Capacitor?.Plugins?.Haptics;
      if (Haptics) {
        const typeMap = {
          SUCCESS: 'SUCCESS',
          WARNING: 'WARNING',
          ERROR: 'ERROR',
        };
        await Haptics.notification({ type: typeMap[type] || 'SUCCESS' });
      }
    } catch (err) {
      console.warn('[NativeBridge] Haptics notification error:', err);
    }
  }
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

/**
 * Set status bar style to dark (matches SwaGGa HQ theme).
 * Only runs on Android native.
 */
export async function initStatusBar() {
  if (!isAndroid()) return;
  try {
    const StatusBar = window.Capacitor?.Plugins?.StatusBar;
    if (StatusBar) {
      await StatusBar.setStyle({ style: 'DARK' });
      await StatusBar.setBackgroundColor({ color: '#0d0b0f' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (err) {
    console.warn('[NativeBridge] StatusBar error:', err);
  }
}

// ─── Splash Screen ────────────────────────────────────────────────────────────

/**
 * Hide the splash screen after the app has finished mounting.
 */
export async function hideSplash() {
  if (!isNative()) return;
  try {
    const SplashScreen = window.Capacitor?.Plugins?.SplashScreen;
    if (SplashScreen) {
      await SplashScreen.hide({ fadeOutDuration: 500 });
    }
  } catch (err) {
    console.warn('[NativeBridge] SplashScreen error:', err);
  }
}

// ─── Local Notifications ─────────────────────────────────────────────────────

/**
 * Request notification permission (Android 13+ requires this).
 * @returns {Promise<boolean>} - true if granted
 */
export async function requestNotificationPermission() {
  if (!isNative()) {
    // Web fallback
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return false;
  }
  try {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return false;
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (err) {
    console.warn('[NativeBridge] Notification permission error:', err);
    return false;
  }
}

/**
 * Schedule the daily pre-market routine reminder at 8:30 AM local time.
 * Fires every day. If already scheduled, cancels and re-schedules.
 */
export async function schedulePremarketReminder() {
  if (!isNative()) return;
  try {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return;
    
    // Cancel any existing reminders first
    const pending = await LocalNotifications.getPending();
    const existing = pending.notifications.filter(n => n.id === 1001);
    if (existing.length) {
      await LocalNotifications.cancel({ notifications: existing });
    }
    
    // Schedule at 8:30 AM today (or tomorrow if already past)
    const fireAt = new Date();
    fireAt.setHours(8, 30, 0, 0);
    if (fireAt < new Date()) {
      fireAt.setDate(fireAt.getDate() + 1); // Push to tomorrow if today's 8:30 has passed
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1001,
          title: '⚡ Pre-Market Routine',
          body: 'Time to check the news, mark your bias, and set your levels. Lock in before the session!',
          schedule: {
            at: fireAt,
            repeats: true,
            every: 'day',
          },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#00d4ff',
        },
      ],
    });
    console.log('[NativeBridge] Pre-market reminder scheduled for 08:30 daily');
  } catch (err) {
    console.warn('[NativeBridge] Schedule reminder error:', err);
  }
}

/**
 * Send an immediate local notification (e.g. habit milestone or achievement).
 * @param {string} title
 * @param {string} body
 * @param {number} [id] - Notification ID (default: random)
 */
export async function sendLocalNotification(title, body, id = Math.floor(Math.random() * 9000) + 1000) {
  if (!isNative()) {
    // Web fallback
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: './img/icon-512.png' });
      } catch (err) {
        console.warn('[NativeBridge] new Notification failed, trying ServiceWorker:', err);
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then(registration => {
              registration.showNotification(title, { body, icon: './img/icon-512.png' });
            })
            .catch(swErr => {
              console.error('[NativeBridge] ServiceWorker showNotification failed:', swErr);
            });
        }
      }
    }
    return;
  }
  try {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + 500) }, // Fire in 500ms
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#00d4ff',
        },
      ],
    });
  } catch (err) {
    console.warn('[NativeBridge] Local notification error:', err);
  }
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

/**
 * Hide the software keyboard.
 */
export async function hideKeyboard() {
  if (!isNative()) return;
  try {
    const Keyboard = window.Capacitor?.Plugins?.Keyboard;
    if (Keyboard) {
      await Keyboard.hide();
    }
  } catch (err) {
    console.warn('[NativeBridge] Keyboard hide error:', err);
  }
}

// ─── App Init ─────────────────────────────────────────────────────────────────

/**
 * One-shot initialiser — call this once when the app mounts (in app.js).
 * Handles all native bootstrapping: status bar, splash screen, notifications.
 */
export async function initNative() {
  if (!isNative()) return;

  console.log('[NativeBridge] Initialising native features...');

  // Run all init tasks concurrently
  await Promise.allSettled([
    initStatusBar(),
    hideSplash(),
  ]);

  // Request notification permission then schedule reminder
  const granted = await requestNotificationPermission();
  if (granted) {
    await schedulePremarketReminder();
  }

  console.log('[NativeBridge] Native init complete');
}

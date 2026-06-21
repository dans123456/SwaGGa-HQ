/*
 * Usage in other modules:
 *   import { nativeHaptic, schedulePremarketReminder } from './native-bridge.js';
 */

import storage from './storage.js';

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

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1001,
          title: '⚡ Pre-Market Routine',
          body: 'Time to check the news, mark your bias, and set your levels. Lock in before the session!',
          schedule: {
            repeats: true,
            every: 'day',
            on: {
              hour: 8,
              minute: 30
            }
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
 * Schedule a daily reminder at a custom hour and minute.
 * @param {number} id - Notification ID
 * @param {string} title
 * @param {string} body
 * @param {number} hour - 0-23
 * @param {number} minute - 0-59
 */
export async function scheduleDailyReminder(id, title, body, hour, minute) {
  if (!isNative()) {
    console.log(`[NativeBridge] Web Fallback: Mock scheduling daily reminder ID ${id} at ${hour}:${minute}`);
    return;
  }
  try {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return;

    // Cancel existing reminder with same ID
    const pending = await LocalNotifications.getPending();
    const existing = pending.notifications.filter(n => n.id === id);
    if (existing.length) {
      await LocalNotifications.cancel({ notifications: existing });
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: {
            repeats: true,
            every: 'day',
            on: {
              hour,
              minute
            }
          },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#00d4ff',
        },
      ],
    });
    console.log(`[NativeBridge] Scheduled daily reminder ID ${id} (Every day at ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')})`);
  } catch (err) {
    console.warn('[NativeBridge] scheduleDailyReminder error:', err);
  }
}

/**
 * Cancel a specific scheduled notification by ID.
 * @param {number} id
 */
export async function cancelNotification(id) {
  if (!isNative()) return;
  try {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return;
    await LocalNotifications.cancel({ notifications: [{ id }] });
    console.log(`[NativeBridge] Cancelled notification ID ${id}`);
  } catch (err) {
    console.warn('[NativeBridge] cancelNotification error:', err);
  }
}

/**
 * Schedules Weekly, Monthly, and Quarterly performance reviews notifications.
 */
/**
 * Helper to calculate the next quarter's date.
 * Quarters start on Jan 1 (month 0), Apr 1 (month 3), Jul 1 (month 6), Oct 1 (month 9)
 * @param {number} hour
 * @param {number} minute
 * @returns {Date}
 */
export function getNextQuarterDate(hour = 10, minute = 0) {
  const now = new Date();
  const quarterMonths = [0, 3, 6, 9];
  for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
    for (const qMonth of quarterMonths) {
      const qDate = new Date(y, qMonth, 1, hour, minute, 0, 0);
      if (qDate > now) {
        return qDate;
      }
    }
  }
  return new Date(now.getFullYear(), 0, 1, hour, minute, 0, 0); // fallback
}

/**
 * Schedules Weekly, Monthly, and Quarterly performance reviews notifications.
 */
export async function scheduleReviewReminders() {
  if (!isNative()) {
    console.log('[NativeBridge] Web Fallback: Mock scheduling review reminders');
    return;
  }
  try {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return;

    // 1. Weekly Reminder (ID: 2001)
    const weeklyEnabled = storage.get('review_weekly_reminder_enabled', true);
    if (weeklyEnabled) {
      const timeStr = storage.get('review_weekly_reminder_time', '18:00');
      const [h, m] = timeStr.split(':').map(Number);
      
      const hr = h !== undefined && !isNaN(h) ? h : 18;
      const min = m !== undefined && !isNaN(m) ? m : 0;

      // Cancel existing if scheduled
      const pending = await LocalNotifications.getPending();
      const existing = pending.notifications.filter(n => n.id === 2001);
      if (existing.length) {
        await LocalNotifications.cancel({ notifications: existing });
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 2001,
            title: '🪖 Weekly Performance Review',
            body: 'Stop escaping! Weekly reflection is due now. Open the app, review your leaks, and face the data. No excuses!',
            schedule: {
              repeats: true,
              every: 'week',
              on: {
                weekday: 1, // Sunday (Capacitor Weekday.Sunday is 1)
                hour: hr,
                minute: min,
              }
            },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#00d4ff',
          }
        ]
      });
      console.log(`[NativeBridge] Scheduled Weekly review reminder (Every Sunday at ${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')})`);
    } else {
      await cancelNotification(2001);
    }

    // 2. Monthly Reminder (ID: 2002)
    const monthlyEnabled = storage.get('review_monthly_reminder_enabled', true);
    if (monthlyEnabled) {
      const timeStr = storage.get('review_monthly_reminder_time', '09:00');
      const [h, m] = timeStr.split(':').map(Number);

      const hr = h !== undefined && !isNaN(h) ? h : 9;
      const min = m !== undefined && !isNaN(m) ? m : 0;

      // Cancel existing
      const pending = await LocalNotifications.getPending();
      const existing = pending.notifications.filter(n => n.id === 2002);
      if (existing.length) {
        await LocalNotifications.cancel({ notifications: existing });
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 2002,
            title: '📆 Monthly Trading Audit',
            body: 'A month of trading has passed. Are you actually getting better, or just repeating mistakes? Audit your setups now!',
            schedule: {
              repeats: true,
              every: 'month',
              on: {
                day: 1, // 1st of the month
                hour: hr,
                minute: min,
              }
            },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#00d4ff',
          }
        ]
      });
      console.log(`[NativeBridge] Scheduled Monthly review reminder (1st of the month at ${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')})`);
    } else {
      await cancelNotification(2002);
    }

    // 3. Quarterly Reminder (ID: 2003)
    const quarterlyEnabled = storage.get('review_quarterly_reminder_enabled', true);
    if (quarterlyEnabled) {
      const timeStr = storage.get('review_quarterly_reminder_time', '10:00');
      const [h, m] = timeStr.split(':').map(Number);

      const hr = h !== undefined && !isNaN(h) ? h : 10;
      const min = m !== undefined && !isNaN(m) ? m : 0;

      const fireAt = getNextQuarterDate(hr, min);

      // Cancel existing
      const pending = await LocalNotifications.getPending();
      const existing = pending.notifications.filter(n => n.id === 2003);
      if (existing.length) {
        await LocalNotifications.cancel({ notifications: existing });
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 2003,
            title: '📊 Quarterly Strategy Alignment',
            body: 'Time to audit the macro strategy. Look at your progress, refine your setups, and level up. DO IT NOW!',
            schedule: {
              at: fireAt,
              repeats: false, // scheduled once, will reschedule when app opens next quarter
            },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#00d4ff',
          }
        ]
      });
      console.log(`[NativeBridge] Scheduled Quarterly review reminder for ${fireAt.toString()}`);
    } else {
      await cancelNotification(2003);
    }

  } catch (err) {
    console.warn('[NativeBridge] scheduleReviewReminders error:', err);
  }
}

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
    const premarketEnabled = storage.get('premarket_reminder_enabled', true);
    if (premarketEnabled) {
      const timeStr = storage.get('premarket_reminder_time', '08:30');
      const [h, m] = timeStr.split(':').map(Number);
      await scheduleDailyReminder(
        1001,
        '⚡ Pre-Market Routine',
        'Time to check the news, mark your bias, and set your levels. Lock in before the session!',
        h !== undefined && !isNaN(h) ? h : 8,
        m !== undefined && !isNaN(m) ? m : 30
      );
    }
    const habitEnabled = storage.get('habit_reminder_enabled', false);
    if (habitEnabled) {
      const timeStr = storage.get('habit_reminder_time', '20:00');
      const [h, m] = timeStr.split(':').map(Number);
      await scheduleDailyReminder(
        1002,
        '🔥 Habit Streak Clean-up',
        'Check off your streaks before the day ends! Keep the fire lit!',
        h !== undefined && !isNaN(h) ? h : 20,
        m !== undefined && !isNaN(m) ? m : 0
      );
    }
    // Schedule the review reminders
    await scheduleReviewReminders();
  }

  console.log('[NativeBridge] Native init complete');
}

// firebase cloud sync

import { initializeApp } from './firebase-app.js';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, inMemoryPersistence, signInWithCredential }
  from './firebase-auth.js';
import { isNative } from './native-bridge.js';
import { getFirestore, doc, setDoc, getDoc }
  from './firebase-firestore.js';

import storage from './storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyDkP_yFI1t8runQ06hSdElaHtKskT8Cbzk",
  authDomain: "swagga-hq.firebaseapp.com",
  projectId: "swagga-hq",
  storageBucket: "swagga-hq.firebasestorage.app",
  messagingSenderId: "115096591196",
  appId: "1:115096591196:web:0de44104d04a2c78eabf99"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// handle strict privacy settings (Firefox private mode, etc)
try {
  setPersistence(auth, browserLocalPersistence)
    .catch((err) => {
      console.warn('Local storage persistence unsupported, falling back to in-memory:', err);
      setPersistence(auth, inMemoryPersistence).catch(console.error);
    });
} catch (e) {
  console.warn('Failed to set persistence:', e);
}

// ---- auth ----

let _currentUser = null;
let _authInitialized = false;
const _authListeners = [];

export function getCurrentUser() {
  return _currentUser;
}

export function onAuthChange(callback) {
  _authListeners.push(callback);
  
  // Only call immediately if Firebase has finished its initial auth check
  if (_authInitialized) {
    callback(_currentUser);
  }
}

export async function signInWithGoogle() {
  if (isNative()) {
    try {
      const FirebaseAuthentication = window.Capacitor?.Plugins?.FirebaseAuthentication;
      if (!FirebaseAuthentication) {
        throw new Error('FirebaseAuthentication plugin is not available on window.Capacitor.Plugins.');
      }
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) {
        throw new Error('No Google ID token returned from native sign-in.');
      }
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    } catch (err) {
      console.error('Native Google Sign-In failed:', err);
      if (window.showGlobalError) {
        window.showGlobalError(
          'Native Google Sign-In Failed!',
          'Error details: ' + (err.message || err),
          'Make sure you have an active internet connection and that Google Play Services is enabled on your phone.'
        );
      }
      return null;
    }
  }

  // Strategy: Try popup first with a timeout. If popup fails (COOP block,
  // popup blocker, or timeout), automatically fall back to redirect flow.
  // The redirect result is picked up by getRedirectResult() on page reload.

  try {
    // Race the popup against a timeout — GitHub Pages' COOP headers can cause
    // signInWithPopup to hang forever because window.closed detection is blocked.
    const POPUP_TIMEOUT_MS = 10000;
    const popupPromise = signInWithPopup(auth, provider);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('POPUP_TIMEOUT')), POPUP_TIMEOUT_MS)
    );

    const result = await Promise.race([popupPromise, timeoutPromise]);
    return result.user;
  } catch (err) {
    const code = err?.code || '';
    const message = err?.message || '';
    console.warn('Popup sign-in failed, evaluating fallback:', code, message);

    // Detect errors where redirect fallback will work
    const isPopupBlocked = code === 'auth/popup-blocked';
    const isPopupClosed  = code === 'auth/popup-closed-by-user';
    const isCOOPBlock    = code === 'auth/unauthorized-domain'
                        || message.includes('Cross-Origin-Opener-Policy')
                        || message === 'POPUP_TIMEOUT';
    const isNetworkIssue = code === 'auth/network-request-failed';
    const isCancelledPopup = code === 'auth/cancelled-popup-request';

    // These errors are recoverable via redirect
    if (isPopupBlocked || isCOOPBlock || isPopupClosed || isCancelledPopup) {
      console.log('Falling back to signInWithRedirect...');
      try {
        await signInWithRedirect(auth, provider);
        // signInWithRedirect navigates away, so this return signals the UI
        return { redirecting: true };
      } catch (redirectErr) {
        console.error('Redirect sign-in also failed:', redirectErr);
        // Fall through to show error UI
      }
    }

    // Show user-friendly error for unrecoverable failures
    console.error('Google Sign-In failed:', code, message);
    
    if (window.showGlobalError) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
      let fixMsg = 'Click the <strong>Shield Icon</strong> 🛡️ next to the URL bar and toggle <strong>Enhanced Tracking Protection OFF</strong> for SwaGGa HQ, then refresh and try again!';
      let errorTitle = 'Google Sign-In Blocked by Browser Security!';

      if (isMobile) {
        if (isStandalone) {
          fixMsg = 'Mobile operating systems block cross-domain auth inside installed PWAs when served from third-party domains.<br><br>' +
                   '✨ <strong>Solution:</strong> Open SwaGGa HQ using the official first-party Firebase URL: <br>' +
                   '<a href="https://swagga-hq.firebaseapp.com" style="color: #00d4ff; font-weight: 700; text-decoration: underline;">https://swagga-hq.firebaseapp.com</a> in your phone\'s Safari or Chrome browser. Sign-in will work 100% there, and you can re-install the PWA directly from that domain!';
        } else {
          fixMsg = 'Mobile browsers block cross-domain cookies and storage partition access by default.<br><br>' +
                   '✨ <strong>Solution:</strong> Go to your phone\'s settings for your browser (e.g., Settings > Safari) and toggle <strong>Prevent Cross-Site Tracking OFF</strong>, or sign in using a desktop browser.';
        }
      } else {
        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        if (isFirefox) {
          errorTitle = 'Google Sign-In Blocked by Firefox!';
          fixMsg = 'Firefox\'s Enhanced Tracking Protection blocks cross-origin cookies required by Google Auth.<br><br>' +
                   '🛡️ <strong>To Fix:</strong> Click the <strong>Shield Icon</strong> next to the URL address bar, toggle <strong>Enhanced Tracking Protection OFF</strong> for this site, and refresh!';
        }
      }

      window.showGlobalError(
        errorTitle,
        'Firebase encountered a storage or security shield restriction.<br><strong>Error Code:</strong> ' + (code || 'N/A') + '<br><strong>Details:</strong> ' + message,
        fixMsg
      );
    }
    return null;
  }
}

export async function firebaseSignOut() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign-out failed:', err);
  }
}

onAuthStateChanged(auth, (user) => {
  _currentUser = user || null;
  _authInitialized = true;
  _authListeners.forEach(cb => cb(_currentUser));
});

// handle redirect results (popup-blocked fallback flow)
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      console.log('Redirect sign-in successful:', result.user.email);
    }
  })
  .catch((err) => {
    // Only log non-critical redirect errors — these fire on every page load
    // when no redirect was pending, which is normal behavior.
    const code = err?.code || '';
    const msg = err?.message || '';
    console.warn('Redirect result check:', code, msg);
    
    // Ignore benign errors that fire on normal page loads with no redirect pending
    const benignCodes = [
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/user-cancelled',
    ];
    if (benignCodes.includes(code)) return;
    
    // Defer error check to allow cached auth persistence to resolve first
    setTimeout(() => {
      if (auth.currentUser || _currentUser) {
        console.log('User is already signed in, ignoring background redirect error.');
        return;
      }
      
      // Only show error overlay if the error is truly blocking sign-in
      // and the user has no session. Network errors on fresh loads are not actionable.
      if (code === 'auth/network-request-failed') {
        console.warn('Network error during redirect check — user may be offline.');
        return;
      }

      if (window.showGlobalError) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        let fixMsg = 'Click the <strong>Shield Icon</strong> next to the URL bar and toggle <strong>Enhanced Tracking Protection OFF</strong> for SwaGGa HQ, then refresh and try again!';
        let errorTitle = 'Google Sign-In Blocked by Firefox!';

        if (isMobile) {
          errorTitle = 'Google Sign-In Blocked by Device Security!';
          if (isStandalone) {
            fixMsg = 'Mobile operating systems block cross-domain auth inside installed PWAs when served from third-party domains.<br><br>' +
                     '✨ <strong>Solution:</strong> Open SwaGGa HQ using the official first-party Firebase URL: <br>' +
                     '<a href="https://swagga-hq.firebaseapp.com" style="color: #00d4ff; font-weight: 700; text-decoration: underline;">https://swagga-hq.firebaseapp.com</a> or ' +
                     '<a href="https://swagga-hq.web.app" style="color: #00d4ff; font-weight: 700; text-decoration: underline;">https://swagga-hq.web.app</a> ' +
                     'in Safari or Chrome on your phone. Google Sign-In will work 100% there, and you can re-install the PWA directly from that domain!';
          } else {
            fixMsg = 'Mobile browsers block cross-domain cookies and storage partition access by default.<br><br>' +
                     '✨ <strong>Solution:</strong> Open the app on the official Firebase hosting URL: <br>' +
                     '<a href="https://swagga-hq.firebaseapp.com" style="color: #00d4ff; font-weight: 700; text-decoration: underline;">https://swagga-hq.firebaseapp.com</a> ' +
                     'which runs on the first-party authentication domain, OR go to your phone\'s Settings > Safari and toggle <strong>Prevent Cross-Site Tracking OFF</strong>.';
          }
        } else {
          const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
          if (!isFirefox) {
            errorTitle = 'Google Sign-In Blocked by Browser!';
            fixMsg = 'Your browser is blocking cross-origin storage or cookies. Disable tracking shields, Brave shields, or adblockers for this site, or run the app on the first-party hosting domain: ' +
                     '<a href="https://swagga-hq.firebaseapp.com" style="color: #00d4ff; font-weight: 700; text-decoration: underline;">https://swagga-hq.firebaseapp.com</a>.';
          }
        }

        window.showGlobalError(
          errorTitle,
          'Firebase encountered a storage or security shield restriction.<br><strong>Error Code:</strong> ' + code + '<br><strong>Details:</strong> ' + msg,
          fixMsg
        );
      }
    }, 1500);
  });

// ---- firestore sync ----

const SYNC_KEYS = [
  'trades',
  'lessons',
  'assignments',
  'habits',
  'ba_lessons',
  'ba_progress_ba-1',
  'bg_unlocked_lessons',
  'ba_user_lessons',
  'mentor_avatar_brahGoh',
  'mentor_avatar_bossAckah',
  'streak_freeze_tokens',
  'xp_data',
  'quiz_scores',
  'pomodoro_data',
  'mastered_terms',
  'daily_grades',
  'pomodoro_history',
  'notepad_text',
  'premarket_routine',
  'premarket_history',
  'unlocked_achievements',
  'extra_study_journal',
  'custom_spotify_playlist',
  'mindset_sessions_completed',
  'notebook_entries',
  'reviews',
  'sim_balance',
  'sim_trade_log',
  'gemini_api_key',
  'claude_api_key',
  'ai_kb',
];

const NAMESPACE = 'swagga';
const RAW_STRING_KEYS = ['gemini_api_key', 'claude_api_key', 'ai_kb'];

function readLocalData() {
  const data = {};
  SYNC_KEYS.forEach(key => {
    const fullKey = `${NAMESPACE}:${key}`;
    const raw = localStorage.getItem(fullKey);
    if (raw !== null) {
      if (RAW_STRING_KEYS.includes(key)) {
        // Self-healing migration for double-stringified keys
        let cleaned = raw;
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          try {
            const parsed = JSON.parse(cleaned);
            if (typeof parsed === 'string') {
              cleaned = parsed;
            }
          } catch (e) {
            // ignore
          }
        }
        data[key] = cleaned;
      } else {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }
  });

  // dynamic ba_progress keys
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i);
    if (fullKey && fullKey.startsWith(`${NAMESPACE}:ba_progress_`)) {
      const shortKey = fullKey.slice(NAMESPACE.length + 1);
      try {
        data[shortKey] = JSON.parse(localStorage.getItem(fullKey));
      } catch {
        // skip
      }
    }
  }

  return data;
}

function writeLocalData(cloudData) {
  Object.entries(cloudData).forEach(([key, value]) => {
    const fullKey = `${NAMESPACE}:${key}`;
    if (RAW_STRING_KEYS.includes(key)) {
      localStorage.setItem(fullKey, typeof value === 'string' ? value : JSON.stringify(value));
    } else {
      localStorage.setItem(fullKey, JSON.stringify(value));
    }
  });
}

export async function pushToCloud() {
  if (!_currentUser) return false;
  try {
    const data = readLocalData();
    data._lastSync = new Date().toISOString();
    data._device = navigator.userAgent.slice(0, 100);
    await setDoc(doc(db, 'users', _currentUser.uid), data, { merge: true });
    return true;
  } catch (err) {
    console.error('Push to cloud failed:', err);
    return false;
  }
}

// pull from firestore — "cloud wins" for arrays (merge by id), "latest wins" for scalars
export async function pullFromCloud() {
  if (!_currentUser) return false;
  try {
    const snap = await getDoc(doc(db, 'users', _currentUser.uid));
    if (!snap.exists()) {

      await pushToCloud();
      return true;
    }

    const cloudData = snap.data();
    const localData = readLocalData();

    const merged = {};

    const allKeys = new Set([...Object.keys(cloudData), ...Object.keys(localData)]);
    allKeys.forEach(key => {
      if (key.startsWith('_')) return;

      const cloud = cloudData[key];
      const local = localData[key];

      if (cloud === undefined) {
        merged[key] = local;
      } else if (local === undefined) {
        merged[key] = cloud;
      } else if (Array.isArray(cloud) && Array.isArray(local)) {
        if (key === 'habits') {
          // merge habit logs + freezes by id
          const mergedHabits = [];
          const safeCloud = cloud.filter(h => h && h.id);
          const safeLocal = local.filter(h => h && h.id);
          const allIds = new Set([...safeCloud.map(h => h.id), ...safeLocal.map(h => h.id)]);
          
          allIds.forEach(id => {
            const cloudH = safeCloud.find(h => h.id === id);
            const localH = safeLocal.find(h => h.id === id);
            
            if (!cloudH) {
              mergedHabits.push(localH);
            } else if (!localH) {
              mergedHabits.push(cloudH);
            } else {
              const mergedLog = { ...(cloudH.log || {}), ...(localH.log || {}) };
              const mergedFreezes = { ...(cloudH.freezes || {}), ...(localH.freezes || {}) };
              
              mergedHabits.push({
                ...cloudH,
                ...localH,
                log: mergedLog,
                freezes: mergedFreezes
              });
            }
          });
          merged[key] = mergedHabits;

          merged[key].forEach(h => {
            if (h.id === 'duolingo' && h.baseStreak !== 44) {
              h.baseStreak = 44;
            }
          });
        } else {
          // other arrays: merge by id, local wins for dupes
          const seen = new Map();
          [...local, ...cloud].filter(item => item != null).forEach(item => {
            const itemId = item?.id || JSON.stringify(item);
            if (!seen.has(itemId)) {
              seen.set(itemId, item);
            }
          });
          merged[key] = [...seen.values()];
        }
      } else if (key === 'streak_freeze_tokens') {
        // higher count wins
        merged[key] = Math.max(Number(cloud) || 0, Number(local) || 0);
      } else if (key === 'xp_data') {
        const localXP = local?.totalXP || 0;
        const cloudXP = cloud?.totalXP || 0;
        const mergedTotal = Math.max(localXP, cloudXP);

        const seenHist = new Set();
        const mergedHist = [];
        [...(local?.history || []), ...(cloud?.history || [])].forEach(h => {
          if (h && h.action && h.xp && h.date) {
            const hKey = `${h.action}_${h.xp}_${h.date}`;
            if (!seenHist.has(hKey)) {
              seenHist.add(hKey);
              mergedHist.push(h);
            }
          }
        });
        merged[key] = { totalXP: mergedTotal, history: mergedHist };
      } else if (key === 'pomodoro_data') {
        if (cloud && local && cloud.date === local.date) {
          merged[key] = {
            date: cloud.date,
            completedToday: Math.max(cloud.completedToday || 0, local.completedToday || 0)
          };
        } else {
          // Compare dates
          const cloudDate = cloud?.date ? new Date(cloud.date) : new Date(0);
          const localDate = local?.date ? new Date(local.date) : new Date(0);
          merged[key] = localDate >= cloudDate ? local : cloud;
        }
      } else if (key === 'daily_grades') {
        merged[key] = { ...(cloud || {}), ...(local || {}) };
      } else if (key === 'pomodoro_history') {
        const mergedPomo = {};
        const allDates = new Set([...Object.keys(cloud || {}), ...Object.keys(local || {})]);
        allDates.forEach(d => {
          mergedPomo[d] = Math.max(Number(cloud?.[d]) || 0, Number(local?.[d]) || 0);
        });
        merged[key] = mergedPomo;
      } else if (key === 'notepad_text') {
        // longer string wins
        const localLen = (local || '').length;
        const cloudLen = (cloud || '').length;
        merged[key] = localLen >= cloudLen ? local : cloud;
      } else if (key.startsWith('ba_progress_')) {
        merged[key] = Math.max(Number(cloud) || 0, Number(local) || 0);
      } else if (key === 'premarket_routine') {
        const cloudRoutine = cloud || {};
        const localRoutine = local || {};
        const cloudDate = cloudRoutine.date || '';
        const localDate = localRoutine.date || '';
        
        if (cloudDate > localDate) {
          merged[key] = cloudRoutine;
        } else if (localDate > cloudDate) {
          merged[key] = localRoutine;
        } else {
          // Same date: merge properties, completed/checked wins, longer text wins
          merged[key] = {
            ...cloudRoutine,
            ...localRoutine,
            completed: !!(cloudRoutine.completed || localRoutine.completed),
            newsChecked: !!(cloudRoutine.newsChecked || localRoutine.newsChecked),
            htfBias: localRoutine.htfBias || cloudRoutine.htfBias || '',
            htfLogic: (localRoutine.htfLogic || '').length >= (cloudRoutine.htfLogic || '').length ? (localRoutine.htfLogic || '') : (cloudRoutine.htfLogic || ''),
            keyLevels: (localRoutine.keyLevels || '').length >= (cloudRoutine.keyLevels || '').length ? (localRoutine.keyLevels || '') : (cloudRoutine.keyLevels || ''),
            riskLimit: (localRoutine.riskLimit || '').length >= (cloudRoutine.riskLimit || '').length ? (localRoutine.riskLimit || '') : (cloudRoutine.riskLimit || ''),
            focusRule: localRoutine.focusRule || cloudRoutine.focusRule || '',
            riskChecked: !!(cloudRoutine.riskChecked || localRoutine.riskChecked),
            rulesChecked: !!(cloudRoutine.rulesChecked || localRoutine.rulesChecked)
          };
        }
      } else if (key === 'premarket_history') {
        // Merge routine histories by date key
        const cloudHist = cloud || {};
        const localHist = local || {};
        const mergedHist = { ...cloudHist };
        
        Object.keys(localHist).forEach(date => {
          if (!mergedHist[date]) {
            mergedHist[date] = localHist[date];
          } else {
            // merge individual routine records
            const cR = mergedHist[date];
            const lR = localHist[date];
            mergedHist[date] = {
              ...cR,
              ...lR,
              completed: !!(cR.completed || lR.completed),
              newsChecked: !!(cR.newsChecked || lR.newsChecked),
              htfBias: lR.htfBias || cR.htfBias || '',
              htfLogic: (lR.htfLogic || '').length >= (cR.htfLogic || '').length ? (lR.htfLogic || '') : (cR.htfLogic || ''),
              keyLevels: (lR.keyLevels || '').length >= (cR.keyLevels || '').length ? (lR.keyLevels || '') : (cR.keyLevels || ''),
              riskLimit: (lR.riskLimit || '').length >= (cR.riskLimit || '').length ? (lR.riskLimit || '') : (cR.riskLimit || ''),
              focusRule: lR.focusRule || cR.focusRule || ''
            };
          }
        });
        merged[key] = mergedHist;
      } else if (['bg_unlocked_lessons', 'unlocked_achievements'].includes(key)) {
        // Object deep-merge: combine local and cloud unlocked lessons / achievements
        merged[key] = { ...(cloud || {}), ...(local || {}) };
      } else if (key === 'notebook_entries') {
        // Merge notebook entries by date key; longer content wins for same date
        const mergedNotebook = { ...(cloud || {}) };
        Object.keys(local || {}).forEach(dateKey => {
          if (!mergedNotebook[dateKey]) {
            mergedNotebook[dateKey] = local[dateKey];
          } else {
            const cLen = (mergedNotebook[dateKey].content || '').length;
            const lLen = (local[dateKey].content || '').length;
            if (lLen > cLen) {
              mergedNotebook[dateKey] = local[dateKey];
            }
          }
        });
        merged[key] = mergedNotebook;
      } else if (key === 'reviews') {
        // Merge reviews by periodKey + type; latest updatedAt wins
        const seen = new Map();
        [...(cloud || []), ...(local || [])].forEach(r => {
          if (!r) return;
          const rKey = `${r.periodKey}_${r.type}`;
          const existing = seen.get(rKey);
          if (!existing || (r.updatedAt && (!existing.updatedAt || r.updatedAt > existing.updatedAt))) {
            seen.set(rKey, r);
          }
        });
        merged[key] = [...seen.values()];
      } else if (key === 'sim_balance') {
        // Higher balance wins (player's best performance)
        merged[key] = Math.max(Number(cloud) || 10000, Number(local) || 10000);
      } else if (key === 'sim_trade_log') {
        // Merge sim trades by dedup on entry+exit+direction
        const seenSim = new Map();
        [...(local || []), ...(cloud || [])].filter(t => t != null).forEach(t => {
          const tKey = `${t.entry}_${t.exit}_${t.direction}_${t.scenario}`;
          if (!seenSim.has(tKey)) seenSim.set(tKey, t);
        });
        merged[key] = [...seenSim.values()];
      } else {
        // default: cloud wins
        merged[key] = cloud;
      }
    });

    writeLocalData(merged);

    merged._lastSync = new Date().toISOString();
    await setDoc(doc(db, 'users', _currentUser.uid), merged, { merge: true });

    return true;
  } catch (err) {
    console.error('Pull from cloud failed:', err);
    return false;
  }
}

export async function syncNow() {
  if (!_currentUser) return { success: false, user: null };
  const ok = await pullFromCloud();
  return { success: ok, user: _currentUser };
}

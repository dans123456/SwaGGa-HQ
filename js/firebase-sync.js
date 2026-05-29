/**
 * SwaGGa HQ — Firebase Cloud Sync
 *
 * Handles:
 *  - Firebase initialization
 *  - Google Sign-In authentication
 *  - Firestore read/write for cloud backup
 *  - Merge logic (local ↔ cloud)
 *
 * SECURITY: Only authenticated users can read/write their own data.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

/* ================================================================ */
/*  FIREBASE INIT                                                    */
/* ================================================================ */

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

/* ================================================================ */
/*  AUTH                                                              */
/* ================================================================ */

let _currentUser = null;
const _authListeners = [];

/** Get current signed-in user (or null). */
export function getCurrentUser() {
  return _currentUser;
}

/** Register a callback for auth state changes. */
export function onAuthChange(callback) {
  _authListeners.push(callback);
  // Fire immediately with current state
  callback(_currentUser);
}

/** Sign in with Google popup. */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.warn('Popup sign-in failed, trying redirect fallback...', err.code, err.message);
    
    const isPopupOrStorageError = 
      err.code === 'auth/popup-blocked' ||
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request' ||
      err.code === 'auth/web-storage-unsupported' ||
      err.code === 'auth/operation-not-allowed' ||
      err.code === 'auth/internal-error' ||
      err.message?.toLowerCase().includes('popup') ||
      err.message?.toLowerCase().includes('cookie') ||
      err.message?.toLowerCase().includes('storage') ||
      err.message?.toLowerCase().includes('tracking');

    if (isPopupOrStorageError) {
      console.log('Redirecting to Google instead...');
      try {
        await signInWithRedirect(auth, provider);
        return { redirecting: true };
      } catch (redirectErr) {
        console.error('Redirect sign-in failed:', redirectErr.code, redirectErr.message);
        return null;
      }
    }
    return null;
  }
}

/** Sign out. */
export async function firebaseSignOut() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign-out failed:', err);
  }
}

// Listen for auth state
onAuthStateChanged(auth, (user) => {
  _currentUser = user || null;
  _authListeners.forEach(cb => cb(_currentUser));
});

// Process redirect results if any (e.g. from Firefox popup-blocked redirect fallback)
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      console.log('Redirect sign-in successful:', result.user.email);
    }
  })
  .catch((err) => {
    console.error('Redirect sign-in failed on page load:', err.code, err.message);
  });

/* ================================================================ */
/*  FIRESTORE SYNC                                                    */
/* ================================================================ */

// Keys we sync to the cloud
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
];

const NAMESPACE = 'swagga';

/**
 * Read all synced keys from localStorage.
 * @returns {object} Map of key → value
 */
function readLocalData() {
  const data = {};
  SYNC_KEYS.forEach(key => {
    const fullKey = `${NAMESPACE}:${key}`;
    const raw = localStorage.getItem(fullKey);
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  });

  // Also grab any dynamic ba_progress keys
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

/**
 * Write cloud data into localStorage.
 * @param {object} cloudData - Map of key → value from Firestore
 */
function writeLocalData(cloudData) {
  Object.entries(cloudData).forEach(([key, value]) => {
    const fullKey = `${NAMESPACE}:${key}`;
    localStorage.setItem(fullKey, JSON.stringify(value));
  });
}

/**
 * Push current localStorage data to Firestore.
 */
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

/**
 * Pull data from Firestore into localStorage.
 * Uses "cloud wins" for arrays (merges unique items by id) and "latest wins" for simple values.
 */
export async function pullFromCloud() {
  if (!_currentUser) return false;
  try {
    const snap = await getDoc(doc(db, 'users', _currentUser.uid));
    if (!snap.exists()) {
      // First time — push local data up
      await pushToCloud();
      return true;
    }

    const cloudData = snap.data();
    const localData = readLocalData();

    // Merge strategy: for arrays, merge by id; for objects, cloud wins
    const merged = {};

    const allKeys = new Set([...Object.keys(cloudData), ...Object.keys(localData)]);
    allKeys.forEach(key => {
      if (key.startsWith('_')) return; // skip metadata keys

      const cloud = cloudData[key];
      const local = localData[key];

      if (cloud === undefined) {
        merged[key] = local;
      } else if (local === undefined) {
        merged[key] = cloud;
      } else if (Array.isArray(cloud) && Array.isArray(local)) {
        if (key === 'habits') {
          // Custom merge for habits: merge the logs and freezes of each habit by id
          const mergedHabits = [];
          const allIds = new Set([...cloud.map(h => h.id), ...local.map(h => h.id)]);
          
          allIds.forEach(id => {
            const cloudH = cloud.find(h => h.id === id);
            const localH = local.find(h => h.id === id);
            
            if (!cloudH) {
              mergedHabits.push(localH);
            } else if (!localH) {
              mergedHabits.push(cloudH);
            } else {
              const mergedLog = { ...(cloudH.log || {}), ...(localH.log || {}) };
              const mergedFreezes = { ...(cloudH.freezes || {}), ...(localH.freezes || {}) };
              mergedHabits.push({
                ...cloudH,
                ...localH, // local overrides (custom styling)
                log: mergedLog,
                freezes: mergedFreezes
              });
            }
          });
          merged[key] = mergedHabits;
          // Enforce correct Duolingo base streak after merge
          merged[key].forEach(h => {
            if (h.id === 'duolingo' && h.baseStreak !== 44) {
              h.baseStreak = 44;
            }
          });
        } else {
          // Merge other arrays by id (local wins over cloud for same ID to keep new details)
          const seen = new Map();
          [...local, ...cloud].forEach(item => {
            const itemId = item?.id || JSON.stringify(item);
            if (!seen.has(itemId)) {
              seen.set(itemId, item);
            }
          });
          merged[key] = [...seen.values()];
        }
      } else {
        // For non-arrays, cloud wins (most recent sync)
        merged[key] = cloud;
      }
    });

    writeLocalData(merged);

    // Push merged result back to cloud
    merged._lastSync = new Date().toISOString();
    await setDoc(doc(db, 'users', _currentUser.uid), merged, { merge: true });

    return true;
  } catch (err) {
    console.error('Pull from cloud failed:', err);
    return false;
  }
}

/**
 * Full sync — pull then push.
 * @returns {{ success: boolean, user: object|null }}
 */
export async function syncNow() {
  if (!_currentUser) return { success: false, user: null };
  const ok = await pullFromCloud();
  return { success: ok, user: _currentUser };
}

// firebase cloud sync

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, inMemoryPersistence }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { BRAH_GOH_CURRICULUM } from './learning.js';

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
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error('Google Sign-In failed:', err.code, err.message);
    
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
        'Firebase encountered a storage or security shield restriction.<br><strong>Error Code:</strong> ' + err.code + '<br><strong>Details:</strong> ' + err.message,
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

// handle redirect results (Firefox popup-blocked fallback)
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      console.log('Redirect sign-in successful:', result.user.email);
    }
  })
  .catch((err) => {
    console.error('Redirect sign-in failed on page load:', err.code, err.message);
    
    // Defer error check to allow cached auth persistence to resolve first
    setTimeout(() => {
      if (auth.currentUser || _currentUser) {
        console.log('User is already signed in, ignoring background redirect error.');
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
          'Firebase encountered a storage or security shield restriction.<br><strong>Error Code:</strong> ' + err.code + '<br><strong>Details:</strong> ' + err.message,
          fixMsg
        );
      }
    }, 1000);
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
];

const NAMESPACE = 'swagga';

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
    localStorage.setItem(fullKey, JSON.stringify(value));
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
              
              if (id === 'course33') {
                // Count directly from curriculum: unlocked episodes with real content
                let totalCurriculumItems = 0;
                try {
                  if (BRAH_GOH_CURRICULUM && Array.isArray(BRAH_GOH_CURRICULUM)) {
                    totalCurriculumItems = BRAH_GOH_CURRICULUM.filter(ep => !ep.locked && ep.description && ep.description.trim().length > 0).length;
                  }
                } catch (_) {
                  // Fallback: use default unlocked count
                  totalCurriculumItems = 14;
                }
                
                // Construct the final log based on whether today was completed or not
                const finalLog = {};
                const todayKey = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
                
                const todayCompleted = !!mergedLog[todayKey];
                if (todayCompleted) {
                  finalLog[todayKey] = true;
                }
                
                const expectedPastKeys = totalCurriculumItems - (todayCompleted ? 1 : 0);
                
                // Fill slot keys going backwards from yesterday
                for (let i = 0; i < expectedPastKeys; i++) {
                  const d = new Date();
                  d.setDate(d.getDate() - 1 - i);
                  const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  finalLog[key] = true;
                }
                
                mergedHabits.push({
                  ...cloudH,
                  ...localH,
                  log: finalLog,
                  freezes: mergedFreezes,
                  subTasks: [
                    { key: 'watch', label: 'Watch Lesson 📺', desc: 'Study today\'s price action' },
                    { key: 'journal', label: 'Journal Takeaways 📝', desc: 'Log summary in Learning Hub' }
                  ]
                });
              } else {
                mergedHabits.push({
                  ...cloudH,
                  ...localH,
                  log: mergedLog,
                  freezes: mergedFreezes
                });
              }
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
          [...local, ...cloud].forEach(item => {
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
      } else if (['bg_unlocked_lessons', 'premarket_routine', 'premarket_history'].includes(key)) {
        // Object deep-merge: combine local and cloud unlocked lessons / routines
        merged[key] = { ...(cloud || {}), ...(local || {}) };
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

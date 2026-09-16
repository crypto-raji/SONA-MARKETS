/**
 * watchlistService.js — Firestore-backed watchlist.
 *
 * Stored at: users/{uid}/watchlist/default  →  { symbols: ['AAPL', 'SOL', ...] }
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase.js';
import { getWalletSession } from './authService.js';

function getUserId() {
  const user = auth.currentUser;
  if (user?.uid) return user.uid;
  const session = getWalletSession();
  if (session?.id || session?.uid) return session.id || session.uid;
  return 'sona_default_user';
}

function requireAuth() {
  const uid = getUserId();
  if (!uid) throw new Error('Not signed in.');
  return { uid };
}

const WL_STORAGE_KEY = (uid) => `sona_watchlist_${uid}`;

function readLocalWatchlist(uid) {
  try {
    const raw = localStorage.getItem(WL_STORAGE_KEY(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalWatchlist(uid, symbols) {
  try {
    localStorage.setItem(WL_STORAGE_KEY(uid), JSON.stringify(symbols));
  } catch {}
}

function watchlistRef(uid) {
  return doc(db, 'users', uid, 'watchlist', 'default');
}

async function readSymbols(uid) {
  let list = readLocalWatchlist(uid);

  if (isFirebaseConfigured && auth.currentUser) {
    try {
      const firestoreTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 2000)
      );
      const snap = await Promise.race([getDoc(watchlistRef(uid)), firestoreTimeout]);
      if (snap?.exists()) {
        const remote = snap.data().symbols || [];
        const merged = Array.from(new Set([...list, ...remote]));
        writeLocalWatchlist(uid, merged);
        return merged;
      }
    } catch {}
  }

  return list;
}

async function writeSymbols(uid, symbols) {
  writeLocalWatchlist(uid, symbols);

  if (isFirebaseConfigured && auth.currentUser) {
    setDoc(watchlistRef(uid), { symbols, updatedAt: serverTimestamp() }).catch(() => {});
  }
}

export async function getWatchlist() {
  const user = requireAuth();
  return readSymbols(user.uid);
}

export async function addToWatchlist(symbol) {
  const user    = requireAuth();
  const current = await readSymbols(user.uid);
  if (!current.includes(symbol)) {
    const next = [...current, symbol];
    await writeSymbols(user.uid, next);
    return next;
  }
  return current;
}

export async function removeFromWatchlist(symbol) {
  const user    = requireAuth();
  const current = await readSymbols(user.uid);
  const next = current.filter((s) => s !== symbol);
  await writeSymbols(user.uid, next);
  return next;
}

/**
 * watchlistService.js — Firestore-backed watchlist.
 *
 * Stored at: users/{uid}/watchlist/default  →  { symbols: ['AAPL', 'SOL', ...] }
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase.js';

function requireAuth() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return user;
}

function watchlistRef(uid) {
  return doc(db, 'users', uid, 'watchlist', 'default');
}

async function readSymbols(uid) {
  const snap = await getDoc(watchlistRef(uid));
  return snap.exists() ? (snap.data().symbols || []) : [];
}

async function writeSymbols(uid, symbols) {
  await setDoc(watchlistRef(uid), { symbols, updatedAt: serverTimestamp() });
}

export async function getWatchlist() {
  const user = requireAuth();
  return readSymbols(user.uid);
}

export async function addToWatchlist(symbol) {
  const user    = requireAuth();
  const current = await readSymbols(user.uid);
  if (!current.includes(symbol)) {
    await writeSymbols(user.uid, [...current, symbol]);
  }
  return readSymbols(user.uid);
}

export async function removeFromWatchlist(symbol) {
  const user    = requireAuth();
  const current = await readSymbols(user.uid);
  await writeSymbols(user.uid, current.filter((s) => s !== symbol));
  return readSymbols(user.uid);
}

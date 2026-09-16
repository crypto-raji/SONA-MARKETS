/**
 * authService.js — Firebase Authentication + Firestore user profiles.
 *
 * Sign-in methods:
 *   1. Google OAuth popup (signInWithGoogle)
 *   2. Browser wallet — Phantom / MetaMask / Coinbase / Backpack (signInWithWallet)
 *
 * On first sign-in a BIP-39 HD wallet is generated (see hdWalletService.js),
 * producing one address per chain: Solana, Ethereum, BNB Chain, Bitcoin.
 * All public addresses are stored in Firestore; the mnemonic is encrypted
 * in localStorage.
 */
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, googleProvider, db, isFirebaseConfigured } from './firebase.js';
import { createHDWallet, restoreHDWallet } from './hdWalletService.js';

const WALLET_SESSION_KEY = 'sona_wallet_session';

// ── Firestore helpers ────────────────────────────────────────────────────────

function userRef(uid) {
  return doc(db, 'users', uid);
}

function mapFirebaseUser(firebaseUser, extra = {}) {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || 'User',
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    authMethod: 'google',
    pinIsSet: false,
    // wallet addresses per chain — set on first sign-in
    wallets: { solana: null, ethereum: null, bnb: null, bitcoin: null },
    walletProvider: 'sona',
    ...extra,
  };
}

async function getOrCreateUserDoc(firebaseUser) {
  const ref = userRef(firebaseUser.uid);
  const uid = firebaseUser.uid;

  // ── Step 1: always restore or create wallet from localStorage first ──────
  // This is independent of Firestore so wallets are always available even
  // if Firestore times out (ad blocker, network issue, etc.)
  let wallets = { solana: null, ethereum: null, bnb: null, bitcoin: null };
  try {
    const restored = await restoreHDWallet(uid);
    if (restored?.addresses) {
      wallets = restored.addresses;
      console.log('[Sona] HD wallet restored from localStorage.');
    } else {
      const hd = await createHDWallet(uid);
      wallets = hd.addresses;
      console.log('[Sona] HD wallet created and stored in localStorage.');
    }
  } catch (e) {
    console.error('[Sona] HD wallet generation failed:', e);
  }

  // ── Step 2: try Firestore with a 6s timeout ──────────────────────────────
  const firestoreTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('firestore_timeout')), 6000)
  );

  let snap;
  try {
    snap = await Promise.race([getDoc(ref), firestoreTimeout]);
  } catch (e) {
    if (e.message === 'firestore_timeout') {
      console.warn('[Sona] Firestore timed out — disable your ad blocker for localhost. Using local data.');
      return mapFirebaseUser(firebaseUser, { wallets });
    }
    throw e;
  }

  if (snap.exists()) {
    const data = snap.data();
    // Backfill wallets if existing doc doesn't have them (old accounts)
    if (!data.wallets?.solana && wallets.solana) {
      try { await updateDoc(ref, { wallets }); } catch {}
      return { id: uid, ...data, wallets };
    }
    return { id: uid, ...data };
  }

  // ── Step 3: new user — write to Firestore ────────────────────────────────
  const newUser = mapFirebaseUser(firebaseUser, {
    wallets,
    walletProvider: 'sona',
    createdAt: serverTimestamp(),
  });
  try {
    await Promise.race([setDoc(ref, newUser), firestoreTimeout]);
  } catch {
    console.warn('[Sona] Could not save new user to Firestore — ad blocker may be active.');
  }
  return newUser;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open Google sign-in popup. Creates a Firestore user doc on first sign-in.
 * Returns the app user object.
 */
export async function signInWithGoogle() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration missing. Please add VITE_FIREBASE_API_KEY to your Railway environment variables.');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return getOrCreateUserDoc(result.user);
}

/**
 * Sign in as a demo user for exploring the platform.
 */
export async function signInDemo() {
  const demoUser = {
    id: 'demo_user',
    name: 'Demo Trader',
    email: 'demo@sona.market',
    photoURL: null,
    authMethod: 'demo',
    pinIsSet: true,
    wallets: {
      solana: 'DemoSoL1111111111111111111111111111111111111',
      ethereum: '0x000000000000000000000000000000000000dEaD',
      bnb: '0x000000000000000000000000000000000000dEaD',
      bitcoin: 'bc1qdemo0000000000000000000000000000000000',
    },
    walletProvider: 'sona',
  };
  try {
    localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(demoUser));
  } catch {}
  return demoUser;
}

/**
 * Sign in using a browser wallet (Phantom, MetaMask, Coinbase, Backpack).
 * Creates a Firestore user doc keyed by wallet address if it doesn't exist.
 * Persists a lightweight session in localStorage so the user stays signed in
 * across page reloads without requiring Firebase Auth.
 */
export async function signInWithWallet({ address, provider, chain }) {
  const uid = `wallet:${address}`;

  // Always restore or create Sona HD wallet from localStorage first
  let wallets = { solana: null, ethereum: null, bnb: null, bitcoin: null };
  try {
    const restored = await restoreHDWallet(uid);
    if (restored?.addresses) {
      wallets = restored.addresses;
    } else {
      const hd = await createHDWallet(uid);
      wallets = hd.addresses;
    }
  } catch {}

  // Overlay the connected address on the right chain slot
  if (chain === 'solana')   wallets.solana   = address;
  if (chain === 'ethereum') wallets.ethereum = address;
  if (chain === 'bnb')      wallets.bnb      = address;
  if (chain === 'bitcoin')  wallets.bitcoin  = address;

  const shortAddr = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const user = {
    id:             uid,
    name:           `${provider.charAt(0).toUpperCase() + provider.slice(1)} Wallet`,
    email:          null,
    photoURL:       null,
    authMethod:     'wallet',
    walletProvider: provider,
    wallets,
    connectedChain: chain,
    connectedAddress: address,
    pinIsSet:       false,
  };

  // Persist session so AuthContext can restore it on reload
  try {
    localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(user));
  } catch {}

  // Try to create/merge Firestore doc with timeout
  const firestoreTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('firestore_timeout')), 6000)
  );
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await Promise.race([getDoc(ref), firestoreTimeout]);
    if (!snap.exists()) {
      await Promise.race([setDoc(ref, { ...user, createdAt: serverTimestamp() }), firestoreTimeout]);
    }
  } catch {}

  return user;
}

/**
 * Returns the persisted wallet session from localStorage, or null.
 */
export function getWalletSession() {
  try {
    const raw = localStorage.getItem(WALLET_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears the wallet session from localStorage.
 */
export function clearWalletSession() {
  try { localStorage.removeItem(WALLET_SESSION_KEY); } catch {}
}

/**
 * Link a manually-connected Solana wallet address to the current user's profile.
 */
export async function connectWalletAccount(address, provider) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not signed in.');

  const ref = userRef(currentUser.uid);
  await updateDoc(ref, { walletAddress: address, walletProvider: provider });

  const snap = await getDoc(ref);
  return { id: currentUser.uid, ...snap.data() };
}

/**
 * Sign out the current user (Google or wallet).
 */
export async function signOut() {
  clearWalletSession();
  await firebaseSignOut(auth);
}

/**
 * Returns the current user from Firestore, or null if not signed in.
 */
export async function getCurrentUser() {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;

  const snap = await getDoc(userRef(firebaseUser.uid));
  if (!snap.exists()) return null;
  return { id: firebaseUser.uid, ...snap.data() };
}

/**
 * Subscribe to auth state changes. Calls callback(user) whenever sign-in
 * state changes. Returns an unsubscribe function.
 * Also checks for a persisted wallet session when no Firebase user is present.
 */
export function onAuthStateChanged(callback) {
  if (!isFirebaseConfigured) {
    const walletSession = getWalletSession();
    callback(walletSession || null);
    return () => {};
  }
  return firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      // Check for wallet session before reporting signed-out
      const walletSession = getWalletSession();
      callback(walletSession || null);
      return;
    }
    try {
      const user = await getOrCreateUserDoc(firebaseUser);
      callback(user);
    } catch {
      callback(mapFirebaseUser(firebaseUser));
    }
  });
}

async function hashPin(pin) {
  const encoded = new TextEncoder().encode(`sona-pin:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const PIN_STORAGE_KEY = 'sona_pin_hash';

/**
 * Hash and store the user's transaction PIN.
 * Saves to localStorage immediately (instant), then syncs to Firestore in the background.
 */
export async function createTransactionPin(pin) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4–6 digits.');
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not signed in.');

  const hash = await hashPin(pin);

  // Save locally first — this is instant and never fails
  try { localStorage.setItem(PIN_STORAGE_KEY, hash); } catch {}

  // Sync to Firestore in background — don't block or throw on failure
  setDoc(userRef(currentUser.uid), { pinIsSet: true, pinHash: hash }, { merge: true })
    .catch(() => {});

  return { success: true };
}

/**
 * Verify the entered PIN against the stored hash.
 * Checks localStorage first (fast), falls back to Firestore.
 */
export async function verifyTransactionPin(pin) {
  if (!/^\d{4,6}$/.test(pin)) return { success: false };
  const currentUser = auth.currentUser;
  if (!currentUser) return { success: false };

  const hash = await hashPin(pin);

  // Check localStorage first — instant
  try {
    const local = localStorage.getItem(PIN_STORAGE_KEY);
    if (local) return { success: hash === local };
  } catch {}

  // Fallback to Firestore
  try {
    const snap = await getDoc(userRef(currentUser.uid));
    const stored = snap.data()?.pinHash;
    if (!stored) return { success: false, reason: 'no_pin_set' };
    // Cache it locally for next time
    try { localStorage.setItem(PIN_STORAGE_KEY, stored); } catch {}
    return { success: hash === stored };
  } catch {
    return { success: false };
  }
}

export async function getUserProfile() {
  return getCurrentUser();
}

/**
 * userService.js — User settings management with local persistence & Firestore sync.
 *
 * Stored locally at: sona_settings_{uid}
 * Stored in Firestore at: users/{uid}/settings/default
 */
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase.js';
import { getActiveNetwork } from '../constants/network.js';
import { getWalletSession } from './authService.js';

export const DEFAULT_SETTINGS = {
  notifications: { priceAlerts: true, transactionUpdates: true, marketing: false },
  security:      { biometricUnlock: false, requirePinForSends: true },
  appearance:    { theme: 'system' },
  wallet:        { network: getActiveNetwork() },
};

function getActiveUid() {
  return auth?.currentUser?.uid || getWalletSession()?.id || getWalletSession()?.uid || 'sona_default_user';
}

function settingsRef(uid) {
  return doc(db, 'users', uid, 'settings', 'default');
}

function getLocalSettings(uid) {
  try {
    const raw = localStorage.getItem(`sona_settings_${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalSettings(uid, settings) {
  try {
    localStorage.setItem(`sona_settings_${uid}`, JSON.stringify(settings));
  } catch {}
}

export async function getSettings() {
  const uid = getActiveUid();
  const local = getLocalSettings(uid);
  
  let currentSettings = {
    ...DEFAULT_SETTINGS,
    ...(local || {}),
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(local?.notifications || {}) },
    security:      { ...DEFAULT_SETTINGS.security, ...(local?.security || {}) },
    appearance:    { ...DEFAULT_SETTINGS.appearance, ...(local?.appearance || {}) },
    wallet:        { ...DEFAULT_SETTINGS.wallet, ...(local?.wallet || {}) },
  };

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const snap = await getDoc(settingsRef(auth.currentUser.uid));
      if (snap.exists()) {
        const firestoreData = snap.data();
        currentSettings = {
          ...currentSettings,
          ...firestoreData,
          notifications: { ...currentSettings.notifications, ...(firestoreData.notifications || {}) },
          security:      { ...currentSettings.security, ...(firestoreData.security || {}) },
          appearance:    { ...currentSettings.appearance, ...(firestoreData.appearance || {}) },
          wallet:        { ...currentSettings.wallet, ...(firestoreData.wallet || {}) },
        };
        setLocalSettings(uid, currentSettings);
      }
    } catch (e) {
      console.warn('[Sona] Could not fetch remote settings, using local:', e);
    }
  }

  return currentSettings;
}

export async function updateSettings(partial) {
  const uid = getActiveUid();
  const current = (await getSettings()) || DEFAULT_SETTINGS;
  const updated = {
    ...current,
    ...partial,
    notifications: { ...current.notifications, ...(partial.notifications || {}) },
    security:      { ...current.security, ...(partial.security || {}) },
    appearance:    { ...current.appearance, ...(partial.appearance || {}) },
    wallet:        { ...current.wallet, ...(partial.wallet || {}) },
  };

  // 1. Save locally immediately (instant and 100% reliable)
  setLocalSettings(uid, updated);

  // 2. Sync to Firestore in background if signed in with Firebase
  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      await setDoc(settingsRef(auth.currentUser.uid), { ...partial, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.warn('[Sona] Settings background sync notice:', err);
    }
  }

  return updated;
}

export async function deleteAccount() {
  const uid = getActiveUid();
  try {
    localStorage.removeItem(`sona_settings_${uid}`);
    localStorage.removeItem(`sona_pin_hash_${uid}`);
  } catch {}

  if (auth?.currentUser) {
    try {
      if (db) await deleteDoc(doc(db, 'users', auth.currentUser.uid));
      await auth.currentUser.delete();
    } catch {}
  }
  return { success: true };
}

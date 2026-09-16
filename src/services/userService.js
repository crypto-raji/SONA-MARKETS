/**
 * userService.js — Firestore-backed user settings.
 *
 * Stored at: users/{uid}/settings/default
 */
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { getActiveNetwork } from '../constants/network.js';

function requireAuth() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return user;
}

function tryGetAuth() {
  return auth.currentUser || null;
}

function settingsRef(uid) {
  return doc(db, 'users', uid, 'settings', 'default');
}

export const DEFAULT_SETTINGS = {
  notifications: { priceAlerts: true, transactionUpdates: true, marketing: false },
  security:      { biometricUnlock: false, requirePinForSends: true },
  appearance:    { theme: 'system' },
  wallet:        { network: getActiveNetwork() },
};

export async function getSettings() {
  const user = tryGetAuth();
  if (!user) return DEFAULT_SETTINGS;
  try {
    const snap = await getDoc(settingsRef(user.uid));
    return snap.exists()
      ? { ...DEFAULT_SETTINGS, ...snap.data() }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(partial) {
  const user = tryGetAuth();
  if (!user) return;
  // setDoc with merge:true handles create + update in one round-trip
  await setDoc(settingsRef(user.uid), { ...partial, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteAccount() {
  const user = requireAuth();
  // Delete Firestore user doc — Firestore subcollections must be cleared via
  // a Cloud Function in production. For now this removes the top-level doc.
  await deleteDoc(doc(db, 'users', user.uid));
  await auth.currentUser.delete();
  return { success: true };
}

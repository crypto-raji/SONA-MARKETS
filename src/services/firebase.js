/**
 * firebase.js — single source of truth for Firebase initialization.
 *
 * Setup (one-time):
 * 1. Go to https://console.firebase.google.com and create a project.
 * 2. Add a Web app (</> icon) — copy the firebaseConfig values into .env.
 * 3. In Authentication > Sign-in method, enable "Google".
 * 4. In Firestore Database, create a database (start in test mode for now).
 * 5. Paste all VITE_FIREBASE_* values into your .env file.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingKeys.length > 0) {
  console.error(
    '[Firebase] Missing env vars:', missingKeys,
    '\nCopy your firebaseConfig from console.firebase.google.com into .env'
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Persistent IndexedDB cache: Firestore data is available instantly on return
// visits without a network round-trip — the SDK serves from cache and then
// syncs in the background. Works across multiple browser tabs.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

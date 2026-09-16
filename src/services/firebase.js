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
import { initializeApp, getApps, getApp } from 'firebase/app';
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

const hasValidConfig = Boolean(
  firebaseConfig.apiKey &&
  typeof firebaseConfig.apiKey === 'string' &&
  !firebaseConfig.apiKey.includes('your-firebase') &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes('your-project')
);

export const isFirebaseConfigured = hasValidConfig;

if (!hasValidConfig) {
  console.info('[Firebase] Credentials not detected or incomplete. App is running with resilient offline/demo fallback.');
}

let app;
if (getApps().length > 0) {
  app = getApp();
} else if (hasValidConfig) {
  app = initializeApp(firebaseConfig);
} else {
  // Safe dummy initialization so top-level imports and hooks never throw at module load
  app = initializeApp({
    apiKey: 'AIzaSyDemoFallbackKeyOnly0000000000000',
    authDomain: 'sona-demo.firebaseapp.com',
    projectId: 'sona-demo-app',
    storageBucket: 'sona-demo.appspot.com',
    messagingSenderId: '123456789012',
    appId: '1:123456789012:web:0000000000000000000000',
  });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

let firestoreInstance;
try {
  firestoreInstance = hasValidConfig
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
    : initializeFirestore(app, {});
} catch (e) {
  try {
    firestoreInstance = initializeFirestore(app, {});
  } catch {
    firestoreInstance = null;
  }
}

export const db = firestoreInstance;

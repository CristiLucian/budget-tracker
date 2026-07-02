import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from "firebase/firestore";

// Client config comes from environment variables (.env.local in dev,
// GitHub Actions secrets in CI). Note: this is a *client* config — it is
// public by design once deployed; data security is enforced by
// firestore.rules, never by hiding these values.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  // Offline-first: Firestore keeps a local IndexedDB cache, queues writes
  // while offline and syncs when the connection returns.
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) throw new Error("Firebase nu este configurat");
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) throw new Error("Firebase nu este configurat");
  return dbInstance;
}

export const googleProvider = new GoogleAuthProvider();

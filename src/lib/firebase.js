// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey:     import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId:  import.meta.env.VITE_FB_PROJECT_ID,
  appId:      import.meta.env.VITE_FB_APP_ID,
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
};

// ✅ App: create once, reuse on HMR
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Firestore: initialize with persistence ONCE, reuse on HMR
export const fdb =
  globalThis.__FDB__ ||
  (globalThis.__FDB__ = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  }));

// ✅ Auth: singleton
export const auth =
  globalThis.__AUTH__ || (globalThis.__AUTH__ = getAuth(app));

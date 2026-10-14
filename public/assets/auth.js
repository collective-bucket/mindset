import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const config = window.MindsetConfig;
const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
});
const auth = getAuth(app);
auth.languageCode = document.documentElement.lang || "en";

const listeners = new Set();
let resolveReady;
const ready = new Promise((resolve) => {
  resolveReady = resolve;
});

setPersistence(auth, browserLocalPersistence).catch(() => {});
getRedirectResult(auth).catch(() => {});

onAuthStateChanged(auth, (user) => {
  resolveReady(user);
  listeners.forEach((listener) => listener(user));
});

async function session(forceRefresh) {
  await ready;
  const user = auth.currentUser;
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || "",
    idToken: await user.getIdToken(Boolean(forceRefresh))
  };
}

async function google() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (error && (error.code === "auth/popup-blocked" || error.code === "auth/operation-not-supported-in-this-environment")) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

window.MindsetAuth = {
  ready,
  session,
  currentUser: () => auth.currentUser,
  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  register: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  reset: (email) =>
    sendPasswordResetEmail(auth, email, { url: window.location.origin + "/login" }),
  google,
  signOut: () => signOut(auth),
  deleteAccount: () => deleteUser(auth.currentUser),
  setLanguage(lang) {
    auth.languageCode = lang;
  }
};

window.dispatchEvent(new Event("mindset-auth"));

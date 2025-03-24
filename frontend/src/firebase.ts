import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA45dlM11c4kpYhm5bVwck53Of759H9rSg",
  authDomain: "lazycreator.firebaseapp.com",
  projectId: "lazycreator",
  storageBucket: "lazycreator.firebasestorage.app",
  messagingSenderId: "828832636822",
  appId: "1:828832636822:web:e33a050b533ac72e5247b7",
  measurementId: "G-SG2LGPMY2E",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Analytics only if supported
let analytics = null;
try {
  // Only initialize analytics in production and if supported by the browser
  if (import.meta.env.PROD) {
    isSupported().then((yes) => yes && (analytics = getAnalytics(app)));
  }
} catch (error) {
  console.error("Analytics initialization error:", error);
}

export { auth };

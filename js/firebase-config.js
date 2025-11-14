// LIFTEC Timer - Firebase Configuration

// Firebase Configuration
// WICHTIG: Diese Werte müssen durch echte Firebase-Projekt-Credentials ersetzt werden
// Erstelle ein Firebase-Projekt auf: https://console.firebase.google.com
const firebaseConfig = {
  apiKey: "AIzaSyBnWDuPt2ApeBSr1NDRFxQBSng63u6YqTk",
  authDomain: "liftec-timer.firebaseapp.com",
  projectId: "liftec-timer",
  storageBucket: "liftec-timer.firebasestorage.app",
  messagingSenderId: "249820052612",
  appId: "1:249820052612:web:97218e6487d95b580f96d1"
};

// Firebase Feature Flags
const FIREBASE_FEATURES = {
  auth: true,           // Authentication aktiviert
  firestore: true,      // Firestore Datenbank aktiviert
  offline: true,        // Offline Persistence aktiviert
  anonymousAuth: true,  // Anonymous Login erlauben
};

// Export configuration
window.FIREBASE_CONFIG = firebaseConfig;
window.FIREBASE_FEATURES = FIREBASE_FEATURES;

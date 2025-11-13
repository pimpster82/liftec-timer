// LIFTEC Timer - Firebase Configuration

// Firebase Configuration
// WICHTIG: Diese Werte müssen durch echte Firebase-Projekt-Credentials ersetzt werden
// Erstelle ein Firebase-Projekt auf: https://console.firebase.google.com
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
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

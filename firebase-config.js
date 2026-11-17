// Firebase web config (public by design; access to the family's data is limited by the family code in the link).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBEMfNuMeItHqTCscVDRASWmnV2QVNuJoc",
  authDomain: "home-shopping-b1a4a.firebaseapp.com",
  projectId: "home-shopping-b1a4a",
  storageBucket: "home-shopping-b1a4a.firebasestorage.app",
  messagingSenderId: "467898336974",
  appId: "1:467898336974:web:108f7f7addc943834a729f"
};
// Web push key (Firebase console → Project settings → Cloud Messaging → Web Push certificates).
window.VAPID_KEY = "BNyL0K0aoVaTyDYHqRd3smsTrvI6XfO_g7BrY5dvWj6VrjkaG0-0jQg0lRFazn457SkbusKAKN_cajXKHdCxRJM";
// Sends the "products were added" notification to the family's other phones.
window.NOTIFY_URL = "https://notify-new-items-467898336974.europe-west1.run.app/";

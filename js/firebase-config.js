// ==========================================================================
// Little Magic Board Game Cafe - Firebase Configuration
// ==========================================================================

// TODO: Replace this configuration object with your Firebase app configuration
// You can get this from the Firebase Console:
// 1. Go to Project Settings
// 2. Scroll down to "Your apps"
// 3. Select Web App (</>) and copy the firebaseConfig object
window.firebaseConfig = {
    apiKey: "AIzaSyASfBlUY3uSOL_c2k1rgBOjB9rYmr5fwWg",
    authDomain: "little-magic-3254e.firebaseapp.com",
    projectId: "little-magic-3254e",
    storageBucket: "little-magic-3254e.firebasestorage.app",
    messagingSenderId: "1097937118702",
    appId: "1:1097937118702:web:6a1e0e616ff1afec43daff",
    measurementId: "G-VBQB147104"
};

/**
 * Checks if the user has replaced the placeholder values with actual Firebase credentials.
 * @returns {boolean} True if Firestore can be initialized, false otherwise.
 */
window.isFirebaseConfigured = function() {
    return (
        window.firebaseConfig.apiKey && 
        window.firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" &&
        window.firebaseConfig.projectId && 
        window.firebaseConfig.projectId !== "YOUR_PROJECT_ID_HERE"
    );
};

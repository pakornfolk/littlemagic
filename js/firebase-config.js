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

// EmailJS Configuration
// 1. Sign up on emailjs.com
// 2. Connect a Gmail/Email service -> Get SERVICE_ID
// 3. Create a template -> Get TEMPLATE_ID
// 4. Go to Account -> API Keys -> Get PUBLIC_KEY
window.emailConfig = {
    publicKey: "J-tvuQR43L3ydZYl1",   // Replace with your Public Key
    serviceId: "service_88p1ugq",   // Replace with your Service ID
    templateId: "template_f0viwvj"  // Replace with your Template ID
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

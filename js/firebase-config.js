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
    templateId: "template_y11pf7a",  // Replace with your Template ID
    
    // ตั้งค่าโหมดทดสอบ (Test Mode)
    // - ระบบจะเช็คอัตโนมัติ: ถ้าเปิดในเครื่องคอม (localhost, 127.0.0.1 หรือเปิดจากไฟล์โดยตรง) จะเป็นโหมดทดสอบ (ดักจับอีเมล)
    //   แต่ถ้าอัปขึ้น Git/โฮสติ้งจริงแล้ว จะปิดโหมดทดสอบและส่งอีเมลจริงออกไปโดยอัตโนมัติ (Auto-Connect)
    testMode: window.location.hostname === "localhost" || 
              window.location.hostname === "127.0.0.1" || 
              window.location.protocol === "file:"
};

// ดักจับการทำงานของ EmailJS เมื่อเปิด Test Mode
(function() {
    if (window.emailConfig && window.emailConfig.testMode) {
        // หาก EmailJS SDK ไม่โหลด (เช่น ทำงานแบบออฟไลน์) ให้สร้าง mock object ขึ้นมาแทนที่
        if (typeof window.emailjs === 'undefined') {
            window.emailjs = {
                init: function(options) {
                    console.log("%c[EmailJS Mock] Initialized with config:", "color: #ff9800; font-weight: bold;", options);
                },
                send: function(serviceId, templateId, templateParams) {
                    return new Promise((resolve) => {
                        console.log("%c[EmailJS Intercepted (Offline Mock)]", "color: #ff9800; font-weight: bold; font-size: 13px;", {
                            serviceId,
                            templateId,
                            templateParams
                        });
                        
                        const msg = `[Test Mode] Intercepted email to ${templateParams.to_email || 'unknown'} (Status: ${templateParams.status_text || 'none'})`;
                        if (window.showToast) {
                            window.showToast(msg, "info");
                        }
                        
                        resolve({ status: 200, text: "OK" });
                    });
                }
            };
        } else {
            // หาก EmailJS SDK โหลดมาแล้ว ให้ override ฟังก์ชัน send เพื่อดักไม่ให้ส่งจริง
            const originalSend = window.emailjs.send;
            window.emailjs.send = function(serviceId, templateId, templateParams) {
                return new Promise((resolve) => {
                    console.log("%c[EmailJS Intercepted]", "color: #ff9800; font-weight: bold; font-size: 13px;", {
                        serviceId,
                        templateId,
                        templateParams
                    });
                    
                    const msg = `[Test Mode] Intercepted email to ${templateParams.to_email || 'unknown'} (Status: ${templateParams.status_text || 'none'})`;
                    if (window.showToast) {
                        window.showToast(msg, "info");
                    }
                    
                    resolve({ status: 200, text: "OK (Intercepted)" });
                });
            };
        }
    }
})();

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

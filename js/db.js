// ==========================================================================
// Little Magic Board Game Cafe - Unified Database Adapter (CORS-free Compatibility Mode)
// ==========================================================================

(function() {
    let dbMode = 'local';
    let db = null;

    // Check if configuration exists and is active
    if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
        try {
            // firebase is loaded globally via compat scripts in HTML
            if (typeof firebase !== 'undefined') {
                const app = firebase.initializeApp(window.firebaseConfig);
                db = firebase.firestore();
                dbMode = 'firebase';
                console.log("Little Magic DB: Configured with Firebase Firestore.");
            } else {
                console.warn("Little Magic DB: Firebase script not loaded. Falling back to local storage.");
                dbMode = 'local';
            }
        } catch (error) {
            console.error("Little Magic DB: Failed to initialize Firebase. Falling back to local storage.", error);
            dbMode = 'local';
        }
    } else {
        console.log("Little Magic DB: Running in Local Storage Mode (Offline).");
        dbMode = 'local';
    }

    // Local Storage Helpers
    function getLocalBookings() {
        const data = localStorage.getItem("lm_bookings");
        return data ? JSON.parse(data) : [];
    }

    function saveLocalBookings(bookings) {
        localStorage.setItem("lm_bookings", JSON.stringify(bookings));
        // Dispatch custom event to notify other modules in the same tab
        window.dispatchEvent(new CustomEvent('lm_local_db_update'));
    }

    // Helper to generate a random 5-digit booking code
    function generateBookingCode() {
        return 'LM-' + Math.floor(10000 + Math.random() * 90000);
    }

    /**
     * Checks if a booking date/time is at least 24 hours in the future
     * @param {string} dateStr YYYY-MM-DD
     * @param {string} timeStr HH:MM
     * @returns {boolean} True if cancelable (>= 24 hours away)
     */
    function isCancelable(dateStr, timeStr) {
        const bookingDateTime = new Date(`${dateStr}T${timeStr}`);
        const now = new Date();
        const timeDiff = bookingDateTime - now;
        return timeDiff >= 24 * 60 * 60 * 1000;
    }

    /**
     * Subscribe to real-time updates of all bookings
     * @param {function} callback Called whenever bookings data changes
     * @returns {function} Unsubscribe function
     */
    function subscribeToBookings(callback) {
        if (dbMode === 'firebase' && db) {
            // Firebase Compat v8 subscription style
            return db.collection("bookings").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
                const bookings = [];
                snapshot.forEach((doc) => {
                    bookings.push({ id: doc.id, ...doc.data() });
                });
                callback(bookings);
            }, (error) => {
                console.error("Firestore subscription error, switching to local:", error);
            });
        } else {
            const handleLocalUpdate = () => {
                callback(getLocalBookings());
            };

            // Listen for updates from other tabs
            window.addEventListener('storage', (e) => {
                if (e.key === 'lm_bookings') {
                    handleLocalUpdate();
                }
            });

            // Listen for updates in the same tab
            window.addEventListener('lm_local_db_update', handleLocalUpdate);

            // Run immediately
            handleLocalUpdate();

            // Unsubscribe function
            return () => {
                window.removeEventListener('storage', handleLocalUpdate);
                window.removeEventListener('lm_local_db_update', handleLocalUpdate);
            };
        }
    }

    /**
     * Add a new booking
     * @param {object} bookingData Form details
     * @returns {Promise<object>} The created booking with ID
     */
    async function addBooking(bookingData) {
        const bookingCode = generateBookingCode();
        const newBooking = {
            name: bookingData.name,
            phone: bookingData.phone,
            players: parseInt(bookingData.players),
            roomType: bookingData.roomType, // 'regular' or 'private'
            date: bookingData.date,
            time: bookingData.time,
            duration: parseInt(bookingData.duration),
            totalPrice: parseFloat(bookingData.totalPrice),
            status: 'pending', // pending, confirmed, active, completed, cancelled
            bookingCode: bookingCode,
            createdAt: new Date().toISOString()
        };

        if (dbMode === 'firebase' && db) {
            const docRef = await db.collection("bookings").add(newBooking);
            return { id: docRef.id, ...newBooking };
        } else {
            const bookings = getLocalBookings();
            const id = 'local_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            const savedBooking = { id, ...newBooking };
            
            bookings.unshift(savedBooking);
            saveLocalBookings(bookings);
            return savedBooking;
        }
    }

    /**
     * Update the status of a booking
     * @param {string} id Booking document ID
     * @param {string} newStatus 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled'
     * @returns {Promise<boolean>}
     */
    async function updateBookingStatus(id, newStatus) {
        if (dbMode === 'firebase' && db) {
            await db.collection("bookings").doc(id).update({ status: newStatus });
            return true;
        } else {
            const bookings = getLocalBookings();
            const index = bookings.findIndex(b => b.id === id);
            if (index !== -1) {
                bookings[index].status = newStatus;
                saveLocalBookings(bookings);
                return true;
            }
            return false;
        }
    }

    /**
     * Cancel a booking by the customer
     * Enforces the 24-hour advance cancellation rule.
     * @param {string} id Booking document ID
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async function cancelBooking(id) {
        let bookingToCancel = null;

        if (dbMode === 'firebase' && db) {
            const docSnap = await db.collection("bookings").doc(id).get();
            if (docSnap.exists) {
                bookingToCancel = docSnap.data();
            }
        } else {
            const bookings = getLocalBookings();
            bookingToCancel = bookings.find(b => b.id === id);
        }

        if (!bookingToCancel) {
            return { success: false, message: 'ไม่พบข้อมูลการจองนี้ในระบบ' };
        }

        if (bookingToCancel.status === 'cancelled') {
            return { success: false, message: 'การจองนี้ถูกยกเลิกไปแล้ว' };
        }

        // Check cancellation policy (24 hours in advance)
        if (!isCancelable(bookingToCancel.date, bookingToCancel.time)) {
            return { 
                success: false, 
                message: 'ไม่สามารถยกเลิกได้ เนื่องจากเหลือน้อยกว่า 1 วัน (24 ชั่วโมง) ก่อนเริ่มจอง หากต้องการยกเลิกโปรดติดต่อทางไลน์' 
            };
        }

        // Perform cancel
        const success = await updateBookingStatus(id, 'cancelled');
        if (success) {
            return { success: true, message: 'ยกเลิกการจองคิวของคุณเรียบร้อยแล้ว' };
        } else {
            return { success: false, message: 'เกิดข้อผิดพลาดในการยกเลิกกรุณาลองใหม่อีกครั้ง' };
        }
    }

    /**
     * Search bookings by representative's phone number or booking code
     * @param {string} searchQuery Phone number or booking code
     * @returns {Promise<Array>} List of matching bookings
     */
    async function searchBookings(searchQuery) {
        const queryClean = searchQuery.trim().toLowerCase();
        
        if (dbMode === 'firebase' && db) {
            const results = [];
            
            // Search by phone first
            const snapPhone = await db.collection("bookings").where("phone", "==", queryClean).get();
            snapPhone.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
            
            // Search by booking code if no results or additional
            const snapCode = await db.collection("bookings").where("bookingCode", "==", queryClean.toUpperCase()).get();
            snapCode.forEach(doc => {
                if (!results.some(r => r.id === doc.id)) {
                    results.push({ id: doc.id, ...doc.data() });
                }
            });
            
            // Sort results by date/time
            return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            const bookings = getLocalBookings();
            return bookings.filter(b => 
                b.phone === queryClean || 
                b.bookingCode.toLowerCase() === queryClean
            );
        }
    }

    /**
     * Delete a booking from the system (Admin only)
     * @param {string} id Booking document ID
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async function deleteBooking(id) {
        if (dbMode === 'firebase' && db) {
            await db.collection("bookings").doc(id).delete();
            return true;
        } else {
            const bookings = getLocalBookings();
            const index = bookings.findIndex(b => b.id === id);
            if (index !== -1) {
                bookings.splice(index, 1);
                saveLocalBookings(bookings);
                return true;
            }
            return false;
        }
    }

    // Expose LittleMagicDB globally
    window.LittleMagicDB = {
        get dbMode() { return dbMode; },
        isCancelable: isCancelable,
        subscribeToBookings: subscribeToBookings,
        addBooking: addBooking,
        updateBookingStatus: updateBookingStatus,
        cancelBooking: cancelBooking,
        deleteBooking: deleteBooking,
        searchBookings: searchBookings
    };
})();

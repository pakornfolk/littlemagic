// ==========================================================================
// Little Magic Board Game Cafe - Customer Application Logic
// ==========================================================================

// Database APIs are loaded globally via window.LittleMagicDB

// Rates definitions
const RATE_REGULAR_HOUR = 40;  // 40 THB per hour per person
const RATE_REGULAR_DAY = 150;  // 150 THB per day per person
const RATE_PRIVATE_HOUR = 60;  // 60 THB per hour per person
const RATE_PRIVATE_DAY = 250;  // 250 THB per day per person

// Cache to store live bookings list
let cachedBookings = [];

// Elements
document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initBookingForm();
    initBookingLookup();
    initScheduleTab();
    initQueueSubscription();
    displayDatabaseMode();

    // Initialize EmailJS if configured
    if (window.emailConfig && window.emailConfig.publicKey && window.emailConfig.publicKey !== "YOUR_EMAILJS_PUBLIC_KEY") {
        try {
            if (typeof emailjs !== 'undefined') {
                emailjs.init({ publicKey: window.emailConfig.publicKey });
                console.log("EmailJS SDK initialized on client side.");
            }
        } catch (e) {
            console.error("Failed to initialize EmailJS on client:", e);
        }
    }
});

// 1. Toast Notification Helper
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-triangle';
    
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px) scale(0.9)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// 2. Tab Navigation Logic
function initTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.dataset.tab;
            
            // Toggle active buttons
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            // Toggle active contents
            tabContents.forEach(content => {
                content.classList.remove("active");
                if (content.id === `${targetTab}-tab`) {
                    content.classList.add("active");
                }
            });
        });
    });
}

// 3. Booking Form Logic
function initBookingForm() {
    const form = document.getElementById("booking-form");
    if (!form) return;

    const inputDate = document.getElementById("booking-date");
    const inputDuration = document.getElementById("booking-duration");
    const durationDayText = document.getElementById("booking-duration-day-text");
    const roomCards = document.querySelectorAll(".room-type-card");
    const priceDisplay = document.getElementById("estimated-price");
    const inputPlayers = document.getElementById("booking-players");

    // Set minimum date to today (or tomorrow if today is Thursday)
    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split("T")[0];
    inputDate.min = todayStr;
    if (todayObj.getDay() === 4) { // Thursday
        const tomorrowObj = new Date();
        tomorrowObj.setDate(tomorrowObj.getDate() + 1);
        inputDate.value = tomorrowObj.toISOString().split("T")[0];
    } else {
        inputDate.value = todayStr;
    }

    // Room Card selection styling & radio synchronization
    roomCards.forEach(card => {
        const radio = card.querySelector('input[type="radio"]');
        card.addEventListener("click", () => {
            roomCards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            radio.checked = true;
            toggleDurationField(radio.value);
            calculatePrice();
        });
        
        radio.addEventListener("change", () => {
            roomCards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            toggleDurationField(radio.value);
            calculatePrice();
        });
    });

    // Helper to show/hide the duration selection dropdown
    function toggleDurationField(selectedValue) {
        if (selectedValue.endsWith('_daily')) {
            inputDuration.style.display = "none";
            durationDayText.style.display = "block";
        } else {
            inputDuration.style.display = "block";
            durationDayText.style.display = "none";
        }
    }

    // Dynamic price calculation helper
    function calculatePrice() {
        const selectedRadio = document.querySelector('input[name="roomSelect"]:checked');
        if (!selectedRadio) return 0;
        
        const val = selectedRadio.value;
        const players = parseInt(inputPlayers.value) || 1;
        
        let pricePerPerson = 0;
        
        if (val === 'regular_hourly') {
            const hours = parseInt(inputDuration.value) || 1;
            pricePerPerson = hours * RATE_REGULAR_HOUR;
        } else if (val === 'regular_daily') {
            pricePerPerson = RATE_REGULAR_DAY;
        } else if (val === 'private_hourly') {
            const hours = parseInt(inputDuration.value) || 1;
            pricePerPerson = hours * RATE_PRIVATE_HOUR;
        } else if (val === 'private_daily') {
            pricePerPerson = RATE_PRIVATE_DAY;
        }
        
        const total = pricePerPerson * players;
        priceDisplay.textContent = total.toLocaleString();
        return total;
    }

    // Bind price recalculations
    inputDuration.addEventListener("change", calculatePrice);
    if (inputPlayers) {
        inputPlayers.addEventListener("change", calculatePrice);
        inputPlayers.addEventListener("input", calculatePrice);
    }
    
    // Bind date change to private room availability check and Thursday block
    if (inputDate) {
        inputDate.addEventListener("change", () => {
            const dateVal = inputDate.value;
            if (dateVal) {
                const dayOfWeek = new Date(dateVal).getDay(); // 0 is Sunday, 4 is Thursday
                if (dayOfWeek === 4) {
                    showToast("ขออภัยครับ ร้านปิดทำการทุกวันพฤหัสบดี กรุณาเลือกวันอื่นนะครับ", "error");
                    
                    // Revert to today (or tomorrow if today is Thursday)
                    const tObj = new Date();
                    const tStr = tObj.toISOString().split("T")[0];
                    if (tObj.getDay() === 4) {
                        const tomObj = new Date();
                        tomObj.setDate(tomObj.getDate() + 1);
                        inputDate.value = tomObj.toISOString().split("T")[0];
                    } else {
                        inputDate.value = tStr;
                    }
                    updatePrivateRoomAvailability(cachedBookings);
                    return;
                }
            }
            updatePrivateRoomAvailability(cachedBookings);
        });
    }
    
    // Handle form submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("booking-name").value.trim();
        const phone = document.getElementById("booking-phone").value.trim();
        const email = document.getElementById("booking-email").value.trim();
        const players = inputPlayers.value;
        const date = inputDate.value;
        const time = document.getElementById("booking-time").value;
        
        // Thursday block validation
        if (date) {
            const dayOfWeek = new Date(date).getDay();
            if (dayOfWeek === 4) {
                showToast("ขออภัยครับ ร้านปิดทำการทุกวันพฤหัสบดี", "error");
                return;
            }
        }
        
        // Opening Hours validation (15:00 - 24:00)
        if (time) {
            const [hours, minutes] = time.split(":").map(Number);
            if (hours < 15) {
                showToast("ขออภัยครับ ร้านเปิดให้บริการเวลา 15:00 น. - 24:00 น. เท่านั้นครับ", "error");
                return;
            }
        }
        
        const selectedRadio = document.querySelector('input[name="roomSelect"]:checked');
        if (!selectedRadio) {
            showToast("กรุณาเลือกพื้นที่บริการ", "error");
            return;
        }
        
        const val = selectedRadio.value;
        const roomType = val.startsWith('private') ? 'private' : 'regular';
        const duration = val.endsWith('daily') ? 'day' : inputDuration.value;
        
        // Simple validations
        if (!name || !phone || !email || !date || !time) {
            showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
            return;
        }
        
        if (phone.length < 9 || phone.length > 10 || isNaN(phone)) {
            showToast("กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (9-10 หลัก)", "error");
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast("กรุณากรอกอีเมลที่ถูกต้อง", "error");
            return;
        }
 
        const totalPrice = calculatePrice();
        
        try {
            // Set button to loading
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังจองคิว...';
            
            const booking = await LittleMagicDB.addBooking({
                name,
                phone,
                email,
                players,
                roomType,
                date,
                time,
                duration,
                totalPrice
            });
            
            // Show Success Modal/Screen
            showBookingSuccess(booking);
            sendNewBookingEmailToShop(booking); // Alert the store of new booking
            sendPendingBookingEmailToCustomer(booking); // Send confirmation email to customer (pending review)
            form.reset();
            
            // Reset to defaults
            inputDate.value = todayStr;
            document.getElementById("room-regular-hourly").checked = true;
            roomCards.forEach(c => c.classList.remove("selected"));
            document.querySelector('.room-type-card[for="room-regular-hourly"]').classList.add("selected");
            toggleDurationField("regular_hourly");
            calculatePrice();
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
            
        } catch (error) {
            console.error("Booking creation failed:", error);
            showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง", "error");
        }
    });
}

// Render booking confirmation overlay modal
function showBookingSuccess(booking) {
    const modal = document.createElement("div");
    modal.className = "admin-login-overlay"; // Reuse overlay style
    modal.style.position = "fixed";
    modal.innerHTML = `
        <div class="admin-login-box" style="max-width: 480px; text-align: left;">
            <div style="text-align: center; margin-bottom: 20px; color: var(--color-status-active);">
                <i class="fas fa-check-circle" style="font-size: 56px;"></i>
                <h2 style="margin-top: 15px; color: var(--color-primary-dark);">จองคิวสำเร็จ!</h2>
                <p style="color: var(--color-primary);">กรุณาบันทึกข้อมูลการจองนี้ไว้เพื่อแสดงหน้าร้าน</p>
            </div>
            
            <div style="background: #FFF9F2; border: 1px dashed var(--color-status-pending); border-radius: var(--border-radius-sm); padding: 12px; font-size: 12px; color: #B25E00; margin-bottom: 20px; display: flex; gap: 8px; align-items: flex-start;">
                <i class="fas fa-exclamation-triangle" style="margin-top: 2.5px;"></i>
                <div>
                    <strong>ข้อแนะนำเกี่ยวกับอีเมล:</strong> หากไม่พบอีเมลยืนยันการจองในกล่องจดหมายปกติ โปรดตรวจสอบในกล่อง <strong>"จดหมายขยะ (Spam)"</strong> หรือสอบถามสถานะการจองทางไลน์ ได้เลยครับ
                </div>
            </div>
            
            <div class="booking-detail-card" style="margin-top: 0; margin-bottom: 20px; background: #FCFAF7;">
                <div class="booking-detail-row">
                    <span>รหัสจอง (Booking Code)</span>
                    <strong style="color: var(--color-accent-magic); font-size: 18px;">${booking.bookingCode}</strong>
                </div>
                <div class="booking-detail-row">
                    <span>ผู้จอง (ตัวแทนกลุ่ม)</span>
                    <span>${booking.name}</span>
                </div>
                <div class="booking-detail-row">
                    <span>เบอร์โทรศัพท์</span>
                    <span>${booking.phone}</span>
                </div>
                <div class="booking-detail-row">
                    <span>อีเมลแจ้งเตือน</span>
                    <span>${booking.email || '-'}</span>
                </div>
                <div class="booking-detail-row">
                    <span>พื้นที่ / ห้อง</span>
                    <span>${booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)'}</span>
                </div>
                <div class="booking-detail-row">
                    <span>วันที่จอง</span>
                    <span>${formatThaiDate(booking.date)}</span>
                </div>
                <div class="booking-detail-row">
                    <span>เวลาเริ่มเล่น</span>
                    <span>${booking.time} น. (${getDurationText(booking.duration)})</span>
                </div>
                <div class="booking-detail-row" style="border: none;">
                    <span>ราคาประเมินรวม</span>
                    <strong style="color: var(--color-primary-dark);">${booking.totalPrice} บาท</strong>
                </div>
            </div>
            
            <button id="close-success-modal" class="btn btn-primary">ตกลง (ปิดหน้าต่าง)</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById("close-success-modal").addEventListener("click", () => {
        modal.remove();
        // Switch user to inquiry tab automatically to see their booking!
        const lookupTabBtn = document.querySelector('.tab-btn[data-tab="lookup"]');
        if (lookupTabBtn) {
            lookupTabBtn.click();
            document.getElementById("lookup-search").value = booking.phone;
            document.getElementById("lookup-btn").click();
        }
    });
}

// 4. Booking Lookup (Check & Cancel Queues)
function initBookingLookup() {
    const searchInput = document.getElementById("lookup-search");
    const searchBtn = document.getElementById("lookup-btn");
    const resultsContainer = document.getElementById("lookup-results");
    
    if (!searchBtn || !resultsContainer) return;
    
    searchBtn.addEventListener("click", async () => {
        const query = searchInput.value.trim();
        if (!query) {
            showToast("กรุณากรอกเบอร์โทรศัพท์ หรือรหัสจองคิว", "error");
            return;
        }
        
        resultsContainer.innerHTML = `
            <div style="text-align:center; padding: 30px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--color-primary);"></i>
                <p style="margin-top:10px;">กำลังค้นหาข้อมูล...</p>
            </div>
        `;
        
        try {
            const bookings = await LittleMagicDB.searchBookings(query);
            renderLookupResults(bookings, resultsContainer);
        } catch (error) {
            console.error("Search error:", error);
            showToast("เกิดข้อผิดพลาดในการค้นหาข้อมูล", "error");
        }
    });
    
    // Press enter in search box
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });
}

function renderLookupResults(bookings, container) {
    if (bookings.length === 0) {
        container.innerHTML = `
            <div class="empty-queue" style="padding: 40px 10px;">
                <i class="fas fa-search-minus"></i>
                <p style="font-family: var(--font-heading); font-size: 16px; margin-top:10px;">ไม่พบข้อมูลการจองของคุณ</p>
                <p style="font-size: 12px; color: var(--color-primary); max-width: 300px; margin: 5px auto 0 auto;">
                    โปรดตรวจสอบเบอร์โทรศัพท์ หรือ รหัสจอง (เช่น LM-12345) ว่าสะกดถูกต้องหรือไม่
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    bookings.forEach(booking => {
        const card = document.createElement("div");
        card.className = "booking-detail-card";
        
        const isBookingCancelable = LittleMagicDB.isCancelable(booking.date, booking.time) && booking.status !== 'cancelled' && booking.status !== 'completed';
        
        let statusBadge = '';
        switch(booking.status) {
            case 'pending': statusBadge = '<span class="badge badge-pending"><i class="fas fa-clock"></i> รอการยืนยัน</span>'; break;
            case 'confirmed': statusBadge = '<span class="badge badge-confirmed"><i class="fas fa-check"></i> ยืนยันแล้ว</span>'; break;
            case 'active': statusBadge = '<span class="badge badge-active"><i class="fas fa-dice"></i> กำลังเล่นอยู่</span>'; break;
            case 'completed': statusBadge = '<span class="badge badge-completed"><i class="fas fa-door-open"></i> เล่นเสร็จแล้ว</span>'; break;
            case 'cancelled': statusBadge = '<span class="badge badge-cancelled"><i class="fas fa-times"></i> ยกเลิกแล้ว</span>'; break;
        }
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin-bottom: 15px;">
                <h3 style="margin:0; border:none; padding:0; font-size:16px; color:var(--color-primary-dark);">
                    รหัสจอง: <span style="color:var(--color-accent-magic);">${booking.bookingCode}</span>
                </h3>
                ${statusBadge}
            </div>
            
            <div class="booking-detail-row">
                <span>ตัวแทนกลุ่ม</span>
                <span>${booking.name}</span>
            </div>
            <div class="booking-detail-row">
                <span>พื้นที่ / ห้อง</span>
                <span>${booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)'}</span>
            </div>
            <div class="booking-detail-row">
                <span>วันที่จอง</span>
                <span>${formatThaiDate(booking.date)}</span>
            </div>
            <div class="booking-detail-row">
                <span>เวลานัดหมาย</span>
                <span>${booking.time} น. (${getDurationText(booking.duration)})</span>
            </div>
            <div class="booking-detail-row">
                <span>จำนวนผู้เล่น</span>
                <span>${booking.players} คน</span>
            </div>
            <div class="booking-detail-row">
                <span>ราคาประเมิน</span>
                <strong style="color:var(--color-primary-dark);">${booking.totalPrice} บาท</strong>
            </div>
            
            ${isBookingCancelable ? `
                <button class="btn btn-cancel" data-id="${booking.id}">
                    <i class="fas fa-trash-alt"></i> ยกเลิกการจองคิวนี้
                </button>
            ` : ''}
            
            ${booking.status === 'cancelled' ? `
                <div class="cancellation-note" style="background:#FFF0EE; color:#A62B1D; border-color: rgba(231,111,81,0.2)">
                    <i class="fas fa-info-circle"></i> การจองคิวนี้ถูกยกเลิกเรียบร้อยแล้ว
                </div>
            ` : ''}
            
            ${!isBookingCancelable && booking.status !== 'cancelled' && booking.status !== 'completed' ? `
                <div class="cancellation-note" style="background:#FFF8F0; color:#B25E00; border-color: rgba(244,162,97,0.2)">
                    <i class="fas fa-exclamation-triangle"></i> ไม่สามารถยกเลิกได้ เนื่องจากเหลือน้อยกว่า 1 วัน (24 ชั่วโมง) ก่อนเริ่มจอง หากต้องการยกเลิกโปรดติดต่อทางไลน์
                </div>
            ` : ''}
        `;
        
        // Handle Cancel Button event
        const cancelBtn = card.querySelector(".btn-cancel");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", async () => {
                const confirmCancel = confirm(`คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองคิว รหัส ${booking.bookingCode}?`);
                if (!confirmCancel) return;
                
                cancelBtn.disabled = true;
                cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังยกเลิก...';
                
                const response = await LittleMagicDB.cancelBooking(booking.id);
                if (response.success) {
                    showToast(response.message, "success");
                    sendCancellationEmails(booking); // Send notifications
                    // Refresh search findings
                    const globalSearchBtn = document.getElementById("lookup-btn");
                    if (globalSearchBtn) globalSearchBtn.click();
                } else {
                    showToast(response.message, "error");
                    cancelBtn.disabled = false;
                    cancelBtn.innerHTML = '<i class="fas fa-trash-alt"></i> ยกเลิกการจองคิวนี้';
                }
            });
        }
        
        container.appendChild(card);
    });
}

// 5. Live Queue Dashboard logic
function initQueueSubscription() {
    const queueListContainer = document.getElementById("queue-list");
    const activeQueuesCount = document.getElementById("active-queues-count");
    const privateRoomsCount = document.getElementById("private-rooms-count");
    
    if (!queueListContainer) return;
    
    LittleMagicDB.subscribeToBookings((bookings) => {
        // Cache live bookings
        cachedBookings = bookings;
        
        // Update Private Room occupancy on selection cards
        updatePrivateRoomAvailability(bookings);

        // Update interactive schedule tab if renderSchedule function exists
        if (typeof renderSchedule === 'function') {
            renderSchedule();
        }

        // We filter queues for TODAY that are active ('pending', 'confirmed', 'active')
        const todayStr = new Date().toISOString().split("T")[0];
        
        // Filter bookings scheduled for today that are not completed/cancelled
        const activeBookingsToday = bookings.filter(b => 
            b.date === todayStr && 
            (b.status === 'pending' || b.status === 'confirmed' || b.status === 'active')
        );
        
        // Sort activeBookingsToday by booking time ascending (chronological)
        activeBookingsToday.sort((a, b) => {
            const timeA = a.time.split(":").map(Number);
            const timeB = b.time.split(":").map(Number);
            return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
        });
        
        // Update stats counters
        if (activeQueuesCount) {
            activeQueuesCount.textContent = activeBookingsToday.length;
        }
        
        if (privateRoomsCount) {
            const occupiedCount = bookings.filter(b => b.roomType === 'private' && b.status === 'active').length;
            privateRoomsCount.textContent = `${occupiedCount}/2`;
        }
        
        // Render queues
        if (activeBookingsToday.length === 0) {
            queueListContainer.innerHTML = `
                <div class="empty-queue">
                    <i class="fas fa-dice"></i>
                    <p style="font-family: var(--font-heading); font-size: 15px; margin-top: 10px;">วันนี้ยังไม่มีคิวจอง</p>
                    <p style="font-size: 12px; color: var(--color-primary);">กดจองเป็นคิวแรกของร้านได้เลย!</p>
                </div>
            `;
            return;
        }
        
        queueListContainer.innerHTML = '';
        
        activeBookingsToday.forEach(booking => {
            const item = document.createElement("div");
            item.className = `queue-item status-${booking.status}`;
            
            let statusText = '';
            let badgeClass = '';
            switch(booking.status) {
                case 'pending': 
                    statusText = 'รอร้านยืนยัน'; 
                    badgeClass = 'badge-pending'; 
                    break;
                case 'confirmed': 
                    statusText = 'ยืนยันคิวแล้ว'; 
                    badgeClass = 'badge-confirmed'; 
                    break;
                case 'active': 
                    statusText = 'กำลังเล่นอยู่'; 
                    badgeClass = 'badge-active'; 
                    break;
            }
            
            const areaBadge = booking.roomType === 'private' 
                ? '<span class="badge badge-room private"><i class="fas fa-door-closed"></i> ห้อง Private</span>' 
                : '<span class="badge badge-room"><i class="fas fa-couch"></i> โซนปกติ</span>';
                
            item.innerHTML = `
                <div class="queue-meta">
                    <div class="queue-title">${maskName(booking.name)}</div>
                    <div class="queue-details">
                        <span><i class="far fa-clock"></i> ${booking.time} น. (${getDurationText(booking.duration)})</span>
                        <span><i class="fas fa-users"></i> ${booking.players} คน</span>
                    </div>
                </div>
                <div class="queue-actions-badge">
                    <span class="badge ${badgeClass}">${statusText}</span>
                    ${areaBadge}
                </div>
            `;
            
            queueListContainer.appendChild(item);
        });
    });
}

// 6. DB Mode Banner
function displayDatabaseMode() {
    let banner = document.getElementById("db-mode-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "db-mode-banner";
        document.body.insertBefore(banner, document.body.firstChild);
    }
    
    if (LittleMagicDB.dbMode === 'firebase') {
        banner.className = "db-mode-banner firebase-active";
        banner.innerHTML = `<i class="fas fa-cloud"></i> เชื่อมต่อ Firebase Realtime Cloud: ระบบจองเรียลไทม์ออนไลน์`;
    } else {
        banner.className = "db-mode-banner";
        banner.innerHTML = `<i class="fas fa-laptop-code"></i> โหมดเดโมภายใน (Offline Mode): ข้อมูลถูกเซฟในเครื่องคุณเท่านั้น | <a href="js/firebase-config.js" style="color:var(--color-primary-dark); font-weight:600; text-decoration:underline;">เปิดใช้คลาวด์ Firebase</a>`;
    }
}

// Helper: Mask Name for Privacy (e.g. Somchai -> Som***)
function maskName(name) {
    if (name.length <= 3) return name[0] + '**';
    return name.slice(0, 3) + '***';
}

// Helper: Date to Thai Date Format
function formatThaiDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543; // Thai BE Era
    return `${day} ${month} ${year}`;
}

// Helper: Get readable duration text
function getDurationText(duration) {
    return duration === 'day' ? 'เหมารายวัน' : `${duration} ชม.`;
}

// Helper: Update Private Room availability and disable booking if full today
function updatePrivateRoomAvailability(bookings) {
    const inputDate = document.getElementById("booking-date");
    if (!inputDate) return;
    
    const selectedDate = inputDate.value;
    const todayStr = new Date().toISOString().split("T")[0];
    
    // Count active private rooms today
    const activePrivateCount = bookings.filter(b => b.roomType === 'private' && b.status === 'active').length;
    const availablePrivateRooms = Math.max(0, 2 - activePrivateCount);
    
    const hourlyCard = document.querySelector('.room-type-card[for="room-private-hourly"]');
    const dailyCard = document.querySelector('.room-type-card[for="room-private-daily"]');
    
    const hourlyRadio = document.getElementById("room-private-hourly");
    const dailyRadio = document.getElementById("room-private-daily");
    
    const regularHourlyRadio = document.getElementById("room-regular-hourly");
    const regularHourlyCard = document.querySelector('.room-type-card[for="room-regular-hourly"]');
    
    const occupancyTexts = document.querySelectorAll(".private-occupancy-text");
    
    if (selectedDate === todayStr && availablePrivateRooms === 0) {
        occupancyTexts.forEach(el => {
            el.innerHTML = `<span style="color: var(--color-status-cancelled); font-weight: 600;"><i class="fas fa-exclamation-circle"></i> เต็มแล้ววันนี้ (0/2)</span>`;
        });
        
        if (hourlyCard) {
            hourlyCard.style.opacity = "0.5";
            hourlyCard.style.pointerEvents = "none";
            hourlyCard.style.cursor = "not-allowed";
        }
        if (dailyCard) {
            dailyCard.style.opacity = "0.5";
            dailyCard.style.pointerEvents = "none";
            dailyCard.style.cursor = "not-allowed";
        }
        
        // If Private is selected, auto-select Regular Hourly
        if (hourlyRadio && dailyRadio && (hourlyRadio.checked || dailyRadio.checked)) {
            regularHourlyRadio.checked = true;
            document.querySelectorAll(".room-type-card").forEach(c => c.classList.remove("selected"));
            if (regularHourlyCard) {
                regularHourlyCard.classList.add("selected");
            }
            
            const inputDuration = document.getElementById("booking-duration");
            const durationDayText = document.getElementById("booking-duration-day-text");
            if (inputDuration && durationDayText) {
                inputDuration.style.display = "block";
                durationDayText.style.display = "none";
            }
            
            // Recalculate price
            const priceDisplay = document.getElementById("estimated-price");
            const inputPlayers = document.getElementById("booking-players");
            if (priceDisplay && inputPlayers) {
                const players = parseInt(inputPlayers.value) || 1;
                const hours = parseInt(inputDuration.value) || 1;
                const total = hours * 40 * players;
                priceDisplay.textContent = total.toLocaleString();
            }
        }
    } else {
        occupancyTexts.forEach(el => {
            if (selectedDate === todayStr) {
                el.innerHTML = `<span style="color: var(--color-status-active); font-weight: 600;"><i class="fas fa-check-circle"></i> ห้องว่างวันนี้: ${availablePrivateRooms}/2</span>`;
            } else {
                el.innerHTML = `<span style="color: var(--color-primary); font-weight: 500;"><i class="far fa-check-circle"></i> จองล่วงหน้าได้ (ว่าง 2/2)</span>`;
            }
        });
        
        if (hourlyCard) {
            hourlyCard.style.opacity = "1";
            hourlyCard.style.pointerEvents = "auto";
            hourlyCard.style.cursor = "pointer";
        }
        if (dailyCard) {
            dailyCard.style.opacity = "1";
            dailyCard.style.pointerEvents = "auto";
            dailyCard.style.cursor = "pointer";
        }
    }
}

// Send Email notifications when a customer cancels a booking
async function sendCancellationEmails(booking) {
    if (!window.emailConfig || !window.emailConfig.publicKey || window.emailConfig.publicKey === "YOUR_EMAILJS_PUBLIC_KEY") {
        console.warn("EmailJS is not configured. Skipping cancellation email alerts.");
        return;
    }

    if (typeof emailjs === 'undefined') {
        console.error("EmailJS SDK not found. Cannot send cancellation emails.");
        return;
    }

    // 1. Send cancellation confirmation to CUSTOMER (if email is saved)
    if (booking.email) {
        try {
            const customerParams = {
                to_email: booking.email,
                to_name: booking.name,
                booking_code: booking.bookingCode,
                status_text: "ยกเลิกการจองคิวแล้ว",
                status_detail: "คุณได้กดยกเลิกคิวของคุณเรียบร้อยแล้ว หากนี่ไม่ใช่การดำเนินการของคุณ โปรดติดต่อทางร้านครับ",
                date: formatThaiDate(booking.date),
                time: booking.time,
                players: booking.players,
                room_type: booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)',
                price: booking.totalPrice
            };

            await emailjs.send(
                window.emailConfig.serviceId,
                window.emailConfig.templateId,
                customerParams
            );
            console.log("Cancellation confirmation email sent to customer.");
        } catch (error) {
            console.error("Failed to send cancellation confirmation to customer:", error);
        }
    }

    // 2. Send cancellation notification to STORE (always send to littlemagic.official2025@gmail.com)
    try {
        const storeParams = {
            to_email: "littlemagic.official2025@gmail.com", // Shop's email
            to_name: "แอดมิน Little Magic",
            booking_code: booking.bookingCode,
            status_text: "ลูกค้ายกเลิกคิวจอง",
            status_detail: `คุณ ${booking.name} ได้กดยกเลิกการจองคิวนี้ด้วยตนเองผ่านหน้าระบบตรวจสอบคิว`,
            date: formatThaiDate(booking.date),
            time: booking.time,
            players: booking.players,
            room_type: booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)',
            price: booking.totalPrice
        };

        await emailjs.send(
            window.emailConfig.serviceId,
            window.emailConfig.templateId,
            storeParams
        );
        console.log("Cancellation alert email sent to shop.");
    } catch (error) {
        console.error("Failed to send cancellation alert email to shop:", error);
    }
}

// Send notification to the store's email when a new booking is created
async function sendNewBookingEmailToShop(booking) {
    if (!window.emailConfig || !window.emailConfig.publicKey || window.emailConfig.publicKey === "YOUR_EMAILJS_PUBLIC_KEY") {
        console.warn("EmailJS is not configured. Skipping new booking email alerts.");
        return;
    }

    if (typeof emailjs === 'undefined') {
        console.error("EmailJS SDK not found. Cannot send new booking email.");
        return;
    }

    try {
        const storeParams = {
            to_email: "littlemagic.official2025@gmail.com", // Shop's email
            to_name: "แอดมิน Little Magic",
            booking_code: booking.bookingCode,
            status_text: "มีคิวจองใหม่เข้ามา (รออนุมัติ)",
            status_detail: `คุณ ${booking.name} ได้จองคิวเข้ามาใหม่ในระบบ กรุณาตรวจสอบข้อมูลและกดยืนยันคิวในระบบหลังบ้าน`,
            date: formatThaiDate(booking.date),
            time: booking.time,
            players: booking.players,
            room_type: booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)',
            price: booking.totalPrice
        };

        await emailjs.send(
            window.emailConfig.serviceId,
            window.emailConfig.templateId,
            storeParams
        );
        console.log("New booking alert email sent to shop.");
    } catch (error) {
        console.error("Failed to send new booking alert email to shop:", error);
    }
}

// Send notification to the customer's email when a new booking is created (Pending approval status)
async function sendPendingBookingEmailToCustomer(booking) {
    if (!booking.email) {
        console.log("No email address provided. Skipping pending email notification to customer.");
        return;
    }

    if (!window.emailConfig || !window.emailConfig.publicKey || window.emailConfig.publicKey === "YOUR_EMAILJS_PUBLIC_KEY") {
        console.warn("EmailJS is not configured. Skipping customer pending email notification.");
        return;
    }

    if (typeof emailjs === 'undefined') {
        console.error("EmailJS SDK not found. Cannot send email.");
        return;
    }

    try {
        const customerParams = {
            to_email: booking.email,
            to_name: booking.name,
            booking_code: booking.bookingCode,
            status_text: "ได้รับข้อมูลการจองคิวแล้ว (รอร้านตรวจสอบ)",
            status_detail: "ระบบได้รับข้อมูลการจองคิวของคุณเรียบร้อยแล้ว ขณะนี้อยู่ระหว่างการตรวจสอบและอนุมัติจากทางร้าน หากร้านยืนยันคิวแล้ว จะมีอีเมลยืนยันส่งไปหาคุณอีกครั้งนะครับ",
            date: formatThaiDate(booking.date),
            time: booking.time,
            players: booking.players,
            room_type: booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)',
            price: booking.totalPrice
        };

        await emailjs.send(
            window.emailConfig.serviceId,
            window.emailConfig.templateId,
            customerParams
        );
        console.log("Pending confirmation email sent to customer.");
    } catch (error) {
        console.error("Failed to send pending email to customer:", error);
    }
}

// ==========================================================================
// 7. Interactive Booking Schedule Tab Logic
// ==========================================================================
function initScheduleTab() {
    const scheduleDateInput = document.getElementById("schedule-date");
    if (!scheduleDateInput) return;

    // Set initial date: Today (or tomorrow if today is Thursday)
    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split("T")[0];
    scheduleDateInput.min = todayStr;
    
    if (todayObj.getDay() === 4) { // Thursday
        const tomorrowObj = new Date();
        tomorrowObj.setDate(tomorrowObj.getDate() + 1);
        scheduleDateInput.value = tomorrowObj.toISOString().split("T")[0];
    } else {
        scheduleDateInput.value = todayStr;
    }

    // Bind change listener
    scheduleDateInput.addEventListener("change", () => {
        const dateVal = scheduleDateInput.value;
        if (dateVal) {
            const dayOfWeek = new Date(dateVal).getDay(); // 4 is Thursday
            if (dayOfWeek === 4) {
                showToast("ขออภัยครับ ร้านปิดทำการทุกวันพฤหัสบดี กรุณาเลือกวันอื่นนะครับ", "error");
                
                // Revert to today (or tomorrow if today is Thursday)
                const tObj = new Date();
                const tStr = tObj.toISOString().split("T")[0];
                if (tObj.getDay() === 4) {
                    const tomObj = new Date();
                    tomObj.setDate(tomObj.getDate() + 1);
                    scheduleDateInput.value = tomObj.toISOString().split("T")[0];
                } else {
                    scheduleDateInput.value = tStr;
                }
            }
        }
        renderSchedule();
    });

    // Render schedule initially
    renderSchedule();
}

function renderSchedule() {
    const scheduleDateInput = document.getElementById("schedule-date");
    if (!scheduleDateInput) return;
    
    const selectedDate = scheduleDateInput.value;
    if (!selectedDate) return;

    // Filter active bookings (pending, confirmed, active) for selectedDate
    const activeBookings = cachedBookings.filter(b => 
        b.date === selectedDate && 
        (b.status === 'pending' || b.status === 'confirmed' || b.status === 'active')
    );

    // 1. Calculate & Render Vibe Meter
    const vibeBadge = document.getElementById("vibe-badge");
    const vibeText = document.getElementById("vibe-text");
    const vibeGaugeFill = document.getElementById("vibe-gauge-fill");

    if (vibeBadge && vibeText && vibeGaugeFill) {
        const dayOfWeek = new Date(selectedDate).getDay();
        if (dayOfWeek === 4) {
            // Closed
            vibeBadge.textContent = "ร้านปิดทำการ ❌";
            vibeBadge.className = "badge badge-cancelled";
            vibeBadge.style.backgroundColor = "";
            vibeBadge.style.color = "";
            vibeText.textContent = "วันนี้ร้านหยุดให้บริการประจำสัปดาห์ (วันพฤหัสบดี) เลือกวันถัดไปได้เลยนะ!";
            vibeGaugeFill.style.width = "0%";
            vibeGaugeFill.className = "vibe-gauge-fill";
        } else {
            const bookingCount = activeBookings.length;
            let levelClass = "level-chill";
            let widthPct = "15%";
            let badgeTxt = "ชิลสบายๆ 🟢";
            let descTxt = "ร้านค่อนข้างโล่ง เล่นบอร์ดเกมแนวไหนก็มีสมาธิ!";

            if (bookingCount >= 2 && bookingCount <= 3) {
                levelClass = "level-good";
                widthPct = "45%";
                badgeTxt = "กำลังสนุก 🟡";
                descTxt = "บรรยากาศกำลังดี มีเสียงหัวเราะรอบโต๊ะเป็นกันเอง";
            } else if (bookingCount >= 4 && bookingCount <= 5) {
                levelClass = "level-lively";
                widthPct = "75%";
                badgeTxt = "ครึกครื้น 🟠";
                descTxt = "ผู้เล่นเยอะ บรรยากาศบอร์ดเกมคาเฟ่เต็มพิกัด!";
            } else if (bookingCount >= 6) {
                levelClass = "level-peak";
                widthPct = "100%";
                badgeTxt = "ปาร์ตี้สุดเหวี่ยง 🔥";
                descTxt = "คนแน่นร้าน! แนะนำรีบจองก่อนโต๊ะเต็ม";
            }

            vibeBadge.textContent = badgeTxt;
            // Clear any inline styles to let CSS classes take over
            vibeBadge.style.backgroundColor = "";
            vibeBadge.style.color = "";
            
            if (bookingCount < 2) {
                vibeBadge.className = "badge badge-active";
            } else if (bookingCount <= 3) {
                vibeBadge.className = "badge badge-pending";
            } else if (bookingCount <= 5) {
                vibeBadge.className = "badge badge-lively";
            } else {
                vibeBadge.className = "badge badge-cancelled";
            }
            
            vibeText.textContent = descTxt;
            vibeGaugeFill.className = `vibe-gauge-fill ${levelClass}`;
            vibeGaugeFill.style.width = widthPct;
        }
    }

    // 2. Render Timeline Blocks
    const rowRegular = document.getElementById("timeline-row-regular");
    const rowPrivate1 = document.getElementById("timeline-row-private1");
    const rowPrivate2 = document.getElementById("timeline-row-private2");

    if (!rowRegular || !rowPrivate1 || !rowPrivate2) return;

    // Clear rows
    rowRegular.innerHTML = '';
    rowPrivate1.innerHTML = '';
    rowPrivate2.innerHTML = '';

    const dayOfWeek = new Date(selectedDate).getDay();
    const isClosed = dayOfWeek === 4;

    // Helper: format slot index to displayable time (HH:MM)
    const getSlotTime = (index) => {
        const mins = index * 30;
        const h = Math.floor(mins / 60) + 15;
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Calculate booking overlap ranges
    const regularBookings = activeBookings.filter(b => b.roomType === 'regular');
    const privateBookings = activeBookings.filter(b => b.roomType === 'private');

    // Helper to calculate slot occupancy [startSlot, endSlot]
    const getBookingSlotRange = (booking) => {
        const [h, m] = booking.time.split(":").map(Number);
        const startMin = (h - 15) * 60 + m;
        const durMin = (booking.duration === 'day') ? 540 : (booking.duration * 60);
        const startSlot = Math.max(0, Math.floor(startMin / 30));
        const endSlot = Math.min(18, Math.ceil((startMin + durMin) / 30) + 1);
        return { startSlot, endSlot };
    };

    // Helper to calculate booking end time string (HH:MM)
    const getBookingEndTime = (booking) => {
        if (booking.duration === 'day') return '24:00';
        const [h, m] = booking.time.split(":").map(Number);
        const endHour = h + parseInt(booking.duration);
        return `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Initialize regular row (we just check if any active booking covers a slot)
    const regularSlots = Array(18).fill(null);
    regularBookings.forEach(booking => {
        const { startSlot, endSlot } = getBookingSlotRange(booking);
        for (let i = startSlot; i < endSlot; i++) {
            if (!regularSlots[i]) {
                regularSlots[i] = booking;
            }
        }
    });

    // Assign private bookings to Private Row 1 and Row 2 to resolve overlaps visually
    const private1Slots = Array(18).fill(null);
    const private2Slots = Array(18).fill(null);

    // Sort private bookings by time to assign chronologically
    privateBookings.sort((a, b) => {
        const timeA = a.time.split(":").map(Number);
        const timeB = b.time.split(":").map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    privateBookings.forEach(booking => {
        const { startSlot, endSlot } = getBookingSlotRange(booking);
        
        // Try row 1 first
        let fitsPrivate1 = true;
        for (let i = startSlot; i < endSlot; i++) {
            if (private1Slots[i]) {
                fitsPrivate1 = false;
                break;
            }
        }

        if (fitsPrivate1) {
            for (let i = startSlot; i < endSlot; i++) {
                private1Slots[i] = booking;
            }
        } else {
            // Try row 2
            let fitsPrivate2 = true;
            for (let i = startSlot; i < endSlot; i++) {
                if (private2Slots[i]) {
                    fitsPrivate2 = false;
                    break;
                }
            }
            if (fitsPrivate2) {
                for (let i = startSlot; i < endSlot; i++) {
                    private2Slots[i] = booking;
                }
            } else {
                // If both rows are full, force assign to row 2 anyway
                for (let i = startSlot; i < endSlot; i++) {
                    private2Slots[i] = booking;
                }
            }
        }
    });

    // Helper: render blocks into a row element
    const renderRowBlocks = (rowElement, slotsArray, zoneType) => {
        let i = 0;
        while (i < 18) {
            if (isClosed) {
                const block = document.createElement("div");
                block.className = "time-block occupied-pending";
                block.style.gridColumn = `${i + 1}`;
                block.style.cursor = "not-allowed";
                block.innerHTML = `<span style="font-size: 10px; font-weight: 700;">ปิด</span>`;
                rowElement.appendChild(block);
                i++;
                continue;
            }

            const booking = slotsArray[i];
            if (booking) {
                // Find how many consecutive slots belong to this same booking ID
                const startSlot = i;
                const bookingId = booking.id;
                while (i < 18 && slotsArray[i] && slotsArray[i].id === bookingId) {
                    i++;
                }
                const endSlot = i; // i is now the slot index after the booking ends

                const block = document.createElement("div");
                let statusClass = "occupied-pending";
                let statusName = "รออนุมัติ";
                if (booking.status === 'confirmed') {
                    statusClass = "occupied-confirmed";
                    statusName = "จองแล้ว";
                } else if (booking.status === 'active') {
                    statusClass = "occupied-active";
                    statusName = "กำลังเล่น";
                }

                const endTimeStr = getBookingEndTime(booking);
                block.className = `time-block ${statusClass}`;
                block.style.gridColumn = `${startSlot + 1} / ${endSlot + 1}`;
                block.title = `จองแล้ว: ${booking.time} - ${endTimeStr} น. (คุณ ${maskName(booking.name)} - ${statusName})`;
                
                // Show text inside the bar: e.g. "18:00 - 20:00"
                const spanColumns = endSlot - startSlot;
                if (spanColumns >= 2) {
                    block.innerHTML = `<span style="font-size: 11px; white-space: nowrap; font-weight: 700;">${booking.time}-${endTimeStr}</span>`;
                } else {
                    block.innerHTML = `<span style="font-size: 10px; font-weight: 700;">จอง</span>`;
                }
                
                rowElement.appendChild(block);
            } else {
                // Free slot (spans 1 column)
                const block = document.createElement("div");
                const slotTimeStr = getSlotTime(i);
                block.className = "time-block free";
                block.style.gridColumn = `${i + 1}`;
                block.title = `เวลา ${slotTimeStr} น. (ว่าง - คลิกเพื่อจองเลย)`;
                block.innerHTML = `<span style="font-size: 10px; font-weight: 700;">ว่าง</span>`;
                
                const currentSlotTime = slotTimeStr;
                block.addEventListener("click", () => {
                    handleQuickBook(selectedDate, currentSlotTime, zoneType);
                });
                
                rowElement.appendChild(block);
                i++;
            }
        }
    };

    renderRowBlocks(rowRegular, regularSlots, 'regular');
    renderRowBlocks(rowPrivate1, private1Slots, 'private');
    renderRowBlocks(rowPrivate2, private2Slots, 'private');

    // 3. Render Detailed Queue Cards for Selected Date
    const queueListHolder = document.getElementById("schedule-queue-list");
    if (!queueListHolder) return;

    // Filter, sort bookings
    const activeDetails = activeBookings.slice();
    activeDetails.sort((a, b) => {
        const timeA = a.time.split(":").map(Number);
        const timeB = b.time.split(":").map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    if (activeDetails.length === 0) {
        queueListHolder.innerHTML = `
            <div class="empty-queue" style="grid-column: 1 / -1; padding: 30px; border: 1.5px dashed var(--color-border); border-radius: var(--border-radius-md);">
                <i class="fas fa-calendar-check" style="font-size: 28px; color: var(--color-primary-light); margin-bottom: 8px;"></i>
                <p style="font-family: var(--font-heading); font-size: 14px;">ยังไม่มีคิวจองในวันที่เลือก</p>
                <p style="font-size: 11px; color: var(--color-primary);">คุณสามารถกดจองคิวเป็นคิวแรกของวันนี้ได้ทันที!</p>
            </div>
        `;
        return;
    }

    queueListHolder.innerHTML = '';
    activeDetails.forEach(booking => {
        const card = document.createElement("div");
        card.className = `masked-booking-card border-${booking.status}`;

        let statusText = 'รอร้านยืนยัน';
        let badgeClass = 'badge-pending';
        if (booking.status === 'confirmed') {
            statusText = 'ยืนยันคิวแล้ว';
            badgeClass = 'badge-confirmed';
        } else if (booking.status === 'active') {
            statusText = 'กำลังเล่นอยู่';
            badgeClass = 'badge-active';
        }

        const areaName = booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)';
        const codeText = booking.bookingCode ? `${booking.bookingCode.slice(0, 5)}***` : 'LM-*****';

        card.innerHTML = `
            <div class="masked-card-header">
                <span class="masked-card-title"><i class="fas fa-dice"></i> คุณ ${maskName(booking.name)}</span>
                <span class="badge ${badgeClass}" style="font-size: 10px; padding: 3px 8px;">${statusText}</span>
            </div>
            <div class="masked-card-body">
                <div class="masked-card-row">
                    <span>เวลานัดหมาย</span>
                    <span>${booking.time} น. (${getDurationText(booking.duration)})</span>
                </div>
                <div class="masked-card-row">
                    <span>พื้นที่บริการ</span>
                    <span>${areaName}</span>
                </div>
                <div class="masked-card-row">
                    <span>จำนวนผู้เล่น</span>
                    <span>${booking.players} คน</span>
                </div>
                <div class="masked-card-row" style="opacity: 0.7; font-size: 11px;">
                    <span>รหัสจองอ้างอิง</span>
                    <span>${codeText}</span>
                </div>
            </div>
        `;
        queueListHolder.appendChild(card);
    });
}

function handleQuickBook(date, time, zone) {
    // 1. Switch to booking tab
    const bookingTabBtn = document.querySelector('[data-tab="booking"]');
    if (bookingTabBtn) {
        bookingTabBtn.click();
    }

    // 2. Set date input
    const bookingDateInput = document.getElementById("booking-date");
    if (bookingDateInput) {
        bookingDateInput.value = date;
        bookingDateInput.dispatchEvent(new Event('change'));
    }

    // 3. Set time select
    const bookingTimeSelect = document.getElementById("booking-time");
    if (bookingTimeSelect) {
        bookingTimeSelect.value = time;
        bookingTimeSelect.dispatchEvent(new Event('change'));
    }

    // 4. Set room type
    let radioId = "room-regular-hourly";
    if (zone === 'private') {
        radioId = "room-private-hourly";
    }
    const radio = document.getElementById(radioId);
    if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
        
        // Update styled selected class on cards
        const roomCards = document.querySelectorAll(".room-type-card");
        roomCards.forEach(c => c.classList.remove("selected"));
        const parentCard = radio.closest(".room-type-card");
        if (parentCard) {
            parentCard.classList.add("selected");
        }
    }

    // 5. Scroll to booking form
    const bookingForm = document.getElementById("booking-form");
    if (bookingForm) {
        setTimeout(() => {
            bookingForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    // 6. Show toast alert
    const zoneName = zone === 'private' ? 'ห้อง Private (รายชั่วโมง)' : 'โซนปกติ (รายชั่วโมง)';
    showToast(`เลือกวันที่ ${formatThaiDate(date)} เวลา ${time} น. (${zoneName}) ให้เรียบร้อยแล้ว กรอกชื่อและจองคิวได้เลย!`, "success");
}

// Bind utilities to window
window.showToast = showToast;
window.formatThaiDate = formatThaiDate;
window.getDurationText = getDurationText;
window.updatePrivateRoomAvailability = updatePrivateRoomAvailability;
window.initScheduleTab = initScheduleTab;
window.renderSchedule = renderSchedule;
window.handleQuickBook = handleQuickBook;

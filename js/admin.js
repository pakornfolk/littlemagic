// ==========================================================================
// Little Magic Board Game Cafe - Admin Dashboard Logic
// ==========================================================================

// Globals and APIs loaded from window.LittleMagicDB, window.showToast, window.formatThaiDate

const ADMIN_EMAIL = "littlemagic.official2025@gmail.com";
const ADMIN_PASSWORD = "admin1234";
let allBookings = [];
let currentFilter = "all";

// Elements
document.addEventListener("DOMContentLoaded", () => {
    initSecurity();
    initFilters();
    initBellNotification();
    initAdminQueueSubscription();
    displayDatabaseMode();

    // Initialize EmailJS if configured
    if (window.emailConfig && window.emailConfig.publicKey && window.emailConfig.publicKey !== "YOUR_EMAILJS_PUBLIC_KEY") {
        try {
            if (typeof emailjs !== 'undefined') {
                emailjs.init({ publicKey: window.emailConfig.publicKey });
                console.log("EmailJS SDK initialized.");
            }
        } catch (e) {
            console.error("Failed to initialize EmailJS:", e);
        }
    }
});

// 1. Authentication Security Overlay
function initSecurity() {
    const overlay = document.getElementById("admin-auth-overlay");
    const loginForm = document.getElementById("admin-login-form");
    
    if (!overlay) return;
    
    // Check if session is already authorized
    if (sessionStorage.getItem("lm_admin_auth") === "true") {
        overlay.style.display = "none";
        requestNotificationPermission();
        return;
    }
    
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById("admin-email").value.trim();
            const passwordInput = document.getElementById("admin-password").value;
            
            if (emailInput === ADMIN_EMAIL && passwordInput === ADMIN_PASSWORD) {
                showToast("เข้าสู่ระบบผู้ดูแลสำเร็จ", "success");
                sessionStorage.setItem("lm_admin_auth", "true");
                overlay.style.opacity = "0";
                setTimeout(() => {
                    overlay.style.display = "none";
                    requestNotificationPermission();
                }, 300);
            } else {
                showToast("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้งครับ", "error");
            }
        });
    }
}

// 2. Filter buttons binding
function initFilters() {
    const filterButtons = document.querySelectorAll(".filter-btn");
    
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            currentFilter = btn.dataset.filter;
            renderAdminDashboard();
        });
    });
}

// 2.2 Bell Notification click bind
function initBellNotification() {
    const bell = document.getElementById("admin-bell");
    if (!bell) return;
    
    bell.addEventListener("click", () => {
        const pendingFilterBtn = document.querySelector('.filter-btn[data-filter="pending"]');
        if (pendingFilterBtn) {
            pendingFilterBtn.click();
            showToast("แสดงรายการจองที่รออนุมัติทั้งหมด", "info");
        }
    });
}

// 3. Database subscription
function initAdminQueueSubscription() {
    LittleMagicDB.subscribeToBookings((bookings) => {
        // Detect if a new booking has arrived to trigger warning notification
        if (allBookings.length > 0 && bookings.length > allBookings.length) {
            // Find what booking is new
            const oldIds = allBookings.map(b => b.id);
            const newBookings = bookings.filter(b => !oldIds.includes(b.id));
            if (newBookings.length > 0 && newBookings[0].status === 'pending') {
                showToast(`คิวจองใหม่มาถึงแล้ว! รหัส: ${newBookings[0].bookingCode} คุณ ${newBookings[0].name}`, "info");
                // Play notification chime
                playNotificationSound();
                // Trigger desktop push notification
                triggerDesktopNotification(newBookings[0]);
            }
        }
        
        allBookings = bookings;
        calculateStats();
        renderAdminDashboard();
    });
}

// 4. Calculate Stats panel counts
function calculateStats() {
    const todayStr = new Date().toISOString().split("T")[0];
    
    // Filter stats for today
    const todayBookings = allBookings.filter(b => b.date === todayStr);
    
    const countPending = todayBookings.filter(b => b.status === 'pending').length;
    const countConfirmed = todayBookings.filter(b => b.status === 'confirmed').length;
    const countActive = todayBookings.filter(b => b.status === 'active').length;
    const countCompleted = todayBookings.filter(b => b.status === 'completed').length;
    
    const elements = {
        'stat-pending': countPending,
        'stat-confirmed': countConfirmed,
        'stat-active': countActive,
        'stat-completed': countCompleted
    };
    
    for (const [id, count] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = count;
    }
    
    // Update Notification Bell Badge (Shows count of ALL pending bookings)
    const bellBadge = document.getElementById("bell-badge");
    const bellIcon = document.querySelector(".admin-bell-container i");
    const totalPending = allBookings.filter(b => b.status === 'pending').length;
    
    if (bellBadge) {
        if (totalPending > 0) {
            bellBadge.textContent = totalPending;
            bellBadge.style.display = "flex";
            
            // Wiggle bell dynamically to alert
            if (bellIcon && !bellIcon.classList.contains("bell-wiggle")) {
                bellIcon.classList.add("bell-wiggle");
                setTimeout(() => {
                    bellIcon.classList.remove("bell-wiggle");
                }, 1000);
            }
        } else {
            bellBadge.style.display = "none";
        }
    }
}

// 5. Render list based on current active filter
function renderAdminDashboard() {
    const container = document.getElementById("admin-queue-list");
    if (!container) return;
    
    let filtered = [...allBookings];
    
    // Sort bookings: first by Date (earlier first) and then by Time
    filtered.sort((a, b) => {
        // Sort active/pending dates close to today
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA - dateB; // Chronological order
    });
    
    if (currentFilter !== "all") {
        filtered = filtered.filter(b => b.status === currentFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px 20px; color: var(--color-primary);">
                    <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 8px;"></i>
                    <p>ไม่มีรายการจองคิวในหมวดหมู่นี้</p>
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    filtered.forEach(booking => {
        const row = document.createElement("tr");
        row.className = `admin-row-status-${booking.status}`;
        
        let statusBadge = '';
        switch(booking.status) {
            case 'pending': statusBadge = '<span class="badge badge-pending">รออนุมัติ</span>'; break;
            case 'confirmed': statusBadge = '<span class="badge badge-confirmed">ยืนยันแล้ว</span>'; break;
            case 'active': statusBadge = '<span class="badge badge-active">กำลังเล่น</span>'; break;
            case 'completed': statusBadge = '<span class="badge badge-completed">เสร็จสิ้น</span>'; break;
            case 'cancelled': statusBadge = '<span class="badge badge-cancelled">ยกเลิก</span>'; break;
        }
        
        let areaBadge = '<span class="badge badge-room">Regular</span>';
        if (booking.roomType === 'private') {
            areaBadge = '<span class="badge badge-room private">Private</span>';
        } else if (booking.roomType === 'dnd') {
            const dmLabel = booking.dndDmRequest === 'yes' ? 'D&D (DM ร้าน)' : 'D&D (DM เอง)';
            areaBadge = `<span class="badge badge-room dnd" style="background-color: #582C83; color: white;">${dmLabel}</span>`;
        }
            
        // Construct Action Buttons
        let actionButtons = '';
        if (booking.status === 'pending') {
            actionButtons = `
                <button class="admin-btn admin-btn-confirm" data-id="${booking.id}">
                    <i class="fas fa-check"></i> อนุมัติ
                </button>
                <button class="admin-btn admin-btn-cancel" data-id="${booking.id}">
                    <i class="fas fa-times"></i> ปฏิเสธ
                </button>
            `;
        } else if (booking.status === 'confirmed') {
            actionButtons = `
                <button class="admin-btn admin-btn-checkin" data-id="${booking.id}">
                    <i class="fas fa-dice"></i> เช็คอิน
                </button>
                <button class="admin-btn admin-btn-cancel" data-id="${booking.id}">
                    <i class="fas fa-times"></i> ยกเลิก
                </button>
            `;
        } else if (booking.status === 'active') {
            actionButtons = `
                <button class="admin-btn admin-btn-complete" data-id="${booking.id}">
                    <i class="fas fa-door-open"></i> เคลียร์โต๊ะ
                </button>
            `;
        } else {
            actionButtons = `<span style="font-size:12px; color:var(--color-primary);">ไม่มีการดำเนินการ</span>`;
        }
        
        // Append delete button permanently to all bookings
        actionButtons += `
            <button class="admin-btn-delete-icon" data-id="${booking.id}" title="ลบคิวนี้อย่างถาวร">
                <div class="trash-bin">
                    <div class="trash-lid"></div>
                    <div class="trash-body"></div>
                </div>
            </button>
        `;
        
        row.innerHTML = `
            <td>
                <strong style="color:var(--color-accent-magic); font-family:monospace; font-size:14px;">${booking.bookingCode}</strong>
            </td>
            <td>
                <div style="font-weight: 600;">${booking.name}</div>
                <div style="font-size:12px; color: var(--color-primary);">${booking.phone}</div>
            </td>
            <td>
                <div>${formatThaiDate(booking.date)}</div>
                <div style="font-size:12px; color: var(--color-primary); font-weight:500;">เวลา: ${booking.time} น. (${getDurationText(booking.duration)})</div>
            </td>
            <td style="text-align: center;">${booking.players} คน</td>
            <td>${areaBadge}</td>
            <td>
                <strong>${booking.totalPrice} บาท</strong>
            </td>
            <td>${statusBadge}</td>
            <td>
                <div class="admin-action-btn-group">
                    ${actionButtons}
                </div>
            </td>
        `;
        
        // Event Listeners for actions
        bindActionButtons(row, booking);
        
        container.appendChild(row);
    });
}

function bindActionButtons(row, booking) {
    // Confirm
    const btnConfirm = row.querySelector(".admin-btn-confirm");
    if (btnConfirm) {
        btnConfirm.addEventListener("click", async () => {
            btnConfirm.disabled = true;
            const success = await LittleMagicDB.updateBookingStatus(booking.id, 'confirmed');
            if (success) {
                showToast(`อนุมัติการจองคิว ${booking.bookingCode} สำเร็จ`, "success");
                sendStatusEmailNotification(booking, 'confirmed');
            }
        });
    }
    
    // Check In
    const btnCheckin = row.querySelector(".admin-btn-checkin");
    if (btnCheckin) {
        btnCheckin.addEventListener("click", async () => {
            btnCheckin.disabled = true;
            const success = await LittleMagicDB.updateBookingStatus(booking.id, 'active');
            if (success) {
                showToast(`เช็คอินเข้าโต๊ะ ${booking.bookingCode} แล้ว`, "success");
                sendStatusEmailNotification(booking, 'active');
            }
        });
    }
    
    // Complete
    const btnComplete = row.querySelector(".admin-btn-complete");
    if (btnComplete) {
        btnComplete.addEventListener("click", async () => {
            btnComplete.disabled = true;
            const success = await LittleMagicDB.updateBookingStatus(booking.id, 'completed');
            if (success) showToast(`คิวจอง ${booking.bookingCode} เสร็จสิ้นการเล่น`, "success");
        });
    }
    
    // Cancel
    const btnCancel = row.querySelector(".admin-btn-cancel");
    if (btnCancel) {
        btnCancel.addEventListener("click", async () => {
            const confirmReject = confirm(`คุณแน่ใจหรือไม่ว่าต้องการยกเลิก/ปฏิเสธ คิวรหัส ${booking.bookingCode}?`);
            if (!confirmReject) return;
            
            btnCancel.disabled = true;
            const success = await LittleMagicDB.updateBookingStatus(booking.id, 'cancelled');
            if (success) {
                showToast(`ยกเลิกคิวรหัส ${booking.bookingCode} แล้ว`, "error");
                sendStatusEmailNotification(booking, 'cancelled');
            }
        });
    }
    
    // Delete Booking
    const btnDelete = row.querySelector(".admin-btn-delete-icon");
    if (btnDelete) {
        btnDelete.addEventListener("click", async () => {
            const confirmDelete = confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการจองคิวรหัส ${booking.bookingCode} อย่างถาวร?\nการดำเนินการนี้จะไม่สามารถย้อนกลับได้!`);
            if (!confirmDelete) return;
            
            btnDelete.disabled = true;
            const originalHtml = btnDelete.innerHTML;
            btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 12px; color: #FFFFFF;"></i>';
            
            const success = await LittleMagicDB.deleteBooking(booking.id);
            if (success) {
                showToast(`ลบข้อมูลการจองคิว ${booking.bookingCode} สำเร็จ`, "success");
            } else {
                showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error");
                btnDelete.disabled = false;
                btnDelete.innerHTML = originalHtml;
            }
        });
    }
}

// 6. DB Mode Banner (identical to main page)
function displayDatabaseMode() {
    let banner = document.getElementById("db-mode-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "db-mode-banner";
        document.body.insertBefore(banner, document.body.firstChild);
    }
    
    if (LittleMagicDB.dbMode === 'firebase') {
        banner.className = "db-mode-banner firebase-active";
        banner.innerHTML = `<i class="fas fa-cloud"></i> เชื่อมต่อผู้ดูแลระบบผ่านคลาวด์ Firebase | แผงการควบคุมแบบสด`;
    } else {
        banner.className = "db-mode-banner";
        banner.innerHTML = `<i class="fas fa-laptop-code"></i> โหมดเดโมภายใน (Offline Mode) | ข้อมูลแผงแอดมินจำลองจากในเครื่อง | <a href="js/firebase-config.js" style="color:var(--color-primary-dark); font-weight:600; text-decoration:underline;">เปิดใช้ Firebase Cloud</a>`;
    }
}

// Play notification sound helper (using synthesized Web Audio API so it works without loading audio file assets!)
function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Play twin-bell chime
        const playTone = (frequency, startTime, duration) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(frequency, startTime);
            
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        
        const now = audioCtx.currentTime;
        playTone(523.25, now, 0.4); // C5
        playTone(659.25, now + 0.15, 0.6); // E5
    } catch (e) {
        console.log("Audio notification block, required interaction first:", e);
    }
}

// Request browser permission for native push notifications
function requestNotificationPermission() {
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    showToast("เปิดใช้งานการแจ้งเตือนบนหน้าจอคอมพิวเตอร์แล้ว", "success");
                }
            });
        }
    }
}

// Trigger a native browser notification on desktop
function triggerDesktopNotification(booking) {
    if ("Notification" in window && Notification.permission === "granted") {
        const area = booking.roomType === 'dnd' ? 'ห้อง Private D&D' : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)');
        const title = `🎲 Little Magic - คิวจองใหม่เข้ามา!`;
        const options = {
            body: `คุณ ${booking.name} ได้จองคิววันที่ ${formatThaiDate(booking.date)} เวลา ${booking.time} น. (${area})`,
            icon: 'img/logo.jpg',
            silent: true // Since we play our own custom chime, let's keep the notification quiet
        };
        try {
            new Notification(title, options);
        } catch (e) {
            console.error("Failed to show desktop notification:", e);
        }
    }
}

// Send Email Notification via EmailJS
async function sendStatusEmailNotification(booking, newStatus) {
    if (!booking.email) {
        console.log(`No email address configured for booking ${booking.bookingCode}. Skipping notification.`);
        return;
    }

    if (!window.emailConfig || !window.emailConfig.publicKey || window.emailConfig.publicKey === "YOUR_EMAILJS_PUBLIC_KEY") {
        console.warn("EmailJS is not configured or still using placeholder keys. Skipping notification.");
        return;
    }

    try {
        let statusTextTh = "";
        let statusDetailTh = "";
        switch (newStatus) {
            case 'confirmed':
                statusTextTh = "ยืนยันการจองเรียบร้อยแล้ว";
                statusDetailTh = "ร้าน Little Magic ได้ยืนยันคิวของคุณแล้ว กรุณาเดินทางมาถึงก่อนเวลานัด 5-10 นาทีนะครับ";
                break;
            case 'cancelled':
                statusTextTh = "ยกเลิกคิวแล้ว";
                statusDetailTh = "คิวการจองนี้ถูกยกเลิกแล้ว หากไม่ใช่การดำเนินการของคุณ โปรดติดต่อทางร้านผ่าน Line ID: @843audre";
                break;
            default:
                return; // Do not send email for other statuses
        }

        const templateParams = {
            to_email: booking.email,
            to_name: booking.name,
            booking_code: booking.bookingCode,
            status_text: statusTextTh,
            status_detail: statusDetailTh,
            date: formatThaiDate(booking.date),
            time: booking.time,
            players: booking.players,
            room_type: booking.roomType === 'dnd' ? 'ห้อง Private D&D' : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)'),
            price: booking.totalPrice
        };

        if (typeof emailjs !== 'undefined') {
            await emailjs.send(
                window.emailConfig.serviceId,
                window.emailConfig.templateId,
                templateParams
            );
            console.log(`Email notification sent successfully for status: ${newStatus}`);
        } else {
            console.error("EmailJS SDK not found. Cannot send email.");
        }
    } catch (error) {
        console.error("Failed to send email notification:", error);
    }
}

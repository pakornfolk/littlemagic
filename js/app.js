// ==========================================================================
// Little Magic Board Game Cafe - Customer Application Logic
// ==========================================================================

// Database APIs are loaded globally via window.LittleMagicDB

// Rates definitions
const RATE_REGULAR_HOUR = 40;  // 40 THB per hour per person
const RATE_REGULAR_DAY = 150;  // 150 THB per day per person
const RATE_PRIVATE_HOUR = 60;  // 60 THB per hour per person
const RATE_PRIVATE_DAY = 250;  // 250 THB per day per person

// TODO: Confirm if D&D price is 250 THB per person or per group. Currently set to 250 THB per person.
const RATE_DND_PLAY = 250;
// TODO: Confirm DM session fee. Currently set to 1500 THB per session.
const RATE_DND_DM_SESSION = 1500;

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

    // Clean up mock booking if it exists in local storage
    const localData = localStorage.getItem("lm_bookings");
    if (localData) {
        let currentBookings = JSON.parse(localData);
        const filtered = currentBookings.filter(b => b.bookingCode !== 'LM-99999');
        if (filtered.length !== currentBookings.length) {
            localStorage.setItem("lm_bookings", JSON.stringify(filtered));
        }
    }

    initParkingModal();
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

    const modeBtnBoardgame = document.getElementById("mode-boardgame");
    const modeBtnDnd = document.getElementById("mode-dnd");
    const roomSelectorGroup = document.getElementById("room-selector-group");
    let activeMode = 'boardgame';

    if (modeBtnBoardgame && modeBtnDnd) {
        modeBtnBoardgame.addEventListener("click", () => {
            modeBtnBoardgame.classList.add("active");
            modeBtnDnd.classList.remove("active");
            activeMode = 'boardgame';
            
            // Show room selector group
            if (roomSelectorGroup) roomSelectorGroup.style.display = "";
            
            // Select regular hourly by default
            const regularHourlyRadio = document.getElementById("room-regular-hourly");
            if (regularHourlyRadio) {
                regularHourlyRadio.checked = true;
                roomCards.forEach(c => c.classList.remove("selected"));
                const card = document.querySelector('.room-type-card[for="room-regular-hourly"]');
                if (card) card.classList.add("selected");
                toggleDurationField(regularHourlyRadio.value);
            }
            calculatePrice();
        });

        modeBtnDnd.addEventListener("click", () => {
            modeBtnDnd.classList.add("active");
            modeBtnBoardgame.classList.remove("active");
            activeMode = 'dnd';
            
            // Hide room selector group
            if (roomSelectorGroup) roomSelectorGroup.style.display = "none";
            
            // Trigger UI toggling for D&D
            toggleDurationField('private_dnd');
            calculatePrice();

            // Trigger date picker validation for D&D constraints
            if (inputDate) {
                inputDate.dispatchEvent(new Event('change'));
            }
        });
    }

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

    // Helper to show/hide the duration selection dropdown and adjust UI for D&D
    function toggleDurationField(selectedValue) {
        const timeWrapper = document.getElementById("booking-time-wrapper");
        const dndSessionWrapper = document.getElementById("booking-dnd-session-wrapper");
        const dndOptionsWrapper = document.getElementById("dnd-options-wrapper");
        const durationWrapper = document.getElementById("duration-wrapper");
        const dndStyleWrapper = document.getElementById("booking-dnd-style-wrapper");
        const timeInput = document.getElementById("booking-time");
        const dndSessionInput = document.getElementById("booking-dnd-session");

        // TODO: Confirm if D&D should use fixed session blocks or free selection.
        if (selectedValue === 'private_dnd') {
            // D&D Mode: Swap check-in time with session blocks, hide duration selector
            if (timeWrapper) timeWrapper.style.display = "none";
            if (dndSessionWrapper) dndSessionWrapper.style.display = "";
            if (dndOptionsWrapper) dndOptionsWrapper.style.display = "block";
            if (durationWrapper) durationWrapper.style.display = "none";
            if (dndStyleWrapper) dndStyleWrapper.style.display = "";

            if (timeInput) timeInput.required = false;
            if (dndSessionInput) dndSessionInput.required = true;

            // Restrict players to 4-6 for D&D
            if (inputPlayers) {
                inputPlayers.min = "4";
                inputPlayers.max = "6";
                const val = parseInt(inputPlayers.value) || 4;
                if (val < 4) inputPlayers.value = "4";
                if (val > 6) inputPlayers.value = "6";
            }
        } else {
            // Normal Mode: Restore standard inputs
            if (timeWrapper) timeWrapper.style.display = "";
            if (dndSessionWrapper) dndSessionWrapper.style.display = "none";
            if (dndOptionsWrapper) dndOptionsWrapper.style.display = "none";
            if (durationWrapper) durationWrapper.style.display = "";
            if (dndStyleWrapper) dndStyleWrapper.style.display = "none";

            if (timeInput) timeInput.required = true;
            if (dndSessionInput) dndSessionInput.required = false;

            // Restore normal player limits
            if (inputPlayers) {
                inputPlayers.min = "2";
                inputPlayers.max = "20";
            }

            if (selectedValue.endsWith('_daily')) {
                inputDuration.style.display = "none";
                durationDayText.style.display = "block";
            } else {
                inputDuration.style.display = "block";
                durationDayText.style.display = "none";
            }
        }
    }

    // Dynamic price calculation helper
    function calculatePrice() {
        const selectedRadio = document.querySelector('input[name="roomSelect"]:checked');
        
        let val = 'regular_hourly';
        if (activeMode === 'dnd') {
            val = 'private_dnd';
        } else {
            if (!selectedRadio) return 0;
            val = selectedRadio.value;
        }
        const players = parseInt(inputPlayers.value) || 1;

        let pricePerPerson = 0;
        let extraDmFee = 0;

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
        } else if (val === 'private_dnd') {
            pricePerPerson = RATE_DND_PLAY;
            extraDmFee = 0; // Professional DM is always included in the per-person price
        }

        const total = (pricePerPerson * players) + extraDmFee;
        priceDisplay.textContent = total.toLocaleString();
        return total;
    }

    // Bind price recalculations
    inputDuration.addEventListener("change", calculatePrice);
    if (inputPlayers) {
        inputPlayers.addEventListener("change", calculatePrice);
        inputPlayers.addEventListener("input", calculatePrice);
    }

    // Bind D&D DM selection changes to price calculation
    const dndDmRadios = document.querySelectorAll('input[name="dndDmSelect"]');
    dndDmRadios.forEach(radio => {
        radio.addEventListener("change", calculatePrice);
    });

    // Bind date change to private room availability check and Thursday/Monday block
    if (inputDate) {
        inputDate.addEventListener("change", () => {
            const dateVal = inputDate.value;
            if (dateVal) {
                const dayOfWeek = new Date(dateVal).getDay(); // 0 is Sunday, 1 is Monday, 4 is Thursday
                
                const revertDate = () => {
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
                };

                if (dayOfWeek === 4) {
                    showToast("ขออภัยครับ ร้านปิดทำการทุกวันพฤหัสบดี กรุณาเลือกวันอื่นนะครับ", "error");
                    revertDate();
                    return;
                }

                if (activeMode === 'dnd') {
                    if (dayOfWeek === 1) {
                        showToast("ขออภัยครับ บริการ D&D งดให้บริการในวันจันทร์ กรุณาเลือกวันอื่นนะครับ", "error");
                        revertDate();
                        return;
                    }

                    // Check if date is at least 2 days from today
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const bookingDate = new Date(dateVal);
                    bookingDate.setHours(0, 0, 0, 0);
                    const diffTime = bookingDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays < 2) {
                        showToast("ขออภัยครับ การเล่น D&D จำเป็นต้องจองล่วงหน้าอย่างน้อย 2 วัน เพื่อจัดเตรียมความพร้อมครับ", "error");
                        revertDate();
                        return;
                    }
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

        const selectedRadio = document.querySelector('input[name="roomSelect"]:checked');
        if (activeMode !== 'dnd' && !selectedRadio) {
            showToast("กรุณาเลือกพื้นที่บริการ", "error");
            return;
        }

        const val = activeMode === 'dnd' ? 'private_dnd' : selectedRadio.value;
        let roomType = 'regular';
        if (val === 'private_dnd') {
            roomType = 'dnd';
        } else if (val.startsWith('private')) {
            roomType = 'private';
        }

        let time = document.getElementById("booking-time").value;
        let duration = val.endsWith('daily') ? 'day' : inputDuration.value;
        let dndDmRequest = 'yes'; // D&D always includes a professional DM
        let dndPlayStyle = '';

        if (val === 'private_dnd') {
            const dndSession = document.getElementById("booking-dnd-session").value; // e.g. "15:00-19:00"
            time = dndSession.split('-')[0]; // "15:00" or "20:00"
            duration = '4'; // D&D session is 4 hours
            dndPlayStyle = document.getElementById("booking-dnd-style").value;

            // Validate D&D players (4-6)
            const numPlayers = parseInt(players) || 0;
            if (numPlayers < 4 || numPlayers > 6) {
                showToast("ห้อง Private D&D จำกัดจำนวนผู้เล่น 4-6 คนเท่านั้นครับ", "error");
                return;
            }
        }

        // Check overlap/conflict client-side first
        const hasConflict = cachedBookings.some(b => {
            if (b.date !== date) return false;
            if (b.status === 'cancelled' || b.status === 'completed') return false;

            // Keep regular separate from private/dnd
            if (roomType === 'regular') {
                if (b.roomType !== 'regular') return false;
            } else {
                if (b.roomType !== 'private' && b.roomType !== 'dnd') return false;
            }

            const [h1, m1] = time.split(":").map(Number);
            const start1 = (h1 - 15) * 60 + m1;
            const dur1 = duration === 'day' ? 540 : (parseInt(duration) * 60);
            const end1 = start1 + dur1;

            const [h2, m2] = b.time.split(":").map(Number);
            const start2 = (h2 - 15) * 60 + m2;
            const dur2 = b.duration === 'day' ? 540 : (parseInt(b.duration) * 60);
            const end2 = start2 + dur2;

            return (start1 < end2 && start2 < end1);
        });

        if (hasConflict) {
            const areaName = roomType === 'regular' ? 'โซนปกติ' : 'ห้อง Private';
            showToast(`ขออภัยครับ ${areaName} ถูกจองในช่วงเวลาดังกล่าวแล้ว โปรดตรวจสอบตารางคิว`, "error");
            return;
        }

        // Thursday/Monday and 2-day lead block validation
        if (date) {
            const dayOfWeek = new Date(date).getDay();
            if (dayOfWeek === 4) {
                showToast("ขออภัยครับ ร้านปิดทำการทุกวันพฤหัสบดี", "error");
                return;
            }

            if (roomType === 'dnd') {
                if (dayOfWeek === 1) { // Monday is 1
                    showToast("ขออภัยครับ บริการ D&D งดให้บริการในวันจันทร์", "error");
                    return;
                }

                // Must book D&D at least 2 days in advance
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const bookingDate = new Date(date);
                bookingDate.setHours(0, 0, 0, 0);
                const diffTime = bookingDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 2) {
                    showToast("ขออภัยครับ การเล่น D&D จำเป็นต้องจองล่วงหน้าอย่างน้อย 2 วัน เพื่อให้ DM จัดเตรียมอุปกรณ์ครับ", "error");
                    return;
                }
            }
        }

        // Opening Hours validation (15:00 - 24:00) - Only for non-D&D
        if (time && val !== 'private_dnd') {
            const [hours, minutes] = time.split(":").map(Number);
            if (hours < 15) {
                showToast("ขออภัยครับ ร้านเปิดให้บริการเวลา 15:00 น. - 24:00 น. เท่านั้นครับ", "error");
                return;
            }
        }

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
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

        try {
            // Set button to loading
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังจองคิว...';
            }

            const booking = await LittleMagicDB.addBooking({
                name,
                phone,
                email,
                players,
                roomType,
                date,
                time,
                duration,
                totalPrice,
                dndDmRequest,
                dndPlayStyle
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

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }

        } catch (error) {
            console.error("Booking creation failed:", error);
            showToast(error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง", "error");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    });
}

// Render booking confirmation overlay modal
function showBookingSuccess(booking) {
    const modal = document.createElement("div");
    modal.className = "admin-login-overlay"; // Reuse overlay style
    modal.style.position = "fixed";
    
    const lineUrl = `https://line.me/R/oaMessage/@843audre/?${encodeURIComponent(
        `สวัสดีครับ ต้องการยืนยันการจองคิว\nรหัสจอง: ${booking.bookingCode}\nผู้จอง: คุณ ${booking.name}\nวันที่เล่น: ${formatThaiDate(booking.date)}\nเวลา: ${booking.time} น. (${getDurationText(booking.duration)})\nพื้นที่: ${booking.roomType === 'dnd' ? `ห้อง Private D&D (${booking.dndPlayStyle || ''})` : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)')}\nจำนวนผู้เล่น: ${booking.players} คน`
    )}`;

    modal.innerHTML = `
        <div class="admin-login-box" style="max-width: 480px; text-align: left;">
            <div style="text-align: center; margin-bottom: 20px; color: var(--color-status-active);">
                <i class="fas fa-check-circle" style="font-size: 56px;"></i>
                <h2 style="margin-top: 15px; color: var(--color-primary-dark);">จองคิวสำเร็จ (รอการยืนยัน)</h2>
                <p style="color: var(--color-primary); font-size: 13px; margin-top: 4px;">
                    ระบบกำลังนำคุณไปยัง LINE ใน <strong id="redirect-timer" style="color: var(--color-accent-magic); font-size: 16px;">5</strong> วินาที...
                </p>
            </div>
            
            <div style="background: #FFF9F2; border: 1px dashed var(--color-status-pending); border-radius: var(--border-radius-sm); padding: 12px; font-size: 12px; color: #B25E00; margin-bottom: 20px; display: flex; gap: 8px; align-items: flex-start;">
                <i class="fas fa-exclamation-triangle" style="margin-top: 2.5px;"></i>
                <div>
                    <strong>โปรดทราบ:</strong> ท่านจำเป็นต้องส่งรายละเอียดการจองนี้ไปที่ LINE OA เพื่อให้แอดมินตรวจสอบและ<strong>ทำการอนุมัติสิทธิ์จองคิว</strong>ให้เสร็จสมบูรณ์ค่ะ
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
                    <span>${booking.roomType === 'dnd' ? 'ห้อง Private D&D' : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)')}</span>
                </div>
                ${booking.roomType === 'dnd' && booking.dndPlayStyle ? `
                <div class="booking-detail-row">
                    <span>รูปแบบการเล่น</span>
                    <strong style="color: var(--color-primary-dark);">${booking.dndPlayStyle}</strong>
                </div>
                ` : ''}
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
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                <a href="${lineUrl}" target="_blank" id="confirm-line-btn" class="btn" style="background-color: #06C755; color: white; width: 100%; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 15px; padding: 12px 20px; border-radius: 50px; box-shadow: 0 4px 12px rgba(6, 199, 85, 0.3); text-align: center;">
                    <i class="fab fa-line" style="font-size: 22px;"></i> ส่งข้อความยืนยันคิวผ่าน LINE ทันที
                </a>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup auto-redirect countdown (5 seconds)
    let secondsLeft = 5;
    const timerSpan = document.getElementById("redirect-timer");
    
    const redirectTimer = setInterval(() => {
        secondsLeft--;
        if (timerSpan) timerSpan.innerText = secondsLeft;
        
        if (secondsLeft <= 0) {
            clearInterval(redirectTimer);
            // Perform redirect in the same window to prevent popup blockers
            window.location.href = lineUrl;
            
            // Clean up modal and switch UI behind the scenes
            modal.remove();
            const lookupTabBtn = document.querySelector('.tab-btn[data-tab="lookup"]');
            if (lookupTabBtn) {
                lookupTabBtn.click();
                document.getElementById("lookup-search").value = booking.phone;
                document.getElementById("lookup-btn").click();
            }
        }
    }, 1000);

    // If user clicks manually, clear timer and close modal instantly (opens LINE in new window as target="_blank")
    document.getElementById("confirm-line-btn").addEventListener("click", () => {
        clearInterval(redirectTimer);
        setTimeout(() => {
            modal.remove();
            // Switch user to inquiry tab automatically to see their booking!
            const lookupTabBtn = document.querySelector('.tab-btn[data-tab="lookup"]');
            if (lookupTabBtn) {
                lookupTabBtn.click();
                document.getElementById("lookup-search").value = booking.phone;
                document.getElementById("lookup-btn").click();
            }
        }, 500);
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
        switch (booking.status) {
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
                <span>${booking.roomType === 'dnd' ? 'ห้อง Private D&D' : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)')}</span>
            </div>
            ${booking.roomType === 'dnd' && booking.dndPlayStyle ? `
            <div class="booking-detail-row">
                <span>รูปแบบการเล่น</span>
                <strong style="color: var(--color-primary-dark);">${booking.dndPlayStyle}</strong>
            </div>
            ` : ''}
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
                <div class="cancellation-note" style="background:#FFF8F0; color:#B25E00; border-color: rgba(244,162,97,0.2); display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                    <span style="display: flex; align-items: center; gap: 6px; font-weight: 500;">
                        <i class="fas fa-exclamation-triangle"></i> ไม่สามารถยกเลิกได้ เนื่องจากเหลือเวลาน้อยกว่า 1 วัน (24 ชั่วโมง)
                    </span>
                    <a href="https://line.me/R/ti/p/@843audre" target="_blank" class="btn" style="width: 100%; box-sizing: border-box; height: 42px; padding: 0 16px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-color: #06C755; background: #06C755; color: #FFFFFF; text-decoration: none; margin-top: 4px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s ease;">
                        <i class="fab fa-line" style="font-size: 20px;"></i> หากต้องการยกเลิก กรุณาติดต่อผ่าน Line
                    </a>
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
            const occupiedCount = bookings.filter(b => (b.roomType === 'private' || b.roomType === 'dnd') && b.status === 'active').length;
            privateRoomsCount.textContent = `${occupiedCount}/1`;
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
            switch (booking.status) {
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

            let areaBadge = '<span class="badge badge-room"><i class="fas fa-couch"></i> โซนปกติ</span>';
            if (booking.roomType === 'private') {
                areaBadge = '<span class="badge badge-room private"><i class="fas fa-door-closed"></i> ห้อง Private</span>';
            } else if (booking.roomType === 'dnd') {
                areaBadge = '<span class="badge badge-room dnd" style="background-color: #582C83; color: white;"><i class="fas fa-dice-d20"></i> ห้อง D&D</span>';
            }

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

    // Check if there is a daily booking on the selected date (which blocks the entire day)
    const hasDailyBooking = bookings.some(b => 
        b.date === selectedDate && 
        (b.roomType === 'private' || b.roomType === 'dnd') && 
        (b.status === 'pending' || b.status === 'confirmed' || b.status === 'active') &&
        b.duration === 'day'
    );

    // Count active private rooms today (including D&D sessions since they share the same rooms)
    const activePrivateCount = bookings.filter(b => (b.roomType === 'private' || b.roomType === 'dnd') && b.status === 'active').length;
    const availablePrivateRooms = Math.max(0, 1 - activePrivateCount);

    const isFullOnSelectedDate = (selectedDate === todayStr && availablePrivateRooms === 0) || hasDailyBooking;

    const hourlyCard = document.querySelector('.room-type-card[for="room-private-hourly"]');
    const dailyCard = document.querySelector('.room-type-card[for="room-private-daily"]');
    const dndCard = document.querySelector('.room-type-card[for="room-private-dnd"]');

    const hourlyRadio = document.getElementById("room-private-hourly");
    const dailyRadio = document.getElementById("room-private-daily");

    const regularHourlyRadio = document.getElementById("room-regular-hourly");
    const regularHourlyCard = document.querySelector('.room-type-card[for="room-regular-hourly"]');

    const occupancyTexts = document.querySelectorAll(".private-occupancy-text");

    if (isFullOnSelectedDate) {
        occupancyTexts.forEach(el => {
            if (hasDailyBooking) {
                el.innerHTML = `<span style="color: var(--color-status-cancelled); font-weight: 600;"><i class="fas fa-exclamation-circle"></i> เต็มแล้ววันนี้ (มีจองเหมารายวัน)</span>`;
            } else {
                el.innerHTML = `<span style="color: var(--color-status-cancelled); font-weight: 600;"><i class="fas fa-exclamation-circle"></i> เต็มแล้ววันนี้ (0/1)</span>`;
            }
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
        if (dndCard) {
            dndCard.style.opacity = "0.5";
            dndCard.style.pointerEvents = "none";
            dndCard.style.cursor = "not-allowed";
        }

        // If Private room is selected, auto-select Regular Hourly
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
            calculatePrice();
        }
    } else {
        occupancyTexts.forEach(el => {
            if (selectedDate === todayStr) {
                el.innerHTML = `<span style="color: var(--color-status-active); font-weight: 600;"><i class="fas fa-check-circle"></i> ห้องว่างวันนี้: ${availablePrivateRooms}/1</span>`;
            } else {
                el.innerHTML = `<span style="color: var(--color-primary); font-weight: 500;"><i class="far fa-check-circle"></i> จองล่วงหน้าได้ (ว่าง 1/1)</span>`;
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
        if (dndCard) {
            dndCard.style.opacity = "1";
            dndCard.style.pointerEvents = "auto";
            dndCard.style.cursor = "pointer";
        }
    }
}

// Send Email notifications when a customer cancels a booking
async function sendCancellationEmails(booking) {
    if (LittleMagicDB.dbMode !== 'firebase') {
        console.log("Offline local mode detected. Skipping cancellation email alerts to save credits.");
        return;
    }

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
            room_type: booking.roomType === 'dnd' ? `ห้อง Private D&D (${booking.dndPlayStyle || ''})` : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)'),
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
    if (LittleMagicDB.dbMode !== 'firebase') {
        console.log("Offline local mode detected. Skipping new booking email alerts to save credits.");
        return;
    }

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
            status_detail: `คุณ ${booking.name} ได้จองคิวเข้ามาใหม่ in ระบบ กรุณาตรวจสอบข้อมูลและกดยืนยันคิวในระบบหลังบ้าน`,
            date: formatThaiDate(booking.date),
            time: booking.time,
            players: booking.players,
            room_type: booking.roomType === 'dnd' ? `ห้อง Private D&D (${booking.dndPlayStyle || ''})` : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)'),
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
    if (LittleMagicDB.dbMode !== 'firebase') {
        return;
    }

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
            room_type: booking.roomType === 'dnd' ? `ห้อง Private D&D (${booking.dndPlayStyle || ''})` : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)'),
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
    const types = ['boardgame', 'dnd'];
    types.forEach(type => {
        const scheduleDateInput = document.getElementById(`schedule-${type}-date`);
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
    });

    // Render schedule initially
    renderSchedule();
}

// Helper: format slot index to displayable time (HH:MM)
function getSlotTime(index) {
    const mins = index * 30;
    const h = Math.floor(mins / 60) + 15;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Helper to calculate slot occupancy [startSlot, endSlot]
function getBookingSlotRange(booking) {
    const [h, m] = booking.time.split(":").map(Number);
    const startMin = (h - 15) * 60 + m;
    const durMin = (booking.duration === 'day') ? 540 : (booking.duration * 60);
    const startSlot = Math.max(0, Math.floor(startMin / 30));
    const endSlot = Math.min(18, Math.ceil((startMin + durMin) / 30) + 1);
    return { startSlot, endSlot };
}

// Helper to calculate booking end time string (HH:MM)
function getBookingEndTime(booking) {
    if (booking.duration === 'day') return '24:00';
    const [h, m] = booking.time.split(":").map(Number);
    const endHour = h + parseInt(booking.duration);
    return `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function renderSchedule() {
    renderScheduleSection('boardgame');
    renderScheduleSection('dnd');
}

function renderScheduleSection(type) {
    const scheduleDateInput = document.getElementById(`schedule-${type}-date`);
    if (!scheduleDateInput) return;

    const selectedDate = scheduleDateInput.value;
    if (!selectedDate) return;

    // Filter active bookings (pending, confirmed, active) for selectedDate.
    // Fetch all active bookings on this date; we will filter by roomType when populating timeline rows and list cards.
    const activeBookings = cachedBookings.filter(b =>
        b.date === selectedDate &&
        (b.status === 'pending' || b.status === 'confirmed' || b.status === 'active')
    );

    // 1. Calculate & Render Vibe Meter
    const vibeBadge = document.getElementById(`vibe-${type}-badge`);
    const vibeText = document.getElementById(`vibe-${type}-text`);
    const vibeGaugeFill = document.getElementById(`vibe-${type}-gauge-fill`);

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
            // We count all active bookings for this date (both board game and dnd) to show true shop status
            const totalActiveShopBookings = cachedBookings.filter(b =>
                b.date === selectedDate &&
                (b.status === 'pending' || b.status === 'confirmed' || b.status === 'active')
            ).length;

            let levelClass = "level-chill";
            let widthPct = "15%";
            let badgeTxt = "ชิลสบายๆ 🟢";
            let descTxt = "ร้านค่อนข้างโล่ง เล่นบอร์ดเกมแนวไหนก็มีสมาธิ!";

            if (totalActiveShopBookings >= 2 && totalActiveShopBookings <= 3) {
                levelClass = "level-good";
                widthPct = "45%";
                badgeTxt = "กำลังสนุก 🟡";
                descTxt = "บรรยากาศกำลังดี มีเสียงหัวเราะรอบโต๊ะเป็นกันเอง";
            } else if (totalActiveShopBookings >= 4 && totalActiveShopBookings <= 5) {
                levelClass = "level-lively";
                widthPct = "75%";
                badgeTxt = "ครึกครื้น 🟠";
                descTxt = "ผู้เล่นเยอะ บรรยากาศบอร์ดเกมคาเฟ่เต็มพิกัด!";
            } else if (totalActiveShopBookings >= 6) {
                levelClass = "level-peak";
                widthPct = "100%";
                badgeTxt = "ปาร์ตี้สุดเหวี่ยง 🔥";
                descTxt = "คนแน่นร้าน! แนะนำรีบจองก่อนโต๊ะเต็ม";
            }

            vibeBadge.textContent = badgeTxt;
            vibeBadge.style.backgroundColor = "";
            vibeBadge.style.color = "";

            if (totalActiveShopBookings < 2) {
                vibeBadge.className = "badge badge-active";
            } else if (totalActiveShopBookings <= 3) {
                vibeBadge.className = "badge badge-pending";
            } else if (totalActiveShopBookings <= 5) {
                vibeBadge.className = "badge badge-lively";
            } else {
                vibeBadge.className = "badge badge-cancelled";
            }

            vibeText.textContent = descTxt;
            vibeGaugeFill.className = `vibe-gauge-fill ${levelClass}`;
            vibeGaugeFill.style.width = widthPct;
        }
    }

    // Helper: render blocks into a row element
    const renderRowBlocks = (rowElement, slotsArray, zoneType, isClosed, selectedDate) => {
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
                const startSlot = i;
                const bookingId = booking.id;
                while (i < 18 && slotsArray[i] && slotsArray[i].id === bookingId) {
                    i++;
                }
                const endSlot = i;

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

                const spanColumns = endSlot - startSlot;
                if (spanColumns >= 2) {
                    block.innerHTML = `<span style="font-size: 11px; white-space: nowrap; font-weight: 700;">${booking.time}-${endTimeStr}</span>`;
                } else {
                    block.innerHTML = `<span style="font-size: 10px; font-weight: 700;">จอง</span>`;
                }

                rowElement.appendChild(block);
            } else {
                const block = document.createElement("div");
                const slotTimeStr = getSlotTime(i);
                block.className = "time-block free";
                block.style.gridColumn = `${i + 1}`;
                block.title = `เวลา ${slotTimeStr} น. (ว่าง - คลิกเพื่อจองเลย)`;
                block.innerHTML = `<span style="font-size: 10px; font-weight: 700;">ว่าง</span>`;

                block.addEventListener("click", () => {
                    handleQuickBook(selectedDate, slotTimeStr, zoneType);
                });

                rowElement.appendChild(block);
                i++;
            }
        }
    };

    // 2. Render Timeline Blocks
    if (type === 'boardgame') {
        const rowRegular = document.getElementById("timeline-row-boardgame-regular");
        const rowPrivate = document.getElementById("timeline-row-boardgame-private");

        if (rowRegular && rowPrivate) {
            rowRegular.innerHTML = '';
            rowPrivate.innerHTML = '';

            const isClosed = new Date(selectedDate).getDay() === 4;

            // Slots
            const regularSlots = Array(18).fill(null);
            const privateSlots = Array(18).fill(null);

            activeBookings.forEach(booking => {
                const { startSlot, endSlot } = getBookingSlotRange(booking);
                // Both 'private' and 'dnd' roomTypes occupy the Private room timeline row
                const slotsArray = booking.roomType === 'regular' ? regularSlots : privateSlots;
                for (let i = startSlot; i < endSlot; i++) {
                    if (i < 18) {
                        slotsArray[i] = booking;
                    }
                }
            });

            renderRowBlocks(rowRegular, regularSlots, 'regular', isClosed, selectedDate);
            renderRowBlocks(rowPrivate, privateSlots, 'private', isClosed, selectedDate);
        }
    } else {
        // dnd type
        const rowDnd = document.getElementById("timeline-row-dnd-private");
        if (rowDnd) {
            rowDnd.innerHTML = '';
            const isClosed = new Date(selectedDate).getDay() === 4;

            const dndSlots = Array(18).fill(null);
            activeBookings.forEach(booking => {
                // Both 'dnd' and 'private' roomTypes occupy the D&D private room timeline row
                if (booking.roomType === 'dnd' || booking.roomType === 'private') {
                    const { startSlot, endSlot } = getBookingSlotRange(booking);
                    for (let i = startSlot; i < endSlot; i++) {
                        if (i < 18) {
                            dndSlots[i] = booking;
                        }
                    }
                }
            });

            renderRowBlocks(rowDnd, dndSlots, 'dnd', isClosed, selectedDate);
        }
    }

    // 3. Render Detailed Queue Cards for Selected Date
    const queueListHolder = document.getElementById(`schedule-${type}-queue-list`);
    if (!queueListHolder) return;

    queueListHolder.innerHTML = '';

    // Filter, sort bookings based on tab type
    const activeDetails = activeBookings.filter(b => 
        type === 'boardgame' ? (b.roomType === 'regular' || b.roomType === 'private') : b.roomType === 'dnd'
    );
    activeDetails.sort((a, b) => {
        const timeA = a.time.split(":").map(Number);
        const timeB = b.time.split(":").map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    if (activeDetails.length === 0) {
        const textEmpty = type === 'boardgame' ? 'วันนี้ยังไม่มีคิวจองเล่นบอร์ดเกม' : 'วันนี้ยังไม่มีคิวจองเล่น D&D';
        queueListHolder.innerHTML = `
            <div class="empty-queue" style="grid-column: 1/-1; padding: 30px;">
                <i class="fas fa-calendar-check" style="font-size: 32px; color: var(--color-primary-light); margin-bottom: 8px;"></i>
                <p style="font-family: var(--font-heading); font-size: 14px; font-weight:600;">${textEmpty}</p>
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

        const areaName = booking.roomType === 'dnd' ? 'ห้อง Private D&D' : (booking.roomType === 'private' ? 'ห้อง Private (ส่วนตัว)' : 'โซนปกติ (Regular Area)');
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

    // 3. Handle Mode and room selections
    if (zone === 'dnd') {
        const modeBtnDnd = document.getElementById("mode-dnd");
        if (modeBtnDnd) {
            modeBtnDnd.click();
        }

        const dndSessionSelect = document.getElementById("booking-dnd-session");
        if (dndSessionSelect) {
            // Find closest D&D 4-hour round
            const startHour = parseInt(time.split(":")[0]) || 15;
            if (startHour <= 17) {
                dndSessionSelect.value = "15:00-19:00";
            } else {
                dndSessionSelect.value = "20:00-24:00";
            }
            dndSessionSelect.dispatchEvent(new Event('change'));
        }
    } else {
        const modeBtnBoardgame = document.getElementById("mode-boardgame");
        if (modeBtnBoardgame) {
            modeBtnBoardgame.click();
        }

        // Set time select
        const bookingTimeSelect = document.getElementById("booking-time");
        if (bookingTimeSelect) {
            bookingTimeSelect.value = time;
            bookingTimeSelect.dispatchEvent(new Event('change'));
        }

        // Set room type radio
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
    }

    // 4. Scroll to booking form
    const bookingForm = document.getElementById("booking-form");
    if (bookingForm) {
        setTimeout(() => {
            bookingForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
    }

    // 5. Show toast alert
    let zoneName = 'โซนปกติ (รายชั่วโมง)';
    if (zone === 'private') zoneName = 'ห้อง Private (รายชั่วโมง)';
    else if (zone === 'dnd') zoneName = 'ห้อง Private D&D';
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

// Initialize Parking & directions modal
function initParkingModal() {
    const parkingMenuBtn = document.getElementById("parking-menu-btn");
    const parkingModal = document.getElementById("parking-modal");
    const closeParkingBtn = document.getElementById("close-parking-modal");
    
    if (parkingMenuBtn && parkingModal) {
        parkingMenuBtn.addEventListener("click", () => {
            parkingModal.style.display = "flex";
            document.body.style.overflow = "hidden"; // Prevent background scroll
        });
    }
    
    if (closeParkingBtn && parkingModal) {
        closeParkingBtn.addEventListener("click", () => {
            parkingModal.style.display = "none";
            document.body.style.overflow = ""; // Re-enable background scroll
        });
    }

    // Close parking modal on clicking outside the box
    if (parkingModal) {
        parkingModal.addEventListener("click", (e) => {
            if (e.target === parkingModal) {
                parkingModal.style.display = "none";
                document.body.style.overflow = "";
            }
        });
    }
}

// Global lightbox functions
window.openLightbox = function(src) {
    const lightbox = document.getElementById("parking-lightbox");
    const img = document.getElementById("lightbox-img");
    if (lightbox && img) {
        // Only open if the image has loaded successfully
        const activeImg = document.querySelector(`.parking-img-container img[src="${src}"]`);
        if (activeImg && activeImg.style.display !== 'none') {
            img.src = src;
            lightbox.style.display = "flex";
        }
    }
};

window.closeLightbox = function() {
    const lightbox = document.getElementById("parking-lightbox");
    if (lightbox) {
        lightbox.style.display = "none";
    }
};


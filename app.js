/**
 * Main Application Logic
 * รองรับการดึงข้อมูลจาก GAS API, ระบบ Mock Data สำหรับ Local Dev,
 * การคำนวณวันคงเหลือ/Overdue, ฟิลเตอร์แผนก, และโหมดจัดการสำหรับ ผอ./Admin
 */

// Application State
let appData = {
  tasks: [],
  settings: {},
  visitorCount: 0,
  scriptOwnerEmail: "",
  currentUserRole: null // 'director' | 'admin' | null
};

// Filter State
let currentFilter = {
  department: "all",
  category: "all",
  status: "all",
  search: "",
  sortBy: "deadline" // 'deadline' | 'priority' | 'progress'
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

/**
 * 1. Initialize & Fetch Data
 */
async function initApp() {
  showLoading(true);
  try {
    let data = null;

    // ตรวจสอบว่าอยู่ในสภาพแวดล้อมที่ต่อ API ได้จริงหรือไม่
    const isMockUrl = !APP_CONFIG.GAS_API_URL || APP_CONFIG.GAS_API_URL.includes("MOCK_REPLACE");
    if (!isMockUrl) {
      try {
        // กำหนด Timeout 10 วินาที เพื่อป้องกันค้างกรณีเน็ตช้า
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${APP_CONFIG.GAS_API_URL}?action=getInitData`, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
        }
      } catch (err) {
        console.warn("ไม่สามารถดึงข้อมูลจาก GAS API ได้:", err);
      }
    }

    // หากต่อ API ไม่ได้ หรือเปิดโหมด Mock ให้ใช้ Mock Data
    if (!data || data.status !== "success") {
      if (typeof MOCK_INITIAL_DATA !== "undefined" && APP_CONFIG.USE_MOCK_FALLBACK) {
        data = MOCK_INITIAL_DATA;
        console.info("⚡ รันในโหมด Mock Data สำรอง");
      }
    }

    if (data) {
      appData.tasks = data.tasks || [];
      appData.settings = data.settings || {};
      appData.visitorCount = data.visitorCount || 0;
      appData.scriptOwnerEmail = data.scriptOwnerEmail || "";

      renderBranding();
      populateDropdowns();
      renderKPIs();
      renderTasks();
      updateLineBriefText();
    }
  } catch (error) {
    console.error("Initialization error:", error);
  } finally {
    // ปิด Loading Overlay เสมอ
    showLoading(false);
  }
}

/**
 * 2. Render Dynamic Branding & Settings
 */
function renderBranding() {
  const s = appData.settings;
  if (s.APP_TITLE) document.getElementById("app-title").innerText = s.APP_TITLE;
  if (s.APP_SUBTITLE) document.getElementById("app-subtitle").innerText = s.APP_SUBTITLE;
  
  // Header External Link
  const headerBtn = document.getElementById("header-ext-link");
  if (s.HEADER_LINK_URL && headerBtn) {
    headerBtn.href = s.HEADER_LINK_URL;
    headerBtn.innerText = s.HEADER_LINK_TITLE || "ลิงก์ภายนอก";
    headerBtn.classList.remove("d-none");
  }

  // Announcement Banner
  const banner = document.getElementById("announcement-banner");
  const bannerText = document.getElementById("announcement-text");
  const isAnnounce = s.ANNOUNCEMENT_ENABLED === true || s.ANNOUNCEMENT_ENABLED === "TRUE" || s.ANNOUNCEMENT_ENABLED === "true";
  if (isAnnounce && s.ANNOUNCEMENT_TEXT) {
    bannerText.innerText = s.ANNOUNCEMENT_TEXT;
    banner.classList.remove("d-none");
  } else {
    banner.classList.add("d-none");
  }

  // Footer Text
  if (s.FOOTER_TEXT) {
    document.getElementById("footer-text").innerText = s.FOOTER_TEXT;
  }
  document.getElementById("visitor-count").innerText = Number(appData.visitorCount).toLocaleString();
}

/**
 * 3. Populate Filters & Form Dropdowns
 */
function populateDropdowns() {
  const s = appData.settings;
  const deptList = s.departmentList || [];
  const catList = s.categoryList || [];

  // Filter Dept Select
  const deptFilter = document.getElementById("filter-department");
  deptFilter.innerHTML = '<option value="all">🏢 ทุกแผนก/หน่วยงาน</option>';
  deptList.forEach(d => {
    deptFilter.innerHTML += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
  });

  // Filter Category Select
  const catFilter = document.getElementById("filter-category");
  catFilter.innerHTML = '<option value="all">📁 ทุกหมวดหมู่</option>';
  catList.forEach(c => {
    catFilter.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  });

  // Task Form Dropdowns
  const taskDeptSelect = document.getElementById("task-dept-input");
  taskDeptSelect.innerHTML = '<option value="">-- กรุณาเลือกแผนก --</option>';
  deptList.forEach(d => {
    taskDeptSelect.innerHTML += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
  });

  const taskCatSelect = document.getElementById("task-cat-input");
  taskCatSelect.innerHTML = '<option value="">-- กรุณาเลือกหมวดหมู่ --</option>';
  catList.forEach(c => {
    taskCatSelect.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  });
}

/**
 * 4. Render KPI Counters
 */
function renderKPIs() {
  const tasks = appData.tasks.filter(t => t.isPublished !== false);
  const now = new Date().setHours(0, 0, 0, 0);

  let total = tasks.length;
  let done = 0;
  let inProgress = 0;
  let overdue = 0;

  tasks.forEach(t => {
    const isDone = t.status === "เสร็จสิ้น" || t.progress >= 100;
    if (isDone) {
      done++;
    } else {
      inProgress++;
      if (t.endDateRaw && t.endDateRaw < now) {
        overdue++;
      }
    }
  });

  document.getElementById("kpi-total").innerText = total;
  document.getElementById("kpi-done").innerText = done;
  document.getElementById("kpi-pending").innerText = inProgress;
  document.getElementById("kpi-overdue").innerText = overdue;
}

/**
 * 5. Render Tasks List
 */
function renderTasks() {
  const container = document.getElementById("tasks-container");
  const filtered = filterTasks();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fas fa-clipboard-list fa-3x mb-3 text-secondary opacity-50"></i>
        <h5>ไม่พบภารกิจที่ตรงกับเงื่อนไขการค้นหา</h5>
        <p class="small">ลองเปลี่ยนตัวเลือกแผนก หรือคำค้นหาใหม่</p>
      </div>`;
    return;
  }

  const now = new Date().setHours(0, 0, 0, 0);

  let html = "";
  filtered.forEach(item => {
    // คำนวณวันคงเหลือ / สถานะ Overdue
    const isDone = item.status === "เสร็จสิ้น" || item.progress >= 100;
    let countdownHtml = "";
    
    if (isDone) {
      countdownHtml = `<span class="countdown-badge" style="background:#dcfce7; color:#15803d;"><i class="fas fa-check"></i> เสร็จสิ้นแล้ว</span>`;
    } else if (item.endDateRaw) {
      const diffTime = item.endDateRaw - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        countdownHtml = `<span class="countdown-badge countdown-overdue"><i class="fas fa-exclamation-circle"></i> เลยกำหนด ${Math.abs(diffDays)} วัน</span>`;
      } else if (diffDays === 0) {
        countdownHtml = `<span class="countdown-badge countdown-soon"><i class="fas fa-clock"></i> ครบกำหนดวันนี้!</span>`;
      } else if (diffDays <= 3) {
        countdownHtml = `<span class="countdown-badge countdown-soon"><i class="fas fa-hourglass-half"></i> เหลืออีก ${diffDays} วัน</span>`;
      } else {
        countdownHtml = `<span class="countdown-badge countdown-safe"><i class="far fa-calendar-alt"></i> เหลืออีก ${diffDays} วัน</span>`;
      }
    } else {
      countdownHtml = `<span class="countdown-badge countdown-safe">-</span>`;
    }

    // Priority Class
    let priorityClass = "priority-normal";
    if (item.priority && item.priority.includes("ด่วน")) priorityClass = "priority-urgent";
    else if (item.priority && item.priority.includes("สำคัญ")) priorityClass = "priority-high";

    // Action buttons
    const actionBtn = item.actionLink ? `
      <a href="${item.actionLink}" target="_blank" class="btn btn-sm btn-primary rounded-pill px-3 fw-bold">
        <i class="fas fa-external-link-alt me-1"></i>ส่งงาน/แบบฟอร์ม
      </a>` : "";

    const docBtn = item.docLink ? `
      <a href="${item.docLink}" target="_blank" class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold">
        <i class="far fa-file-alt me-1"></i>เอกสารแนบ
      </a>` : "";

    // Edit button for Director/Admin
    const editBtn = appData.currentUserRole ? `
      <button class="btn btn-sm btn-light border rounded-pill px-3 text-secondary ms-auto" onclick="openEditTaskModal('${item.id}')">
        <i class="fas fa-edit me-1"></i>จัดการงาน
      </button>` : "";

    html += `
      <div class="task-card ${priorityClass}">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span class="badge-dept"><i class="fas fa-building me-1 text-primary"></i>${escapeHtml(item.department || "ไม่ระบุแผนก")}</span>
          <span class="badge bg-light text-secondary border">${escapeHtml(item.category || "ทั่วไป")}</span>
          <span class="badge ${getPriorityBadgeClass(item.priority)}">${escapeHtml(item.priority || "📌 ปกติ")}</span>
          <div class="ms-auto">${countdownHtml}</div>
        </div>

        <h5 class="fw-bold text-dark my-2" style="line-height: 1.4;">${escapeHtml(item.taskName)}</h5>

        ${item.directorNote ? `
          <div class="alert alert-warning py-1 px-3 small rounded-3 my-2 mb-3 d-flex align-items-center gap-2">
            <i class="fas fa-bullhorn text-warning"></i>
            <div><strong>ข้อสั่งการ ผอ.:</strong> ${escapeHtml(item.directorNote)}</div>
          </div>` : ""}

        <div class="row align-items-center g-2 mt-2">
          <div class="col-md-5">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="small text-muted fw-bold">ความคืบหน้า:</span>
              <span class="small fw-extrabold ${item.progress >= 100 ? 'text-success' : 'text-primary'}">${item.progress}%</span>
            </div>
            <div class="progress" style="height: 8px; border-radius: 6px;">
              <div class="progress-bar ${item.progress >= 100 ? 'bg-success' : 'bg-primary'}" role="progressbar" style="width: ${item.progress}%;"></div>
            </div>
          </div>

          <div class="col-md-3">
            <div class="small text-muted"><i class="far fa-calendar-check me-1"></i>กำหนดส่ง: <strong>${item.endDate || "-"}</strong></div>
          </div>

          <div class="col-md-4 d-flex align-items-center gap-2 justify-content-md-end flex-wrap">
            ${actionBtn}
            ${docBtn}
            ${editBtn}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function filterTasks() {
  return appData.tasks.filter(t => {
    if (t.isPublished === false && !appData.currentUserRole) return false;

    // Dept filter
    if (currentFilter.department !== "all" && t.department !== currentFilter.department) {
      return false;
    }
    // Category filter
    if (currentFilter.category !== "all" && t.category !== currentFilter.category) {
      return false;
    }
    // Status filter
    if (currentFilter.status === "done" && t.status !== "เสร็จสิ้น" && t.progress < 100) return false;
    if (currentFilter.status === "pending" && (t.status === "เสร็จสิ้น" || t.progress >= 100)) return false;
    if (currentFilter.status === "overdue") {
      const now = new Date().setHours(0, 0, 0, 0);
      if (t.progress >= 100 || !t.endDateRaw || t.endDateRaw >= now) return false;
    }

    // Search filter
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      const matchName = (t.taskName || "").toLowerCase().includes(q);
      const matchDept = (t.department || "").toLowerCase().includes(q);
      const matchNote = (t.directorNote || "").toLowerCase().includes(q);
      if (!matchName && !matchDept && !matchNote) return false;
    }

    return true;
  }).sort((a, b) => {
    if (currentFilter.sortBy === "deadline") {
      return (a.endDateRaw || 9999999999999) - (b.endDateRaw || 9999999999999);
    } else if (currentFilter.sortBy === "progress") {
      return b.progress - a.progress;
    }
    return 0;
  });
}

function onFilterChange() {
  currentFilter.department = document.getElementById("filter-department").value;
  currentFilter.category = document.getElementById("filter-category").value;
  currentFilter.status = document.getElementById("filter-status").value;
  currentFilter.search = document.getElementById("search-input").value.trim();
  currentFilter.sortBy = document.getElementById("sort-by").value;
  renderTasks();
}

/**
 * 6. Hybrid LINE Copy Feature (Zero-Quota)
 */
function updateLineBriefText() {
  const tasks = appData.tasks.filter(t => t.isPublished !== false && t.progress < 100);
  const now = new Date().setHours(0, 0, 0, 0);

  // คัดกรองงาน Overdue หรือส่งใน 3 วัน
  const urgentTasks = tasks.filter(t => {
    if (t.priority && t.priority.includes("ด่วน")) return true;
    if (t.endDateRaw) {
      const diffDays = Math.ceil((t.endDateRaw - now) / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
    }
    return false;
  });

  const todayStr = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  let brief = `📢 [แจ้งเตือนภารกิจสำคัญ - กฟฉ.1]\nประจำวันที่ ${todayStr}\n\n`;

  if (urgentTasks.length === 0) {
    brief += `✅ ไม่มีงานค้างเกินกำหนด หรือภารกิจเร่งด่วนในขณะนี้ ขอบคุณทุกท่านที่ร่วมมือครับ ✨\n`;
  } else {
    brief += `⚠️ รายการงานที่ต้องติดตามเร่งด่วน / ใกล้ครบกำหนด (${urgentTasks.length} รายการ):\n`;
    urgentTasks.slice(0, 8).forEach((t, i) => {
      const diffDays = t.endDateRaw ? Math.ceil((t.endDateRaw - now) / (1000 * 60 * 60 * 24)) : null;
      let timeText = t.endDate ? `(กำหนดส่ง: ${t.endDate})` : "";
      if (diffDays !== null && diffDays < 0) timeText = `🔴 [เลยกำหนด ${Math.abs(diffDays)} วัน!]`;
      else if (diffDays === 0) timeText = `⚡ [ครบกำหนดวันนี้!]`;

      brief += `${i + 1}. [${t.priority || "ด่วน"}] ${t.taskName}\n   🏢 ${t.department || "ทุกแผนก"} ${timeText}\n`;
      if (t.actionLink) brief += `   🔗 ส่งงาน: ${t.actionLink}\n`;
    });
  }

  brief += `\n👉 ตรวจสอบสถานะแดชบอร์ดฉบับเต็มได้ที่:\n📱 ${window.location.href.split("#")[0]}`;
  document.getElementById("line-brief-textarea").value = brief;
}

function copyLineBrief() {
  const textarea = document.getElementById("line-brief-textarea");
  textarea.select();
  textarea.setSelectionRange(0, 99999); // Mobile
  navigator.clipboard.writeText(textarea.value).then(() => {
    alert("📋 คัดลอกข้อความสรุปเรียบร้อยแล้ว!\nสามารถนำไปกด Paste (วาง) ส่งในกลุ่ม LINE 15 คนได้ทันที ไม่เสียโควตาข้อความ");
  }).catch(err => {
    alert("ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดเลือกข้อความแล้วคัดลอกด้วยตนเอง");
  });
}

/**
 * 7. Role Authentication (Director / Admin PIN)
 */
function openAuthModal() {
  const modal = new bootstrap.Modal(document.getElementById("authModal"));
  document.getElementById("auth-pin-input").value = "";
  modal.show();
}

function verifyPin() {
  const pin = document.getElementById("auth-pin-input").value.trim();
  const dirPin = (appData.settings.DIRECTOR_PIN || APP_CONFIG.DEFAULT_DIRECTOR_PIN).toString().trim();
  const adminPin = (appData.settings.ADMIN_PIN || APP_CONFIG.DEFAULT_ADMIN_PIN).toString().trim();

  if (pin === adminPin) {
    appData.currentUserRole = "admin";
    enterManagementMode();
  } else if (pin === dirPin) {
    appData.currentUserRole = "director";
    enterManagementMode();
  } else {
    alert("❌ รหัส PIN ไม่ถูกต้อง");
  }
}

function enterManagementMode() {
  bootstrap.Modal.getInstance(document.getElementById("authModal")).hide();
  document.getElementById("btn-auth-open").classList.add("d-none");
  document.getElementById("btn-logout").classList.remove("d-none");
  document.getElementById("management-bar").classList.remove("d-none");

  // Show/Hide Admin Tab
  const adminTabBtn = document.getElementById("tab-admin-btn");
  if (appData.currentUserRole === "admin") {
    adminTabBtn.classList.remove("d-none");
    populateAdminSettingsForm();
  } else {
    adminTabBtn.classList.add("d-none");
  }

  // Switch to management tab
  switchTab("director");
  renderTasks();
}

function logout() {
  appData.currentUserRole = null;
  document.getElementById("btn-auth-open").classList.remove("d-none");
  document.getElementById("btn-logout").classList.add("d-none");
  document.getElementById("management-bar").classList.add("d-none");
  switchTab("public");
  renderTasks();
}

function switchTab(tab) {
  document.querySelectorAll(".app-tab-panel").forEach(p => p.classList.add("d-none"));
  document.querySelectorAll(".tab-nav-btn").forEach(b => b.classList.remove("active"));

  if (tab === "public") {
    document.getElementById("panel-public").classList.remove("d-none");
  } else if (tab === "director") {
    document.getElementById("panel-director").classList.remove("d-none");
    document.getElementById("tab-director-btn").classList.add("active");
  } else if (tab === "admin") {
    document.getElementById("panel-admin").classList.remove("d-none");
    document.getElementById("tab-admin-btn").classList.add("active");
  }
}

/**
 * 8. Task CRUD Operations
 */
function openNewTaskModal() {
  document.getElementById("task-form").reset();
  document.getElementById("task-id-input").value = "";
  document.getElementById("task-modal-title").innerText = "➕ สั่งการ / มอบหมายภารกิจใหม่ (ผอ.)";
  new bootstrap.Modal(document.getElementById("taskModal")).show();
}

function openEditTaskModal(taskId) {
  const item = appData.tasks.find(t => t.id === taskId);
  if (!item) return;

  document.getElementById("task-id-input").value = item.id;
  document.getElementById("task-name-input").value = item.taskName || "";
  document.getElementById("task-dept-input").value = item.department || "";
  document.getElementById("task-cat-input").value = item.category || "";
  document.getElementById("task-end-input").value = item.endDate || "";
  document.getElementById("task-priority-input").value = item.priority || "📌 ปกติ";
  document.getElementById("task-status-input").value = item.status || "รอดำเนินการ";
  document.getElementById("task-progress-input").value = item.progress || 0;
  document.getElementById("task-action-input").value = item.actionLink || "";
  document.getElementById("task-doc-input").value = item.docLink || "";
  document.getElementById("task-note-input").value = item.directorNote || "";

  document.getElementById("task-modal-title").innerText = `✏️ จัดการภารกิจ (${item.id})`;
  new bootstrap.Modal(document.getElementById("taskModal")).show();
}

async function saveTask() {
  const taskId = document.getElementById("task-id-input").value;
  const taskData = {
    taskName: document.getElementById("task-name-input").value.trim(),
    department: document.getElementById("task-dept-input").value,
    category: document.getElementById("task-cat-input").value,
    endDate: document.getElementById("task-end-input").value.trim(),
    priority: document.getElementById("task-priority-input").value,
    status: document.getElementById("task-status-input").value,
    progress: parseFloat(document.getElementById("task-progress-input").value) || 0,
    actionLink: document.getElementById("task-action-input").value.trim(),
    docLink: document.getElementById("task-doc-input").value.trim(),
    directorNote: document.getElementById("task-note-input").value.trim()
  };

  if (!taskData.taskName) {
    alert("กรุณาระบุชื่องาน/ภารกิจ");
    return;
  }

  showLoading(true);
  try {
    const isEdit = !!taskId;
    const action = isEdit ? "updateTask" : "createTask";

    // ถ้าเชื่อมต่อ GAS API
    const isMock = APP_CONFIG.GAS_API_URL.includes("MOCK_REPLACE");
    if (!isMock) {
      const res = await fetch(APP_CONFIG.GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({ action, taskId, taskData })
      });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
    } else {
      // Mock Local Update
      if (isEdit) {
        const idx = appData.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) Object.assign(appData.tasks[idx], taskData);
      } else {
        const newId = "T-" + (appData.tasks.length + 1001);
        appData.tasks.unshift({ id: newId, ...taskData, isPublished: true });
      }
    }

    bootstrap.Modal.getInstance(document.getElementById("taskModal")).hide();
    alert("✅ บันทึกข้อมูลภารกิจเรียบร้อยแล้ว");
    renderKPIs();
    renderTasks();
    updateLineBriefText();
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
  } finally {
    showLoading(false);
  }
}

/**
 * 9. Admin Settings Operations & Drive Auth Check
 */
function populateAdminSettingsForm() {
  const s = appData.settings;
  document.getElementById("setting-title").value = s.APP_TITLE || "";
  document.getElementById("setting-subtitle").value = s.APP_SUBTITLE || "";
  document.getElementById("setting-announcement").value = s.ANNOUNCEMENT_TEXT || "";
  document.getElementById("setting-announce-enable").checked = s.ANNOUNCEMENT_ENABLED === "TRUE";
  document.getElementById("setting-link-title").value = s.HEADER_LINK_TITLE || "";
  document.getElementById("setting-link-url").value = s.HEADER_LINK_URL || "";
  document.getElementById("setting-footer").value = s.FOOTER_TEXT || "";
  document.getElementById("setting-departments").value = s.DEPARTMENTS || "";
  document.getElementById("setting-categories").value = s.CATEGORIES || "";
  document.getElementById("setting-drive-id").value = s.DRIVE_FOLDER_ID || "";
  document.getElementById("setting-dir-pin").value = s.DIRECTOR_PIN || "";
  document.getElementById("setting-admin-pin").value = s.ADMIN_PIN || "";
}

async function saveAdminSettings() {
  const newSettings = {
    APP_TITLE: document.getElementById("setting-title").value.trim(),
    APP_SUBTITLE: document.getElementById("setting-subtitle").value.trim(),
    ANNOUNCEMENT_TEXT: document.getElementById("setting-announcement").value.trim(),
    ANNOUNCEMENT_ENABLED: document.getElementById("setting-announce-enable").checked ? "TRUE" : "FALSE",
    HEADER_LINK_TITLE: document.getElementById("setting-link-title").value.trim(),
    HEADER_LINK_URL: document.getElementById("setting-link-url").value.trim(),
    FOOTER_TEXT: document.getElementById("setting-footer").value.trim(),
    DEPARTMENTS: document.getElementById("setting-departments").value.trim(),
    CATEGORIES: document.getElementById("setting-categories").value.trim(),
    DRIVE_FOLDER_ID: document.getElementById("setting-drive-id").value.trim(),
    DIRECTOR_PIN: document.getElementById("setting-dir-pin").value.trim(),
    ADMIN_PIN: document.getElementById("setting-admin-pin").value.trim()
  };

  const adminPin = appData.settings.ADMIN_PIN || APP_CONFIG.DEFAULT_ADMIN_PIN;

  showLoading(true);
  try {
    const isMock = APP_CONFIG.GAS_API_URL.includes("MOCK_REPLACE");
    if (!isMock) {
      const res = await fetch(APP_CONFIG.GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "saveSettings", settings: newSettings, adminPin })
      });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
    } else {
      Object.assign(appData.settings, newSettings);
      appData.settings.departmentList = newSettings.DEPARTMENTS.split(",").map(s => s.trim()).filter(Boolean);
      appData.settings.categoryList = newSettings.CATEGORIES.split(",").map(s => s.trim()).filter(Boolean);
    }

    alert("✅ บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!");
    renderBranding();
    populateDropdowns();
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการบันทึกการตั้งค่า: " + err.message);
  } finally {
    showLoading(false);
  }
}

async function verifyDrivePermission() {
  const folderId = document.getElementById("setting-drive-id").value.trim();
  if (!folderId) {
    alert("กรุณาระบุ Google Drive Folder ID ก่อนกดตรวจสอบ");
    return;
  }

  showLoading(true);
  try {
    const isMock = APP_CONFIG.GAS_API_URL.includes("MOCK_REPLACE");
    if (!isMock) {
      const res = await fetch(`${APP_CONFIG.GAS_API_URL}?action=checkDrivePermission&folderId=${encodeURIComponent(folderId)}`);
      const json = await res.json();
      alert(json.message);
    } else {
      alert(`✅ [โหมดทดสอบ] ยืนยันสิทธิ์สำเร็จ!\nระบบสามารถเข้าถึงโฟลเดอร์ ID: ${folderId}\n(หากต่อระบบจริงแล้วเป็นของ Gmail อื่น ระบบจะแนะนำการแชร์สิทธิ์ให้อัตโนมัติ)`);
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการตรวจสอบ: " + err.message);
  } finally {
    showLoading(false);
  }
}

async function autoProvisionDatabase() {
  if (!confirm("ต้องการสร้าง/ซ่อมแซมตาราง Tasks และ Settings ใน Google Sheets ใหม่อัตโนมัติใช่หรือไม่?")) {
    return;
  }

  showLoading(true);
  try {
    const isMock = APP_CONFIG.GAS_API_URL.includes("MOCK_REPLACE");
    if (!isMock) {
      const res = await fetch(`${APP_CONFIG.GAS_API_URL}?action=setup`);
      const json = await res.json();
      alert(json.message);
    } else {
      alert("✅ [โหมดทดสอบ] ตรวจสอบและสร้างโครงสร้างตารางเรียบร้อยแล้ว!");
    }
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Utility Helpers
 */
function showLoading(show) {
  const el = document.getElementById("loading-overlay");
  if (el) el.classList.toggle("d-none", !show);
}

function getPriorityBadgeClass(p) {
  if (p && p.includes("ด่วน")) return "bg-danger";
  if (p && p.includes("สำคัญ")) return "bg-warning text-dark";
  return "bg-primary";
}

function escapeHtml(str) {
  if (!str) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

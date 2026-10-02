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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

/**
 * 1. Initialize & Fetch Data
 */
async function initApp() {
  setStatus("กำลังเชื่อมต่อ...");

  // Phase 3.2 — Render Loading Skeleton ก่อนโหลดข้อมูล
  const taskContainer = document.getElementById("tasks-container");
  if (taskContainer) taskContainer.innerHTML = renderSkeletonHtml(3);

  // Phase 3.6 — Register PWA Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(e => console.log("SW register:", e));
  }

  // Phase 2.6 — Autofocus ช่องชื่องานเมื่อ Task Modal เปิด
  const taskModalEl = document.getElementById("taskModal");
  if (taskModalEl && !taskModalEl.dataset.autofocusBound) {
    taskModalEl.dataset.autofocusBound = "true";
    taskModalEl.addEventListener("shown.bs.modal", () => {
      const nameInput = document.getElementById("task-name-input");
      if (nameInput) nameInput.focus();
    });
  }

  // Safety net: ถ้า 12 วินาทีผ่านไปยังไม่เสร็จ ให้บังคับซ่อน overlay
  const safetyTimer = setTimeout(() => {
    showLoading(false);
    setStatus("⚠️ Timeout - ใช้ข้อมูลสำรอง");
    console.warn("Safety timer triggered after 12s");
  }, 12000);

  try {
    let data = null;
    let source = "";

    const isMockUrl = !APP_CONFIG.GAS_API_URL || APP_CONFIG.GAS_API_URL.includes("MOCK_REPLACE");

    if (!isMockUrl) {
      setStatus("กำลังดึงข้อมูลจาก GAS...");
      try {
        const fetchPromise = fetch(APP_CONFIG.GAS_API_URL + "?action=getInitData", {
          method: "GET",
          redirect: "follow"
        }).then(res => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout 10s")), 10000)
        );

        data = await Promise.race([fetchPromise, timeoutPromise]);
        source = "GAS API";
      } catch (err) {
        console.warn("GAS API ไม่ตอบสนอง:", err.message);
        setStatus("⚠️ GAS API ไม่ตอบ → ใช้ Mock Data");
        data = null;
      }
    }

    // Fallback: ใช้ Mock Data ถ้า API ไม่ตอบหรือ URL เป็น Mock
    if (!data || data.status !== "success") {
      if (typeof MOCK_INITIAL_DATA !== "undefined") {
        data = MOCK_INITIAL_DATA;
        source = "Mock Data (Local)";
        setStatus("⚡ ใช้ Mock Data สำรอง");
      }
    }

    if (data) {
      appData.tasks    = data.tasks    || [];
      appData.settings = data.settings || {};
      appData.visitorCount     = data.visitorCount     || 0;
      appData.scriptOwnerEmail = data.scriptOwnerEmail || "";

      try { renderBranding();      } catch(e) { console.error("renderBranding:", e); }
      try { populateDropdowns();   } catch(e) { console.error("populateDropdowns:", e); }
      try { renderKPIs();          } catch(e) { console.error("renderKPIs:", e); }
      try { renderTasks();         } catch(e) { console.error("renderTasks:", e); }
      try { renderDirectorTasks(); } catch(e) { console.error("renderDirectorTasks:", e); }
      try { updateLineBriefText(); } catch(e) { console.error("updateLineBriefText:", e); }
      try { renderActivityLogs();  } catch(e) { console.error("renderActivityLogs:", e); }

      setStatus("✅ โหลดสำเร็จ | " + appData.tasks.length + " งาน | " + source);
    } else {
      setStatus("❌ ไม่มีข้อมูล");
    }
  } catch (error) {
    console.error("initApp error:", error);
    setStatus("❌ Error: " + error.message);
  } finally {
    clearTimeout(safetyTimer);
    showLoading(false);
    syncDebugBadgeVisibility(); // Phase 1.4 — ซ่อน badge จาก Public
  }
}

function setStatus(msg) {
  // Phase 1.4 — Debug badge เฉพาะ Admin เท่านั้น
  // ระหว่างโหลดให้อัปเดตได้เพื่อ Debug แต่หลังโหลดจะซ่อน badge ถ้าไม่ใช่ Admin
  const el = document.getElementById("app-load-status");
  if (el) el.textContent = msg;
}

function syncDebugBadgeVisibility() {
  // ซ่อน Version Badge จาก Public — แสดงเฉพาะเมื่อ Login เป็น Admin
  const badge = document.getElementById("app-version-badge");
  if (!badge) return;
  if (appData.currentUserRole === "admin") {
    badge.style.display = "";
  } else {
    badge.style.display = "none";
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

  // 1.6 — Dynamic document.title
  if (s.APP_TITLE) {
    document.title = s.APP_TITLE + " — ระบบติดตามภารกิจ";
  }
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

  // Phase 2.2 — Update active state on KPI cards
  renderKPIActiveState();
}

function renderKPIActiveState() {
  const map = {
    all: "kpi-card-total",
    done: "kpi-card-done",
    pending: "kpi-card-pending",
    overdue: "kpi-card-overdue"
  };
  Object.values(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("kpi-active");
  });
  const activeId = map[currentFilter.status];
  if (activeId) {
    const activeEl = document.getElementById(activeId);
    if (activeEl) activeEl.classList.add("kpi-active");
  }
}

/**
 * Phase 3.2 — Render Loading Skeleton Placeholder
 */
function renderSkeletonHtml(count = 3) {
  let s = "";
  for (let i = 0; i < count; i++) {
    s += `
      <div class="skeleton-card">
        <div class="d-flex align-items-center gap-2 mb-3">
          <div class="skeleton-shimmer" style="width: 110px; height: 26px;"></div>
          <div class="skeleton-shimmer" style="width: 80px; height: 26px;"></div>
          <div class="skeleton-shimmer ms-auto" style="width: 100px; height: 26px;"></div>
        </div>
        <div class="skeleton-shimmer mb-2" style="width: 70%; height: 22px;"></div>
        <div class="row align-items-center g-2 mt-3">
          <div class="col-md-5">
            <div class="skeleton-shimmer" style="width: 100%; height: 8px;"></div>
          </div>
          <div class="col-md-3">
            <div class="skeleton-shimmer" style="width: 120px; height: 16px;"></div>
          </div>
          <div class="col-md-4 d-flex justify-content-md-end gap-2">
            <div class="skeleton-shimmer" style="width: 90px; height: 32px; border-radius: 20px;"></div>
          </div>
        </div>
      </div>`;
  }
  return s;
}

/**
 * Phase 3.3 — Modular Task Card HTML with Expandable Details Pane
 */
function renderTaskCardHtml(item, isDirectorView = false) {
  const now = new Date().setHours(0, 0, 0, 0);
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
    <a href="${item.actionLink}" target="_blank" class="btn btn-sm btn-pea-primary rounded-pill px-3 fw-bold shadow-sm">
      <i class="fas fa-external-link-alt me-1"></i>ส่งงาน/แบบฟอร์ม
    </a>` : "";

  const docBtn = item.docLink ? `
    <a href="${item.docLink}" target="_blank" class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold">
      <i class="far fa-file-alt me-1"></i>เอกสารแนบ
    </a>` : "";

  // Edit button for Director/Admin
  const canManage = isDirectorView || !!appData.currentUserRole;
  const editBtn = canManage ? `
    <button class="btn btn-sm btn-light border rounded-pill px-3 text-secondary ms-auto" onclick="openEditTaskModal('${item.id}')">
      <i class="fas fa-edit me-1"></i>จัดการงาน
    </button>` : "";

  return `
    <div class="task-card ${priorityClass}">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span class="badge-dept"><i class="fas fa-bolt me-1" style="color: #f59e0b;"></i>${escapeHtml(item.department || "ไม่ระบุแผนก")}</span>
        <span class="badge bg-light text-secondary border">${escapeHtml(item.category || "ทั่วไป")}</span>
        <span class="badge ${getPriorityBadgeClass(item.priority)}">${escapeHtml(item.priority || "📌 ปกติ")}</span>
        <div class="ms-auto">${countdownHtml}</div>
      </div>

      <h5 class="fw-bold text-dark my-2" style="line-height: 1.4;">${escapeHtml(item.taskName)}</h5>

      ${item.directorNote ? `
        <div class="alert alert-warning py-1 px-3 small rounded-3 my-2 mb-3 d-flex align-items-center gap-2" style="background:#fffbeb; border-color:#fde68a; color:#854d0e;">
          <i class="fas fa-bullhorn text-warning"></i>
          <div><strong>ข้อสั่งการ ผอ.:</strong> ${escapeHtml(item.directorNote)}</div>
        </div>` : ""}

      <div class="row align-items-center g-2 mt-2">
        <div class="col-md-5">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <span class="small text-muted fw-bold">ความคืบหน้า:</span>
            <span class="small fw-extrabold" style="color: ${item.progress >= 100 ? '#059669' : '#5c0658'};">${item.progress}%</span>
          </div>
          <div class="progress" style="height: 8px; border-radius: 6px; background-color: #f3e8f5;">
            <div class="progress-bar ${item.progress >= 100 ? 'bg-success' : 'bg-pea'}" role="progressbar" style="width: ${item.progress}%;"></div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="small text-muted"><i class="far fa-calendar-check me-1" style="color: #8e1564;"></i>กำหนดส่ง: <strong>${item.endDate || "-"}</strong></div>
        </div>

        <div class="col-md-4 d-flex align-items-center gap-2 justify-content-md-end flex-wrap">
          ${actionBtn}
          ${docBtn}
          ${editBtn}
        </div>
      </div>

      <!-- Phase 3.3 — Expandable Details Accordion Footer -->
      <div class="mt-3 pt-2 border-top d-flex align-items-center justify-content-between">
        <button type="button" class="btn-task-expand" onclick="toggleTaskExpand('${item.id}', this)">
          <i class="fas fa-chevron-down"></i> <span>ดูรายละเอียดเพิ่มเติม</span>
        </button>
        <span class="text-muted small" style="font-size: 0.72rem; font-family: monospace;">รหัส: ${escapeHtml(item.id)}</span>
      </div>

      <!-- Expandable Details Container -->
      <div id="task-details-${item.id}" class="task-details-pane d-none">
        <div class="row g-2 small">
          <div class="col-sm-6">
            <span class="text-muted">สถานะงาน:</span> <strong>${escapeHtml(item.status || "รอดำเนินการ")}</strong>
          </div>
          <div class="col-sm-6">
            <span class="text-muted">ความสำคัญ:</span> <strong>${escapeHtml(item.priority || "📌 ปกติ")}</strong>
          </div>
          ${item.actionLink ? `
          <div class="col-12">
            <span class="text-muted">🔗 ลิงก์ระบบส่งงาน:</span> <a href="${item.actionLink}" target="_blank" class="text-break">${escapeHtml(item.actionLink)}</a>
          </div>` : ""}
          ${item.docLink ? `
          <div class="col-12">
            <span class="text-muted">📄 เอกสารแนบ:</span> <a href="${item.docLink}" target="_blank" class="text-break">${escapeHtml(item.docLink)}</a>
          </div>` : ""}
          ${item.directorNote ? `
          <div class="col-12 mt-1">
            <div class="p-2 rounded-3 bg-white border">
              <strong class="text-warning"><i class="fas fa-bullhorn me-1"></i>ข้อสั่งการ ผอ.:</strong>
              <div class="mt-1">${escapeHtml(item.directorNote)}</div>
            </div>
          </div>` : ""}
        </div>
      </div>

    </div>
  `;
}

function toggleTaskExpand(taskId, btn) {
  const pane = document.getElementById(`task-details-${taskId}`);
  if (!pane) return;
  const isHidden = pane.classList.contains("d-none");
  const icon = btn.querySelector("i");
  const textSpan = btn.querySelector("span");

  if (isHidden) {
    pane.classList.remove("d-none");
    if (icon) { icon.classList.remove("fa-chevron-down"); icon.classList.add("fa-chevron-up"); }
    if (textSpan) textSpan.textContent = "ซ่อนรายละเอียด";
  } else {
    pane.classList.add("d-none");
    if (icon) { icon.classList.remove("fa-chevron-up"); icon.classList.add("fa-chevron-down"); }
    if (textSpan) textSpan.textContent = "ดูรายละเอียดเพิ่มเติม";
  }
}

/**
 * 5. Render Tasks List (Public View)
 */
function renderTasks() {
  const container = document.getElementById("tasks-container");
  if (!container) return;
  const filtered = filterTasks();

  // Phase 2.1 — Empty State ระดับมืออาชีพ พร้อมปุ่มล้างตัวกรอง
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box my-4">
        <div class="empty-state-icon">
          <i class="fas fa-clipboard-check"></i>
        </div>
        <h4 class="fw-bold text-dark mb-2">ไม่พบภารกิจที่ตรงกับเงื่อนไข</h4>
        <p class="text-muted mb-4 small" style="max-width: 480px; margin: 0 auto;">
          ไม่มีรายการภารกิจที่ตรงกับตัวกรองแผนก หรือสถานะที่คุณเลือกในขณะนี้ ลองเลือกแผนกอื่น หรือกดปุ่มด้านล่างเพื่อแสดงภารกิจทั้งหมด
        </p>
        <button type="button" class="btn btn-director rounded-pill px-4 fw-bold shadow-sm" onclick="resetFilters()">
          <i class="fas fa-undo me-1"></i> ล้างตัวกรองและดูงานทั้งหมด
        </button>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(item => renderTaskCardHtml(item, false)).join("");
}

/**
 * Phase 3.1 — Render Director Control Center Tasks (Pinned Urgent + All Tasks)
 */
function renderDirectorTasks() {
  const urgentContainer = document.getElementById("director-urgent-container");
  const listContainer = document.getElementById("director-tasks-container");
  if (!listContainer) return;

  const tasks = appData.tasks.filter(t => t.isPublished !== false);
  const now = new Date().setHours(0, 0, 0, 0);

  // ภารกิจเร่งด่วน: ด่วนที่สุด หรือ Overdue หรือ กำหนดส่งใน 3 วัน
  const urgentTasks = tasks.filter(t => {
    if (t.status === "เสร็จสิ้น" || t.progress >= 100) return false;
    if (t.priority && t.priority.includes("ด่วน")) return true;
    if (t.endDateRaw) {
      const diffDays = Math.ceil((t.endDateRaw - now) / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
    }
    return false;
  });

  if (urgentContainer) {
    if (urgentTasks.length > 0) {
      urgentContainer.classList.remove("d-none");
      const urgentCardsHtml = urgentTasks.map(t => renderTaskCardHtml(t, true)).join("");
      urgentContainer.innerHTML = `
        <div class="director-urgent-card">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <h5 class="fw-bold text-danger mb-0">
              <i class="fas fa-fire me-1"></i> ภารกิจเร่งด่วนที่ ผอ. ต้องสั่งการ / ติดตามด่วน (${urgentTasks.length} รายการ)
            </h5>
            <span class="badge bg-danger rounded-pill px-3 py-1">ต้องดำเนินการทันที</span>
          </div>
          <p class="small text-muted mb-3">ภารกิจที่อยู่ในระดับ "ด่วนที่สุด" หรือเลยกำหนดส่ง (Overdue) หรือใกล้ครบกำหนดส่งภายใน 3 วัน</p>
          <div>
            ${urgentCardsHtml}
          </div>
        </div>
      `;
    } else {
      urgentContainer.classList.add("d-none");
      urgentContainer.innerHTML = "";
    }
  }

  // รายการภารกิจทั้งหมดในมุมมอง ผอ.
  if (tasks.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fas fa-clipboard-check fa-3x mb-3 text-secondary opacity-50"></i>
        <h5>ยังไม่มีภารกิจในระบบ</h5>
        <p class="small">ผอ. สามารถกดปุ่ม "มอบหมายภารกิจใหม่" ด้านบนเพื่อเริ่มสั่งการงานแรก</p>
      </div>`;
  } else {
    listContainer.innerHTML = tasks.map(t => renderTaskCardHtml(t, true)).join("");
  }
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
  currentFilter.sortBy = document.getElementById("sort-by").value;
  renderKPIActiveState();
  renderTasks();
}

/**
 * Phase 2.2 — Clickable KPI Quick Filters
 */
function filterByKpi(kpiType) {
  currentFilter.status = kpiType;
  const statusSelect = document.getElementById("filter-status");
  if (statusSelect) statusSelect.value = kpiType;

  renderKPIActiveState();
  renderTasks();

  const labels = {
    all: "ภารกิจทั้งหมด",
    done: "เสร็จสิ้นแล้ว",
    pending: "กำลังดำเนินการ",
    overdue: "เกินกำหนดส่ง (Overdue)"
  };
  showToast(`⚡ กรองด่วน: ${labels[kpiType] || kpiType}`, "info");

  // Smooth scroll ไปยังส่วนแสดงการ์ดภารกิจ
  const container = document.getElementById("tasks-container");
  if (container) {
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Phase 2.3 — Reset All Filters
 */
function resetFilters() {
  currentFilter.department = "all";
  currentFilter.category = "all";
  currentFilter.status = "all";
  currentFilter.sortBy = "deadline";

  const deptSel = document.getElementById("filter-department");
  const catSel = document.getElementById("filter-category");
  const statSel = document.getElementById("filter-status");
  const sortSel = document.getElementById("sort-by");

  if (deptSel) deptSel.value = "all";
  if (catSel) catSel.value = "all";
  if (statSel) statSel.value = "all";
  if (sortSel) sortSel.value = "deadline";

  renderKPIActiveState();
  renderTasks();
  showToast("🔄 ล้างตัวกรองทั้งหมดแล้ว", "info");
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
    showToast("📋 คัดลอกข้อความสรุปเรียบร้อยแล้ว! นำไปวางในกลุ่ม LINE ได้ทันที", "success");
  }).catch(err => {
    showToast("⚠️ ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดเลือกข้อความแล้วคัดลอกด้วยตนเอง", "info");
  });
}

// Phase 1.2 — Show/Hide PIN Toggle สำหรับ Auth Modal
function toggleAuthPinVisibility() {
  const input = document.getElementById("auth-pin-input");
  const btn = document.getElementById("auth-pin-eye-btn");
  const icon = btn.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}


/**
 * 7. Role Authentication (Director / Admin PIN)
 * Phase 1.1 — Brute Force Rate Limiting: 5 ครั้งผิด → Lock 30 วินาที
 */
const pinAttempts = { count: 0, lockedUntil: 0 };

function openAuthModal() {
  const modal = new bootstrap.Modal(document.getElementById("authModal"));
  const input = document.getElementById("auth-pin-input");
  input.value = "";

  // 1.3 — กด Enter → Auto Submit
  input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); verifyPin(); } };

  // Reset show/hide icon
  const eyeBtn = document.getElementById("auth-pin-eye-btn");
  if (eyeBtn) {
    const icon = eyeBtn.querySelector("i");
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }

  updatePinLockUI();
  modal.show();

  // Autofocus หลัง Modal เปิดสมบูรณ์
  document.getElementById("authModal").addEventListener("shown.bs.modal", () => {
    if (Date.now() >= pinAttempts.lockedUntil) input.focus();
  }, { once: true });
}

function updatePinLockUI() {
  const input = document.getElementById("auth-pin-input");
  const verifyBtn = document.getElementById("auth-verify-btn");
  const lockMsg = document.getElementById("pin-lock-message");
  if (!input || !verifyBtn || !lockMsg) return;

  const remaining = Math.ceil((pinAttempts.lockedUntil - Date.now()) / 1000);
  if (remaining > 0) {
    // ถูก Lock อยู่
    input.disabled = true;
    verifyBtn.disabled = true;
    lockMsg.classList.remove("d-none");
    lockMsg.innerHTML = `<i class="fas fa-lock me-1"></i> ถูกล็อก — กรุณารอ <strong id="pin-countdown">${remaining}</strong> วินาที`;

    // Countdown Timer
    const countdownEl = document.getElementById("pin-countdown");
    const countdownInterval = setInterval(() => {
      const r = Math.ceil((pinAttempts.lockedUntil - Date.now()) / 1000);
      if (r <= 0) {
        clearInterval(countdownInterval);
        input.disabled = false;
        verifyBtn.disabled = false;
        lockMsg.classList.add("d-none");
        pinAttempts.count = 0;
        input.focus();
      } else {
        if (countdownEl) countdownEl.textContent = r;
      }
    }, 1000);
  } else {
    // ปกติ
    input.disabled = false;
    verifyBtn.disabled = false;
    lockMsg.classList.add("d-none");
  }
}

function verifyPin() {
  // ตรวจสอบว่าถูก Lock อยู่หรือไม่
  if (Date.now() < pinAttempts.lockedUntil) {
    updatePinLockUI();
    return;
  }

  const pin = document.getElementById("auth-pin-input").value.trim();
  const dirPin = (appData.settings.DIRECTOR_PIN || APP_CONFIG.DEFAULT_DIRECTOR_PIN).toString().trim();
  const adminPin = (appData.settings.ADMIN_PIN || APP_CONFIG.DEFAULT_ADMIN_PIN).toString().trim();

  if (pin === adminPin) {
    pinAttempts.count = 0;
    pinAttempts.lockedUntil = 0;
    appData.currentUserRole = "admin";
    enterManagementMode();
  } else if (pin === dirPin) {
    pinAttempts.count = 0;
    pinAttempts.lockedUntil = 0;
    appData.currentUserRole = "director";
    enterManagementMode();
  } else {
    pinAttempts.count++;
    document.getElementById("auth-pin-input").value = "";
    document.getElementById("auth-pin-input").classList.add("is-invalid");
    setTimeout(() => document.getElementById("auth-pin-input").classList.remove("is-invalid"), 600);

    if (pinAttempts.count >= 5) {
      // Lock 30 วินาที
      pinAttempts.lockedUntil = Date.now() + 30000;
      updatePinLockUI();
      showToast("🔒 กรอกรหัสผิดเกินกำหนด ระบบถูกล็อกชั่วคราว 30 วินาที", "error");
    } else {
      const remaining = 5 - pinAttempts.count;
      showToast(`❌ รหัส PIN ไม่ถูกต้อง — เหลืออีก ${remaining} ครั้งก่อนถูกล็อก`, "error");
    }
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

  // Phase 3.5 — Log Activity
  logActivity("เข้าสู่ระบบจัดการ", `เข้าสู่ระบบสำเร็จในฐานะ: ${appData.currentUserRole === "admin" ? "ผู้ดูแลระบบ (Admin)" : "ผู้อำนวยการ (ผอ.)"}`, appData.currentUserRole);

  // Switch to management tab
  syncDebugBadgeVisibility(); // Phase 1.4 — แสดง badge เฉพาะ Admin
  switchTab("director");
  renderTasks();
  renderDirectorTasks();
}

function logout() {
  const previousRole = appData.currentUserRole;
  appData.currentUserRole = null;
  document.getElementById("btn-auth-open").classList.remove("d-none");
  document.getElementById("btn-logout").classList.add("d-none");
  document.getElementById("management-bar").classList.add("d-none");
  pinAttempts.count = 0;       // Phase 1.1 — Reset attempts on logout
  pinAttempts.lockedUntil = 0;
  syncDebugBadgeVisibility();  // Phase 1.4 — ซ่อน badge เมื่อออกจากระบบ

  // Phase 3.5 — Log Activity
  logActivity("ออกจากระบบจัดการ", "ออกจากโหมดจัดการภารกิจ", previousRole);

  switchTab("public");
  renderTasks();
}

function switchTab(tab) {
  document.querySelectorAll(".app-tab-panel").forEach(p => p.classList.add("d-none"));
  document.querySelectorAll(".tab-nav-btn").forEach(b => b.classList.remove("active"));

  if (tab === "public") {
    document.getElementById("panel-public").classList.remove("d-none");
    renderTasks();
  } else if (tab === "director") {
    document.getElementById("panel-director").classList.remove("d-none");
    document.getElementById("tab-director-btn").classList.add("active");
    renderDirectorTasks();
  } else if (tab === "admin") {
    document.getElementById("panel-admin").classList.remove("d-none");
    document.getElementById("tab-admin-btn").classList.add("active");
    populateAdminSettingsForm();
    renderActivityLogs();
  }
}

/**
 * 8. Task CRUD Operations & Modal Helpers (Phase 2.4 - 2.7)
 */
function convertToIsoDate(dateStr, dateRaw) {
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  if (!dateStr) return "";
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) { // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    } else { // DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return "";
}

function updateTaskProgressBadge(val) {
  const badge = document.getElementById("task-progress-val");
  if (!badge) return;
  const num = parseInt(val) || 0;
  badge.innerText = num + "%";
  if (num >= 100) {
    badge.style.background = "#dcfce7";
    badge.style.color = "#15803d";
  } else {
    badge.style.background = "#f3e8f5";
    badge.style.color = "#5c0658";
  }
}

function openNewTaskModal() {
  document.getElementById("task-form").reset();
  document.getElementById("task-id-input").value = "";
  document.getElementById("task-progress-input").value = 0;
  updateTaskProgressBadge(0);

  // ตั้งค่าวันที่เริ่มต้นเป็น วันนี้
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  document.getElementById("task-end-input").value = `${yyyy}-${mm}-${dd}`;

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
  
  // Phase 2.5 — Convert to ISO format YYYY-MM-DD for date input
  document.getElementById("task-end-input").value = convertToIsoDate(item.endDate, item.endDateRaw);

  document.getElementById("task-priority-input").value = item.priority || "📌 ปกติ";
  document.getElementById("task-status-input").value = item.status || "รอดำเนินการ";
  
  // Phase 2.4 — Set progress slider & badge
  const progressVal = item.progress || 0;
  document.getElementById("task-progress-input").value = progressVal;
  updateTaskProgressBadge(progressVal);

  document.getElementById("task-action-input").value = item.actionLink || "";
  document.getElementById("task-doc-input").value = item.docLink || "";
  document.getElementById("task-note-input").value = item.directorNote || "";

  document.getElementById("task-modal-title").innerText = `✏️ จัดการภารกิจ (${item.id})`;
  new bootstrap.Modal(document.getElementById("taskModal")).show();
}

async function saveTask() {
  const taskId = document.getElementById("task-id-input").value;
  const rawDateVal = document.getElementById("task-end-input").value; // "YYYY-MM-DD"
  let displayEndDate = rawDateVal;
  let calculatedEndDateRaw = null;
  if (rawDateVal && rawDateVal.includes("-")) {
    const [y, m, d] = rawDateVal.split("-");
    displayEndDate = `${d}/${m}/${y}`;
    calculatedEndDateRaw = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
  }

  const taskData = {
    taskName: document.getElementById("task-name-input").value.trim(),
    department: document.getElementById("task-dept-input").value,
    category: document.getElementById("task-cat-input").value,
    endDate: displayEndDate,
    endDateRaw: calculatedEndDateRaw,
    priority: document.getElementById("task-priority-input").value,
    status: document.getElementById("task-status-input").value,
    progress: parseFloat(document.getElementById("task-progress-input").value) || 0,
    actionLink: document.getElementById("task-action-input").value.trim(),
    docLink: document.getElementById("task-doc-input").value.trim(),
    directorNote: document.getElementById("task-note-input").value.trim()
  };

  if (!taskData.taskName) {
    showToast("กรุณาระบุชื่องาน/ภารกิจ", "error");
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
    showToast("✅ บันทึกข้อมูลภารกิจเรียบร้อยแล้ว", "success");
    renderKPIs();
    renderTasks();
    renderDirectorTasks();
    updateLineBriefText();

    // Phase 3.5 — Log Activity
    logActivity(isEdit ? "แก้ไขภารกิจ" : "สั่งการภารกิจใหม่", `${taskData.taskName} (${taskData.department})`, appData.currentUserRole);
  } catch (err) {
    showToast("เกิดข้อผิดพลาดในการบันทึก: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// In-memory tags for Master Data chips
let adminDeptList = [];
let adminCatList = [];

/**
 * 9. Admin Settings Operations & Drive Auth Check (Enterprise Upgrade)
 */
function populateAdminSettingsForm() {
  const s = appData.settings;
  document.getElementById("setting-title").value = s.APP_TITLE || "";
  document.getElementById("setting-subtitle").value = s.APP_SUBTITLE || "";
  document.getElementById("setting-announcement").value = s.ANNOUNCEMENT_TEXT || "";
  
  const isAnnounce = s.ANNOUNCEMENT_ENABLED === true || s.ANNOUNCEMENT_ENABLED === "TRUE" || s.ANNOUNCEMENT_ENABLED === "true";
  document.getElementById("setting-announce-enable").checked = isAnnounce;
  
  document.getElementById("setting-link-title").value = s.HEADER_LINK_TITLE || "";
  document.getElementById("setting-link-url").value = s.HEADER_LINK_URL || "";
  document.getElementById("setting-footer").value = s.FOOTER_TEXT || "";
  document.getElementById("setting-drive-id").value = s.DRIVE_FOLDER_ID || "";
  document.getElementById("setting-dir-pin").value = s.DIRECTOR_PIN || "";
  document.getElementById("setting-admin-pin").value = s.ADMIN_PIN || "";

  // Populate Chip Tag Lists
  adminDeptList = (s.departmentList && s.departmentList.length > 0) 
    ? [...s.departmentList] 
    : (s.DEPARTMENTS ? s.DEPARTMENTS.split(",").map(t => t.trim()).filter(Boolean) : []);
  
  adminCatList = (s.categoryList && s.categoryList.length > 0) 
    ? [...s.categoryList] 
    : (s.CATEGORIES ? s.CATEGORIES.split(",").map(t => t.trim()).filter(Boolean) : []);

  renderDepartmentChips();
  renderCategoryChips();
}

function renderDepartmentChips() {
  const container = document.getElementById("dept-chips-container");
  const badge = document.getElementById("dept-count-badge");
  if (badge) badge.innerText = `${adminDeptList.length} แผนก`;

  if (!container) return;
  if (adminDeptList.length === 0) {
    container.innerHTML = `<span class="text-muted small p-2">ยังไม่มีรายชื่อแผนก พิมพ์ชื่อแล้วกดเพิ่มได้เลย</span>`;
    return;
  }

  container.innerHTML = adminDeptList.map((dept, idx) => `
    <span class="tag-chip">
      <i class="fas fa-building text-primary" style="font-size: 0.75rem;"></i>
      <span>${escapeHtml(dept)}</span>
      <span class="tag-chip-remove" title="ลบแผนกนี้" onclick="removeDepartmentTag(${idx})">
        <i class="fas fa-times-circle"></i>
      </span>
    </span>
  `).join("");
}

function addDepartmentTag() {
  const input = document.getElementById("new-dept-input");
  const val = input.value.trim();
  if (!val) return;
  if (adminDeptList.includes(val)) {
    showToast("มีแผนกนี้อยู่ในรายการแล้ว", "info");
    input.focus();
    return;
  }
  adminDeptList.push(val);
  input.value = "";
  renderDepartmentChips();
  showToast(`เพิ่ม "${val}" เรียบร้อยแล้ว`, "success");
}

function removeDepartmentTag(idx) {
  const removed = adminDeptList.splice(idx, 1);
  renderDepartmentChips();
  showToast(`ลบ "${removed}" แล้ว`, "info");
}

function renderCategoryChips() {
  const container = document.getElementById("cat-chips-container");
  const badge = document.getElementById("cat-count-badge");
  if (badge) badge.innerText = `${adminCatList.length} หมวดหมู่`;

  if (!container) return;
  if (adminCatList.length === 0) {
    container.innerHTML = `<span class="text-muted small p-2">ยังไม่มีหมวดหมู่</span>`;
    return;
  }

  container.innerHTML = adminCatList.map((cat, idx) => `
    <span class="tag-chip">
      <i class="fas fa-folder text-warning" style="font-size: 0.75rem;"></i>
      <span>${escapeHtml(cat)}</span>
      <span class="tag-chip-remove" title="ลบหมวดหมู่นี้" onclick="removeCategoryTag(${idx})">
        <i class="fas fa-times-circle"></i>
      </span>
    </span>
  `).join("");
}

function addCategoryTag() {
  const input = document.getElementById("new-cat-input");
  const val = input.value.trim();
  if (!val) return;
  if (adminCatList.includes(val)) {
    showToast("มีหมวดหมู่นี้อยู่แล้ว", "info");
    input.focus();
    return;
  }
  adminCatList.push(val);
  input.value = "";
  renderCategoryChips();
  showToast(`เพิ่ม "${val}" เรียบร้อยแล้ว`, "success");
}

function removeCategoryTag(idx) {
  const removed = adminCatList.splice(idx, 1);
  renderCategoryChips();
  showToast(`ลบ "${removed}" แล้ว`, "info");
}

function togglePinVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}

async function saveAdminSettings() {
  if (adminDeptList.length === 0) {
    showToast("กรุณาระบุรายชื่อแผนกอย่างน้อย 1 แผนก", "error");
    return;
  }

  const newSettings = {
    APP_TITLE: document.getElementById("setting-title").value.trim(),
    APP_SUBTITLE: document.getElementById("setting-subtitle").value.trim(),
    ANNOUNCEMENT_TEXT: document.getElementById("setting-announcement").value.trim(),
    ANNOUNCEMENT_ENABLED: document.getElementById("setting-announce-enable").checked ? "TRUE" : "FALSE",
    HEADER_LINK_TITLE: document.getElementById("setting-link-title").value.trim(),
    HEADER_LINK_URL: document.getElementById("setting-link-url").value.trim(),
    FOOTER_TEXT: document.getElementById("setting-footer").value.trim(),
    DEPARTMENTS: adminDeptList.join(", "),
    CATEGORIES: adminCatList.join(", "),
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
    }

    Object.assign(appData.settings, newSettings);
    appData.settings.departmentList = [...adminDeptList];
    appData.settings.categoryList = [...adminCatList];

    renderBranding();
    populateDropdowns();
    showToast("✅ บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!", "success");

    // Phase 3.5 — Log Activity
    logActivity("บันทึกการตั้งค่าระบบ", "แก้ไขข้อมูล Branding และ Master Data", "admin");
    renderActivityLogs();
  } catch (err) {
    showToast("เกิดข้อผิดพลาดในการบันทึก: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

/**
 * Phase 3.4 — Discard Changes in Admin Settings Form
 */
function discardAdminSettings() {
  if (confirm("ต้องการยกเลิกการแก้ไขและคืนค่าเดิมจากการตั้งค่าล่าสุดใช่หรือไม่?")) {
    populateAdminSettingsForm();
    showToast("🔄 คืนค่าการตั้งค่าจากที่บันทึกล่าสุดเรียบร้อยแล้ว", "info");
  }
}

/**
 * Phase 3.5 — System Activity Log & Audit Trail
 */
function logActivity(action, detail = "", role = null) {
  const currentRole = role || appData.currentUserRole || "system";
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const newLog = {
    id: Date.now(),
    timestamp: `${dateStr} ${timeStr}`,
    role: currentRole,
    action,
    detail
  };

  let logs = [];
  try {
    logs = JSON.parse(localStorage.getItem("pea_activity_logs") || "[]");
  } catch (e) {
    logs = [];
  }

  logs.unshift(newLog);
  if (logs.length > 50) logs = logs.slice(0, 50); // เก็บประวัติล่าสุด 50 รายการ

  try {
    localStorage.setItem("pea_activity_logs", JSON.stringify(logs));
  } catch (e) {
    console.warn("Cannot save activity logs:", e);
  }

  renderActivityLogs();
}

function renderActivityLogs() {
  const tbody = document.getElementById("activity-log-tbody");
  if (!tbody) return;

  let logs = [];
  try {
    logs = JSON.parse(localStorage.getItem("pea_activity_logs") || "[]");
  } catch (e) {
    logs = [];
  }

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3 small">ยังไม่มีประวัติกิจกรรมในระบบ</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => {
    let badgeClass = "activity-badge-system";
    let roleName = "ระบบ";
    if (l.role === "admin") {
      badgeClass = "activity-badge-admin";
      roleName = "ผู้ดูแลระบบ (Admin)";
    } else if (l.role === "director") {
      badgeClass = "activity-badge-director";
      roleName = "ผู้อำนวยการ (ผอ.)";
    }

    return `
      <tr>
        <td class="text-muted small">${escapeHtml(l.timestamp)}</td>
        <td><span class="badge ${badgeClass} px-2 py-1 rounded-pill small">${roleName}</span></td>
        <td>
          <strong class="text-dark">${escapeHtml(l.action)}</strong>
          ${l.detail ? `<div class="small text-muted mt-0">${escapeHtml(l.detail)}</div>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}

function clearActivityLogs() {
  if (confirm("ต้องการล้างประวัติกิจกรรมทั้งหมดใช่หรือไม่?")) {
    localStorage.removeItem("pea_activity_logs");
    renderActivityLogs();
    showToast("🗑️ ล้างประวัติกิจกรรมเรียบร้อยแล้ว", "info");
  }
}

function showToast(message, type = "success") {
  const toastEl = document.getElementById("appToast");
  const msgEl = document.getElementById("toastMessage");
  if (!toastEl || !msgEl) {
    alert(message);
    return;
  }

  toastEl.classList.remove("bg-toast-success", "bg-toast-error", "bg-toast-info");
  let iconHtml = '<i class="fas fa-check-circle fa-lg"></i>';

  if (type === "success") {
    toastEl.classList.add("bg-toast-success");
    iconHtml = '<i class="fas fa-check-circle fa-lg"></i>';
  } else if (type === "error") {
    toastEl.classList.add("bg-toast-error");
    iconHtml = '<i class="fas fa-exclamation-circle fa-lg"></i>';
  } else {
    toastEl.classList.add("bg-toast-info");
    iconHtml = '<i class="fas fa-info-circle fa-lg"></i>';
  }

  msgEl.innerHTML = `${iconHtml} <span>${escapeHtml(message)}</span>`;
  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
}

async function verifyDrivePermission() {
  const folderId = document.getElementById("setting-drive-id").value.trim();
  if (!folderId) {
    showToast("กรุณาระบุ Google Drive Folder ID ก่อนกดตรวจสอบ", "error");
    return;
  }

  showLoading(true);
  try {
    const isMock = APP_CONFIG.GAS_API_URL.includes("MOCK_REPLACE");
    if (!isMock) {
      const res = await fetch(`${APP_CONFIG.GAS_API_URL}?action=checkDrivePermission&folderId=${encodeURIComponent(folderId)}`);
      const json = await res.json();
      showToast(json.message, json.status === "success" ? "success" : "info");
    } else {
      showToast(`✅ [โหมดทดสอบ] ยืนยันสิทธิ์โฟลเดอร์ ID: ${folderId} สำเร็จ!`, "success");
    }
    // Phase 3.5 — Log Activity
    logActivity("ตรวจสอบสิทธิ์ Google Drive", `โฟลเดอร์ ID: ${folderId}`, "admin");
  } catch (err) {
    showToast("เกิดข้อผิดพลาดในการตรวจสอบ: " + err.message, "error");
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
      showToast(json.message, json.status === "success" ? "success" : "info");
    } else {
      showToast("✅ [โหมดทดสอบ] ตรวจสอบและสร้างโครงสร้างตารางเรียบร้อยแล้ว!", "success");
    }
    // Phase 3.5 — Log Activity
    logActivity("ซ่อมแซมตาราง Google Sheets", "เรียกใช้ Auto-Provisioning", "admin");
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

/**
 * Utility Helpers
 */
function showLoading(show) {
  const el = document.getElementById("loading-overlay");
  if (el) {
    if (show) {
      el.classList.remove("d-none");
      el.style.display = "flex";
    } else {
      el.classList.add("d-none");
      el.style.display = "none";
    }
  }
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

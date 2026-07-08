const DAY_ORDER = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4 };

let ALL_RECORDS = [];

async function loadData() {
  const statusEl = document.getElementById("load-status");
  try {
    const res = await fetch(`data/timetable.csv?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    ALL_RECORDS = parseCsvText(text);
    statusEl.textContent = `총 ${ALL_RECORDS.length}개 수업, ${new Set(ALL_RECORDS.map((r) => r.teacher)).size}명 교사 데이터 로드 완료`;
    populateControls();
    restoreLastView();
  } catch (err) {
    statusEl.textContent = "데이터를 불러오지 못했습니다: " + err.message;
    statusEl.classList.add("error");
  }
}

function populateControls() {
  const teachers = [...new Set(ALL_RECORDS.map((r) => r.teacher))].sort((a, b) => a.localeCompare(b, "ko"));
  const schools = [...new Set(ALL_RECORDS.map((r) => r.school))].sort((a, b) => a.localeCompare(b, "ko"));

  const teacherSelect = document.getElementById("teacher-select");
  teacherSelect.innerHTML = '<option value="">교사를 선택하세요</option>' +
    teachers.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  const schoolSelect = document.getElementById("school-select");
  schoolSelect.innerHTML = '<option value="">파견 학교를 선택하세요</option>' +
    schools.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- 탭 전환 ----------
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      localStorage.setItem("timetable:lastTab", btn.dataset.tab);
    });
  });
}

function restoreLastView() {
  const lastTab = localStorage.getItem("timetable:lastTab");
  if (lastTab && document.getElementById(lastTab)) {
    document.querySelector(`.tab-btn[data-tab="${lastTab}"]`).click();
  }
}

// ---------- 교사명으로 조회 ----------
function renderTeacherView(teacher) {
  const container = document.getElementById("teacher-result");
  if (!teacher) {
    container.innerHTML = "";
    return;
  }
  const records = ALL_RECORDS.filter((r) => r.teacher === teacher);
  if (records.length === 0) {
    container.innerHTML = "<p class='empty'>해당 교사의 수업이 없습니다.</p>";
    return;
  }
  const byKey = {};
  for (const r of records) byKey[`${r.day}-${r.period}`] = r;

  let html = `<table class="grid-table"><thead><tr><th>교시</th>`;
  for (const d of Object.keys(DAY_ORDER)) html += `<th>${d}</th>`;
  html += `</tr></thead><tbody>`;
  for (let p = 1; p <= 7; p++) {
    html += `<tr><th>${p}교시</th>`;
    for (const d of Object.keys(DAY_ORDER)) {
      const rec = byKey[`${d}-${p}`];
      if (rec) {
        html += `<td class="filled"><div class="cell-school">${escapeHtml(rec.school)}</div><div class="cell-subject">${escapeHtml(rec.subject)}</div><div class="cell-time">${escapeHtml(rec.time)}</div><div class="cell-room">${escapeHtml(rec.classroom)}</div></td>`;
      } else {
        html += `<td class="empty-cell"></td>`;
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  html += `<p class="summary">주간 총 ${records.length}시간 · 강의실: ${[...new Set(records.map((r) => r.classroom))].join(", ")}</p>`;
  container.innerHTML = html;
}

// ---------- 파견학교로 조회 ----------
function renderSchoolView(school) {
  const container = document.getElementById("school-result");
  if (!school) {
    container.innerHTML = "";
    return;
  }
  const records = ALL_RECORDS.filter((r) => r.school === school).sort(
    (a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day] || a.period - b.period
  );
  if (records.length === 0) {
    container.innerHTML = "<p class='empty'>해당 학교로 파견되는 수업이 없습니다.</p>";
    return;
  }
  let html = `<table class="list-table"><thead><tr><th>요일</th><th>교시</th><th>교사</th><th>과목</th><th>시간</th><th>강의실</th></tr></thead><tbody>`;
  for (const r of records) {
    html += `<tr><td>${r.day}</td><td>${r.period}교시</td><td>${escapeHtml(r.teacher)}</td><td>${escapeHtml(r.subject)}</td><td>${escapeHtml(r.time)}</td><td>${escapeHtml(r.classroom)}</td></tr>`;
  }
  html += `</tbody></table>`;
  html += `<p class="summary">총 ${records.length}개 수업</p>`;
  container.innerHTML = html;
}

// ---------- 요일·교시로 조회 ----------
let selectedDay = null;
let selectedPeriod = null;

function initSlotButtons() {
  const dayWrap = document.getElementById("day-buttons");
  dayWrap.innerHTML = Object.keys(DAY_ORDER)
    .map((d) => `<button class="chip-btn" data-day="${d}">${d}요일</button>`)
    .join("");
  const periodWrap = document.getElementById("period-buttons");
  periodWrap.innerHTML = [1, 2, 3, 4, 5, 6, 7]
    .map((p) => `<button class="chip-btn" data-period="${p}">${p}교시</button>`)
    .join("");

  dayWrap.addEventListener("click", (e) => {
    if (!e.target.matches("button")) return;
    dayWrap.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    selectedDay = e.target.dataset.day;
    renderSlotView();
  });
  periodWrap.addEventListener("click", (e) => {
    if (!e.target.matches("button")) return;
    periodWrap.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    selectedPeriod = Number(e.target.dataset.period);
    renderSlotView();
  });
}

function renderSlotView() {
  const container = document.getElementById("slot-result");
  if (!selectedDay || !selectedPeriod) {
    container.innerHTML = "";
    return;
  }
  const records = ALL_RECORDS.filter((r) => r.day === selectedDay && r.period === selectedPeriod).sort((a, b) =>
    a.teacher.localeCompare(b.teacher, "ko")
  );
  if (records.length === 0) {
    container.innerHTML = "<p class='empty'>해당 시간에 진행되는 수업이 없습니다.</p>";
    return;
  }
  let html = `<table class="list-table"><thead><tr><th>교사</th><th>강의실</th><th>파견학교</th><th>과목</th><th>시간</th></tr></thead><tbody>`;
  for (const r of records) {
    html += `<tr><td>${escapeHtml(r.teacher)}</td><td>${escapeHtml(r.classroom)}</td><td>${escapeHtml(r.school)}</td><td>${escapeHtml(r.subject)}</td><td>${escapeHtml(r.time)}</td></tr>`;
  }
  html += `</tbody></table>`;
  html += `<p class="summary">${selectedDay}요일 ${selectedPeriod}교시 · 총 ${records.length}개 수업</p>`;
  container.innerHTML = html;
}

function init() {
  initTabs();
  initSlotButtons();
  document.getElementById("teacher-select").addEventListener("change", (e) => renderTeacherView(e.target.value));
  document.getElementById("school-select").addEventListener("change", (e) => renderSchoolView(e.target.value));
  loadData();
}

document.addEventListener("DOMContentLoaded", init);

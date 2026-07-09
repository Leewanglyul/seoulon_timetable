const DAY_ORDER = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4 };
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const SEMESTER_START = "2026-08-13";
const SEMESTER_END = "2027-02-05";

let ALL_RECORDS = [];
let holidayCache = null; // Map<"YYYY-MM-DD", holidayName>
let holidayLoadError = null;

async function loadData(idToken) {
  const statusEl = document.getElementById("load-status");
  try {
    const res = await fetch(`/api/timetable?t=${Date.now()}`, {
      headers: { Authorization: "Bearer " + idToken },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
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

  renderChipList("teacher-buttons", teachers, "teacher");
  renderChipList("school-buttons", schools, "school");
}

function renderChipList(containerId, items, datasetKey) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = items
    .map((name) => `<button type="button" class="chip-btn" data-${datasetKey}="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
    .join("");
}

function filterChips(containerId, query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll(`#${containerId} button`).forEach((btn) => {
    btn.style.display = btn.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

function toggleSetMember(set, value, btn) {
  if (set.has(value)) {
    set.delete(value);
    btn.classList.remove("active");
  } else {
    set.add(value);
    btn.classList.add("active");
  }
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

// ---------- 요일×교시 그리드 공용 렌더러 ----------
const FIELD_CONFIG = {
  teacher: ["cell-teacher", (r) => r.teacher],
  school: ["cell-school", (r) => r.school],
  subject: ["cell-subject", (r) => r.subject],
  time: ["cell-time", (r) => r.time],
  classroom: ["cell-room", (r) => r.classroom],
};

// 여러 명/여러 학교를 비교할 때 항목별로 구분되도록 순환 배정하는 색상 팔레트
const COMPARE_PALETTE = ["#2b5fa8", "#c0392b", "#1a7a3c", "#b8860b", "#7d3c98", "#008b8b", "#d2691e", "#555555"];

function colorMapFor(names) {
  const map = {};
  names.forEach((name, i) => {
    map[name] = COMPARE_PALETTE[i % COMPARE_PALETTE.length];
  });
  return map;
}

function renderTagRow(names, colorMap, datasetKey) {
  if (names.length === 0) return "";
  const chips = names
    .map(
      (name) =>
        `<button type="button" class="tag-chip" style="border-color:${colorMap[name]}" data-remove-${datasetKey}="${escapeHtml(name)}"><span class="tag-dot" style="background:${colorMap[name]}"></span>${escapeHtml(name)}<span class="tag-x">×</span></button>`
    )
    .join("");
  return `<div class="tag-row">${chips}</div>`;
}

function renderEntryBlock(record, fields, colorMap, colorField) {
  const inner = fields
    .map((f) => {
      const [cls, get] = FIELD_CONFIG[f];
      return `<span class="${cls}">${escapeHtml(get(record))}</span>`;
    })
    .join("");
  const color = colorMap && colorField ? colorMap[record[colorField]] : null;
  const style = color ? ` style="border-left:4px solid ${color}"` : "";
  return `<div class="slot-entry"${style}>${inner}</div>`;
}

// days/periods: 표시할 순서가 반영된 배열. records: 이미 필터링된 레코드 목록.
function buildWeekGrid(days, periods, records, fields, colorMap, colorField) {
  const byKey = {};
  for (const r of records) {
    const key = `${r.day}-${r.period}`;
    (byKey[key] = byKey[key] || []).push(r);
  }
  for (const key in byKey) {
    byKey[key].sort((a, b) => a.teacher.localeCompare(b.teacher, "ko"));
  }

  let total = 0;
  let html = `<table class="grid-table"><thead><tr><th>교시</th>`;
  for (const d of days) html += `<th>${d}</th>`;
  html += `</tr></thead><tbody>`;
  for (const p of periods) {
    html += `<tr><th>${p}교시</th>`;
    for (const d of days) {
      const entries = byKey[`${d}-${p}`] || [];
      total += entries.length;
      if (entries.length === 0) {
        html += `<td class="empty-cell"></td>`;
        continue;
      }
      html += `<td class="filled">${entries.map((r) => renderEntryBlock(r, fields, colorMap, colorField)).join("")}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return { html, total };
}

const ALL_DAYS = Object.keys(DAY_ORDER);
const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7];

// ---------- 스프레드시트(CSV) 다운로드 ----------
const lastRecordsByView = {};

function csvField(v) {
  return '"' + String(v ?? "").replace(/"/g, '""') + '"';
}

function recordsToCsv(records) {
  const header = ["요일", "교시", "교사", "참여학교", "과목", "시간", "강의실"];
  const lines = [header.map(csvField).join(",")];
  for (const r of records) {
    lines.push([r.day, `${r.period}교시`, r.teacher, r.school, r.subject, r.time, r.classroom].map(csvField).join(","));
  }
  return lines.join("\r\n");
}

function downloadCsv(filenamePrefix, records) {
  if (!records || records.length === 0) return;
  const csv = "﻿" + recordsToCsv(records); // BOM 포함 -- 엑셀에서 한글 깨짐 방지
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${filenamePrefix}_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadButtonHtml(viewKey) {
  return `<button type="button" class="reset-btn download-btn" data-download="${viewKey}">스프레드시트로 다운로드</button>`;
}

// ---------- 교사명으로 조회 (여러 명 비교 가능) ----------
const selectedTeachers = new Set();

function renderTeacherView() {
  const container = document.getElementById("teacher-result");
  if (selectedTeachers.size === 0) {
    container.innerHTML = "<p class='empty'>교사를 하나 이상 선택하세요.</p>";
    return;
  }
  const names = [...selectedTeachers].sort((a, b) => a.localeCompare(b, "ko"));
  const colorMap = colorMapFor(names);
  const records = ALL_RECORDS.filter((r) => selectedTeachers.has(r.teacher));
  lastRecordsByView.teacher = records;
  const { html, total } = buildWeekGrid(ALL_DAYS, ALL_PERIODS, records, ["teacher", "school", "subject", "time", "classroom"], colorMap, "teacher");
  container.innerHTML = `${renderTagRow(names, colorMap, "teacher")}${html}<p class="summary">총 ${total}개 수업</p>${downloadButtonHtml("teacher")}`;
}

// ---------- 참여학교로 조회 (여러 학교 비교 가능) ----------
const selectedSchools = new Set();

function renderSchoolView() {
  const container = document.getElementById("school-result");
  if (selectedSchools.size === 0) {
    container.innerHTML = "<p class='empty'>참여 학교를 하나 이상 선택하세요.</p>";
    return;
  }
  const names = [...selectedSchools].sort((a, b) => a.localeCompare(b, "ko"));
  const colorMap = colorMapFor(names);
  const records = ALL_RECORDS.filter((r) => selectedSchools.has(r.school));
  lastRecordsByView.school = records;
  const { html, total } = buildWeekGrid(ALL_DAYS, ALL_PERIODS, records, ["school", "teacher", "subject", "time", "classroom"], colorMap, "school");
  container.innerHTML = `${renderTagRow(names, colorMap, "school")}${html}<p class="summary">총 ${total}개 수업</p>${downloadButtonHtml("school")}`;
}

// ---------- 요일·교시로 조회 (다중 선택 가능) ----------
const selectedDays = new Set();
const selectedPeriods = new Set();

function initSlotButtons() {
  const dayWrap = document.getElementById("day-buttons");
  dayWrap.innerHTML = ALL_DAYS.map((d) => `<button type="button" class="chip-btn" data-day="${d}">${d}요일</button>`).join("");
  const periodWrap = document.getElementById("period-buttons");
  periodWrap.innerHTML = ALL_PERIODS.map((p) => `<button type="button" class="chip-btn" data-period="${p}">${p}교시</button>`).join("");

  dayWrap.addEventListener("click", (e) => {
    if (!e.target.matches("button")) return;
    toggleSetMember(selectedDays, e.target.dataset.day, e.target);
    renderSlotView();
  });
  periodWrap.addEventListener("click", (e) => {
    if (!e.target.matches("button")) return;
    toggleSetMember(selectedPeriods, Number(e.target.dataset.period), e.target);
    renderSlotView();
  });
}

function renderSlotView() {
  const container = document.getElementById("slot-result");
  const days = ALL_DAYS.filter((d) => selectedDays.has(d));
  const periods = ALL_PERIODS.filter((p) => selectedPeriods.has(p));

  if (days.length === 0 || periods.length === 0) {
    container.innerHTML = "<p class='empty'>요일과 교시를 하나 이상 선택하세요.</p>";
    return;
  }
  const { html, total } = buildWeekGrid(days, periods, ALL_RECORDS, ["teacher", "school", "subject", "time", "classroom"]);
  lastRecordsByView.slot = ALL_RECORDS.filter((r) => days.includes(r.day) && periods.includes(r.period));
  container.innerHTML = `${html}<p class="summary">${days.join(", ")}요일 · ${periods.join(", ")}교시 · 총 ${total}개 수업</p>${downloadButtonHtml("slot")}`;
}

// ---------- 날짜로 조회 (공휴일 반영) ----------
async function loadHolidays() {
  if (holidayCache) return holidayCache;
  holidayCache = new Map();
  try {
    const res = await fetch("/api/holidays");
    const data = await res.json();
    if (data.error) holidayLoadError = data.error;
    for (const h of data.holidays || []) holidayCache.set(h.date, h.name);
  } catch (err) {
    holidayLoadError = err.message;
  }
  return holidayCache;
}

async function renderDateView(dateStr) {
  const container = document.getElementById("date-result");
  if (!dateStr) {
    container.innerHTML = "";
    return;
  }

  const weekdayIdx = new Date(dateStr + "T00:00:00").getDay();
  const weekdayLabel = WEEKDAY_LABELS[weekdayIdx];

  const holidays = await loadHolidays();
  const holidayName = holidays.get(dateStr);
  const noteHtml = holidayLoadError
    ? `<p class="summary" style="color:#c0392b">공휴일 정보를 불러오지 못했습니다 (${escapeHtml(holidayLoadError)}). 주말 여부만 반영됩니다.</p>`
    : "";

  if (weekdayIdx === 0 || weekdayIdx === 6) {
    container.innerHTML = noteHtml + `<p class="empty">${dateStr} (${weekdayLabel}요일)은 주말입니다. 정규 수업이 없습니다.</p>`;
    return;
  }
  if (holidayName) {
    container.innerHTML = noteHtml + `<p class="empty">${dateStr} (${weekdayLabel}요일)은 공휴일(${escapeHtml(holidayName)})입니다. 정규 수업이 없습니다.</p>`;
    return;
  }

  const records = ALL_RECORDS.filter((r) => r.day === weekdayLabel).sort(
    (a, b) => a.period - b.period || a.teacher.localeCompare(b.teacher, "ko")
  );
  if (records.length === 0) {
    container.innerHTML = noteHtml + "<p class='empty'>해당 요일에 등록된 수업이 없습니다.</p>";
    return;
  }

  let html = `<table class="list-table"><thead><tr><th>교시</th><th>교사</th><th>참여학교</th><th>과목</th><th>시간</th><th>강의실</th></tr></thead><tbody>`;
  for (const r of records) {
    html += `<tr><td>${r.period}교시</td><td>${escapeHtml(r.teacher)}</td><td>${escapeHtml(r.school)}</td><td>${escapeHtml(r.subject)}</td><td>${escapeHtml(r.time)}</td><td>${escapeHtml(r.classroom)}</td></tr>`;
  }
  html += `</tbody></table>`;
  html += `<p class="summary">${dateStr} (${weekdayLabel}요일) 기준 정규 시간표 · 총 ${records.length}개 수업 · 시험 기간 등 실제 학사일정에 따라 달라질 수 있습니다.</p>`;
  lastRecordsByView.date = records;
  html += downloadButtonHtml("date");
  container.innerHTML = noteHtml + html;
}

function init() {
  initTabs();
  initSlotButtons();

  document.getElementById("teacher-buttons").addEventListener("click", (e) => {
    if (!e.target.matches("button")) return;
    toggleSetMember(selectedTeachers, e.target.dataset.teacher, e.target);
    renderTeacherView();
  });
  document.getElementById("teacher-filter").addEventListener("input", (e) => filterChips("teacher-buttons", e.target.value));
  document.getElementById("teacher-reset").addEventListener("click", () => {
    selectedTeachers.clear();
    document.querySelectorAll("#teacher-buttons button.active").forEach((b) => b.classList.remove("active"));
    renderTeacherView();
  });
  document.getElementById("teacher-result").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-teacher]");
    if (!btn) return;
    const name = btn.dataset.removeTeacher;
    selectedTeachers.delete(name);
    const chip = document.querySelector(`#teacher-buttons button[data-teacher="${CSS.escape(name)}"]`);
    if (chip) chip.classList.remove("active");
    renderTeacherView();
  });

  document.getElementById("school-buttons").addEventListener("click", (e) => {
    if (!e.target.matches("button")) return;
    toggleSetMember(selectedSchools, e.target.dataset.school, e.target);
    renderSchoolView();
  });
  document.getElementById("school-filter").addEventListener("input", (e) => filterChips("school-buttons", e.target.value));
  document.getElementById("school-reset").addEventListener("click", () => {
    selectedSchools.clear();
    document.querySelectorAll("#school-buttons button.active").forEach((b) => b.classList.remove("active"));
    renderSchoolView();
  });
  document.getElementById("school-result").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-school]");
    if (!btn) return;
    const name = btn.dataset.removeSchool;
    selectedSchools.delete(name);
    const chip = document.querySelector(`#school-buttons button[data-school="${CSS.escape(name)}"]`);
    if (chip) chip.classList.remove("active");
    renderSchoolView();
  });

  document.getElementById("date-input").addEventListener("change", (e) => renderDateView(e.target.value));

  document.getElementById("app-content").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-download]");
    if (!btn) return;
    const key = btn.dataset.download;
    downloadCsv(`시간표_${key}`, lastRecordsByView[key]);
  });
}

async function start() {
  const statusEl = document.getElementById("load-status");
  const loginGate = document.getElementById("login-gate");
  let auth;
  try {
    auth = await checkAuthStatus();
  } catch (err) {
    statusEl.textContent = "로그인 처리 중 오류가 발생했습니다: " + err.message;
    statusEl.classList.add("error");
    return;
  }

  if (!auth.configured) {
    statusEl.textContent = "관리자가 아직 로그인 인증을 설정하지 않아 접근할 수 없습니다.";
    statusEl.classList.add("error");
    return;
  }

  if (!auth.signedIn) {
    statusEl.textContent = "로그인이 필요합니다.";
    loginGate.style.display = "";
    document.getElementById("login-btn").addEventListener("click", triggerLogin);
    return;
  }

  const userLabel = auth.account && (auth.account.username || auth.account.name);
  if (userLabel) statusEl.textContent = `${userLabel}(으)로 로그인됨 · 데이터를 불러오는 중...`;

  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.style.display = "";
  logoutBtn.addEventListener("click", signOut);

  document.getElementById("app-content").style.display = "";
  init();
  loadData(auth.idToken);
}

document.addEventListener("DOMContentLoaded", start);

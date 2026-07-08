// CSV -> 레코드 배열 변환 로직
// CSV 구조: 1~3행은 헤더(강의실,교사명,월1..금7,시수), 4행부터 데이터
// 각 요일·교시 셀은 줄바꿈으로 [파견학교, 과목명(1줄 이상), 시간] 을 담고 있음

const DAYS = ["월", "화", "수", "목", "금"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// 슬롯 컬럼 순서: 월1..월7, 화1..화7, 수1..수7, 목1..목7, 금1..금7 (총 35개, 앞 2열 뒤 1열 제외)
function buildSlotColumns() {
  const cols = [];
  for (const day of DAYS) {
    for (const period of PERIODS) {
      cols.push({ day, period });
    }
  }
  return cols;
}
const SLOT_COLUMNS = buildSlotColumns();

function cleanCell(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  const school = lines[0];
  const time = lines[lines.length - 1].replace(/[`'"]/g, "");
  const subject = lines.length > 2 ? lines.slice(1, -1).join(" ") : lines.length > 1 ? lines[1] : "";
  return { school, subject, time };
}

// rows: PapaParse 결과의 data 배열 (2차원 배열, 각 행은 문자열 배열)
function rowsToRecords(rows) {
  const records = [];
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 3) continue;
    const classroom = (row[0] || "").trim();
    const teacher = (row[1] || "").trim();
    if (!teacher) continue;

    for (let i = 0; i < SLOT_COLUMNS.length; i++) {
      const cellRaw = row[2 + i];
      if (!cellRaw || !cellRaw.trim()) continue;
      const parsed = cleanCell(cellRaw);
      if (!parsed) continue;
      const { day, period } = SLOT_COLUMNS[i];
      records.push({
        classroom,
        teacher,
        day,
        period,
        school: parsed.school,
        subject: parsed.subject,
        time: parsed.time,
      });
    }
  }
  return records;
}

function parseCsvText(csvText) {
  const result = Papa.parse(csvText, { skipEmptyLines: false });
  return rowsToRecords(result.data);
}

// 화면·저장소와 무관한 순수 로직 (node 테스트 대상)

export const QUESTION_TYPES = {
  attend: "참석 여부",
  items: "품목별 수량 (주문)",
  count: "숫자 입력",
  choice: "하나 고르기",
  multi: "여러 개 고르기",
  text: "자유 입력",
};

export const ATTEND_CHOICES = ["참석", "불참", "미정"];

export function newId(len = 8) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const rnd = (globalThis.crypto && crypto.getRandomValues)
    ? crypto.getRandomValues(new Uint32Array(len))
    : Array.from({ length: len }, () => Math.floor(Math.random() * 2 ** 32));
  for (let i = 0; i < len; i++) out += chars[rnd[i] % chars.length];
  return out;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function won(n) {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

// "야채김밥 | 3000" 형식 한 줄씩 → [{id,label,price}]
export function parseOptions(text, withPrice = false) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, price] = line.split("|").map((x) => x.trim());
      const opt = { id: newId(6), label };
      if (withPrice && price) {
        const p = Number(price.replace(/[^0-9.]/g, ""));
        if (Number.isFinite(p) && p > 0) opt.price = p;
      }
      return opt;
    });
}

// 이미 응답이 있는 조사를 고칠 때, 같은 이름의 항목은 기존 id를 유지해 응답이 끊기지 않게 함
export function mergeOptionIds(oldOptions = [], parsed = []) {
  const used = new Set();
  return parsed.map((o) => {
    const prev = oldOptions.find((x) => x.label === o.label && !used.has(x.id));
    if (prev) { used.add(prev.id); return { ...o, id: prev.id }; }
    return o;
  });
}

export function optionsToText(options = []) {
  return options.map((o) => (o.price ? `${o.label} | ${o.price}` : o.label)).join("\n");
}

export function isOpen(survey, now = Date.now()) {
  if (!survey || survey.status !== "open") return false;
  if (survey.deadlineMs && now >= survey.deadlineMs) return false;
  return true;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export function formatDeadline(ms) {
  if (!ms) return "없음";
  // 한국 시간 기준으로 표시
  const d = new Date(ms + 9 * 3600 * 1000);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEK[d.getUTCDay()]}) ${ampm} ${h12}시${m ? ` ${m}분` : ""}`;
}

export function koSort(names) {
  return [...names].sort((a, b) => a.localeCompare(b, "ko"));
}

export function sortByName(responses) {
  return [...responses].sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
}

export function validateSurvey(s) {
  const errors = [];
  if (!s.group) errors.push("모임을 골라 주세요.");
  if (!s.title || !s.title.trim()) errors.push("조사 제목을 입력해 주세요.");
  if (!s.questions || s.questions.length === 0) errors.push("질문을 하나 이상 추가해 주세요.");
  (s.questions || []).forEach((q, i) => {
    const n = i + 1;
    if (!q.label || !q.label.trim()) errors.push(`${n}번 질문 내용을 입력해 주세요.`);
    if (!QUESTION_TYPES[q.type]) errors.push(`${n}번 질문 형식이 올바르지 않습니다.`);
    if (["items", "choice", "multi"].includes(q.type) && (!q.options || q.options.length < 1)) {
      errors.push(`${n}번 질문의 항목을 한 줄에 하나씩 입력해 주세요.`);
    }
  });
  return errors;
}

function isEmptyAnswer(q, a) {
  if (a === undefined || a === null || a === "") return true;
  switch (q.type) {
    case "attend": return !a.choice;
    case "items": return !Object.values(a).some((v) => Number(v) > 0);
    case "multi": return !Array.isArray(a) || a.length === 0;
    case "count": return !Number.isFinite(Number(a));
    default: return false;
  }
}

export function validateResponse(survey, name, answers) {
  const errors = [];
  const nm = String(name || "").trim();
  if (!nm) errors.push("이름을 입력해 주세요. (예: 채아아빠)");
  if (nm.length > 30) errors.push("이름은 30자 이내로 입력해 주세요.");
  survey.questions.forEach((q, i) => {
    const a = answers[q.id];
    if (q.required && isEmptyAnswer(q, a)) errors.push(`${i + 1}번 "${q.label}"에 답해 주세요.`);
    if (q.type === "count" && a !== undefined && a !== "" && (Number(a) < 0 || !Number.isFinite(Number(a)))) {
      errors.push(`${i + 1}번은 0 이상의 숫자로 입력해 주세요.`);
    }
    if (q.type === "items" && a) {
      for (const v of Object.values(a)) {
        if (!(Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 999)) {
          errors.push(`${i + 1}번 수량은 0~999 사이 정수로 입력해 주세요.`);
          break;
        }
      }
    }
  });
  return errors;
}

// 저장 직전에 답을 정리 (빈 값 제거, 숫자 변환)
export function cleanAnswers(survey, answers) {
  const out = {};
  for (const q of survey.questions) {
    const a = answers[q.id];
    if (isEmptyAnswer(q, a)) continue;
    switch (q.type) {
      case "attend": {
        const v = { choice: a.choice };
        if (q.headcount && a.choice === "참석") v.headcount = Math.max(1, Number(a.headcount) || 1);
        out[q.id] = v;
        break;
      }
      case "items": {
        const v = {};
        for (const [k, n] of Object.entries(a)) if (Number(n) > 0) v[k] = Number(n);
        out[q.id] = v;
        break;
      }
      case "count": out[q.id] = Number(a); break;
      case "text": out[q.id] = String(a).trim().slice(0, 500); break;
      default: out[q.id] = a;
    }
  }
  return out;
}

export function aggregate(survey, responses) {
  return survey.questions.map((q) => {
    const answered = responses.filter((r) => r.answers && !isEmptyAnswer(q, r.answers[q.id]));
    const base = { q, answered: answered.length };
    switch (q.type) {
      case "attend": {
        const rows = ATTEND_CHOICES.map((c) => {
          const rs = answered.filter((r) => r.answers[q.id].choice === c);
          return {
            label: c,
            count: rs.length,
            people: rs.reduce((s, r) => s + (Number(r.answers[q.id].headcount) || 1), 0),
            names: koSort(rs.map((r) => r.name)),
          };
        });
        return { ...base, rows };
      }
      case "items": {
        let totalQty = 0, totalPrice = 0;
        const rows = q.options.map((o) => {
          const qty = answered.reduce((s, r) => s + (Number(r.answers[q.id][o.id]) || 0), 0);
          totalQty += qty;
          if (o.price) totalPrice += qty * o.price;
          return { label: o.label, qty, price: o.price ? qty * o.price : null };
        });
        const perPerson = sortByName(answered).map((r) => {
          const name = r.name;
          const a = r.answers[q.id];
          const parts = q.options.filter((o) => a[o.id] > 0).map((o) => `${o.label} ${a[o.id]}${q.unit || ""}`);
          const sum = q.options.reduce((s, o) => s + (o.price ? (a[o.id] || 0) * o.price : 0), 0);
          return { name, text: parts.join(", "), sum };
        });
        return { ...base, rows, totalQty, totalPrice, perPerson };
      }
      case "count": {
        const total = answered.reduce((s, r) => s + Number(r.answers[q.id]), 0);
        const list = sortByName(answered).map((r) => ({ name: r.name, value: r.answers[q.id] }));
        return { ...base, total, list };
      }
      case "choice":
      case "multi": {
        const rows = q.options.map((o) => {
          const rs = answered.filter((r) => {
            const a = r.answers[q.id];
            return Array.isArray(a) ? a.includes(o.id) : a === o.id;
          });
          return { label: o.label, count: rs.length, names: koSort(rs.map((r) => r.name)) };
        });
        return { ...base, rows };
      }
      case "text": {
        const list = sortByName(answered).map((r) => ({ name: r.name, value: r.answers[q.id] }));
        return { ...base, list };
      }
      default:
        return base;
    }
  });
}

export function answerText(q, a) {
  if (a === undefined || a === null || a === "") return "";
  switch (q.type) {
    case "attend":
      return a.choice + (a.choice === "참석" && q.headcount ? ` ${a.headcount || 1}명` : "");
    case "items":
      return q.options.filter((o) => a[o.id] > 0).map((o) => `${o.label} ${a[o.id]}${q.unit || ""}`).join(", ");
    case "count":
      return `${a}${q.unit || ""}`;
    case "choice":
      return q.options.find((o) => o.id === a)?.label || "";
    case "multi":
      return q.options.filter((o) => a.includes(o.id)).map((o) => o.label).join(", ");
    default:
      return String(a);
  }
}

export function buildInviteText(survey, url, groupName) {
  const lines = [`[조사] ${survey.title}`];
  if (groupName) lines[0] += ` (${groupName})`;
  lines.push("");
  if (survey.desc) lines.push(survey.desc.trim(), "");
  lines.push(`■ 마감: ${formatDeadline(survey.deadlineMs)}`);
  lines.push(`■ 응답: ${url}`);
  lines.push("", "링크를 눌러 이름과 답을 남겨 주세요. 같은 기기에서 다시 열면 수정할 수 있습니다.");
  return lines.join("\n");
}

export function buildSummaryText(survey, responses, groupName, roster = []) {
  const res = aggregate(survey, responses);
  const lines = [`[조사 결과] ${survey.title}${groupName ? ` (${groupName})` : ""}`];
  lines.push(`마감: ${formatDeadline(survey.deadlineMs)} · 응답 ${responses.length}명`);
  if (roster.length) {
    const m = matchRoster(roster, responses);
    lines.push(`응답 가정 ${m.answered.length}/${m.total}${m.missing.length ? ` · 미응답: ${m.missing.join(", ")}` : ""}`);
  }
  res.forEach((r, i) => {
    lines.push("", `${i + 1}. ${r.q.label}`);
    switch (r.q.type) {
      case "attend":
        r.rows.filter((x) => x.count > 0).forEach((x) => {
          const extra = r.q.headcount && x.label === "참석" ? ` (총 ${x.people}명)` : "";
          lines.push(`- ${x.label} ${x.count}가정${extra}: ${x.names.join(", ")}`);
        });
        break;
      case "items":
        r.rows.filter((x) => x.qty > 0).forEach((x) => {
          lines.push(`- ${x.label}: ${x.qty}${r.q.unit || ""}${x.price ? ` (${won(x.price)})` : ""}`);
        });
        lines.push(`합계 ${r.totalQty}${r.q.unit || ""}${r.totalPrice ? ` / ${won(r.totalPrice)}` : ""}`);
        if (r.perPerson.length) {
          lines.push("", "[주문자별]");
          r.perPerson.forEach((p) => lines.push(`- ${p.name}: ${p.text}${p.sum ? ` (${won(p.sum)})` : ""}`));
        }
        break;
      case "count":
        lines.push(`합계 ${r.total}${r.q.unit || ""}`);
        r.list.forEach((x) => lines.push(`- ${x.name}: ${x.value}${r.q.unit || ""}`));
        break;
      case "choice":
      case "multi":
        r.rows.filter((x) => x.count > 0).forEach((x) => lines.push(`- ${x.label} ${x.count}: ${x.names.join(", ")}`));
        break;
      case "text":
        r.list.forEach((x) => lines.push(`- ${x.name}: ${x.value}`));
        break;
    }
  });
  return lines.join("\n");
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(survey, responses) {
  const header = ["이름", ...survey.questions.map((q) => q.label), "응답 시각"];
  const rows = sortByName(responses).map((r) => {
    return [
      r.name,
      ...survey.questions.map((q) => answerText(q, r.answers?.[q.id])),
      r.updatedAt ? new Date(r.updatedAt).toISOString() : "",
    ];
  });
  // 엑셀에서 한글이 깨지지 않도록 BOM 추가
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

// 자주 쓰는 조사 양식
export function templates() {
  return {
    gimbap: {
      title: "김밥 주문",
      desc: "필요한 만큼 수량을 적어 주세요.",
      questions: [
        { id: newId(6), type: "items", label: "김밥 종류별 수량", required: true, unit: "줄",
          options: [{ id: newId(6), label: "야채김밥" }, { id: newId(6), label: "유부김밥" }] },
        { id: newId(6), type: "text", label: "요청 사항", required: false },
      ],
    },
    dinner: {
      title: "저녁 모임 참석",
      desc: "",
      questions: [
        { id: newId(6), type: "attend", label: "참석 여부", required: true, headcount: false },
        { id: newId(6), type: "text", label: "하고 싶은 말", required: false },
      ],
    },
    picnic: {
      title: "야유회 참석 인원",
      desc: "가족 단위로 참석 인원을 적어 주세요.",
      questions: [
        { id: newId(6), type: "attend", label: "참석 여부와 인원(어른+아이)", required: true, headcount: true },
        { id: newId(6), type: "text", label: "식사·알레르기 등 참고 사항", required: false },
      ],
    },
  };
}

// ---------- 명단(가정) ----------
// 한 줄 = 한 가정. 아이 이름을 쓰고, 쌍둥이·형제는 쉼표로 함께 씀. 예) "채아" / "정인, 현겸"
// 성까지 쓴 세 글자 이름(박채아)은 이름 두 글자(채아)로 맞춤
export function givenName(n) {
  const t = String(n).trim().replace(/\s+/g, "");
  return /^[가-힣]{3}$/.test(t) ? t.slice(1) : t;
}

export function parseRoster(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const kids = line.split(/[,，·/]/).map(givenName).filter(Boolean);
      return { label: kids.join("·"), keys: kids };
    })
    .filter((h) => h.keys.length);
}

export function rosterToText(roster = []) {
  return roster.map((h) => h.keys.join(", ")).join("\n");
}

// 응답 이름에 아이 이름이 들어 있으면 그 가정이 응답한 것으로 봄 (예: "채아아빠", "박상열(채아)")
export function matchRoster(roster = [], responses = []) {
  const names = responses.map((r) => String(r.name).replace(/\s+/g, ""));
  const used = new Set();
  const answered = [];
  const missing = [];
  for (const h of roster) {
    const hit = names.findIndex((n) => h.keys.some((k) => n.includes(k)));
    if (hit >= 0) {
      answered.push(h.label);
      names.forEach((n, i) => { if (h.keys.some((k) => n.includes(k))) used.add(i); });
    } else {
      missing.push(h.label);
    }
  }
  const unknown = responses.filter((_, i) => !used.has(i)).map((r) => r.name);
  return { total: roster.length, answered, missing: koSort(missing), unknown: koSort(unknown) };
}

export function buildReminderText(survey, url, missingLabels) {
  const lines = [`[조사 안내] ${survey.title}`, ""];
  lines.push(`아직 응답이 없는 가정: ${missingLabels.join(", ")}`);
  lines.push(`마감: ${formatDeadline(survey.deadlineMs)}`);
  lines.push(`응답: ${url}`);
  lines.push("", "바쁘시겠지만 시간 되실 때 답 부탁드립니다.");
  return lines.join("\n");
}

// ---------- 조사 문안(텍스트) ↔ 조사 ----------
// 채팅에서 받은 문안을 붙여 넣어 조사를 만들 때 쓰는 형식. 예:
//   모임: 2학년
//   제목: 김밥 주문
//   안내: 소풍날 아침에 받을 김밥입니다.
//   마감: 2026-11-04 21:00
//   결과공개: 아니오
//   질문: 품목 | 김밥 종류별 수량 | 필수 | 단위=줄
//   - 야채김밥 | 3000
//   질문: 하나 | 받는 곳 | 필수
//   - 학교 정문
export const TEXT_TYPES = { 참석: "attend", 품목: "items", 숫자: "count", 하나: "choice", 여러개: "multi", 글: "text" };
const TYPE_TO_TEXT = Object.fromEntries(Object.entries(TEXT_TYPES).map(([k, v]) => [v, k]));

function parseKstDate(s) {
  const m = String(s).trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?)?$/);
  if (!m) return undefined;
  const [, y, mo, d, h = "23", mi = "59"] = m;
  return Date.UTC(+y, +mo - 1, +d, +h - 9, +mi);
}

function kstDateText(ms) {
  const d = new Date(ms + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function parseSurveyText(text, groupList = []) {
  const errors = [];
  const s = { title: "", desc: "", group: "", deadlineMs: null, publicResults: true, status: "open", questions: [] };
  let last = null; // 마지막으로 연 필드: "desc" 또는 질문 객체
  String(text || "").replace(/\r/g, "").split("\n").forEach((raw, idx) => {
    const line = raw.trim();
    const n = idx + 1;
    if (!line || line.startsWith("```")) return;
    const kv = line.match(/^(모임|제목|안내|마감|결과공개|질문)\s*[:：]\s*(.*)$/);
    if (kv) {
      const [, key, val] = kv;
      last = null;
      if (key === "모임") {
        const g = groupList.find((x) => x.name === val.trim() || x.id === val.trim());
        if (g) s.group = g.id; else errors.push(`${n}줄: 모임 "${val}"을(를) 찾지 못했습니다.`);
      } else if (key === "제목") s.title = val.trim();
      else if (key === "안내") { s.desc = val.trim(); last = "desc"; }
      else if (key === "마감") {
        if (/^(없음|-)?$/.test(val.trim())) s.deadlineMs = null;
        else {
          const ms = parseKstDate(val);
          if (ms === undefined) errors.push(`${n}줄: 마감은 2026-11-04 21:00 형식으로 써 주세요.`);
          else s.deadlineMs = ms;
        }
      } else if (key === "결과공개") s.publicResults = !/^(아니오|아니요|비공개|x|no|false)$/i.test(val.trim());
      else if (key === "질문") {
        const parts = val.split("|").map((x) => x.trim());
        const type = TEXT_TYPES[parts[0]];
        if (!type) { errors.push(`${n}줄: 질문 형식은 ${Object.keys(TEXT_TYPES).join("·")} 중 하나로 써 주세요.`); return; }
        const q = { id: newId(6), type, label: parts[1] || "", required: true };
        for (const opt of parts.slice(2)) {
          if (opt === "선택") q.required = false;
          else if (opt === "필수") q.required = true;
          else if (opt === "인원" && type === "attend") q.headcount = true;
          else if (opt.startsWith("단위=")) q.unit = opt.slice(3).trim();
        }
        if (["items", "choice", "multi"].includes(type)) q.options = [];
        if (type === "attend") q.headcount = !!q.headcount;
        s.questions.push(q);
        last = q;
      }
      return;
    }
    if (line.startsWith("-")) {
      if (last && last.options) {
        const [label, price] = line.slice(1).split("|").map((x) => x.trim());
        const o = { id: newId(6), label };
        const p = Number(String(price || "").replace(/[^0-9.]/g, ""));
        if (last.type === "items" && p > 0) o.price = p;
        if (label) last.options.push(o);
      } else errors.push(`${n}줄: 항목(-)은 품목·하나·여러개 질문 아래에 써 주세요.`);
      return;
    }
    if (last === "desc") { s.desc += `\n${line}`; return; }
    errors.push(`${n}줄을 이해하지 못했습니다: ${line.slice(0, 30)}`);
  });
  return { survey: s, errors: [...errors, ...validateSurvey(s)] };
}

export function surveyToText(s, groupList = []) {
  const lines = [];
  lines.push(`모임: ${groupList.find((g) => g.id === s.group)?.name || s.group}`);
  lines.push(`제목: ${s.title}`);
  if (s.desc) lines.push(`안내: ${s.desc}`);
  lines.push(`마감: ${s.deadlineMs ? kstDateText(s.deadlineMs) : "없음"}`);
  lines.push(`결과공개: ${s.publicResults ? "예" : "아니오"}`);
  for (const q of s.questions) {
    const opts = [q.required ? "필수" : "선택"];
    if (q.type === "attend" && q.headcount) opts.push("인원");
    if (q.unit) opts.push(`단위=${q.unit}`);
    lines.push(`질문: ${TYPE_TO_TEXT[q.type]} | ${q.label} | ${opts.join(" | ")}`);
    for (const o of q.options || []) lines.push(`- ${o.label}${o.price ? ` | ${o.price}` : ""}`);
  }
  return lines.join("\n");
}

// 지난 조사로 다음 회차 만들기: 마감을 7일 뒤로(이미 지났으면 오늘부터 3일 뒤 밤 9시)
export function nextRound(survey, now = Date.now()) {
  const { id, createdAt, updatedAt, ...rest } = survey;
  let deadlineMs = null;
  if (survey.deadlineMs) {
    deadlineMs = survey.deadlineMs;
    while (deadlineMs <= now) deadlineMs += 7 * 24 * 3600 * 1000;
  }
  return { ...rest, title: survey.title.replace(/\s*\(복사본\)$/, ""), status: "open", deadlineMs };
}

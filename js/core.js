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
  if (!ms) return "마감 없음";
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

export function buildSummaryText(survey, responses, groupName) {
  const res = aggregate(survey, responses);
  const lines = [`[조사 결과] ${survey.title}${groupName ? ` (${groupName})` : ""}`];
  lines.push(`마감: ${formatDeadline(survey.deadlineMs)} · 응답 ${responses.length}명`);
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

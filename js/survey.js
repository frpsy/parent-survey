import { getSurvey, getMyResponse, saveMyResponse, deleteMyResponse, watchResponses } from "./store.js";
import {
  escapeHtml, formatDeadline, isOpen, validateResponse, cleanAnswers, ATTEND_CHOICES,
  answerText, aggregate, won, dueLabel, buildSummaryText,
} from "./core.js";
import { $, $$, header, modeBanner, groupName, errorsBox, toast, fail, markDone, shareLink, surveyUrl, copyText } from "./ui.js";

const root = $("#app");
const id = new URLSearchParams(location.search).get("id");
const NAME_KEY = "ps_last_name";

function qInput(q, a) {
  const name = `q_${q.id}`;
  switch (q.type) {
    case "attend": {
      const head = q.headcount
        ? `<div class="hc" ${a?.choice === "참석" ? "" : "hidden"}>
             <label class="field" for="${name}_hc">함께 오는 인원 <span class="hint">(본인 포함, 어른+아이)</span></label>
             <input type="number" id="${name}_hc" min="1" max="20" inputmode="numeric" value="${escapeHtml(a?.headcount || 1)}">
           </div>` : "";
      return `<div class="choices" role="radiogroup" aria-label="${escapeHtml(q.label)}">
        ${ATTEND_CHOICES.map((c) => `<label class="choice"><input type="radio" name="${name}" value="${c}" ${a?.choice === c ? "checked" : ""}><span>${c}</span></label>`).join("")}
      </div>${head}`;
    }
    case "items":
      return q.options.map((o) => `<div class="menu-item ${(a?.[o.id] || 0) > 0 ? "on" : ""}">
        <div><div style="font-weight:600">${escapeHtml(o.label)}</div>${o.price ? `<div class="price">${won(o.price)}</div>` : ""}</div>
        <div class="stepper row" style="gap:0;flex-wrap:nowrap">
          <button type="button" data-step="-1" aria-label="${escapeHtml(o.label)} 줄이기">−</button>
          <input type="number" min="0" max="999" inputmode="numeric" data-item="${o.id}" value="${escapeHtml(a?.[o.id] || 0)}" aria-label="${escapeHtml(o.label)} 수량">
          <button type="button" data-step="1" aria-label="${escapeHtml(o.label)} 늘리기">+</button>
        </div>
      </div>`).join("");
    case "count":
      return `<div class="row"><input type="number" name="${name}" min="0" inputmode="numeric" style="max-width:140px" value="${escapeHtml(a ?? "")}"> <span>${escapeHtml(q.unit || "")}</span></div>`;
    case "choice":
      return `<div class="choices">${q.options.map((o) => `<label class="choice"><input type="radio" name="${name}" value="${o.id}" ${a === o.id ? "checked" : ""}><span>${escapeHtml(o.label)}</span></label>`).join("")}</div>`;
    case "multi":
      return `<div class="choices">${q.options.map((o) => `<label class="choice"><input type="checkbox" name="${name}" value="${o.id}" ${Array.isArray(a) && a.includes(o.id) ? "checked" : ""}><span>${escapeHtml(o.label)}</span></label>`).join("")}</div>`;
    default:
      return `<textarea name="${name}" maxlength="500">${escapeHtml(a || "")}</textarea>`;
  }
}

function readAnswers(survey) {
  const out = {};
  for (const q of survey.questions) {
    const box = $(`[data-q="${q.id}"]`);
    const name = `q_${q.id}`;
    switch (q.type) {
      case "attend": {
        const c = $(`input[name="${name}"]:checked`, box)?.value;
        if (c) out[q.id] = { choice: c, headcount: Number($(`#${name}_hc`, box)?.value) || 1 };
        break;
      }
      case "items": {
        const v = {};
        $$("[data-item]", box).forEach((i) => { v[i.dataset.item] = Number(i.value) || 0; });
        out[q.id] = v;
        break;
      }
      case "count": {
        const v = $(`input[name="${name}"]`, box).value;
        if (v !== "") out[q.id] = Number(v);
        break;
      }
      case "choice": {
        const c = $(`input[name="${name}"]:checked`, box)?.value;
        if (c) out[q.id] = c;
        break;
      }
      case "multi":
        out[q.id] = $$(`input[name="${name}"]:checked`, box).map((i) => i.value);
        break;
      default:
        out[q.id] = $(`textarea[name="${name}"]`, box).value;
    }
  }
  return out;
}

function itemTotal(q, box) {
  let qty = 0, sum = 0;
  $$("[data-item]", box).forEach((i) => {
    const n = Number(i.value) || 0;
    qty += n;
    const o = q.options.find((x) => x.id === i.dataset.item);
    if (o?.price) sum += n * o.price;
  });
  $$(".menu-item", box).forEach((m) => m.classList.toggle("on", Number($("input", m).value) > 0));
  updateBar();
}

function bind(survey) {
  for (const q of survey.questions) {
    const box = $(`[data-q="${q.id}"]`);
    if (q.type === "attend" && q.headcount) {
      $$(`input[type=radio]`, box).forEach((r) => r.addEventListener("change", () => {
        $(".hc", box).hidden = r.value !== "참석";
      }));
    }
    if (q.type === "items") {
      $$("[data-step]", box).forEach((b) => b.addEventListener("click", () => {
        const input = $("input", b.parentElement);
        input.value = Math.max(0, Math.min(999, (Number(input.value) || 0) + Number(b.dataset.step)));
        itemTotal(q, box);
      }));
      $$("[data-item]", box).forEach((i) => i.addEventListener("input", () => itemTotal(q, box)));
      itemTotal(q, box);
    }
  }
}

const ICON = {
  list: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  user: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  board: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12l5 5L20 7"/></svg>',
};
const AV = ["#f0712a", "#1f9e5a", "#3b7dd8", "#a654c9", "#d4448a", "#2a9d9b"];
function avatar(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `<span class="avatar" style="background:${AV[h % AV.length]}">${escapeHtml(Array.from(String(name).trim())[0] || "?")}</span>`;
}

// 모두가 보는 실시간 현황판 (자유 입력 답은 보여 주지 않음)
let lastResponses = [];
function liveBoard(survey, responses) {
  lastResponses = responses;
  const res = aggregate(survey, responses);
  const unitOf = (q) => escapeHtml(q.unit || "");
  const blocks = res.map((r) => {
    if (r.q.type === "items") {
      return `${res.length > 1 ? `<div class="q-label">${escapeHtml(r.q.label)}</div>` : ""}
        ${r.rows.map((x) => `<div class="stat"><span>${escapeHtml(x.label)}</span><span><b>${x.qty}${unitOf(r.q)}</b>${x.price ? ` <span class="sub">${won(x.price)}</span>` : ""}</span></div>`).join("")}
        <div class="tot"><span>총 ${r.perPerson.length}명 · ${r.totalQty}${unitOf(r.q)}</span><span class="amt">${r.totalPrice ? won(r.totalPrice) : `${r.totalQty}${unitOf(r.q)}`}</span></div>
        ${r.perPerson.map((p) => `<div class="person">${avatar(p.name)}<div class="who"><div class="row1"><span>${escapeHtml(p.name)}</span>${p.sum ? `<span>${won(p.sum)}</span>` : ""}</div><div class="what">${escapeHtml(p.text)}</div></div></div>`).join("")}`;
    }
    if (r.q.type === "attend" || r.q.type === "choice" || r.q.type === "multi") {
      return `<div class="q"><div class="q-label">${escapeHtml(r.q.label)}</div>${r.rows.map((x) => `<div class="stat"><span>${escapeHtml(x.label)}</span><b>${x.count}${r.q.type === "attend" ? "가정" : ""}${r.q.type === "attend" && r.q.headcount && x.label === "참석" ? ` · 총 ${x.people}명` : ""}</b></div>${x.names?.length ? `<div class="names">${x.names.map(escapeHtml).join(", ")}</div>` : ""}`).join("")}</div>`;
    }
    if (r.q.type === "count") {
      return `<div class="q"><div class="q-label">${escapeHtml(r.q.label)}</div><div class="tot"><span>합계</span><span class="amt">${r.total}${unitOf(r.q)}</span></div>${r.list.map((x) => `<div class="stat"><span>${escapeHtml(x.name)}</span><span>${escapeHtml(x.value)}${unitOf(r.q)}</span></div>`).join("")}</div>`;
    }
    return "";
  }).join("");
  return `<div class="card">
    <div class="sec-h">${ICON.board}전체 현황 <span class="live-dot">실시간 · ${responses.length}명</span></div>
    ${responses.length ? blocks : `<div class="empty" style="padding:16px 0">아직 응답이 없습니다. 첫 응답을 남겨 주세요.</div>`}
    ${responses.length ? `<button class="btn kakao block" id="kakao" type="button" style="margin-top:14px">카톡 공유용 요약 복사</button>` : ""}
  </div>`;
}

// 아래 고정 바: 지금 고른 내용과 금액
function updateBar() {
  const bar = $("#barsum");
  if (!bar || !currentSurvey) return;
  const answers = readAnswers(currentSurvey);
  let total = 0;
  const parts = [];
  for (const q of currentSurvey.questions) {
    const a = answers[q.id];
    if (q.type === "items" && a) {
      for (const o of q.options) if (a[o.id] > 0) { parts.push(`${o.label} ${a[o.id]}`); if (o.price) total += a[o.id] * o.price; }
    } else if (q.type !== "text") {
      const t = answerText(q, a);
      if (t) parts.push(t);
    }
  }
  const hasPrice = currentSurvey.questions.some((q) => q.type === "items" && q.options.some((o) => o.price));
  bar.innerHTML = `<small>${parts.length ? escapeHtml(parts.join(", ")) : "아직 고른 내용이 없습니다"}</small><b>${hasPrice ? won(total) : `${parts.length ? "선택 완료" : "　"}`}</b>`;
}

let stopBoard = null;
function startBoard(survey) {
  if (stopBoard) { stopBoard(); stopBoard = null; }
  const el = $("#board");
  if (!el || !survey.publicResults) return;
  el.innerHTML = `<div class="card sub">현황을 불러오는 중…</div>`;
  stopBoard = watchResponses(survey.id, (responses) => {
    const box = $("#board");
    if (!box) return;
    box.innerHTML = liveBoard(survey, responses);
    $("#kakao", box)?.addEventListener("click", () => copyText(buildSummaryText(survey, lastResponses, groupName(survey.group)), "요약을 복사했습니다. 카톡에 붙여 넣으세요"));
  }, () => {
    const box = $("#board");
    if (box) box.innerHTML = "";
  });
}

let editing = false;
let currentSurvey = null;

async function render(survey, mine, message = "") {
  const open = isOpen(survey);
  const due = dueLabel(survey);
  const showForm = open && (!mine || editing);
  const lastName = mine?.name || (() => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } })();

  currentSurvey = survey;
  document.body.classList.toggle("has-bar", showForm);
  root.innerHTML = `
    <div class="hero">
      <div class="top">
        <a class="btn small" href="./#${encodeURIComponent(survey.group)}">목록</a>
        <span class="pill ${due.tone}">${escapeHtml(groupName(survey.group))} · ${due.text}</span>
        <span class="spacer"></span>
        ${mine && !showForm && open ? `<button class="btn small" id="edit2" type="button">내 응답 수정</button>` : ""}
        <button class="btn small" id="share" type="button">공유</button>
      </div>
      <h1>${escapeHtml(survey.title)}</h1>
      ${survey.desc ? `<p>${escapeHtml(survey.desc)}</p>` : ""}
      <div class="meta" style="margin-top:6px">마감 ${escapeHtml(formatDeadline(survey.deadlineMs))}</div>
    </div>
    ${modeBanner()}
    ${message}
    ${mine && !showForm ? `<div class="card mine">
      <div class="sec-h">${ICON.check}내 응답</div>
      <div class="stat"><span>이름</span><b>${escapeHtml(mine.name)}</b></div>
      ${survey.questions.map((q) => { const t = answerText(q, mine.answers?.[q.id]); return t ? `<div class="stat"><span>${escapeHtml(q.label)}</span><span style="text-align:right">${escapeHtml(t)}</span></div>` : ""; }).join("")}
      ${open ? `<button class="btn block" id="edit" style="margin-top:10px">수정하기</button>` : ""}
    </div>` : ""}
    ${showForm ? `
    <form id="form" novalidate>
      ${survey.questions.map((q, i) => `<div class="card" data-q="${q.id}">
        <div class="sec-h">${q.type === "items" ? ICON.list : ICON.check}${escapeHtml(q.label)}${q.required ? `<span class="req">*</span>` : ""}</div>
        ${qInput(q, mine?.answers?.[q.id])}
      </div>`).join("")}
      <div class="card">
        <div class="sec-h">${ICON.user}응답자 정보</div>
        <label class="field" for="name" style="margin-top:0">이름 <span class="req">*</span></label>
        <input type="text" id="name" maxlength="30" autocomplete="nickname" placeholder="예: 채아아빠" value="${escapeHtml(lastName)}">
        <div class="hint" style="margin-top:6px">같은 기기에서 다시 열면 수정·취소할 수 있어요.</div>
        <div id="err"></div>
        ${mine ? `<button class="btn danger block" type="button" id="del" style="margin-top:12px">내 응답 취소</button>` : ""}
      </div>
    </form>
    <div class="bottombar"><div class="in">
      <div class="sum" id="barsum"></div>
      <button class="btn primary" type="submit" form="form">${mine ? "수정 저장" : "응답 보내기"}</button>
    </div></div>` : !open ? `<div class="card sub">마감된 조사입니다.</div>` : ""}
    <div id="board"></div>
  `;

  startBoard(survey);
  $("#share").addEventListener("click", () => shareLink(survey.title, surveyUrl(survey.id)));
  $("#edit")?.addEventListener("click", () => { editing = true; render(survey, mine); });
  $("#edit2")?.addEventListener("click", () => { editing = true; render(survey, mine); });
  if (!showForm) return;
  bind(survey);
  $("#form").addEventListener("change", updateBar);
  $("#form").addEventListener("input", updateBar);
  updateBar();
  $("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#name").value.trim();
    const answers = readAnswers(survey);
    const errors = validateResponse(survey, name, answers);
    $("#err").innerHTML = errorsBox(errors);
    if (errors.length) { $("#err").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const btn = e.submitter || $(".bottombar button[type=submit]");
    btn.disabled = true;
    try {
      await saveMyResponse(survey.id, name, cleanAnswers(survey, answers));
      try { localStorage.setItem(NAME_KEY, name); } catch { /* 무시 */ }
      markDone(survey.id);
      editing = false;
      const fresh = await getMyResponse(survey.id);
      await render(survey, fresh, `<div class="ok" role="status">응답이 저장되었습니다. 고맙습니다!</div>`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      btn.disabled = false;
      $("#err").innerHTML = errorsBox(["저장하지 못했습니다. 마감되었거나 연결이 불안정할 수 있습니다."]);
      console.error(err);
    }
  });
  $("#del")?.addEventListener("click", async () => {
    if (!confirm("내 응답을 취소할까요?")) return;
    await deleteMyResponse(survey.id);
    markDone(survey.id, false);
    editing = false;
    toast("응답을 취소했습니다");
    await render(survey, null);
  });
}

(async () => {
  try {
    if (!id) { location.replace("./"); return; }
    const survey = await getSurvey(id);
    if (!survey) {
      root.innerHTML = `${header()}<div class="card">조사를 찾을 수 없습니다. 링크를 다시 확인해 주세요.</div>`;
      return;
    }
    document.title = `${survey.title} - 학부모 조사함`;
    const mine = await getMyResponse(id);
    if (mine) markDone(id);
    await render(survey, mine);
  } catch (e) {
    fail(root, e);
  }
})();

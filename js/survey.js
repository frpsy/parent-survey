import { getSurvey, getMyResponse, saveMyResponse, deleteMyResponse, watchResponses } from "./store.js";
import {
  escapeHtml, formatDeadline, isOpen, validateResponse, cleanAnswers, ATTEND_CHOICES,
  answerText, aggregate, won, dueLabel,
} from "./core.js";
import { $, $$, header, modeBanner, groupName, errorsBox, toast, fail, markDone, shareLink, surveyUrl } from "./ui.js";

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
      return q.options.map((o) => `<div class="item-row">
        <div>${escapeHtml(o.label)}${o.price ? ` <span class="hint">${won(o.price)}</span>` : ""}</div>
        <div class="stepper">
          <button type="button" class="btn small" data-step="-1" aria-label="${escapeHtml(o.label)} 줄이기">−</button>
          <input type="number" min="0" max="999" inputmode="numeric" data-item="${o.id}" value="${escapeHtml(a?.[o.id] || 0)}" aria-label="${escapeHtml(o.label)} 수량">
          <button type="button" class="btn small" data-step="1" aria-label="${escapeHtml(o.label)} 늘리기">+</button>
        </div>
      </div>`).join("") + `<div class="hint" data-total></div>`;
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
  const t = $("[data-total]", box);
  if (t) t.textContent = qty ? `합계 ${qty}${q.unit || ""}${sum ? ` · ${won(sum)}` : ""}` : "";
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

// 모두가 보는 실시간 현황판 (자유 입력 답은 보여 주지 않음)
function liveBoard(survey, responses) {
  const res = aggregate(survey, responses);
  const t = new Date();
  const hhmm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  const unitOf = (q) => escapeHtml(q.unit || "");
  const blocks = res.map((r) => {
    let body = "";
    if (r.q.type === "items") {
      body = `<div class="stat"><span>합계</span><b class="big">${r.totalQty}${unitOf(r.q)}</b></div>`
        + r.rows.map((x) => `<div class="stat"><span>${escapeHtml(x.label)}</span><b>${x.qty}${unitOf(r.q)}${x.price ? ` · ${won(x.price)}` : ""}</b></div>`).join("")
        + (r.totalPrice ? `<div class="stat"><span>금액 합계</span><b>${won(r.totalPrice)}</b></div>` : "")
        + (r.perPerson.length ? `<details open><summary>누가 얼마나 (${r.perPerson.length}명)</summary>${r.perPerson.map((p) => `<div class="stat"><span>${escapeHtml(p.name)}</span><span style="text-align:right">${escapeHtml(p.text)}</span></div>`).join("")}</details>` : "");
    } else if (r.q.type === "attend" || r.q.type === "choice" || r.q.type === "multi") {
      body = r.rows.map((x) => `<div class="stat"><span>${escapeHtml(x.label)}</span><b>${x.count}${r.q.type === "attend" ? "가정" : ""}${r.q.type === "attend" && r.q.headcount && x.label === "참석" ? ` · 총 ${x.people}명` : ""}</b></div>${x.names?.length ? `<div class="names">${x.names.map(escapeHtml).join(", ")}</div>` : ""}`).join("");
    } else if (r.q.type === "count") {
      body = `<div class="stat"><span>합계</span><b class="big">${r.total}${unitOf(r.q)}</b></div>`
        + r.list.map((x) => `<div class="stat"><span>${escapeHtml(x.name)}</span><span>${escapeHtml(x.value)}${unitOf(r.q)}</span></div>`).join("");
    } else {
      return "";
    }
    return `<div class="q"><div class="q-label">${escapeHtml(r.q.label)}</div>${body}</div>`;
  }).join("");
  return `<div class="card">
    <div class="row"><h3 style="margin:0">실시간 현황</h3><span class="pill">${responses.length}명 응답</span><span class="spacer"></span><span class="sub">${hhmm} 갱신</span></div>
    ${responses.length ? blocks : `<div class="empty" style="padding:16px 0">아직 응답이 없습니다. 첫 응답을 남겨 주세요.</div>`}
  </div>`;
}

let stopBoard = null;
function startBoard(survey) {
  if (stopBoard) { stopBoard(); stopBoard = null; }
  const el = $("#board");
  if (!el || !survey.publicResults) return;
  el.innerHTML = `<div class="card sub">현황을 불러오는 중…</div>`;
  stopBoard = watchResponses(survey.id, (responses) => {
    const box = $("#board");
    if (box) box.innerHTML = liveBoard(survey, responses);
  }, () => {
    const box = $("#board");
    if (box) box.innerHTML = "";
  });
}

let editing = false;

async function render(survey, mine, message = "") {
  const open = isOpen(survey);
  const due = dueLabel(survey);
  const showForm = open && (!mine || editing);
  const lastName = mine?.name || (() => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } })();

  root.innerHTML = `
    ${header(`<a class="btn small" href="./#${encodeURIComponent(survey.group)}">목록</a>`)}
    ${modeBanner()}
    <div class="card">
      <div class="meta row"><span>${escapeHtml(groupName(survey.group))}</span>
        <span class="pill ${due.tone}">${due.text}</span>
        <span class="spacer"></span>
        <button class="btn small" id="share" type="button">공유</button></div>
      <h2 style="margin-top:6px">${escapeHtml(survey.title)}</h2>
      ${survey.desc ? `<p style="white-space:pre-line;margin:6px 0 4px">${escapeHtml(survey.desc)}</p>` : ""}
      <div class="meta">마감 ${escapeHtml(formatDeadline(survey.deadlineMs))}</div>
    </div>
    ${message}
    ${mine && !showForm ? `<div class="card mine">
      <div class="row"><h3 style="margin:0">내 응답</h3><span class="pill done">응답함</span></div>
      <div class="stat"><span>이름</span><b>${escapeHtml(mine.name)}</b></div>
      ${survey.questions.map((q) => { const t = answerText(q, mine.answers?.[q.id]); return t ? `<div class="stat"><span>${escapeHtml(q.label)}</span><span style="text-align:right">${escapeHtml(t)}</span></div>` : ""; }).join("")}
      ${open ? `<button class="btn block" id="edit" style="margin-top:10px">수정하기</button>` : ""}
    </div>` : ""}
    <div id="board"></div>
    ${showForm ? `
    <form class="card" id="form" novalidate>
      <label class="field" for="name">이름 <span class="req">*</span> <span class="hint">예: 채아아빠, 홍길동(채아맘)</span></label>
      <input type="text" id="name" maxlength="30" autocomplete="nickname" value="${escapeHtml(lastName)}">
      ${survey.questions.map((q, i) => `<div class="q" data-q="${q.id}">
        <div class="q-label">${i + 1}. ${escapeHtml(q.label)}${q.required ? `<span class="req">*</span>` : ""}</div>
        ${qInput(q, mine?.answers?.[q.id])}
      </div>`).join("")}
      <div id="err"></div>
      <button class="btn primary block" type="submit">${mine ? "수정 저장" : "응답 보내기"}</button>
      ${mine ? `<button class="btn danger block" type="button" id="del" style="margin-top:8px">내 응답 취소</button>` : ""}
    </form>` : !open ? `<div class="card sub">마감된 조사입니다.</div>` : ""}
  `;

  startBoard(survey);
  $("#share").addEventListener("click", () => shareLink(survey.title, surveyUrl(survey.id)));
  $("#edit")?.addEventListener("click", () => { editing = true; render(survey, mine); });
  if (!showForm) return;
  bind(survey);
  $("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#name").value.trim();
    const answers = readAnswers(survey);
    const errors = validateResponse(survey, name, answers);
    $("#err").innerHTML = errorsBox(errors);
    if (errors.length) { $("#err").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const btn = e.submitter || $("button[type=submit]");
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

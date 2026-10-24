import { groups } from "./config.js";
import {
  mode, adminState, adminSignIn, adminSignOut, listSurveys, getSurvey, saveSurvey, deleteSurvey,
  listResponses, deleteResponse, getRoster, saveRoster, watchResponses,
} from "./store.js";
import {
  QUESTION_TYPES, escapeHtml, formatDeadline, isOpen, validateSurvey, parseOptions, optionsToText,
  mergeOptionIds, templates, newId, aggregate, answerText, buildInviteText, buildSummaryText, toCSV,
  won, sortByName, parseRoster, rosterToText, matchRoster, buildReminderText,
  parseSurveyText, surveyToText, nextRound,
} from "./core.js";
import { $, $$, header, modeBanner, groupName, errorsBox, toast, copyText, surveyUrl, fail } from "./ui.js";

const root = $("#app");
let currentGroup = groups[0].id;

function signOutBtn(state) {
  return `<button class="btn small" id="signout" title="${escapeHtml(state.email || "")}">로그아웃</button>`;
}
function bindSignOut() {
  $("#signout")?.addEventListener("click", async () => { await adminSignOut(); route(); });
}

// ---------- 목록 ----------
async function viewList(state) {
  const surveys = await listSurveys();
  const counts = {};
  await Promise.all(surveys.map(async (s) => {
    try { counts[s.id] = (await listResponses(s.id)).length; } catch { counts[s.id] = "?"; }
  }));
  const mine = surveys.filter((s) => s.group === currentGroup).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  let roster = [];
  try { roster = await getRoster(currentGroup); } catch { /* 무시 */ }

  root.innerHTML = `
    ${header(signOutBtn(state))}
    ${modeBanner()}
    <div class="tabs" role="tablist">
      ${groups.map((g) => `<button class="tab" role="tab" data-g="${g.id}" aria-selected="${g.id === currentGroup}">${escapeHtml(g.name)}</button>`).join("")}
    </div>
    <div class="card">
      <h3>새 조사 만들기</h3>
      <div class="sub" style="margin-bottom:10px">${escapeHtml(groupName(currentGroup))}에 만듭니다. 양식을 고른 뒤 고칠 수 있습니다.</div>
      <div class="row">
        <a class="btn small" href="#new/${currentGroup}/gimbap">김밥 주문</a>
        <a class="btn small" href="#new/${currentGroup}/dinner">저녁 모임 참석</a>
        <a class="btn small" href="#new/${currentGroup}/picnic">야유회 참석 인원</a>
        <a class="btn small" href="#new/${currentGroup}/blank">빈 양식</a>
      </div>
      <a class="btn primary block" href="#paste/${currentGroup}" style="margin-top:10px">문안 붙여넣기로 만들기</a>
    </div>
    ${groups.find((g) => g.id === currentGroup)?.roster === false ? "" : `<div class="card row">
      <div><b>학부모 명단</b> <span class="sub">${roster.length ? `${roster.length}가정` : "아직 없음"} · 관리자만 봅니다</span></div>
      <span class="spacer"></span>
      <a class="btn small" href="#roster/${currentGroup}">${roster.length ? "명단 수정" : "명단 넣기"}</a>
    </div>`}
    <div class="section-title">조사 ${mine.length}건</div>
    ${mine.length ? mine.map((s) => `<a class="card" href="#r/${s.id}">
        <h3>${escapeHtml(s.title)}</h3>
        <div class="meta">
          <span class="pill ${isOpen(s) ? "" : "closed"}">${isOpen(s) ? "진행 중" : "마감"}</span>
          <span>응답 ${counts[s.id]}명</span>
          <span>마감 ${escapeHtml(formatDeadline(s.deadlineMs))}</span>
        </div>
      </a>`).join("") : `<div class="empty">아직 만든 조사가 없습니다.</div>`}
    <footer><a href="./#${currentGroup}">학부모용 목록 보기</a></footer>
  `;
  bindSignOut();
  $$(".tab").forEach((b) => b.addEventListener("click", () => { currentGroup = b.dataset.g; viewList(state); }));
}

// ---------- 편집 ----------
function toLocalInput(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(21, 0, 0, 0);
  return d.getTime();
}

function editorQ(q, i, total) {
  const needsOptions = ["items", "choice", "multi"].includes(q.type);
  return `<div class="editor-q" data-i="${i}">
    <div class="row">
      <b>${i + 1}.</b>
      <select data-f="type" aria-label="질문 형식" style="flex:1">
        ${Object.entries(QUESTION_TYPES).map(([k, v]) => `<option value="${k}" ${q.type === k ? "selected" : ""}>${v}</option>`).join("")}
      </select>
    </div>
    <label class="field">질문</label>
    <input type="text" data-f="label" value="${escapeHtml(q.label || "")}" maxlength="80">
    ${needsOptions ? `
      <label class="field">항목 <span class="hint">한 줄에 하나${q.type === "items" ? ", 가격은 '이름 | 3000' 형식(선택)" : ""}</span></label>
      <textarea data-f="options">${escapeHtml(q._optText ?? optionsToText(q.options))}</textarea>` : ""}
    ${q.type === "items" || q.type === "count" ? `
      <label class="field">단위 <span class="hint">예: 줄, 개, 명</span></label>
      <input type="text" data-f="unit" value="${escapeHtml(q.unit || "")}" maxlength="6" style="max-width:120px">` : ""}
    <div class="row">
      <label class="row"><input type="checkbox" data-f="required" ${q.required ? "checked" : ""}> 필수</label>
      ${q.type === "attend" ? `<label class="row"><input type="checkbox" data-f="headcount" ${q.headcount ? "checked" : ""}> 참석 인원도 받기</label>` : ""}
      <span class="spacer"></span>
      <button type="button" class="btn small" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="위로">↑</button>
      <button type="button" class="btn small" data-act="down" ${i === total - 1 ? "disabled" : ""} aria-label="아래로">↓</button>
      <button type="button" class="btn small danger" data-act="del">삭제</button>
    </div>
  </div>`;
}

async function viewEdit(state, draft, hasResponses) {
  const original = JSON.parse(JSON.stringify(draft));
  const paint = (errors = []) => {
    root.innerHTML = `
      ${header(signOutBtn(state))}
      ${modeBanner()}
      <a class="btn small" href="${draft.id ? `#r/${draft.id}` : "#"}">← 돌아가기</a>
      <form class="card" id="ed" style="margin-top:12px" novalidate>
        <h3>${draft.id ? "조사 수정" : "새 조사"}</h3>
        ${hasResponses ? `<div class="banner">이미 응답이 있습니다. 항목 이름을 바꾸거나 지우면 그 항목의 기존 응답은 집계에서 빠집니다.</div>` : ""}
        <label class="field">모임</label>
        <select id="group">${groups.map((g) => `<option value="${g.id}" ${draft.group === g.id ? "selected" : ""}>${escapeHtml(g.name)}</option>`).join("")}</select>
        <label class="field">제목</label>
        <input type="text" id="title" value="${escapeHtml(draft.title)}" maxlength="60">
        <label class="field">안내 문구 <span class="hint">(선택)</span></label>
        <textarea id="desc" maxlength="1000">${escapeHtml(draft.desc || "")}</textarea>
        <label class="field">마감 <span class="hint">비우면 직접 마감할 때까지 받습니다</span></label>
        <input type="datetime-local" id="deadline" value="${toLocalInput(draft.deadlineMs)}">
        <label class="row" style="margin-top:12px"><input type="checkbox" id="pub" ${draft.publicResults ? "checked" : ""}> 모두에게 실시간 현황판 공개 (이름 포함)</label>
        <div class="section-title">질문</div>
        <div id="qs">${draft.questions.map((q, i) => editorQ(q, i, draft.questions.length)).join("")}</div>
        <div class="row" style="margin:6px 0 4px">
          <button type="button" class="btn small" id="addq">+ 질문 추가</button>
        </div>
        ${errorsBox(errors)}
        <button class="btn primary block" type="submit" style="margin-top:12px">저장</button>
      </form>
    `;
    bindSignOut();
    bindEditor();
  };

  const sync = () => {
    draft.group = $("#group").value;
    draft.title = $("#title").value;
    draft.desc = $("#desc").value;
    const dl = $("#deadline").value;
    draft.deadlineMs = dl ? new Date(dl).getTime() : null;
    draft.publicResults = $("#pub").checked;
    $$(".editor-q").forEach((box) => {
      const q = draft.questions[Number(box.dataset.i)];
      q.label = $("[data-f=label]", box).value;
      q.required = $("[data-f=required]", box).checked;
      const hc = $("[data-f=headcount]", box);
      if (hc) q.headcount = hc.checked;
      const unit = $("[data-f=unit]", box);
      if (unit) q.unit = unit.value.trim();
      const opt = $("[data-f=options]", box);
      if (opt) q._optText = opt.value;
    });
  };

  const bindEditor = () => {
    $$(".editor-q").forEach((box) => {
      const i = Number(box.dataset.i);
      $("[data-f=type]", box).addEventListener("change", (e) => {
        sync();
        draft.questions[i].type = e.target.value;
        paint();
      });
      $$("[data-act]", box).forEach((b) => b.addEventListener("click", () => {
        sync();
        const qs = draft.questions;
        if (b.dataset.act === "del") qs.splice(i, 1);
        if (b.dataset.act === "up" && i > 0) [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
        if (b.dataset.act === "down" && i < qs.length - 1) [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
        paint();
      }));
    });
    $("#addq").addEventListener("click", () => {
      sync();
      draft.questions.push({ id: newId(6), type: "attend", label: "", required: true, options: [] });
      paint();
    });
    $("#ed").addEventListener("submit", async (e) => {
      e.preventDefault();
      sync();
      const survey = {
        ...draft,
        title: draft.title.trim(),
        desc: draft.desc.trim(),
        questions: draft.questions.map((q) => {
          const { _optText, ...rest } = q;
          if (["items", "choice", "multi"].includes(q.type)) {
            const prev = original.questions.find((x) => x.id === q.id)?.options || q.options || [];
            rest.options = mergeOptionIds(prev, parseOptions(_optText ?? optionsToText(q.options), q.type === "items"));
          } else {
            delete rest.options;
          }
          if (!["items", "count"].includes(q.type)) delete rest.unit;
          if (q.type !== "attend") delete rest.headcount;
          rest.label = rest.label.trim();
          return rest;
        }),
      };
      const errors = validateSurvey(survey);
      if (errors.length) { paint(errors); return; }
      const btn = $("button[type=submit]");
      btn.disabled = true;
      try {
        const saved = await saveSurvey(survey);
        toast("저장했습니다");
        location.hash = `#r/${saved.id}`;
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        paint(["저장하지 못했습니다. 관리자 계정과 Firestore 규칙을 확인해 주세요."]);
      }
    });
  };

  paint();
}

// ---------- 문안 붙여넣기 ----------
function viewPaste(state, groupId, prevText = "", errors = []) {
  currentGroup = groupId;
  root.innerHTML = `
    ${header(signOutBtn(state))}
    ${modeBanner()}
    <a class="btn small" href="#">← 목록</a>
    <form class="card" id="pf" style="margin-top:12px">
      <h3>문안 붙여넣기로 만들기</h3>
      <p class="sub">채팅에서 받은 조사 문안을 그대로 붙여 넣으세요. 불러온 뒤 화면에서 확인하고 저장하면 됩니다. "모임:" 줄이 없으면 ${escapeHtml(groupName(groupId))}에 만듭니다.</p>
      <textarea id="pt" style="min-height:280px" placeholder="모임: 2학년&#10;제목: 김밥 주문&#10;마감: 2026-11-04 21:00&#10;질문: 품목 | 김밥 종류별 수량 | 필수 | 단위=줄&#10;- 야채김밥 | 3000">${escapeHtml(prevText)}</textarea>
      ${errorsBox(errors)}
      <button class="btn primary block" type="submit" style="margin-top:10px">불러오기</button>
    </form>`;
  bindSignOut();
  $("#pf").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#pt").value;
    const { survey, errors: errs } = parseSurveyText(text, groups);
    if (!survey.group) survey.group = groupId;
    const real = errs.filter((x) => x !== "모임을 골라 주세요.");
    if (real.length) { viewPaste(state, groupId, text, real); return; }
    history.replaceState(null, "", "#new");
    viewEdit(state, survey, false);
  });
}

// ---------- 명단 ----------
async function viewRoster(state, groupId) {
  currentGroup = groupId;
  const roster = await getRoster(groupId);
  root.innerHTML = `
    ${header(signOutBtn(state))}
    ${modeBanner()}
    <a class="btn small" href="#">← 목록</a>
    <form class="card" id="rf" style="margin-top:12px">
      <h3>${escapeHtml(groupName(groupId))} 학부모 명단</h3>
      <p class="sub">한 줄에 한 가정씩 아이 이름만 적어 주세요. 쌍둥이·형제는 한 줄에 쉼표로 씁니다. 응답 이름에 아이 이름이 들어 있으면(예: 채아아빠) 응답한 가정으로 셉니다.</p>
      <p class="sub">연락처·생년월일은 넣지 마세요. 명단은 관리자 화면에서만 보입니다.</p>
      <textarea id="rt" style="min-height:280px" placeholder="채아&#10;정인, 현겸">${escapeHtml(rosterToText(roster))}</textarea>
      <div class="sub" id="rc" style="margin:6px 0 10px"></div>
      <button class="btn primary block" type="submit">저장</button>
    </form>`;
  bindSignOut();
  const count = () => { $("#rc").textContent = `${parseRoster($("#rt").value).length}가정`; };
  $("#rt").addEventListener("input", count);
  count();
  $("#rf").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveRoster(groupId, parseRoster($("#rt").value));
      toast("명단을 저장했습니다");
      location.hash = "#";
    } catch (err) {
      console.error(err);
      toast("저장하지 못했습니다");
    }
  });
}

// ---------- 결과 ----------
function resultCard(r) {
  const unit = escapeHtml(r.q.unit || "");
  let body = "";
  switch (r.q.type) {
    case "attend":
    case "choice":
    case "multi":
      body = r.rows.map((x) => `<div class="stat"><span>${escapeHtml(x.label)}</span><b>${x.count}${r.q.type === "attend" ? "가정" : ""}${r.q.type === "attend" && r.q.headcount && x.label === "참석" ? ` · 총 ${x.people}명` : ""}</b></div>
        ${x.names.length ? `<div class="names">${x.names.map(escapeHtml).join(", ")}</div>` : ""}`).join("");
      break;
    case "items":
      body = r.rows.map((x) => `<div class="stat"><span>${escapeHtml(x.label)}</span><b>${x.qty}${unit}${x.price ? ` · ${won(x.price)}` : ""}</b></div>`).join("")
        + `<div class="stat"><span>합계</span><b class="big">${r.totalQty}${unit}</b></div>`
        + (r.totalPrice ? `<div class="stat"><span>금액 합계</span><b>${won(r.totalPrice)}</b></div>` : "")
        + (r.perPerson.length ? `<details><summary>주문자별 보기</summary>${r.perPerson.map((p) => `<div class="stat"><span>${escapeHtml(p.name)}</span><span>${escapeHtml(p.text)}${p.sum ? ` · ${won(p.sum)}` : ""}</span></div>`).join("")}</details>` : "");
      break;
    case "count":
      body = `<div class="stat"><span>합계</span><b class="big">${r.total}${unit}</b></div>`
        + r.list.map((x) => `<div class="stat"><span>${escapeHtml(x.name)}</span><span>${escapeHtml(x.value)}${unit}</span></div>`).join("");
      break;
    case "text":
      body = r.list.length ? r.list.map((x) => `<div class="stat"><span>${escapeHtml(x.name)}</span><span style="white-space:pre-line;text-align:right">${escapeHtml(x.value)}</span></div>`).join("") : `<div class="sub">응답 없음</div>`;
      break;
  }
  return `<div class="card"><h3>${escapeHtml(r.q.label)}</h3><div class="sub" style="margin-bottom:6px">${r.answered}명 응답</div>${body}</div>`;
}

let stopLive = null;
function stopLiveWatch() { if (stopLive) { stopLive(); stopLive = null; } }

async function viewResult(state, id) {
  stopLiveWatch();
  const survey = await getSurvey(id);
  if (!survey) { root.innerHTML = `${header(signOutBtn(state))}<div class="card">조사를 찾을 수 없습니다. <a href="#">목록</a></div>`; bindSignOut(); return; }
  currentGroup = survey.group;
  let roster = [];
  try { roster = await getRoster(survey.group); } catch { /* 무시 */ }
  const paint = (responses) => {
    const rm = roster.length ? matchRoster(roster, responses) : null;
    const open = isOpen(survey);
    const url = surveyUrl(id);
    const gName = groupName(survey.group);

    root.innerHTML = `
      ${header(signOutBtn(state))}
      ${modeBanner()}
      <a class="btn small" href="#">← 목록</a>
      <div class="card" style="margin-top:12px">
        <div class="meta"><span>${escapeHtml(gName)}</span><span class="pill ${open ? "" : "closed"}">${open ? "진행 중" : "마감"}</span></div>
        <h2 style="margin-top:6px">${escapeHtml(survey.title)}</h2>
        <div class="meta"><span>응답 ${responses.length}명</span><span>마감 ${escapeHtml(formatDeadline(survey.deadlineMs))}</span><span class="pill">실시간</span></div>
      <div class="row" style="margin-top:10px">
        <span class="sub">현황판: ${survey.publicResults ? "모두에게 공개 중" : "관리자만 보기"}</span>
        <button class="btn small" id="pubtoggle">${survey.publicResults ? "비공개로" : "모두에게 공개"}</button>
      </div>
        <div class="row" style="margin-top:12px">
          <button class="btn small primary" id="invite">카톡 공지 복사</button>
          <button class="btn small primary" id="summary">결과 요약 복사</button>
          <button class="btn small" id="link">링크 복사</button>
          <button class="btn small" id="csv">엑셀(CSV) 받기</button>
        </div>
        <div class="row" style="margin-top:8px">
          <a class="btn small" href="#edit/${id}">수정</a>
          <button class="btn small" id="toggle">${survey.status === "open" ? "지금 마감" : "다시 열기"}</button>
          <button class="btn small" id="dup">다음 회차로 복제</button>
          <button class="btn small" id="astext">문안 복사</button>
          <a class="btn small" href="${escapeHtml(url)}" target="_blank" rel="noopener">응답 화면</a>
          <span class="spacer"></span>
          <button class="btn small danger" id="del">삭제</button>
        </div>
      </div>
      ${rm ? `<div class="card">
        <h3>응답 가정 ${rm.answered.length} / ${rm.total}</h3>
        ${rm.missing.length ? `<div class="stat"><span>미응답</span><span style="text-align:right">${rm.missing.map(escapeHtml).join(", ")}</span></div>` : `<div class="ok">모든 가정이 응답했습니다.</div>`}
        ${rm.unknown.length ? `<div class="stat"><span>명단과 안 맞는 이름</span><span style="text-align:right">${rm.unknown.map(escapeHtml).join(", ")}</span></div>` : ""}
        ${rm.missing.length && open ? `<button class="btn small" id="remind" style="margin-top:8px">미응답 안내 복사</button>` : ""}
      </div>` : groups.find((g) => g.id === survey.group)?.roster === false ? "" : `<div class="card sub">명단을 넣으면 미응답 가정을 볼 수 있습니다. <a href="#roster/${escapeHtml(survey.group)}">명단 넣기</a></div>`}
      ${responses.length ? aggregate(survey, responses).map(resultCard).join("") : `<div class="empty">아직 응답이 없습니다. 카톡 공지를 복사해 단톡방에 올려 보세요.</div>`}
      ${responses.length ? `<div class="card"><h3>응답자 ${responses.length}명</h3>
        <div class="table-scroll"><table class="list">
          <thead><tr><th>이름</th>${survey.questions.map((q) => `<th>${escapeHtml(q.label)}</th>`).join("")}<th></th></tr></thead>
          <tbody>${sortByName(responses).map((r) => `<tr><td>${escapeHtml(r.name)}</td>${survey.questions.map((q) => `<td>${escapeHtml(answerText(q, r.answers?.[q.id]))}</td>`).join("")}<td><button class="btn small danger" data-delr="${escapeHtml(r.id)}" aria-label="${escapeHtml(r.name)} 응답 삭제">삭제</button></td></tr>`).join("")}</tbody>
        </table></div></div>` : ""}
    `;
    bindSignOut();

    $("#invite").addEventListener("click", () => copyText(buildInviteText(survey, url, gName), "카톡 공지를 복사했습니다"));
    $("#summary").addEventListener("click", () => copyText(buildSummaryText(survey, responses, gName, roster), "결과 요약을 복사했습니다"));
    $("#remind")?.addEventListener("click", () => copyText(buildReminderText(survey, url, rm.missing), "미응답 안내를 복사했습니다"));
    $("#link").addEventListener("click", () => copyText(url, "링크를 복사했습니다"));
    $("#csv").addEventListener("click", () => {
      const blob = new Blob([toCSV(survey, responses)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${survey.title.replace(/[\\/:*?"<>|]/g, "_")}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $("#toggle").addEventListener("click", async () => {
      const next = { ...survey, status: survey.status === "open" ? "closed" : "open" };
      if (next.status === "open" && next.deadlineMs && next.deadlineMs <= Date.now()) {
        if (!confirm("마감 시각이 지났습니다. 마감 시각을 지우고 다시 열까요?")) return;
        next.deadlineMs = null;
      }
      await saveSurvey(next);
      toast(next.status === "open" ? "다시 열었습니다" : "마감했습니다");
      viewResult(state, id);
    });
    $("#dup").addEventListener("click", async () => {
      const draft = nextRound(survey);
      if (!draft.deadlineMs) draft.deadlineMs = defaultDeadline();
      const copy = await saveSurvey(draft);
      toast("복제했습니다");
      location.hash = `#edit/${copy.id}`;
    });
    $("#pubtoggle").addEventListener("click", async () => {
      survey.publicResults = !survey.publicResults;
      await saveSurvey(survey);
      toast(survey.publicResults ? "현황판을 공개했습니다" : "현황판을 비공개로 바꿨습니다");
      paint(responses);
    });
    $("#astext").addEventListener("click", () => copyText(surveyToText(survey, groups), "조사 문안을 복사했습니다"));
    $("#del").addEventListener("click", async () => {
      if (!confirm(`"${survey.title}" 조사와 응답 ${responses.length}건을 모두 지울까요? 되돌릴 수 없습니다.`)) return;
      stopLiveWatch();
      await deleteSurvey(id);
      toast("삭제했습니다");
      location.hash = "#";
    });
    $$("[data-delr]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 응답을 삭제할까요?")) return;
      await deleteResponse(id, b.dataset.delr);
      toast("응답을 삭제했습니다");
    }));
  };
  stopLive = watchResponses(id, paint, (e) => { console.error(e); toast("실시간 연결이 끊겼습니다. 새로고침해 주세요"); });
}

// ---------- 라우팅 ----------
async function route() {
  stopLiveWatch();
  try {
    const state = await adminState();
    if (!state.isAdmin) {
      root.innerHTML = `
        ${header()}
        ${modeBanner()}
        <div class="card">
          <h3>관리자 로그인</h3>
          ${state.signedIn ? `<div class="errors">${escapeHtml(state.email)} 계정은 관리자로 등록되어 있지 않습니다.</div>` : ""}
          <p class="sub">${mode === "local" ? "체험 모드에서는 바로 들어갈 수 있습니다." : "config.js 에 등록된 구글 계정으로 로그인해 주세요."}</p>
          <div class="row">
            <button class="btn primary" id="signin">${mode === "local" ? "체험 모드로 들어가기" : "구글 계정으로 로그인"}</button>
            ${state.signedIn ? `<button class="btn" id="signout">로그아웃</button>` : ""}
          </div>
        </div>`;
      $("#signin").addEventListener("click", async () => {
        try { await adminSignIn(); route(); } catch (e) { toast("로그인하지 못했습니다"); console.error(e); }
      });
      bindSignOut();
      return;
    }
    const [view, a, b] = location.hash.replace(/^#/, "").split("/");
    if (view === "new") {
      const group = groups.some((g) => g.id === a) ? a : currentGroup;
      const tpl = templates()[b] || { title: "", desc: "", questions: [{ id: newId(6), type: "attend", label: "참석 여부", required: true, options: [] }] };
      return viewEdit(state, { ...tpl, group, status: "open", deadlineMs: defaultDeadline(), publicResults: true }, false);
    }
    if (view === "edit" && a) {
      const s = await getSurvey(a);
      if (!s) { location.hash = "#"; return; }
      let n = 0;
      try { n = (await listResponses(a)).length; } catch { /* 무시 */ }
      return viewEdit(state, JSON.parse(JSON.stringify(s)), n > 0);
    }
    if (view === "r" && a) return viewResult(state, a);
    if (view === "roster" && groups.some((g) => g.id === a && g.roster !== false)) return viewRoster(state, a);
    if (view === "paste") return viewPaste(state, groups.some((g) => g.id === a) ? a : currentGroup);
    return viewList(state);
  } catch (e) {
    fail(root, e);
  }
}

window.addEventListener("hashchange", route);
route();

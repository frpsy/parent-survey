import { groups } from "./config.js";
import { listSurveys } from "./store.js";
import { escapeHtml, formatDeadline, isOpen } from "./core.js";
import { $, $$, header, modeBanner, fail } from "./ui.js";

const root = $("#app");

function card(s) {
  const open = isOpen(s);
  return `<a class="card" href="survey.html?id=${encodeURIComponent(s.id)}">
    <h2>${escapeHtml(s.title)}</h2>
    <div class="meta">
      <span class="pill ${open ? "" : "closed"}">${open ? "진행 중" : "마감"}</span>
      <span>마감 ${escapeHtml(formatDeadline(s.deadlineMs))}</span>
    </div>
  </a>`;
}

function render(surveys, groupId) {
  const mine = surveys
    .filter((s) => s.group === groupId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const open = mine.filter((s) => isOpen(s));
  const closed = mine.filter((s) => !isOpen(s));
  const g = groups.find((x) => x.id === groupId);

  root.innerHTML = `
    ${header()}
    ${modeBanner()}
    <div class="tabs" role="tablist">
      ${groups.map((x) => `<button class="tab" role="tab" data-g="${x.id}" aria-selected="${x.id === groupId}">${escapeHtml(x.name)}</button>`).join("")}
    </div>
    <p class="sub">${escapeHtml(g?.desc || "")}</p>
    <div class="section-title">진행 중인 조사</div>
    ${open.length ? open.map(card).join("") : `<div class="empty">지금 진행 중인 조사가 없습니다.</div>`}
    ${closed.length ? `<details><summary>지난 조사 ${closed.length}건</summary>${closed.map(card).join("")}</details>` : ""}
    <footer><a href="admin.html">관리자</a></footer>
  `;
  $$(".tab").forEach((b) => b.addEventListener("click", () => {
    history.replaceState(null, "", `#${b.dataset.g}`);
    render(surveys, b.dataset.g);
  }));
}

(async () => {
  try {
    const surveys = await listSurveys();
    const fromHash = location.hash.slice(1);
    const groupId = groups.some((g) => g.id === fromHash) ? fromHash : groups[0].id;
    render(surveys, groupId);
  } catch (e) {
    fail(root, e);
  }
})();

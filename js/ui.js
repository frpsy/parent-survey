import { mode } from "./store.js";
import { groups, siteTitle } from "./config.js";
import { escapeHtml } from "./core.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function groupName(id) {
  return groups.find((g) => g.id === id)?.name || id;
}

export function modeBanner() {
  if (mode !== "local") return "";
  return `<div class="banner">체험 모드입니다. 응답이 이 기기 브라우저에만 저장되어 다른 학부모와 공유되지 않습니다. 실제 운영은 README의 Firebase 설정을 마친 뒤 사용해 주세요.</div>`;
}

export function header(right = "") {
  return `<header class="top"><h1><a href="./">${siteTitle}</a></h1><div class="top-actions">${right}</div></header>`;
}

// ---------- 화면 테마 (색·밝기, 이 기기에만 저장, 관리자 화면에서만 고름) ----------
const PALETTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>';

export function themeButton() {
  return window.psTheme ? `<button class="btn small icon" type="button" data-theme-open aria-label="화면 테마" title="화면 테마">${PALETTE}</button>` : "";
}

function openTheme() {
  const T = window.psTheme;
  if (!T) return;
  $("dialog.theme")?.remove();
  const cur = T.get();
  const dlg = document.createElement("dialog");
  dlg.className = "theme";
  dlg.setAttribute("aria-label", "화면 테마");
  dlg.innerHTML = `<h3>화면 테마</h3>
    <div class="section-title">색</div>
    <div class="swatches" role="radiogroup" aria-label="색">
      ${T.accents.map((a) => `<label class="swatch"><input type="radio" name="th_accent" value="${a.id}" ${cur.accent === a.id ? "checked" : ""}><i style="background:${a.hex}"></i><span>${escapeHtml(a.name)}</span></label>`).join("")}
    </div>
    <div class="section-title">밝기</div>
    <div class="seg" role="radiogroup" aria-label="밝기">
      ${T.modes.map((m) => `<label><input type="radio" name="th_mode" value="${m.id}" ${cur.mode === m.id ? "checked" : ""}><span>${escapeHtml(m.name)}</span></label>`).join("")}
    </div>
    <p class="hint" style="margin:12px 0 0">이 기기에만 적용됩니다.</p>
    <button class="btn block" type="button" data-theme-close style="margin-top:14px">닫기</button>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("change", (e) => {
    if (e.target.name === "th_accent") T.set({ accent: e.target.value });
    if (e.target.name === "th_mode") T.set({ mode: e.target.value });
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-theme-close]")) dlg.close(); });
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}

document.addEventListener("click", (e) => { if (e.target.closest("[data-theme-open]")) openTheme(); });

let toastTimer;
export function toast(msg) {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

export async function copyText(text, msg = "복사했습니다") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* 무시 */ }
    ta.remove();
  }
  toast(msg);
}

export function surveyUrl(id) {
  return new URL(`survey.html?id=${encodeURIComponent(id)}`, location.href).href;
}

export function errorsBox(errors) {
  if (!errors.length) return "";
  return `<div class="errors" role="alert"><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`;
}

export function fail(root, err) {
  console.error(err);
  root.innerHTML = `${header()}<div class="errors" role="alert">불러오지 못했습니다. 잠시 후 다시 시도해 주세요.<br><small>${escapeHtml(err?.message || err)}</small></div>`;
}

export async function shareLink(title, url) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch { /* 취소 */ }
  }
  await copyText(url, "링크를 복사했습니다");
}

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
  return `<header class="top"><h1><a href="./">${siteTitle}</a></h1><div>${right}</div></header>`;
}

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
  root.innerHTML = `${header()}<div class="errors" role="alert">불러오지 못했습니다. 잠시 후 다시 시도해 주세요.<br><small>${String(err?.message || err).replace(/</g, "&lt;")}</small></div>`;
}

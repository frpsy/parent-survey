// 화면 테마 (색·밝기). CSS보다 먼저 일반 스크립트로 읽어 깜빡임 없이 적용합니다.
// 설정은 이 기기 브라우저에만 저장됩니다.
(function () {
  var KEY = "ps_theme";
  var ACCENTS = [
    { id: "lilac", name: "라일락", hex: "#7c5cbf" },
    { id: "forest", name: "숲", hex: "#2f7d55" },
    { id: "ocean", name: "바다", hex: "#2f6fb8" },
    { id: "sunset", name: "노을", hex: "#c0573c" },
    { id: "ink", name: "먹", hex: "#5b5b63" },
  ];
  var MODES = [
    { id: "auto", name: "자동" },
    { id: "light", name: "밝게" },
    { id: "dark", name: "어둡게" },
  ];

  function read() {
    var v = {};
    try { v = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { v = {}; }
    return {
      accent: ACCENTS.some(function (a) { return a.id === v.accent; }) ? v.accent : "lilac",
      mode: MODES.some(function (m) { return m.id === v.mode; }) ? v.mode : "auto",
    };
  }

  function apply(t) {
    var el = document.documentElement;
    el.setAttribute("data-accent", t.accent);
    if (t.mode === "auto") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", t.mode);
    var hex = ACCENTS.filter(function (a) { return a.id === t.accent; })[0].hex;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", hex);
    var icon = document.querySelector('link[rel="icon"]');
    if (icon) {
      icon.setAttribute("href", "data:image/svg+xml," + encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='15' fill='" + hex + "'/>"
        + "<path d='M9 16.5l4.5 4.5L23 11.5' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>"));
    }
  }

  function set(patch) {
    var t = read();
    if (patch.accent) t.accent = patch.accent;
    if (patch.mode) t.mode = patch.mode;
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { /* 저장 불가 환경 */ }
    apply(t);
    return t;
  }

  apply(read());
  window.psTheme = { accents: ACCENTS, modes: MODES, get: read, set: set };
})();

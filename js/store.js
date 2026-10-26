// 저장소: Firebase 설정이 있으면 Firestore, 없으면 이 브라우저(localStorage)에 저장하는 체험 모드
import { firebaseConfig, adminEmails } from "./config.js";
import { newId } from "./core.js";
import { sampleSurveys, sampleResponses } from "./samples.js";

export const mode = firebaseConfig.apiKey && firebaseConfig.projectId ? "firebase" : "local";

const FB = "https://www.gstatic.com/firebasejs/10.12.2";
let fb = null;

async function initFirebase() {
  if (fb) return fb;
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-auth.js`),
    import(`${FB}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  fb = { auth, fs, authObj: auth.getAuth(app), db: fs.getFirestore(app) };
  return fb;
}

// 관리자 화면 등에서 SDK를 미리 받아 두어 첫 조회를 앞당김
export function warmUp() {
  if (mode === "firebase") initFirebase().then(waitForUser).catch(() => {});
}

// 로그인 상태가 한 번 확정된 뒤에는 이벤트를 기다리지 않고 현재 값을 씀
let authSettled = false;
function waitForUser(f) {
  if (authSettled) return Promise.resolve(f.authObj.currentUser);
  return new Promise((resolve) => {
    const off = f.auth.onAuthStateChanged(f.authObj, (u) => { off(); authSettled = true; resolve(u); });
  });
}

// ---------- 체험 모드 ----------
const LS_SURVEYS = "ps_surveys";
const LS_RESP = (id) => `ps_resp_${id}`;
const LS_ME = "ps_me";
const LS_ADMIN = "ps_admin";

function lsGet(k, d) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ }
}
// 체험 모드 첫 방문 시 샘플 조사를 한 번만 넣음 (지운 샘플은 다시 생기지 않음)
// v2: 샘플 제목 변경(학년 → 2학년)을 이미 받은 기기에도 반영
const LS_SEEDED = "ps_seeded_v2";
function ensureSamples() {
  if (lsGet(LS_SEEDED, false)) return;
  const hadV1 = lsGet("ps_seeded_v1", false);
  const all = lsGet(LS_SURVEYS, []);
  for (const s of sampleSurveys) {
    const i = all.findIndex((x) => x.id === s.id);
    if (i >= 0) all[i] = { ...all[i], title: s.title };
    else if (!hadV1) all.push({ ...s, updatedAt: s.createdAt });
    const rs = lsGet(LS_RESP(s.id), {});
    for (const r of sampleResponses[s.id] || []) if (!rs[r.id]) rs[r.id] = r;
    lsSet(LS_RESP(s.id), rs);
  }
  lsSet(LS_SURVEYS, all);
  lsSet(LS_SEEDED, true);
}
if (mode === "local") ensureSamples();

function localMe() {
  let me = lsGet(LS_ME, null);
  if (!me) { me = "local-" + newId(10); lsSet(LS_ME, me); }
  return me;
}

// ---------- 공통 API ----------

// 응답자 식별 (Firebase: 익명 로그인 uid, 체험: 브라우저 고유값)
export async function respondentId() {
  if (mode === "local") return localMe();
  const f = await initFirebase();
  const u = (await waitForUser(f)) || (await f.auth.signInAnonymously(f.authObj)).user;
  return u.uid;
}

export async function adminState() {
  if (mode === "local") return { signedIn: !!lsGet(LS_ADMIN, false), isAdmin: !!lsGet(LS_ADMIN, false), email: "체험 모드 관리자" };
  const f = await initFirebase();
  const u = await waitForUser(f);
  const email = u && !u.isAnonymous ? u.email : null;
  return { signedIn: !!email, isAdmin: !!email && adminEmails.includes(email), email };
}

export async function adminSignIn() {
  if (mode === "local") { lsSet(LS_ADMIN, true); return; }
  const f = await initFirebase();
  await f.auth.signInWithPopup(f.authObj, new f.auth.GoogleAuthProvider());
}

export async function adminSignOut() {
  if (mode === "local") { lsSet(LS_ADMIN, false); return; }
  const f = await initFirebase();
  await f.auth.signOut(f.authObj);
}

export async function listSurveys() {
  if (mode === "local") return lsGet(LS_SURVEYS, []);
  const f = await initFirebase();
  const snap = await f.fs.getDocs(f.fs.collection(f.db, "surveys"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSurvey(id) {
  if (mode === "local") return lsGet(LS_SURVEYS, []).find((s) => s.id === id) || null;
  const f = await initFirebase();
  const d = await f.fs.getDoc(f.fs.doc(f.db, "surveys", id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function saveSurvey(survey) {
  const data = { ...survey, updatedAt: Date.now() };
  if (!data.id) { data.id = newId(10); data.createdAt = Date.now(); }
  if (mode === "local") {
    const all = lsGet(LS_SURVEYS, []);
    const i = all.findIndex((s) => s.id === data.id);
    if (i >= 0) all[i] = data; else all.push(data);
    lsSet(LS_SURVEYS, all);
    return data;
  }
  const f = await initFirebase();
  const { id, ...rest } = data;
  await f.fs.setDoc(f.fs.doc(f.db, "surveys", id), rest);
  return data;
}

export async function deleteSurvey(id) {
  if (mode === "local") {
    lsSet(LS_SURVEYS, lsGet(LS_SURVEYS, []).filter((s) => s.id !== id));
    try { localStorage.removeItem(LS_RESP(id)); } catch { /* 무시 */ }
    return;
  }
  const f = await initFirebase();
  const rs = await f.fs.getDocs(f.fs.collection(f.db, "surveys", id, "responses"));
  await Promise.all(rs.docs.map((d) => f.fs.deleteDoc(d.ref)));
  await f.fs.deleteDoc(f.fs.doc(f.db, "surveys", id));
}

// 관리자 또는 결과 공개 조사일 때만 전체 응답을 읽을 수 있음
export async function listResponses(surveyId) {
  if (mode === "local") return Object.values(lsGet(LS_RESP(surveyId), {}));
  const f = await initFirebase();
  const snap = await f.fs.getDocs(f.fs.collection(f.db, "surveys", surveyId, "responses"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 응답 수만 필요할 때: 문서 전체를 내려받지 않고 개수만 서버에서 셈
export async function countResponses(surveyId) {
  if (mode === "local") return Object.keys(lsGet(LS_RESP(surveyId), {})).length;
  const f = await initFirebase();
  const col = f.fs.collection(f.db, "surveys", surveyId, "responses");
  if (!f.fs.getCountFromServer) return (await f.fs.getDocs(col)).size;
  return (await f.fs.getCountFromServer(col)).data().count;
}

export async function getMyResponse(surveyId) {
  const me = await respondentId();
  if (mode === "local") return lsGet(LS_RESP(surveyId), {})[me] || null;
  const f = await initFirebase();
  const d = await f.fs.getDoc(f.fs.doc(f.db, "surveys", surveyId, "responses", me));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function saveMyResponse(surveyId, name, answers) {
  const me = await respondentId();
  const data = { uid: me, name: name.trim(), answers, updatedAt: Date.now() };
  if (mode === "local") {
    const all = lsGet(LS_RESP(surveyId), {});
    all[me] = { id: me, ...data };
    lsSet(LS_RESP(surveyId), all);
    return;
  }
  const f = await initFirebase();
  await f.fs.setDoc(f.fs.doc(f.db, "surveys", surveyId, "responses", me), data);
}

export async function deleteMyResponse(surveyId) {
  const me = await respondentId();
  return deleteResponse(surveyId, me);
}

export async function deleteResponse(surveyId, responseId) {
  if (mode === "local") {
    const all = lsGet(LS_RESP(surveyId), {});
    delete all[responseId];
    lsSet(LS_RESP(surveyId), all);
    return;
  }
  const f = await initFirebase();
  await f.fs.deleteDoc(f.fs.doc(f.db, "surveys", surveyId, "responses", responseId));
}

// ---------- 명단: 관리자만 읽고 씀 (코드·저장소에는 넣지 않음) ----------
const LS_ROSTER = (g) => `ps_roster_${g}`;

export async function getRoster(groupId) {
  if (mode === "local") return lsGet(LS_ROSTER(groupId), []);
  const f = await initFirebase();
  const d = await f.fs.getDoc(f.fs.doc(f.db, "rosters", groupId));
  return d.exists() ? d.data().households || [] : [];
}

export async function saveRoster(groupId, households) {
  if (mode === "local") { lsSet(LS_ROSTER(groupId), households); return; }
  const f = await initFirebase();
  await f.fs.setDoc(f.fs.doc(f.db, "rosters", groupId), { households, updatedAt: Date.now() });
}

// ---------- 실시간 응답 구독 (현황판) ----------
// 응답이 바뀔 때마다 cb(응답 목록)을 부름. 돌려받은 함수를 부르면 구독을 멈춤.
export function watchResponses(surveyId, cb, onError = () => {}) {
  if (mode === "local") {
    let last = "";
    const emit = () => {
      const raw = JSON.stringify(lsGet(LS_RESP(surveyId), {}));
      if (raw === last) return;
      last = raw;
      cb(Object.values(JSON.parse(raw)));
    };
    emit();
    const onStorage = (e) => { if (!e.key || e.key === LS_RESP(surveyId)) emit(); };
    window.addEventListener("storage", onStorage);
    const t = setInterval(emit, 2000);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(t); };
  }
  let off = () => {};
  let stopped = false;
  initFirebase().then((f) => {
    if (stopped) return;
    off = f.fs.onSnapshot(
      f.fs.collection(f.db, "surveys", surveyId, "responses"),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError,
    );
  }).catch(onError);
  return () => { stopped = true; off(); };
}

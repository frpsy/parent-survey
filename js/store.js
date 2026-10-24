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

function waitForUser(f) {
  return new Promise((resolve) => {
    const off = f.auth.onAuthStateChanged(f.authObj, (u) => { off(); resolve(u); });
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
const LS_SEEDED = "ps_seeded_v1";
function ensureSamples() {
  if (lsGet(LS_SEEDED, false)) return;
  const all = lsGet(LS_SURVEYS, []);
  for (const s of sampleSurveys) {
    if (!all.some((x) => x.id === s.id)) all.push({ ...s, updatedAt: s.createdAt });
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

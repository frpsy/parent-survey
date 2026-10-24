// surveys/*.txt 를 Firestore 에 등록·갱신합니다 (GitHub Actions 에서 실행).
// 필요: 저장소 Secret FIREBASE_SERVICE_ACCOUNT (Firebase 서비스 계정 JSON 전체)
import { readFileSync, readdirSync } from "node:fs";
import { groups } from "../js/config.js";
import { parseSurveyText, withStableIds, slugFromFile } from "../js/core.js";

const dir = new URL("../surveys/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
const surveys = [];
let failed = false;
for (const f of files) {
  const { survey, errors } = parseSurveyText(readFileSync(new URL(f, dir), "utf8"), groups);
  if (errors.length) { failed = true; console.error(`✗ ${f}\n  - ${errors.join("\n  - ")}`); continue; }
  surveys.push(withStableIds(survey, slugFromFile(f)));
  console.log(`✓ ${f}`);
}
if (failed) process.exit(1);
if (process.argv.includes("--check")) process.exit(0);

const key = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!key) {
  console.log("::warning::FIREBASE_SERVICE_ACCOUNT 가 없어 등록을 건너뜁니다. README의 '자동 등록 설정'을 참고하세요.");
  process.exit(0);
}
const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(key)) }));

for (const s of surveys) {
  const { id, status, ...fields } = s;
  const ref = db.collection("surveys").doc(id);
  const snap = await ref.get();
  const now = Date.now();
  const data = { ...fields, source: "repo", updatedAt: now };
  if (snap.exists) await ref.set(data, { merge: true });
  else await ref.set({ ...data, status: "open", createdAt: now });
  console.log(`${snap.exists ? "갱신" : "등록"}: ${id} — ${s.title}`);
}

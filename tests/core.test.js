import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseOptions, mergeOptionIds, isOpen, formatDeadline, validateSurvey, validateResponse,
  cleanAnswers, aggregate, buildSummaryText, buildInviteText, toCSV, answerText, escapeHtml, templates,
} from "../js/core.js";

const survey = {
  id: "s1",
  group: "grade",
  title: "김밥 주문",
  status: "open",
  deadlineMs: Date.UTC(2026, 9, 30, 12, 0), // 한국 시간 10/30(금) 오후 9시
  questions: [
    { id: "a", type: "items", label: "김밥", required: true, unit: "줄",
      options: [{ id: "v", label: "야채김밥", price: 3000 }, { id: "t", label: "참치김밥", price: 4000 }] },
    { id: "b", type: "attend", label: "참석", required: true, headcount: true },
    { id: "c", type: "choice", label: "수령", required: false, options: [{ id: "x", label: "학교" }, { id: "y", label: "집" }] },
    { id: "d", type: "text", label: "메모", required: false },
  ],
};

const responses = [
  { id: "1", name: "채아아빠", answers: { a: { v: 2, t: 1 }, b: { choice: "참석", headcount: 3 }, c: "x" } },
  { id: "2", name: "가윤엄마", answers: { a: { v: 1 }, b: { choice: "불참" }, d: "늦게 받아요" } },
  { id: "3", name: "나연아빠", answers: { a: { t: 2 }, b: { choice: "참석", headcount: 2 }, c: "x" } },
];

test("항목 파싱: 가격 포함", () => {
  const o = parseOptions("야채김밥 | 3,000\n\n참치김밥|4000\n유부", true);
  assert.equal(o.length, 3);
  assert.equal(o[0].price, 3000);
  assert.equal(o[1].label, "참치김밥");
  assert.equal(o[2].price, undefined);
});

test("항목 수정 시 같은 이름은 기존 id 유지", () => {
  const merged = mergeOptionIds(survey.questions[0].options, parseOptions("참치김밥\n야채김밥\n새김밥"));
  assert.equal(merged[0].id, "t");
  assert.equal(merged[1].id, "v");
  assert.notEqual(merged[2].id, "v");
});

test("마감 판정", () => {
  assert.equal(isOpen(survey, survey.deadlineMs - 1), true);
  assert.equal(isOpen(survey, survey.deadlineMs), false);
  assert.equal(isOpen({ ...survey, status: "closed" }, 0), false);
  assert.equal(isOpen({ ...survey, deadlineMs: null }, Date.now()), true);
});

test("마감 표기는 한국 시간", () => {
  assert.equal(formatDeadline(survey.deadlineMs), "10월 30일(금) 오후 9시");
  assert.equal(formatDeadline(null), "마감 없음");
});

test("조사 검증", () => {
  assert.deepEqual(validateSurvey(survey), []);
  const bad = validateSurvey({ group: "grade", title: " ", questions: [{ id: "q", type: "items", label: "", options: [] }] });
  assert.equal(bad.length, 3);
});

test("응답 검증", () => {
  assert.deepEqual(validateResponse(survey, "채아아빠", responses[0].answers), []);
  const e = validateResponse(survey, "", { a: { v: 0 } });
  assert.ok(e.some((x) => x.includes("이름")));
  assert.ok(e.some((x) => x.includes("김밥")));
  assert.ok(e.some((x) => x.includes("참석")));
  assert.ok(validateResponse(survey, "a", { a: { v: 1.5 }, b: { choice: "불참" } }).length > 0);
});

test("응답 정리: 0 수량 제거, 불참이면 인원 제거", () => {
  const c = cleanAnswers(survey, { a: { v: 0, t: "2" }, b: { choice: "불참", headcount: 4 }, c: undefined, d: "  안녕 " });
  assert.deepEqual(c, { a: { t: 2 }, b: { choice: "불참" }, d: "안녕" });
});

test("집계", () => {
  const [items, attend, choice, text] = aggregate(survey, responses);
  assert.equal(items.totalQty, 6);
  assert.equal(items.totalPrice, 3 * 3000 + 3 * 4000);
  assert.deepEqual(items.perPerson.map((p) => p.name), ["가윤엄마", "나연아빠", "채아아빠"]);
  const yes = attend.rows.find((r) => r.label === "참석");
  assert.equal(yes.count, 2);
  assert.equal(yes.people, 5);
  assert.deepEqual(yes.names, ["나연아빠", "채아아빠"]);
  assert.equal(choice.rows[0].count, 2);
  assert.equal(text.list.length, 1);
});

test("같은 이름 응답도 모두 집계", () => {
  const dup = [...responses, { id: "4", name: "채아아빠", answers: { a: { v: 1 }, b: { choice: "미정" } } }];
  const [items] = aggregate(survey, dup);
  assert.equal(items.perPerson.length, 4);
  assert.equal(items.totalQty, 7);
});

test("카톡용 결과 요약과 공지", () => {
  const s = buildSummaryText(survey, responses, "채아 학년");
  assert.match(s, /^\[조사 결과\] 김밥 주문 \(채아 학년\)/);
  assert.match(s, /응답 3명/);
  assert.match(s, /야채김밥: 3줄 \(9,000원\)/);
  assert.match(s, /합계 6줄 \/ 21,000원/);
  assert.match(s, /참석 2가정 \(총 5명\): 나연아빠, 채아아빠/);
  const inv = buildInviteText(survey, "https://example.com/survey.html?id=s1", "씨앗별");
  assert.match(inv, /\[조사\] 김밥 주문 \(씨앗별\)/);
  assert.match(inv, /https:\/\/example.com/);
});

test("CSV: BOM, 가나다순, 쉼표 이스케이프", () => {
  const csv = toCSV(survey, [...responses, { id: "5", name: "다은,엄마", answers: { a: { v: 1 }, b: { choice: "참석" } } }]);
  assert.ok(csv.startsWith("﻿이름,"));
  const lines = csv.split("\n");
  assert.ok(lines[1].startsWith("가윤엄마"));
  assert.ok(csv.includes('"다은,엄마"'));
  assert.ok(csv.includes('"야채김밥 2줄, 참치김밥 1줄"'));
});

test("답 표시와 HTML 이스케이프", () => {
  assert.equal(answerText(survey.questions[1], { choice: "참석", headcount: 3 }), "참석 3명");
  assert.equal(escapeHtml(`<b a="1">'&`), "&lt;b a=&quot;1&quot;&gt;&#39;&amp;");
});

test("양식은 모두 유효", () => {
  for (const t of Object.values(templates())) {
    assert.deepEqual(validateSurvey({ ...t, group: "ssiat" }), []);
  }
});

test("샘플 조사와 응답은 유효", async () => {
  const { sampleSurveys, sampleResponses } = await import("../js/samples.js");
  assert.deepEqual(sampleSurveys.map((s) => s.group).sort(), ["grade", "ssiat"]);
  for (const s of sampleSurveys) {
    assert.deepEqual(validateSurvey(s), []);
    for (const r of sampleResponses[s.id]) assert.deepEqual(validateResponse(s, r.name, r.answers), [], r.name);
  }
});

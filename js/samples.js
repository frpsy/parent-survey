// 체험 모드에서 처음 열 때 넣어 주는 샘플 조사 (Firebase 운영 모드에서는 쓰지 않음)
// 응답자 이름은 실제 학부모와 겹치지 않도록 가상의 이름을 씁니다.

const KST = (y, m, d, h) => Date.UTC(y, m - 1, d, h - 9);

export const sampleSurveys = [
  {
    id: "sample-grade",
    group: "grade",
    title: "[샘플] 11월 2학년 아빠 모임 참석",
    desc: "11월 아빠 모임 날짜와 참석 여부를 정하려고 합니다.\n장소는 참석 인원이 정해지면 따로 알려 드리겠습니다.",
    status: "open",
    deadlineMs: KST(2026, 11, 6, 21),
    publicResults: true,
    createdAt: KST(2026, 10, 24, 20),
    questions: [
      { id: "g1", type: "attend", label: "참석 여부", required: true, headcount: false },
      { id: "g2", type: "multi", label: "가능한 날짜 (여러 개 선택)", required: true,
        options: [{ id: "d1", label: "11/14(토) 저녁 7시" }, { id: "d2", label: "11/21(토) 저녁 7시" }, { id: "d3", label: "11/28(토) 저녁 7시" }] },
      { id: "g3", type: "text", label: "하고 싶은 말", required: false },
    ],
  },
  {
    id: "sample-ssiat",
    group: "ssiat",
    title: "[샘플] 씨앗별 가을 소풍 김밥 주문",
    desc: "소풍날 아침에 함께 받을 김밥을 주문합니다.\n아이 몫과 함께 오시는 가족 몫까지 적어 주세요.",
    status: "open",
    deadlineMs: KST(2026, 11, 4, 21),
    publicResults: false,
    createdAt: KST(2026, 10, 24, 20),
    questions: [
      { id: "s1", type: "items", label: "김밥 종류별 수량", required: true, unit: "줄",
        options: [{ id: "k1", label: "야채김밥", price: 3000 }, { id: "k2", label: "유부김밥", price: 3500 }] },
      { id: "s2", type: "choice", label: "받는 곳", required: true,
        options: [{ id: "p1", label: "학교 정문" }, { id: "p2", label: "소풍 장소" }] },
      { id: "s3", type: "text", label: "요청 사항", required: false },
    ],
  },
];

const t = KST(2026, 10, 24, 21);
export const sampleResponses = {
  "sample-grade": [
    { id: "sample-r1", uid: "sample-r1", name: "하늘아빠", updatedAt: t, answers: { g1: { choice: "참석" }, g2: ["d1", "d2"], g3: "오랜만에 뵙겠습니다" } },
    { id: "sample-r2", uid: "sample-r2", name: "바다아빠", updatedAt: t, answers: { g1: { choice: "참석" }, g2: ["d2"] } },
    { id: "sample-r3", uid: "sample-r3", name: "별이아빠", updatedAt: t, answers: { g1: { choice: "미정" }, g2: ["d2", "d3"] } },
    { id: "sample-r4", uid: "sample-r4", name: "숲이아빠", updatedAt: t, answers: { g1: { choice: "불참" }, g2: ["d3"], g3: "다음에 꼭 갈게요" } },
  ],
  "sample-ssiat": [
    { id: "sample-r1", uid: "sample-r1", name: "하늘맘", updatedAt: t, answers: { s1: { k1: 2, k2: 1 }, s2: "p1" } },
    { id: "sample-r2", uid: "sample-r2", name: "구름아빠", updatedAt: t, answers: { s1: { k1: 3 }, s2: "p2", s3: "단무지 빼 주세요" } },
    { id: "sample-r3", uid: "sample-r3", name: "봄이엄마", updatedAt: t, answers: { s1: { k2: 2 }, s2: "p1" } },
  ],
};

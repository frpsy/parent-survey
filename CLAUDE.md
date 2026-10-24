# 학부모 조사함 — 작업 규칙

- 이 저장소는 광명교회 홈페이지(frpsy/gmchurch_web)와 별개입니다. 두 저장소의 코드를 섞지 않습니다.
- 빌드 단계 없는 정적 사이트(바닐라 JS ES 모듈). 외부 라이브러리는 Firebase SDK(gstatic CDN)와 Pretendard 폰트만 씁니다.
- 순수 로직은 `js/core.js` 에 두고 `tests/core.test.js` 로 검증합니다. 화면 코드(`home.js`, `survey.js`, `admin.js`)는 DOM만 다룹니다.
- 저장소 접근은 `js/store.js` 한 곳에서만 합니다. Firebase 설정이 없으면 localStorage 체험 모드입니다.
- 화면에 넣는 사용자 입력은 반드시 `escapeHtml` 을 거칩니다.
- 데이터 구조를 바꾸면 `firestore.rules` 의 응답 필드 검증(`validResponse`)도 함께 고칩니다.
- 변경 후 `npm test` 통과를 확인하고, feature 브랜치 → PR → squash 머지로 반영합니다.
- 문구는 존댓말, 간결하게. 이름 목록은 가나다순.
- 사용자가 조사를 만들어 달라고 하면 README의 "문안 붙여넣기" 형식으로 문안을 코드블럭 하나에 담아 준다. 형식을 바꾸면 `parseSurveyText`·`surveyToText`와 테스트를 함께 고친다.

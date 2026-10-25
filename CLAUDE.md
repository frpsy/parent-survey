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
- 사용자가 단톡방 요구사항을 붙여 주면: `surveys/YYYY-MM-영문이름.txt` 를 문안 형식으로 작성 → `npm test` → PR → squash 머지 → 응답 링크(`survey.html?id=파일이름`)와 카톡 공지 문구를 보고한다. 모임이 불분명하면 2학년, 마감이 없으면 3일 뒤 21:00, 결과공개는 예가 기본.
- 파일 조사의 질문·항목 id는 이름으로 고정되므로, 응답이 있는 조사의 질문·항목 이름을 바꾸면 그 부분 응답이 끊긴다는 점을 사용자에게 알린다.

## 기본 규칙 (사용자 지정)

- 응답 화면은 한 가지 주제에 대한 응답 화면입니다. 화면에 목록 버튼을 두지 않습니다.
- 학부모에게는 조사 목록을 보여 주지 않습니다. 단톡방에는 조사 링크 하나만 줍니다. 첫 화면(`index.html`)에 목록·관리자 링크를 넣지 않습니다.
- 색상(테마) 선택은 관리자 전용입니다. 학부모 화면(첫 화면·응답 화면)에는 테마 버튼을 두지 않습니다.
- 조사의 상세 설명(안내)은 단톡방 원문을 줄이거나 요약하지 말고, 빠지는 내용 없이 전부 넣습니다.
- 실시간 현황(결과)은 기본으로 공개합니다. 비공개는 사용자가 따로 요청할 때만 합니다.
- 안내 문구에 "응답하면 현황을 볼 수 있습니다" 같은 사용 설명 문장을 덧붙이지 않습니다.
- 가격처럼 확인되지 않은 값은 임시값임을 사용자에게 알립니다.
- commit·PR·squash 머지는 묻지 않고 끝까지 진행하고, 배포까지 확인한 뒤 보고합니다.

## Claude Code로 이어받기 (시작 안내)

- 시작: `git clone https://github.com/frpsy/parent-survey.git` → 폴더에서 `claude` 실행 → `npm test` 로 20여 개 테스트 통과 확인.
- 화면 확인: `python3 -m http.server 8000` 후 `http://localhost:8000`. Firebase 연결을 끊고 체험 모드로 보려면 `js/config.js` 의 `apiKey` 를 임시로 비워 보되, 그 변경은 커밋하지 않습니다.
- 운영 구조: 사이트는 GitHub Pages(Actions 배포), 데이터는 Firebase 프로젝트 `parent-survey-d21e7`(Firestore). 관리자 계정은 `lgpsy83@gmail.com` 구글 로그인입니다.
- 조사 추가: `surveys/YYYY-MM-영문이름.txt` 를 머지하면 Actions가 Firestore에 자동 등록합니다(시크릿 `FIREBASE_SERVICE_ACCOUNT`). 이미 올라간 파일은 내용이 바뀐 커밋이 있어야 다시 등록됩니다.
- 삭제·가격 수정 등 관리자 화면 작업은 사용자의 구글 로그인이 필요해 Claude가 직접 할 수 없습니다. 파일 조사는 문안 파일을 고치는 방식으로 수정합니다.
- 캐시: 배포한 CSS가 브라우저에 최대 10분 남을 수 있어 HTML의 `style.css?v=N` 번호를 CSS를 바꿀 때마다 올립니다.
- 열린 항목: 2학년 김밥 주문의 가격(야채 3,500원·유부 4,000원)은 임시값입니다. 씨앗별 방학 급식 조사(`2026-10-vacation-lunch`)의 마감과 안내 문구를 원문과 대조해야 합니다.
- 다음 후보: 카톡 공유 미리보기, 마감 전 독려 문구, 날짜·시간 투표, 선착순 정원, 입금 확인, 홈 화면 설치(PWA).
- GitHub: `gh` 의 GraphQL이 막힌 환경이면 `gh api repos/frpsy/parent-survey/pulls` 같은 REST 호출로 PR을 만들고 머지합니다.

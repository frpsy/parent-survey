# 이어받기 안내 (CLAUDE.md에서 옮김, 2026-11-07)

- 시작: `git clone https://github.com/frpsy/parent-survey.git` → 폴더에서 `claude` 실행 → `npm test` 로 20여 개 테스트 통과 확인.
- 화면 확인: `python3 -m http.server 8000` 후 `http://localhost:8000`. Firebase 연결을 끊고 체험 모드로 보려면 `js/config.js` 의 `apiKey` 를 임시로 비워 보되, 그 변경은 커밋하지 않습니다.
- 운영 구조: 사이트는 GitHub Pages(Actions 배포), 데이터는 Firebase 프로젝트 `parent-survey-d21e7`(Firestore). 관리자 계정은 `lgpsy83@gmail.com` 구글 로그인입니다.
- 조사 추가: `surveys/YYYY-MM-영문이름.txt` 를 머지하면 Actions가 Firestore에 자동 등록합니다(시크릿 `FIREBASE_SERVICE_ACCOUNT`). 이미 올라간 파일은 내용이 바뀐 커밋이 있어야 다시 등록됩니다.
- 삭제·가격 수정 등 관리자 화면 작업은 사용자의 구글 로그인이 필요해 Claude가 직접 할 수 없습니다. 파일 조사는 문안 파일을 고치는 방식으로 수정합니다.
- 캐시: 배포한 CSS가 브라우저에 최대 10분 남을 수 있어 HTML의 `style.css?v=N` 번호를 CSS를 바꿀 때마다 올립니다.
- 열린 항목: 2학년 김밥 주문의 가격(야채 3,500원·유부 4,000원)은 임시값입니다. 씨앗별 방학 급식 조사(`2026-10-vacation-lunch`)의 마감과 안내 문구를 원문과 대조해야 합니다.
- 다음 후보: 카톡 공유 미리보기, 마감 전 독려 문구, 날짜·시간 투표, 선착순 정원, 입금 확인, 홈 화면 설치(PWA).
- GitHub: `gh` 의 GraphQL이 막힌 환경이면 `gh api repos/frpsy/parent-survey/pulls` 같은 REST 호출로 PR을 만들고 머지합니다.

// 조사 페이지 설정 파일
// 1) Firebase 프로젝트를 만든 뒤 firebaseConfig 값을 채우면 실제 운영 모드로 동작합니다.
//    값이 비어 있으면 "체험 모드"(이 브라우저에만 저장)로 동작합니다.
// 2) adminEmails 에 관리자 구글 계정을 넣습니다. firestore.rules 의 이메일과 같아야 합니다.

export const firebaseConfig = {
  apiKey: "AIzaSyB7VsDdAy_lTPwwlQ2QCImdYSYKwhVyQ1k",
  authDomain: "parent-survey-d21e7.firebaseapp.com",
  projectId: "parent-survey-d21e7",
  storageBucket: "parent-survey-d21e7.firebasestorage.app",
  messagingSenderId: "754087097956",
  appId: "1:754087097956:web:5beb1e8d56cff487d59171",
};

export const adminEmails = [
  "lgpsy83@gmail.com",
];

// 조사를 묶어서 관리하는 모임(그룹) 목록. 순서대로 탭에 표시됩니다.
export const groups = [
  { id: "grade", name: "2학년", desc: "채아네 2학년(18년생) 학부모 조사" },
  { id: "ssiat", name: "씨앗별", desc: "씨앗별 학부모 조사" },
];

export const siteTitle = "학부모 조사함";

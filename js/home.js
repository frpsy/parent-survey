// 첫 화면: 학부모에게는 조사 목록을 보여 주지 않고, 단톡방 링크로만 들어오게 함
import { $, header } from "./ui.js";

$("#app").innerHTML = `
  ${header()}
  <div class="card empty">단톡방에 올라온 조사 링크로 들어와 주세요.</div>
`;

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { groups } from "../js/config.js";
import { parseSurveyText, slugFromFile } from "../js/core.js";

const dir = new URL("../surveys/", import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith(".txt"))) {
  test(`조사 파일 ${f} 형식 확인`, () => {
    const { errors } = parseSurveyText(readFileSync(new URL(f, dir), "utf8"), groups);
    assert.deepEqual(errors, []);
    assert.ok(slugFromFile(f).length >= 3, "파일 이름은 영문·숫자로 3자 이상");
  });
}

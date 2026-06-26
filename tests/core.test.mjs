import assert from "node:assert/strict";
import {
  createWordCard,
  getDueWords,
  gradeSpelling,
  gradeWord,
  translateWord,
  upsertWord
} from "../src/core.js";

const first = createWordCard("Resilient", {
  meaning_zh: "有韧性的",
  part_of_speech: "adjective",
  example_en: "She is resilient.",
  example_zh: "她很有韧性。"
});

assert.equal(first.word, "resilient");
assert.equal(first.meaning_zh, "有韧性的");

const created = upsertWord([], first);
assert.equal(created.created, true);
assert.equal(created.words.length, 1);

const duplicate = createWordCard(" resilient ", {
  meaning_zh: "能恢复的",
  part_of_speech: "adjective"
});
const updated = upsertWord(created.words, duplicate);
assert.equal(updated.created, false);
assert.equal(updated.words.length, 1);
assert.equal(updated.card.id, first.id);
assert.equal(updated.card.meaning_zh, "能恢复的");

const now = new Date("2026-06-26T08:00:00.000Z");
const gradedAgain = gradeWord(first, "again", now);
assert.equal(gradedAgain.mistake_count, 1);
assert.equal(new Date(gradedAgain.next_review_at).getTime(), new Date("2026-06-26T08:10:00.000Z").getTime());

const gradedEasy = gradeWord(first, "easy", now);
assert.equal(gradedEasy.familiarity_level, 1);
assert.ok(new Date(gradedEasy.next_review_at) > now);

const spelling = gradeSpelling(first, "resilient", now);
assert.equal(spelling.isCorrect, true);

const dueNow = { ...first, next_review_at: "2026-06-26T07:59:00.000Z" };
const due = getDueWords([dueNow, gradedEasy], now, 30);
assert.equal(due.length, 1);
assert.equal(due[0].id, first.id);

const translated = await translateWord("serendipity", {}, async () => {
  throw new Error("offline");
});
assert.equal(translated.meaning_zh.includes("机缘"), true);

console.log("All core tests passed");

import assert from "node:assert/strict";
import { plainNarrative, readableNarrative } from "../src/utils/plainText";

// A model reply with markdown: the reader must neither print nor narrate "**".
const story = readableNarrative(
  "**الاكتشاف الأول: ماذا يفعل هذا المتحف؟**\nإنه **مؤسسة** ثقافية.\n\n## History\n* A point",
);
assert.equal(
  story.text,
  "الاكتشاف الأول: ماذا يفعل هذا المتحف؟\nإنه مؤسسة ثقافية.\n\nHistory\n- A point",
);
assert.ok(story.headings.has("الاكتشاف الأول: ماذا يفعل هذا المتحف؟"));
assert.ok(story.headings.has("History"));
assert.ok(!story.text.includes("*"));

// Plain stories pass through untouched.
const reviewed = "What to notice\nStart at the top of the stepped plaza.";
assert.equal(plainNarrative(reviewed), reviewed);

console.log("Narrative markdown cleanup checks passed.");

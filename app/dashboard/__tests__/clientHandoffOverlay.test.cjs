/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../DashboardClientHandoffOverlay.tsx"),
  "utf8"
);

test("Client Summary renders deterministic daily sections with section-level sources", () => {
  assert.match(source, /Daily summary — \{formatSummaryDate\(activeHandoff\.date\)\}/);
  assert.match(source, /activeHandoff\.sections\.map/);
  assert.match(source, /section\.title/);
  assert.match(source, /section\.summary/);
  assert.match(source, /section\.sourceReferenceIds\.includes\(reference\.id\)/);
  assert.match(source, /label="View Sources"/);
});

test("Client Summary preserves the prior overview as a backward-compatible fallback", () => {
  assert.match(source, /activeHandoff\.sections\?\.length/);
  assert.match(source, /activeHandoff\.overview/);
  assert.match(source, /Referenced notes/);
  assert.doesNotMatch(source, /Live · provisional|Documentation is still in progress/);
});

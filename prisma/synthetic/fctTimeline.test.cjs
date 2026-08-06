/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFctTimeline } = require("./fctTimeline");
const { compareReplay, replaySignals } = require("./signalReplay");

test("FCT fixture is mostly neutral and never embeds labels in source data", () => {
  const dataset = buildFctTimeline();
  assert.equal(dataset.expectedSignals.length, 40);
  assert.ok(dataset.sourceRecords.every((record) => !("expectedSignal" in record)));
  assert.equal(dataset.summary.expectedSignals.neutral, 31);
  assert.equal(dataset.summary.expectedSignals.blue, 6);
  assert.equal(dataset.summary.expectedSignals.amber, 2);
  assert.equal(dataset.summary.expectedSignals.red, 1);
});

test("routine DTT mastery stays neutral while new independent communication becomes blue", () => {
  const dataset = buildFctTimeline();
  const replay = replaySignals({ sourceRecords: dataset.sourceRecords, evaluationDates: dataset.expectedSignals.map((item) => item.date), calibration: dataset.profile.calibration });
  const byDate = new Map(replay.map((result) => [result.date, result]));
  assert.equal(byDate.get("2026-02-10").signal, "neutral");
  assert.equal(byDate.get("2026-02-13").signal, "blue");
  assert.equal(byDate.get("2026-02-18").signal, "amber");
  assert.equal(byDate.get("2026-03-23").signal, "red");
  assert.ok(compareReplay(replay, dataset.expectedSignals).accuracy >= 0.9);
});

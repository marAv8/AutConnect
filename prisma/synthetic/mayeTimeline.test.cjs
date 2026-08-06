/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMayeTimeline } = require("./mayeTimeline");
const { compareReplay, replaySignals } = require("./signalReplay");

test("Maye fixture keeps expected labels separate from source records", () => {
  const dataset = buildMayeTimeline();
  assert.equal(dataset.expectedSignals.length, 40);
  assert.ok(dataset.sourceRecords.every((record) => !("expectedSignal" in record)));
  assert.equal(dataset.summary.expectedSignals.red, 1);
  assert.ok(dataset.summary.expectedSignals.neutral > dataset.summary.expectedSignals.red);
});

test("Maye high assistance can remain neutral while change from baseline drives color", () => {
  const dataset = buildMayeTimeline();
  const replay = replaySignals({
    sourceRecords: dataset.sourceRecords,
    evaluationDates: dataset.expectedSignals.map((item) => item.date),
    calibration: dataset.profile.calibration,
  });
  const byDate = new Map(replay.map((result) => [result.date, result]));
  assert.equal(byDate.get("2026-02-03").signal, "neutral");
  assert.equal(byDate.get("2026-02-12").signal, "amber");
  assert.equal(byDate.get("2026-02-18").signal, "red");
  assert.equal(byDate.get("2026-03-05").signal, "blue");
  assert.equal(byDate.get("2026-03-13").signal, "amber");
  assert.ok(compareReplay(replay, dataset.expectedSignals).accuracy >= 0.9);
});

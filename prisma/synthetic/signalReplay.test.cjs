/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSuDoTimeline } = require("./sudoTimeline");
const { compareReplay, replaySignals } = require("./signalReplay");

test("replays without reading expected signals", () => {
  const dataset = buildSuDoTimeline();
  const evaluationDates = dataset.expectedSignals.map((item) => item.date);
  const replay = replaySignals({ sourceRecords: dataset.sourceRecords, evaluationDates });

  assert.equal(replay.length, evaluationDates.length);
  assert.ok(replay.every((item) => item.signal && item.reason && item.explanation));
  assert.ok(replay.every((item) => !("expectedSignal" in item)));
});

test("Case Support records do not affect synthetic client signal replay", () => {
  const dataset = buildSuDoTimeline();
  const evaluationDates = dataset.expectedSignals.map((item) => item.date);
  const withCaseSupport = replaySignals({
    sourceRecords: dataset.sourceRecords,
    evaluationDates,
  });
  const withoutCaseSupport = replaySignals({
    sourceRecords: dataset.sourceRecords.filter(
      (record) => !record.recordType.startsWith("caseSupport")
    ),
    evaluationDates,
  });

  assert.deepEqual(
    withCaseSupport.map(({ date, signal, reason }) => ({ date, signal, reason })),
    withoutCaseSupport.map(({ date, signal, reason }) => ({ date, signal, reason }))
  );
});

test("classifies the bounded Special Olympics event as amber", () => {
  const dataset = buildSuDoTimeline();
  const evaluationDates = dataset.expectedSignals.map((item) => item.date);
  const replay = replaySignals({ sourceRecords: dataset.sourceRecords, evaluationDates });
  const result = replay.find((item) => item.date === "2025-08-14");

  assert.equal(result.signal, "amber");
  assert.equal(result.reason, "bounded_high_intensity_event");
});

test("produces a measurable comparison without changing evaluator output", () => {
  const dataset = buildSuDoTimeline();
  const evaluationDates = dataset.expectedSignals.map((item) => item.date);
  const replay = replaySignals({ sourceRecords: dataset.sourceRecords, evaluationDates });
  const comparison = compareReplay(replay, dataset.expectedSignals);

  assert.equal(comparison.evaluated, evaluationDates.length);
  assert.ok(comparison.accuracy > 0.5);
  assert.equal(
    Object.values(comparison.confusion).reduce(
      (total, row) => total + Object.values(row).reduce((sum, value) => sum + value, 0),
      0
    ),
    evaluationDates.length
  );
});

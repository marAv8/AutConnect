/* eslint-disable @typescript-eslint/no-require-imports */
const { buildSuDoTimeline } = require("./synthetic/sudoTimeline");
const { compareReplay, replaySignals } = require("./synthetic/signalReplay");

const dataset = buildSuDoTimeline();
const evaluationDates = dataset.expectedSignals.map((item) => item.date);
const replay = replaySignals({
  sourceRecords: dataset.sourceRecords,
  evaluationDates,
});
const comparison = compareReplay(replay, dataset.expectedSignals);
const detailed = process.argv.includes("--details");

console.log(
  JSON.stringify(
    {
      fixtureId: dataset.fixtureId,
      evaluated: comparison.evaluated,
      matches: comparison.matches,
      accuracy: Number((comparison.accuracy * 100).toFixed(1)),
      confusion: comparison.confusion,
      mismatchCount: comparison.mismatches.length,
      mismatches: detailed ? comparison.mismatches : comparison.mismatches.slice(0, 20),
      anchorResults: dataset.summary.anchorEvents.map((anchor) => {
        const actual = replay.find((item) => item.date === anchor.date);
        return {
          id: anchor.id,
          date: anchor.date,
          expected: anchor.expectedSignal,
          actual: actual?.signal ?? null,
          reason: actual?.reason ?? null,
          confidence: actual?.confidence ?? null,
        };
      }),
    },
    null,
    2
  )
);

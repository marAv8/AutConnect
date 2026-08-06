/* eslint-disable @typescript-eslint/no-require-imports */
const { buildFctTimeline } = require("./synthetic/fctTimeline");
const { compareReplay, replaySignals } = require("./synthetic/signalReplay");

const dataset = buildFctTimeline();
const replay = replaySignals({
  sourceRecords: dataset.sourceRecords,
  evaluationDates: dataset.expectedSignals.map((item) => item.date),
  calibration: dataset.profile.calibration,
});
const comparison = compareReplay(replay, dataset.expectedSignals);
console.log(JSON.stringify({
  fixtureId: dataset.fixtureId,
  evaluated: comparison.evaluated,
  matches: comparison.matches,
  accuracy: Number((comparison.accuracy * 100).toFixed(1)),
  confusion: comparison.confusion,
  mismatchCount: comparison.mismatches.length,
  mismatches: comparison.mismatches,
  anchorResults: dataset.summary.anchorEvents.map((anchor) => {
    const actual = replay.find((item) => item.date === anchor.date);
    return { id: anchor.id, date: anchor.date, expected: anchor.expectedSignal, actual: actual?.signal, reason: actual?.reason };
  }),
}, null, 2));

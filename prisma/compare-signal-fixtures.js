/* eslint-disable @typescript-eslint/no-require-imports */
const { buildSuDoTimeline } = require("./synthetic/sudoTimeline");
const { buildMayeTimeline } = require("./synthetic/mayeTimeline");
const { buildFctTimeline } = require("./synthetic/fctTimeline");
const { compareReplay, replaySignals } = require("./synthetic/signalReplay");

const datasets = [buildSuDoTimeline(), buildMayeTimeline(), buildFctTimeline()];
const results = datasets.map((dataset) => {
  const replay = replaySignals({
    sourceRecords: dataset.sourceRecords,
    evaluationDates: dataset.expectedSignals.map((item) => item.date),
    calibration: dataset.profile.calibration ?? {},
  });
  const comparison = compareReplay(replay, dataset.expectedSignals);
  return {
    fixtureId: dataset.fixtureId,
    evaluated: comparison.evaluated,
    matches: comparison.matches,
    accuracy: Number((comparison.accuracy * 100).toFixed(1)),
    mismatchCount: comparison.mismatches.length,
  };
});
const totals = results.reduce((summary, result) => ({
  evaluated: summary.evaluated + result.evaluated,
  matches: summary.matches + result.matches,
}), { evaluated: 0, matches: 0 });

console.log(JSON.stringify({
  fixtures: results,
  aggregate: {
    ...totals,
    accuracy: Number(((totals.matches / totals.evaluated) * 100).toFixed(1)),
  },
  interpretation:
    "Synthetic calibration agreement is not clinical validation. Use these fixtures to test implementation, then validate prospectively with reviewed real-world records before autonomous signaling.",
}, null, 2));

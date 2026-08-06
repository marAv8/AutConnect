/* eslint-disable @typescript-eslint/no-require-imports */
const { buildMayeTimeline } = require("./synthetic/mayeTimeline");

const dataset = buildMayeTimeline();
if (process.argv.includes("--json")) console.log(JSON.stringify(dataset, null, 2));
else console.log(JSON.stringify(dataset.summary, null, 2));

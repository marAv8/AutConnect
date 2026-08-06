/* eslint-disable @typescript-eslint/no-require-imports */
const { buildFctTimeline } = require("./synthetic/fctTimeline");
const dataset = buildFctTimeline();
console.log(JSON.stringify(process.argv.includes("--json") ? dataset : dataset.summary, null, 2));

/* eslint-disable @typescript-eslint/no-require-imports */
const { buildSuDoTimeline } = require("./synthetic/sudoTimeline");

const dataset = buildSuDoTimeline();
const includeSamples = process.argv.includes("--samples");
const includeFullDataset = process.argv.includes("--json");

if (includeFullDataset) {
  console.log(JSON.stringify(dataset, null, 2));
  process.exit(0);
}

const preview = { summary: dataset.summary };

if (includeSamples) {
  const sampleDates = new Set([
    "2025-01-13",
    "2025-08-14",
    "2025-09-30",
    "2025-10-03",
    "2025-10-06",
    "2025-10-21",
    "2025-10-31",
  ]);
  preview.samples = dataset.sourceRecords.filter((record) =>
    sampleDates.has(record.date.slice(0, 10))
  );
}

console.log(JSON.stringify(preview, null, 2));


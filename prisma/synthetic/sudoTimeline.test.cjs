/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ANCHOR_EVENTS,
  buildSuDoTimeline,
  weekdaysBetween,
} = require("./sudoTimeline");

test("builds a deterministic SuDo timeline without database access", () => {
  const first = buildSuDoTimeline();
  const second = buildSuDoTimeline();

  assert.deepEqual(first, second);
  assert.equal(first.fixtureId, "sudo-signal-lab-v1");
  assert.ok(first.sourceRecords.length > 400);
  assert.ok(first.expectedSignals.length > 150);
  assert.ok(first.goalDefinitions.length > 10);
});

test("links every measurement to one reusable synthetic goal definition", () => {
  const dataset = buildSuDoTimeline();
  const goalKeys = new Set(dataset.goalDefinitions.map((goal) => goal.syntheticKey));
  const entryRecords = dataset.sourceRecords.filter((record) => record.recordType === "entry");

  for (const entry of entryRecords) {
    for (const item of entry.items) {
      assert.ok(item.goalKey, `${entry.syntheticId} has an item without a goal key`);
      assert.ok(goalKeys.has(item.goalKey), `${item.goalKey} has no goal definition`);
    }
  }
});

test("keeps source records and expected signals as separate tracks", () => {
  const dataset = buildSuDoTimeline();

  for (const record of dataset.sourceRecords) {
    assert.equal("expectedSignal" in record, false);
  }
  assert.ok(dataset.expectedSignals.every((item) => item.expectedSignal));
});

test("makes positive and review conditions observable in their measurements", () => {
  const dataset = buildSuDoTimeline();
  const entryByDay = new Map(
    dataset.sourceRecords
      .filter((record) => record.recordType === "entry" && record.role === "BehaviorTherapist")
      .map((record) => [record.date.slice(0, 10), record])
  );
  const comparable = dataset.expectedSignals.filter(
    (item) => item.date >= "2025-02-10" && item.date <= "2025-05-30" && entryByDay.has(item.date)
  );
  const positive = comparable.find((item) => item.scenarioCondition === "sustained_positive_evidence");
  const review = comparable.find((item) => item.scenarioCondition === "review_condition");

  assert.ok(positive);
  assert.ok(review);
  const positiveIncidents = entryByDay.get(positive.date).items.find((item) => item.target === "Elopement Reduction").rawValue;
  const reviewIncidents = entryByDay.get(review.date).items.find((item) => item.target === "Elopement Reduction").rawValue;
  assert.ok(positiveIncidents < reviewIncidents);
});

test("matches the agreed eight-week September-October calibration", () => {
  const dataset = buildSuDoTimeline();
  const transitionSignals = dataset.expectedSignals.filter(
    (item) => item.date >= "2025-09-08" && item.date <= "2025-10-31"
  );

  assert.equal(transitionSignals.length, 40);
  assert.deepEqual(dataset.summary.expectedSignalsSeptemberOctober, {
    neutral: 8,
    amber: 20,
    red: 12,
  });
});

test("never labels the January-August calibration red", () => {
  const dataset = buildSuDoTimeline();
  const earlySignals = dataset.expectedSignals.filter((item) => item.date < "2025-09-08");

  assert.equal(earlySignals.some((item) => item.expectedSignal === "red"), false);
});

test("contains every anchor event in the source or expected timeline", () => {
  const dataset = buildSuDoTimeline();
  const sourceDays = new Set(dataset.sourceRecords.map((record) => record.date.slice(0, 10)));
  const expectedDays = new Set(dataset.expectedSignals.map((item) => item.date));

  for (const anchor of ANCHOR_EVENTS) {
    assert.ok(sourceDays.has(anchor.date), `missing source records for ${anchor.id}`);
    assert.ok(expectedDays.has(anchor.date), `missing expected signal for ${anchor.id}`);
  }
});

test("models stable home context during the school coordination breakdown", () => {
  const dataset = buildSuDoTimeline();
  const breakdownCaregiverEntries = dataset.sourceRecords.filter(
    (record) =>
      record.recordType === "entry" &&
      record.role === "Caregiver" &&
      record.date >= "2025-10-06" &&
      record.date <= "2025-10-17T23:59:59.999Z"
  );

  assert.ok(breakdownCaregiverEntries.length > 0);
  assert.ok(
    breakdownCaregiverEntries.every((entry) =>
      entry.contextData.entries.some((item) =>
        ["Good", "Ate well", "Smooth", "Calm", "Completed"].includes(item.value)
      )
    )
  );
});

test("weekday helper excludes weekends", () => {
  assert.deepEqual(weekdaysBetween("2025-09-08", "2025-09-14"), [
    "2025-09-08",
    "2025-09-09",
    "2025-09-10",
    "2025-09-11",
    "2025-09-12",
  ]);
});

/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const originalTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const fieldObservation = require(path.join(
  process.cwd(),
  "src/lib/fieldObservation.ts",
));

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

const {
  FIELD_OBSERVATION_RUBRIC,
  buildFieldObservationItemSnapshot,
  calculateFieldObservationFidelity,
  getFieldObservationCardIndex,
  getFieldObservationCoverage,
  getFieldObservationDashboardHref,
  isFieldObservationFinishEnabled,
  validateFieldObservationAuthorization,
  validateFieldObservationContext,
} = fieldObservation;

function itemsWithRatings(ratings) {
  return FIELD_OBSERVATION_RUBRIC.map((criterion, index) => ({
    criterionKey: criterion.key,
    rating: ratings[index] ?? "NOT_OBSERVED",
  }));
}

test("calculates 100 percent when every criterion is implemented", () => {
  const result = calculateFieldObservationFidelity(
    itemsWithRatings(Array(8).fill("IMPLEMENTED")),
  );
  assert.deepEqual(result, {
    fidelityPercent: 100,
    applicableItemCount: 8,
    earnedPoints: 16,
    possiblePoints: 16,
  });
});

test("rounds fidelity and excludes criteria that were not observed", () => {
  const result = calculateFieldObservationFidelity(
    itemsWithRatings([
      "IMPLEMENTED",
      "PARTIALLY_IMPLEMENTED",
      "IMPLEMENTED",
      "NOT_OBSERVED",
      "NOT_OBSERVED",
      "NOT_OBSERVED",
      "NOT_OBSERVED",
      "NOT_OBSERVED",
    ]),
  );
  assert.deepEqual(result, {
    fidelityPercent: 83,
    applicableItemCount: 3,
    earnedPoints: 5,
    possiblePoints: 6,
  });
});

test("accepts one assessed criterion and excludes all unassessed criteria", () => {
  const result = calculateFieldObservationFidelity(
    itemsWithRatings(["PARTIALLY_IMPLEMENTED"]),
  );
  assert.deepEqual(result, {
    fidelityPercent: 50,
    applicableItemCount: 1,
    earnedPoints: 1,
    possiblePoints: 2,
  });
});

test("rejects an observation with zero assessed criteria", () => {
  assert.throws(
    () =>
      calculateFieldObservationFidelity(
        itemsWithRatings(Array(8).fill("NOT_OBSERVED")),
      ),
    /At least one.*assessed/,
  );
});

test("carousel navigation stays within all 10 card boundaries", () => {
  assert.equal(getFieldObservationCardIndex(0, -1), 0);
  assert.equal(getFieldObservationCardIndex(0, 1), 1);
  assert.equal(getFieldObservationCardIndex(8, 1), 9);
  assert.equal(getFieldObservationCardIndex(9, 1), 9);
  assert.equal(getFieldObservationCardIndex(9, -1), 8);
});

test("unselected criteria become NOT_OBSERVED in the full snapshot", () => {
  const snapshot = buildFieldObservationItemSnapshot({
    session_preparation: "IMPLEMENTED",
  });

  assert.equal(snapshot.length, 8);
  assert.deepEqual(
    snapshot.map((item) => item.rating),
    ["IMPLEMENTED", ...Array(7).fill("NOT_OBSERVED")],
  );
  assert.ok(snapshot.every((item) => item.note === null));
});

test("coverage excludes NOT_OBSERVED and calculates confirmation fidelity", () => {
  const coverage = getFieldObservationCoverage({
    session_preparation: "IMPLEMENTED",
    plan_implementation: "PARTIALLY_IMPLEMENTED",
    proactive_support: "NOT_IMPLEMENTED",
    reinforcement: "NOT_OBSERVED",
  });

  assert.deepEqual(coverage, {
    assessedItemCount: 3,
    excludedItemCount: 5,
    fidelityPercent: 50,
  });
});

test("Finish requires details and at least one genuine assessment", () => {
  const details = {
    observedProviderId: "provider-1",
    observedAt: "2026-08-12T09:30",
    setting: "SCHOOL",
  };

  assert.equal(
    isFieldObservationFinishEnabled({
      ...details,
      criterionRatings: { session_preparation: "NOT_OBSERVED" },
    }),
    false,
  );
  assert.equal(
    isFieldObservationFinishEnabled({
      ...details,
      observedProviderId: "",
      criterionRatings: { session_preparation: "IMPLEMENTED" },
    }),
    false,
  );
  assert.equal(
    isFieldObservationFinishEnabled({
      ...details,
      criterionRatings: { session_preparation: "IMPLEMENTED" },
    }),
    true,
  );
});

test("completion UI remains global, restores observing, and avoids daily completion", () => {
  const formPath = path.join(
    process.cwd(),
    "app/portal/supervisor/field-observation/[clientId]/FieldObservationForm.tsx",
  );
  const source = fs.readFileSync(formPath, "utf8");
  const sourceFile = ts.createSourceFile(
    formPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const buttons = [];
  let closeConfirmationDeclaration;

  function visit(node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(sourceFile) === "button"
    ) {
      buttons.push(node);
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === "closeConfirmation"
    ) {
      closeConfirmationDeclaration = node;
    }
    ts.forEachChild(node, visit);
  }

  function buttonLabel(button) {
    return button.children
      .filter(ts.isJsxText)
      .map((child) => child.getText(sourceFile))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function attributeSource(element, attributeName) {
    const attribute = element.openingElement.attributes.properties.find(
      (candidate) =>
        ts.isJsxAttribute(candidate) &&
        candidate.name.getText(sourceFile) === attributeName,
    );
    return attribute?.initializer?.getText(sourceFile) ?? "";
  }

  visit(sourceFile);

  const finishButtons = buttons.filter((button) => buttonLabel(button) === "Finish");
  assert.equal(finishButtons.length, 1);
  const finishButton = finishButtons[0];
  assert.match(attributeSource(finishButton, "onClick"), /setConfirmationOpen\(true\)/);

  for (
    let ancestor = finishButton.parent;
    ancestor;
    ancestor = ancestor.parent
  ) {
    if (ts.isConditionalExpression(ancestor)) {
      assert.doesNotMatch(
        ancestor.condition.getText(sourceFile),
        /currentIndex|activeCriterion/,
      );
    }
  }

  assert.match(source, /\{confirmationOpen\s*\?\s*createPortal\(/);
  assert.match(source, /role="dialog"/);

  const continueButtons = buttons.filter(
    (button) => buttonLabel(button) === "Continue observing",
  );
  assert.equal(continueButtons.length, 1);
  assert.equal(attributeSource(continueButtons[0], "onClick"), "{closeConfirmation}");

  assert.ok(closeConfirmationDeclaration);
  const closeConfirmationSource = closeConfirmationDeclaration.getText(sourceFile);
  assert.match(closeConfirmationSource, /setConfirmationOpen\(false\)/);
  assert.match(closeConfirmationSource, /finishButtonRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(closeConfirmationSource, /setCurrentIndex/);

  assert.match(source, /if \(savingRef\.current \|\| !finishEnabled\) return/);
  assert.match(source, /savingRef\.current = true;[\s\S]*createFieldObservation/);
  assert.doesNotMatch(source, /completeSessionNote|Submit Completed Notes/);
  assert.equal(
    getFieldObservationDashboardHref("client id"),
    "/dashboard?clientId=client%20id&view=orbit",
  );
});

test("rejects missing, extra, duplicate, and unrecognized rubric values", () => {
  const valid = itemsWithRatings(Array(8).fill("IMPLEMENTED"));
  assert.throws(
    () => calculateFieldObservationFidelity(valid.slice(0, 7)),
    /exactly match/,
  );
  assert.throws(
    () =>
      calculateFieldObservationFidelity([
        ...valid.slice(0, 7),
        { criterionKey: valid[0].criterionKey, rating: "IMPLEMENTED" },
      ]),
    /Duplicate/,
  );
  assert.throws(
    () =>
      calculateFieldObservationFidelity([
        ...valid.slice(0, 7),
        { criterionKey: "invented", rating: "IMPLEMENTED" },
      ]),
    /Unrecognized Field Observation criterion/,
  );
  assert.throws(
    () =>
      calculateFieldObservationFidelity(
        valid.map((item, index) =>
          index === 0 ? { ...item, rating: "EXCELLENT" } : item,
        ),
      ),
    /Unrecognized Field Observation rating/,
  );
});

test("enforces supervisor, assignment, and observed-role authorization", () => {
  const allowed = {
    actorRole: "Supervisor",
    supervisorAssignedToClient: true,
    observedProviderAssignedToClient: true,
    observedProviderRole: "BehaviorTherapist",
  };
  assert.doesNotThrow(() => validateFieldObservationAuthorization(allowed));
  assert.throws(
    () =>
      validateFieldObservationAuthorization({
        ...allowed,
        actorRole: "Educator",
      }),
    /Only supervisors/,
  );
  assert.throws(
    () =>
      validateFieldObservationAuthorization({
        ...allowed,
        supervisorAssignedToClient: false,
      }),
    /supervisor is not assigned/,
  );
  assert.throws(
    () =>
      validateFieldObservationAuthorization({
        ...allowed,
        observedProviderAssignedToClient: false,
      }),
    /observed provider is not assigned/,
  );
  assert.throws(
    () =>
      validateFieldObservationAuthorization({
        ...allowed,
        observedProviderRole: "Caregiver",
      }),
    /not eligible/,
  );
});

test("validates observation time, setting, and optional duration", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");
  assert.doesNotThrow(() =>
    validateFieldObservationContext({
      observedAt: new Date("2026-08-10T11:00:00.000Z"),
      setting: "SCHOOL",
      durationMinutes: 45,
      now,
    }),
  );
  assert.throws(
    () =>
      validateFieldObservationContext({
        observedAt: new Date("invalid"),
        setting: "SCHOOL",
        now,
      }),
    /valid observation date/,
  );
  assert.throws(
    () =>
      validateFieldObservationContext({
        observedAt: new Date("2026-08-10T11:00:00.000Z"),
        setting: "CLASSROOM",
        now,
      }),
    /recognized observation setting/,
  );
  assert.throws(
    () =>
      validateFieldObservationContext({
        observedAt: new Date("2026-08-10T11:00:00.000Z"),
        setting: "SCHOOL",
        durationMinutes: 0,
        now,
      }),
    /Duration must/,
  );
});

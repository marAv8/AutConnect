/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  CUSTOM_OBSERVABLE_SKILL_TARGET,
  STRENGTHS_AND_EMERGING_SKILLS_GROUP,
  professionTemplates,
} = require("../professionTemplates.ts");

const serviceProviderRoles = [
  "BehaviorTherapist",
  "SpeechPathologist",
  "OccupationalTherapist",
  "Educator",
];

test("service providers receive the shared strengths library without a visible Other target", () => {
  for (const role of serviceProviderRoles) {
    const targets = professionTemplates[role].targets;
    assert.equal(targets.some((target) => target.value === "Other"), false, role);
    assert.equal(
      targets.some(
        (target) =>
          target.group === STRENGTHS_AND_EMERGING_SKILLS_GROUP &&
          target.value === CUSTOM_OBSERVABLE_SKILL_TARGET
      ),
      true,
      role
    );
  }
});

test("supervisor and caretaker target libraries are not changed into strengths libraries", () => {
  for (const role of ["Supervisor", "Caregiver"]) {
    assert.equal(
      professionTemplates[role].targets.some(
        (target) => target.group === STRENGTHS_AND_EMERGING_SKILLS_GROUP
      ),
      false,
      role
    );
  }
});

test("predefined strength targets store an explicit positive direction", () => {
  const strengthTargets = professionTemplates.BehaviorTherapist.targets.filter(
    (target) =>
      target.group === STRENGTHS_AND_EMERGING_SKILLS_GROUP &&
      target.value !== CUSTOM_OBSERVABLE_SKILL_TARGET
  );

  assert.ok(strengthTargets.length > 0);
  assert.equal(
    strengthTargets.every((target) => target.direction === "higherIsBetter"),
    true
  );
});

/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
  canViewCaregiverMedication,
  redactMedicationContextData,
  redactMedicationNote,
  redactMedicationRevisionValue,
  shouldRedactCaregiverMedication,
} = require("../caregiverMedicationPrivacy.ts");

const root = path.join(__dirname, "../../..");

test("only the caregiver author and supervisor can view caregiver medication context", () => {
  assert.equal(
    canViewCaregiverMedication({
      viewerProviderId: "caregiver-1",
      viewerRole: "Caregiver",
      authorProviderId: "caregiver-1",
    }),
    true
  );
  assert.equal(
    canViewCaregiverMedication({
      viewerProviderId: "supervisor-1",
      viewerRole: "Supervisor",
      authorProviderId: "caregiver-1",
    }),
    true
  );
  assert.equal(
    canViewCaregiverMedication({
      viewerProviderId: "bt-1",
      viewerRole: "BehaviorTherapist",
      authorProviderId: "caregiver-1",
    }),
    false
  );
});

test("redaction applies only to caregiver context entries", () => {
  const viewer = {
    viewerProviderId: "bt-1",
    viewerRole: "BehaviorTherapist",
    authorProviderId: "caregiver-1",
  };
  assert.equal(
    shouldRedactCaregiverMedication({ kind: "MorningContext", ...viewer }),
    true
  );
  assert.equal(
    shouldRedactCaregiverMedication({ kind: "SessionNote", ...viewer }),
    false
  );
});

test("note, structured context, and revision payloads remove medication without removing other context", () => {
  assert.equal(
    redactMedicationNote("Sleep: Good\nMedication: Given\nTransition: Smooth"),
    "Sleep: Good\nTransition: Smooth"
  );
  assert.deepEqual(
    redactMedicationContextData({
      entries: [
        { key: "sleep", label: "Sleep", value: "Good" },
        { key: "medication", label: "Medication", value: "Given" },
      ],
      comment: "A calm morning.",
    }),
    {
      entries: [{ key: "sleep", label: "Sleep", value: "Good" }],
      comment: "A calm morning.",
    }
  );
  assert.deepEqual(
    redactMedicationRevisionValue([
      { path: "entries.sleep", label: "Sleep", after: "Good" },
      {
        path: "entries.medication",
        label: "Medication",
        after: { key: "medication", value: "Given" },
      },
    ]),
    [{ path: "entries.sleep", label: "Sleep", after: "Good" }]
  );
});

test("all general note reads and signal semantics use the central medication policy", () => {
  const route = fs.readFileSync(path.join(root, "app/api/notes/history/route.ts"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/portal/notes/view/page.tsx"), "utf8");
  const signal = fs.readFileSync(path.join(root, "app/libs/clientSignal/server.ts"), "utf8");
  for (const source of [route, page]) {
    assert.match(source, /shouldRedactCaregiverMedication/);
    assert.match(source, /redactMedicationContextData/);
    assert.match(source, /redactMedicationRevisionValue/);
  }
  assert.match(signal, /redactMedicationNote/);
  assert.match(signal, /MorningContext/);
  assert.match(signal, /EveningContext/);
});

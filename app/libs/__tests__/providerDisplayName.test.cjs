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
  formatCompactProviderBadgeName,
  formatProviderDisplayName,
  formatStoredProviderDisplayName,
} = require("../providerDisplayName.ts");

test("formats compact provider badges with the first name only", () => {
  assert.equal(formatCompactProviderBadgeName("Mona"), "Mona");
  assert.equal(formatCompactProviderBadgeName("  kristine  "), "Kristine");
  assert.equal(formatCompactProviderBadgeName("MICHELLE"), "Michelle");
  assert.doesNotMatch(formatCompactProviderBadgeName("Mona"), /[A-Z]\.$/);
});

test("applies the same compact and standard rules to every provider role", () => {
  const roles = [
    "Supervisor",
    "BehaviorTherapist",
    "SpeechPathologist",
    "OccupationalTherapist",
    "Educator",
    "Caregiver",
  ];

  for (const role of roles) {
    assert.equal(formatCompactProviderBadgeName("Mona"), "Mona", role);
    assert.equal(formatProviderDisplayName("Mona", "Avetisian"), "Mona A.", role);
  }
});

test("formats lowercase provider names", () => {
  assert.equal(formatProviderDisplayName("christine", "babb"), "Christine B.");
});

test("formats uppercase provider names", () => {
  assert.equal(formatProviderDisplayName("ERIN", "arr"), "Erin A.");
});

test("handles a missing last name", () => {
  assert.equal(formatProviderDisplayName("tina", ""), "Tina");
  assert.equal(formatProviderDisplayName("tina", null), "Tina");
});

test("trims and collapses accidental whitespace", () => {
  assert.equal(
    formatProviderDisplayName("  mary   jane  ", "  watson  "),
    "Mary Jane W."
  );
});

test("preserves reasonable internal capitalization and punctuation", () => {
  assert.equal(formatProviderDisplayName("McKenna", "d."), "McKenna D.");
  assert.equal(
    formatProviderDisplayName("anne-marie", "o'brien"),
    "Anne-Marie O."
  );
});

test("handles one-character, hyphenated, and whitespace-containing last names", () => {
  assert.equal(formatProviderDisplayName("Mona", "q"), "Mona Q.");
  assert.equal(formatProviderDisplayName("Mona", "smith-jones"), "Mona S.");
  assert.equal(formatProviderDisplayName("Mona", "  de la Cruz  "), "Mona D.");
});

test("formats legacy structured full-name values without mutating the input", () => {
  const storedName = "Mona Avetisian";
  assert.equal(formatStoredProviderDisplayName(storedName), "Mona A.");
  assert.equal(storedName, "Mona Avetisian");
});

test("the client orbit keeps badge roles and interactions while using compact names", () => {
  const orbitSource = fs.readFileSync(
    path.join(__dirname, "../../dashboard/ClientOrbit.tsx"),
    "utf8"
  );

  assert.match(orbitSource, /formatCompactProviderBadgeName\(\s*pc\.provider\.firstName/);
  assert.doesNotMatch(orbitSource, /formatProviderDisplayName/);
  assert.match(orbitSource, /formatBadgeRole\(pc\.role\)/);
  assert.match(orbitSource, /onOpenNotes\(pc\.provider\.id\)/);
  assert.match(orbitSource, /onOpenEntryForm\(/);
});

test("provider formatting does not alter persisted user-authored note text", () => {
  const createEntrySource = fs.readFileSync(
    path.join(__dirname, "../../actions/createEntry.ts"),
    "utf8"
  );
  const updateEntrySource = fs.readFileSync(
    path.join(__dirname, "../../actions/updateOwnEntry.ts"),
    "utf8"
  );

  assert.match(createEntrySource, /note: parsed\.data\.note \|\| null/);
  assert.match(updateEntrySource, /note: parsed\.data\.note \|\| null/);
});

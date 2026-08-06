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
      target: ts.ScriptTarget.ES2021,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  annotateDeterministicInsight,
  shouldAttemptSynthesis,
} = require("../insightAnswerContract.ts");

test("a directly covered Team Focus answer is high-confidence and deterministic", () => {
  const result = annotateDeterministicInsight(
    { headline: "Current Team Focus", summary: "Use the visual schedule." },
    "What is the current Team Focus?",
    "overview"
  );

  assert.equal(result.answerMode, "deterministic");
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.limitations, []);
  assert.equal(
    shouldAttemptSynthesis(
      "What is the current Team Focus?",
      "overview",
      result
    ),
    false
  );
});

test("an interpretive cross-record question is eligible for guarded synthesis", () => {
  const question =
    "What patterns appear across providers, and how might they relate?";
  const result = annotateDeterministicInsight(
    { summary: "Three providers contributed across eight sessions." },
    question,
    "providers"
  );

  assert.equal(result.confidence, "high");
  assert.equal(shouldAttemptSynthesis(question, "providers", result), true);
});

test("an unsupported no-data answer is labeled insufficient and is not synthesized", () => {
  const question = "Tell me whether the weather caused this.";
  const result = annotateDeterministicInsight(
    { summary: "No matching client data was found." },
    question,
    "overview"
  );

  assert.equal(result.answerMode, "insufficient");
  assert.equal(result.confidence, "low");
  assert.equal(shouldAttemptSynthesis(question, "overview", result), false);
});

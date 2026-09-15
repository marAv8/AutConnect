/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
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

const {
  restrictedQuestionAnswer,
  synthesizedAnswerIsGuarded,
} = require("../insightQuestionGuard.ts");

test("provider-linked performance questions remain in scope", () => {
  assert.equal(
    restrictedQuestionAnswer(
      "How did the behavior therapist perform with this client according to the recorded data?"
    ),
    null
  );
});

test("treatment and personnel decisions receive a bounded deterministic answer", () => {
  for (const question of [
    "What treatment should the provider use next?",
    "Rank the providers from best to worst.",
    "Should this provider be disciplined?",
  ]) {
    const answer = restrictedQuestionAnswer(question);
    assert.ok(answer);
    assert.equal(answer.answerMode, "insufficient");
    assert.deepEqual(answer.evidence, []);
  }
});

test("post-generation guard rejects prescriptions, causation, and invented outcomes", () => {
  const deterministic = { summary: "Three provider-linked records were found." };
  for (const summary of [
    "The provider should change the intervention.",
    "The behavior technician caused the decrease.",
    "The client mastered the goal.",
  ]) {
    assert.equal(
      synthesizedAnswerIsGuarded({ summary }, deterministic),
      false
    );
  }
  assert.equal(
    synthesizedAnswerIsGuarded(
      { summary: "The provider documented lower durations across three records." },
      deterministic
    ),
    true
  );
});

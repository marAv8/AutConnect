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

const { synthesizeInsight } = require("../insightSynthesis.ts");

function context() {
  return {
    client: {
      id: "client-secret-id",
      firstName: "MaYe",
      lastName: "Private",
      dateOfBirth: "2015-01-01T00:00:00.000Z",
      diagnosis: "Private diagnosis",
    },
    careTeam: [
      {
        providerId: "provider-secret-id",
        providerName: "Erin Arr",
        accountRole: "Supervisor",
        assignmentRole: "Supervisor",
      },
    ],
    currentTeamFocus: {
      id: "focus-secret-id",
      title: "Help MaYe Private transition",
      content: "Erin Arr will introduce the visual schedule.",
      updatedAt: "2026-07-30T14:00:00.000Z",
      authorName: "Erin Arr",
      authorRole: "Supervisor",
    },
    sessions: [],
    documentationRecords: [],
    caseSupport: { requests: [], cases: [] },
  };
}

test("synthesis is opt-in and does not call the network when disabled", async () => {
  const previousEnabled = process.env.INSIGHTS_AI_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.INSIGHTS_AI_ENABLED;
  delete process.env.OPENAI_API_KEY;

  let called = false;
  const result = await synthesizeInsight(
    {
      question: "What patterns appear?",
      category: "overview",
      context: context(),
      deterministic: { summary: "A structured summary." },
      viewerProviderId: "provider-secret-id",
    },
    async () => {
      called = true;
      throw new Error("should not run");
    }
  );

  assert.equal(result, null);
  assert.equal(called, false);
  process.env.INSIGHTS_AI_ENABLED = previousEnabled;
  process.env.OPENAI_API_KEY = previousKey;
});

test("enabled synthesis sends de-identified evidence and accepts only cited sources", async () => {
  const previousEnabled = process.env.INSIGHTS_AI_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.INSIGHTS_AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-key";

  let requestBody = "";
  const result = await synthesizeInsight(
    {
      question: "How do Erin Arr's notes relate to MaYe Private's focus?",
      category: "overview",
      context: context(),
      deterministic: {
        headline: "Overview",
        summary: "Erin Arr documented MaYe Private's current focus.",
      },
      viewerProviderId: "provider-secret-id",
    },
    async (_url, init) => {
      requestBody = String(init.body);
      return new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    headline: "Current pattern",
                    summary: "The focus and recent record align.",
                    confidence: "high",
                    limitations: [],
                    sourceIds: ["S1", "NOT_ALLOWED"],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 }
      );
    }
  );

  assert.ok(result);
  assert.equal(result.answerMode, "synthesized");
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].sourceId, "S1");
  assert.doesNotMatch(requestBody, /MaYe|Private|Erin Arr/);
  assert.doesNotMatch(
    requestBody,
    /client-secret-id|provider-secret-id|focus-secret-id|2015-01-01|Private diagnosis/
  );
  assert.match(requestBody, /the client/);
  assert.match(requestBody, /BCBA 1/);

  process.env.INSIGHTS_AI_ENABLED = previousEnabled;
  process.env.OPENAI_API_KEY = previousKey;
});

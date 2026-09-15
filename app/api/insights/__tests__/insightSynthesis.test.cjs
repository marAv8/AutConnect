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

test("production synthesis fails closed without transmitting records", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousEnabled = process.env.INSIGHTS_AI_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.NODE_ENV = "production";
  process.env.INSIGHTS_AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "fictional-test-key";

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
      throw new Error("production must not transmit records");
    }
  );

  assert.equal(result, null);
  assert.equal(called, false);
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousEnabled === undefined) delete process.env.INSIGHTS_AI_ENABLED;
  else process.env.INSIGHTS_AI_ENABLED = previousEnabled;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
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
                    summary: "BCBA 1 documented the aligned focus and recent record.",
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
  assert.match(result.summary, /Erin Arr/);
  assert.doesNotMatch(result.summary, /BCBA 1/);
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

test("unsafe or uncited synthesis falls back instead of reaching the UI", async () => {
  const previousEnabled = process.env.INSIGHTS_AI_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.INSIGHTS_AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-key";

  for (const payload of [
    {
      headline: "Provider conclusion",
      summary: "The provider caused the decrease.",
      confidence: "high",
      limitations: [],
      sourceIds: ["S1"],
    },
    {
      headline: "Uncited conclusion",
      summary: "A pattern was found.",
      confidence: "high",
      limitations: [],
      sourceIds: [],
    },
  ]) {
    const result = await synthesizeInsight(
      {
        question: "What pattern is documented?",
        category: "overview",
        context: context(),
        deterministic: { summary: "A structured summary." },
        viewerProviderId: "provider-secret-id",
      },
      async () =>
        new Response(
          JSON.stringify({
            output: [
              {
                content: [
                  { type: "output_text", text: JSON.stringify(payload) },
                ],
              },
            ],
          }),
          { status: 200 }
        )
    );
    assert.equal(result, null);
  }

  process.env.INSIGHTS_AI_ENABLED = previousEnabled;
  process.env.OPENAI_API_KEY = previousKey;
});

test("synthesized Field Observation evidence returns the dated record ID without sending it externally", async () => {
  const previousEnabled = process.env.INSIGHTS_AI_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.INSIGHTS_AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-key";

  const fieldContext = context();
  fieldContext.fieldObservations = [
    {
      id: "field-observation-secret-id",
      observedAt: "2026-08-10T17:00:00.000Z",
      setting: "SCHOOL",
      durationMinutes: 45,
      observedProvider: {
        id: "educator-secret-id",
        name: "Casey Secret",
        role: "Educator",
      },
      supervisor: { name: "Erin Arr" },
      rubricVersion: "1.0",
      fidelityPercent: 75,
      applicableItemCount: 8,
      items: [
        {
          criterionKey: "prompting_and_independence",
          criterionLabel: "Prompting and independence",
          rating: "PARTIALLY_IMPLEMENTED",
          displayOrder: 3,
          note: "Fade verbal prompts.",
        },
      ],
      strengths: "Prepared materials.",
      coachingFocus: "Fade verbal prompts.",
      followUp: null,
    },
  ];

  let requestBody = "";
  const result = await synthesizeInsight(
    {
      question: "What patterns appear in Field Observations?",
      category: "overview",
      context: fieldContext,
      deterministic: { summary: "A structured Field Observation summary." },
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
                    headline: "Observed pattern",
                    summary: "The documented pattern requires supervisor review.",
                    confidence: "medium",
                    limitations: ["One observation is available."],
                    sourceIds: ["S2"],
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
  assert.equal(result.evidence[0].sourceId, "field-observation-secret-id");
  assert.equal(result.evidence[0].date, "2026-08-10T17:00:00.000Z");
  assert.doesNotMatch(requestBody, /field-observation-secret-id/);

  process.env.INSIGHTS_AI_ENABLED = previousEnabled;
  process.env.OPENAI_API_KEY = previousKey;
});

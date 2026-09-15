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

const { interpretClientSignalEvidence } = require("../clientSignalSemantics.ts");

test("production client-signal semantics fail closed without transmitting records", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousEnabled = process.env.CLIENT_SIGNAL_AI_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.NODE_ENV = "production";
  process.env.CLIENT_SIGNAL_AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "fictional-test-key";

  let called = false;
  const result = await interpretClientSignalEvidence(
    {
      viewerProviderId: "provider-a",
      entries: [
        {
          id: "fictional-entry-a",
          providerId: "provider-a",
          providerRole: "BehaviorTherapist",
          date: "2026-08-21T00:00:00.000Z",
          note: "Fictional sensitive note",
          items: [],
          abcObservations: [],
        },
      ],
    },
    async () => {
      called = true;
      throw new Error("production must not transmit records");
    },
  );

  assert.deepEqual(result, []);
  assert.equal(called, false);
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousEnabled === undefined) delete process.env.CLIENT_SIGNAL_AI_ENABLED;
  else process.env.CLIENT_SIGNAL_AI_ENABLED = previousEnabled;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});

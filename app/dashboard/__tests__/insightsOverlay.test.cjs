/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

const overlaySource = source("../InsightsOverlay.tsx");
const hookSource = source("../useInsights.ts");
const dashboardSource = source("../SupervisorDashboard.tsx");
const presentationSource = source("../findingPresentation.ts");
const snapshotSource = source("../../api/insights/insightSnapshot.ts");
const lensesSource = source("../../libs/insights/lenses.ts");
const globalStyles = source("../../globals.css");

function loadPresentationHelper() {
  const compiled = ts.transpileModule(presentationSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: loadedModule.exports,
    module: loadedModule,
  });
  return loadedModule.exports;
}

test("the live hook loads the typed snapshot with one read request", () => {
  assert.match(hookSource, /const loadSnapshot = useCallback/);
  assert.match(hookSource, /\/api\/insights\?clientId=/);
  assert.match(hookSource, /method: "GET"/);
  assert.match(hookSource, /readInsightsResponse<InsightSnapshot/);
  assert.equal((overlaySource.match(/loadSnapshot\(\)/g) ?? []).length, 1);
  assert.match(overlaySource, /\[isOpen, loadSnapshot\]/);
});

test("the live hook handles empty or non-JSON API responses without exposing a JSON parser error", () => {
  assert.match(hookSource, /async function readInsightsResponse/);
  assert.match(hookSource, /await response\.text\(\)/);
  assert.match(hookSource, /JSON\.parse\(responseText\)/);
  assert.match(hookSource, /if \(!responseText\.trim\(\)\)/);
  assert.doesNotMatch(hookSource, /await res\.json\(\)/);
  assert.match(hookSource, /Insights could not complete the request/);
});

test("the overlay renders the five fixed lens definitions", () => {
  for (const lens of [
    "observations",
    "patterns",
    "context",
    "confidence",
    "significance",
  ]) {
    assert.match(lensesSource, new RegExp(`"${lens}"`));
  }
  assert.match(overlaySource, /INSIGHT_LENSES\.map/);
  assert.match(overlaySource, /INSIGHT_LENS_LABELS\[lens\]/);
  assert.match(overlaySource, /useState<InsightLens>\("observations"\)/);
  assert.doesNotMatch(overlaySource, /INSIGHT_CATEGORY_DEFINITIONS/);
  assert.doesNotMatch(overlaySource, /hasCaseSupportAccess/);
  assert.doesNotMatch(dashboardSource, /hasCaseSupportAccess=\{activeClient/);
});

test("the guarded contextual question implementation is preserved behind a disabled UI flag", () => {
  assert.match(
    overlaySource,
    /const CONTEXTUAL_QUESTIONS_ENABLED\s*=\s*process\.env\.NEXT_PUBLIC_INSIGHTS_CONTEXTUAL_QUESTIONS === "true"/
  );
  assert.match(
    overlaySource,
    /CONTEXTUAL_QUESTIONS_ENABLED && !isLoading && !error && snapshot/
  );
  assert.match(overlaySource, /<form/);
  assert.match(overlaySource, /onSubmit=\{submitQuestion\}/);
  assert.match(overlaySource, /ask\(submittedQuestion, selectedLens\)/);
  assert.match(overlaySource, /maxLength=\{500\}/);
  assert.match(overlaySource, /Answers are limited to authorized records and available sources\./);
  assert.match(hookSource, /JSON\.stringify\(\{ clientId, question, lens \}\)/);
  assert.doesNotMatch(overlaySource, /Next Steps/i);
});

test("every rendered finding uses a collapsed native View Sources disclosure", () => {
  assert.match(overlaySource, /function FindingCard/);
  assert.match(overlaySource, /<details style=/);
  assert.doesNotMatch(overlaySource, /<details[^>]*\sopen(?:=|\s|>)/);
  assert.match(overlaySource, /<summary[\s\S]*View Sources[\s\S]*<\/summary>/);
  assert.match(overlaySource, /finding\.sources\.map/);
  assert.match(
    overlaySource,
    /finding\.supportingRecordCount > finding\.sources\.length/
  );
  assert.match(overlaySource, /Showing \{finding\.sources\.length\} of \{finding\.supportingRecordCount\}/);
  assert.doesNotMatch(overlaySource, /source\.recordId/);
});

test("finding titles use deterministic concise presentation rules", () => {
  const { conciseFindingTitle } = loadPresentationHelper();

  assert.equal(conciseFindingTitle("Recorded pattern for Tacting"), "Tacting");
  assert.equal(conciseFindingTitle("Recorded pattern for Manding"), "Manding");
  assert.equal(
    conciseFindingTitle("Recorded pattern for Transitions"),
    "Transitions"
  );
  assert.equal(
    conciseFindingTitle("Recent Field Observation"),
    "Field Observation"
  );
  assert.equal(
    conciseFindingTitle("Recent completed documentation"),
    "Completed Documentation"
  );
  assert.equal(
    conciseFindingTitle("Accessible Case Support documentation"),
    "Case Support Documentation"
  );
  assert.equal(conciseFindingTitle("Current Team Focus"), "Current Team Focus");
  assert.equal(
    conciseFindingTitle("Differing recorded trends for Manding"),
    "Manding — Differing Trends"
  );

  assert.match(presentationSource, /function conciseFindingTitle/);
  assert.match(presentationSource, /\^Recorded pattern for\\s\+\(\.\+\)\$\/i/);
  assert.match(presentationSource, /\^Recent\\s\+\(\.\+\)\$\/i/);
  assert.match(presentationSource, /\^Accessible\\s\+\(\.\+\)\$\/i/);
  assert.match(presentationSource, /"completed documentation": "Completed Documentation"/);
  assert.match(presentationSource, /"field observation": "Field Observation"/);
  assert.match(presentationSource, /"case support documentation": "Case Support Documentation"/);
  assert.match(overlaySource, /const displayTitle = conciseFindingTitle\(finding\.title\)/);
  assert.doesNotMatch(overlaySource, />\s*\{finding\.title\}\s*<\/h3>/);
  assert.match(snapshotSource, /title: "Current Team Focus"/);
});

test("finding metadata is available only through an accessible information disclosure", () => {
  assert.match(overlaySource, /function FindingMetadataDisclosure/);
  assert.match(overlaySource, /aria-label="About this finding"/);
  assert.match(overlaySource, /aria-expanded=\{isExpanded\}/);
  assert.match(overlaySource, /aria-controls=\{disclosureId\}/);
  assert.match(overlaySource, /<Info aria-hidden="true"/);
  assert.match(overlaySource, /event\.key !== "Escape"/);
  assert.match(overlaySource, /evidenceStrengthLabel\(finding\)/);
  assert.match(overlaySource, /classificationLabel\(finding\)/);
  assert.equal((overlaySource.match(/evidenceStrengthLabel\(finding\)/g) ?? []).length, 1);
  assert.equal((overlaySource.match(/classificationLabel\(finding\)/g) ?? []).length, 1);
});

test("substantive statements and confidence limitations stay visible on finding cards", () => {
  assert.match(overlaySource, /\{finding\.statement\}/);
  assert.match(overlaySource, /finding\.limitations\.length/);
  assert.match(overlaySource, /finding\.limitations\.map/);
  assert.doesNotMatch(
    overlaySource,
    /<FindingMetadataDisclosure[^>]*(statement|limitations)=/
  );
});

test("distinct findings with a shared snapshot ID receive collision-safe React keys", () => {
  assert.match(
    overlaySource,
    /function findingRenderKey\(finding: InsightFinding, position: number\)/
  );
  assert.match(
    overlaySource,
    /return `\$\{finding\.id\}:\$\{finding\.title\}:\$\{position\}`/
  );
  assert.equal(
    (overlaySource.match(/key=\{findingRenderKey\(finding, position\)\}/g) ?? [])
      .length,
    3
  );
  assert.doesNotMatch(overlaySource, /key=\{finding\.id\}/);
});

test("lens switching is local and does not invoke another request", () => {
  assert.match(overlaySource, /onClick=\{\(\) => setSelectedLens\(lens\)\}/);
  assert.match(overlaySource, /snapshot\?\.lenses\[selectedLens\]\.findings/);
  assert.equal((overlaySource.match(/loadSnapshot\(\)/g) ?? []).length, 1);
});

test("Patterns are organized into collapsed contributor sections", () => {
  assert.match(overlaySource, /function PatternFindingGroups/);
  assert.match(overlaySource, /selectedLens === "patterns"/);
  assert.match(overlaySource, /finding\.contributor/);
  assert.match(overlaySource, /Caretaker Context/);
  assert.match(overlaySource, /supported pattern/);
  assert.doesNotMatch(
    overlaySource,
    /<details[^>]*\sopen(?:=|\s|>)[\s\S]*supported pattern/
  );
  assert.match(snapshotSource, /lens === "patterns"[\s\S]*findingsByLens\[lens\]/);
  assert.doesNotMatch(snapshotSource, /for \(const seriesGroup of grouped\) \{\s*if \(findings\.length >= MAX_FINDINGS_PER_LENS\) break;/);
});

test("Significance uses its lens-specific empty state", () => {
  assert.match(
    overlaySource,
    /selectedLens === "significance"[\s\S]*The current records support the patterns shown, but not an additional significance finding\./
  );
  assert.match(
    overlaySource,
    /No supported findings are available for this lens from the current records\./
  );
});

test("the complete Insights panel scrolls vertically on desktop and mobile", () => {
  assert.match(
    globalStyles,
    /\.insights-overlay-panel[\s\S]*overflow-y: auto !important;[\s\S]*touch-action: pan-y;/
  );
  assert.match(
    globalStyles,
    /\.insights-answer-viewport[\s\S]*overflow: visible;/
  );
});

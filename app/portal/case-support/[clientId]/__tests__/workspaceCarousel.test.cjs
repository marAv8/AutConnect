/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const pageSource = fs.readFileSync(path.join(__dirname, "../page.tsx"), "utf8");
const carouselSource = fs.readFileSync(
  path.join(__dirname, "../CaseSupportWorkspaceCarousel.tsx"),
  "utf8"
);
const carouselStyles = fs.readFileSync(
  path.join(__dirname, "../CaseSupportWorkspaceCarousel.module.css"),
  "utf8"
);
const providerCarouselSource = fs.readFileSync(
  path.join(__dirname, "../ProviderCaseSupportCarousel.tsx"),
  "utf8"
);
const resolutionControlSource = fs.readFileSync(
  path.join(__dirname, "../ResolutionConfidenceControl.tsx"),
  "utf8"
);
const globalStyles = fs.readFileSync(
  path.join(__dirname, "../../../../globals.css"),
  "utf8"
);
const actionSource = fs.readFileSync(
  path.join(__dirname, "../../../../actions/manageCaseSupport.ts"),
  "utf8"
);
const inboxSource = fs.readFileSync(
  path.join(__dirname, "../../requests/page.tsx"),
  "utf8"
);

test("the supervisor active workspace is a five-card local-state carousel", () => {
  assert.match(carouselSource, /const WORKSPACE_CARD_COUNT = 5/);
  assert.match(carouselSource, /activeCard \+ 1} of \{WORKSPACE_CARD_COUNT/);
  assert.match(carouselSource, /hidden=\{index !== activeCard\}/);
  assert.doesNotMatch(carouselSource, /useRouter|history\.(push|replace)/);

  for (const title of [
    "Case Overview",
    "Add Update",
    "Case Access",
    "Resolve Case",
    "Resolved Cases",
  ]) {
    assert.match(pageSource, new RegExp(title));
  }
  assert.doesNotMatch(pageSource, /Documentation History/);
  assert.doesNotMatch(pageSource, />\s*Agency Coordination\s*</);
});

test("the carousel remains bounded without horizontal card overflow", () => {
  assert.match(carouselStyles, /width: min\(100%, 860px\)/);
  assert.match(carouselStyles, /min-width: 0/);
  assert.match(carouselStyles, /overflow-wrap: anywhere/);
  assert.match(carouselStyles, /\.cardSlot\[hidden\][\s\S]*display: none/);
  assert.match(carouselStyles, /@media \(max-width: 620px\)/);
});

test("supervisor intake is absent while the dedicated Inbox remains intact", () => {
  assert.doesNotMatch(pageSource, /SupervisorRequestGroups|pendingSupervisorRequests/);
  assert.match(inboxSource, /caseSupportRequest\.findMany/);
  assert.match(inboxSource, /recipientSupervisorId: session\.providerId/);
});

test("all established documentation fields remain in the workspace", () => {
  for (const name of [
    "occurredAt",
    "requestSource",
    "requestedBy",
    "coverageStatus",
    "durationMinutes",
    "scheduleImpacts",
    "whatOccurred",
    "supportProvided",
    "observableOutcome",
    "communication",
    "followUp",
  ]) {
    assert.match(pageSource, new RegExp(`name="${name}"`));
  }
});

test("the supervisor Add Update form exposes only the six approved fields", () => {
  const formStart = pageSource.indexOf(
    "if (isSupervisor || simplifiedProvider) {"
  );
  const legacyFormStart = pageSource.indexOf("\n  return (", formStart + 20);
  const supervisorForm = pageSource.slice(formStart, legacyFormStart);

  for (const name of [
    "occurredAt",
    "requestSource",
    "durationMinutes",
    "whatOccurred",
    "supportProvided",
    "observableOutcome",
  ]) {
    assert.match(supervisorForm, new RegExp(`name="${name}"`));
  }
  for (const removedName of [
    "requestedBy",
    "coverageStatus",
    "scheduleImpacts",
    "communication",
    "followUp",
  ]) {
    assert.doesNotMatch(supervisorForm, new RegExp(`name="${removedName}"`));
  }
  assert.match(supervisorForm, />Add Update</);
  assert.match(supervisorForm, /submitLabel="Save Update"/);
  assert.doesNotMatch(
    supervisorForm,
    /Immediate safety need|Other|Unclear|Assigned client coverage/
  );
});

test("provider active Case Support uses one or two local-state cards by permission", () => {
  assert.match(providerCarouselSource, /const cards = Children\.toArray\(children\)/);
  assert.match(providerCarouselSource, /activeCard \+ 1} of \{cards\.length\}/);
  assert.match(providerCarouselSource, /hidden=\{index !== activeCard\}/);
  assert.match(pageSource, /const canAddUpdates = canContribute && supportCase\?\.status === "OPEN"/);
  assert.match(
    pageSource,
    /<ProviderCaseSupportCarousel[\s\S]*<h2 className="case-support-section-title">Case Overview<\/h2>/
  );
  assert.match(pageSource, /\{canAddUpdates \? \([\s\S]*simplifiedProvider/);
  assert.doesNotMatch(providerCarouselSource, /WORKSPACE_CARD_COUNT|historyOnly/);

  const providerStart = pageSource.indexOf(
    "<ProviderCaseSupportCarousel initialCard={initialProviderCard}>"
  );
  const providerEnd = pageSource.indexOf(
    "</ProviderCaseSupportCarousel>",
    providerStart
  );
  const providerWorkspace = pageSource.slice(providerStart, providerEnd);
  for (const supervisorOnlyLabel of [
    "Case Access",
    "Resolve Case",
    "Resolved Cases",
    "Documentation timeline",
    "Agency coordination",
    "Manage access",
  ]) {
    assert.doesNotMatch(providerWorkspace, new RegExp(supervisorOnlyLabel));
  }
});

test("the provider card uses the approved simplified six-field update", () => {
  const formStart = pageSource.indexOf(
    "if (isSupervisor || simplifiedProvider) {"
  );
  const legacyFormStart = pageSource.indexOf("\n  return (", formStart + 20);
  const simplifiedForm = pageSource.slice(formStart, legacyFormStart);

  for (const name of [
    "occurredAt",
    "requestSource",
    "durationMinutes",
    "whatOccurred",
    "supportProvided",
    "observableOutcome",
  ]) {
    assert.match(simplifiedForm, new RegExp(`name="${name}"`));
  }
  for (const removedName of [
    "requestedBy",
    "coverageStatus",
    "scheduleImpacts",
    "communication",
    "followUp",
  ]) {
    assert.doesNotMatch(simplifiedForm, new RegExp(`name="${removedName}"`));
  }
  assert.match(simplifiedForm, /label=\{isSupervisor \? "Source" : "Initiated by"\}/);
  assert.match(simplifiedForm, /"Provider"/);
  assert.match(simplifiedForm, /"Classroom staff"/);
  assert.match(simplifiedForm, /"School administrator"/);
  assert.match(simplifiedForm, /"Agency supervisor"/);
  assert.doesNotMatch(simplifiedForm, /Provider noticed a need|Immediate safety need/);
});

test("provider overview contains chronological activity and read-only resolution context", () => {
  assert.match(
    pageSource,
    /openSupportCase \?\? supportCases\.find\(\(\{ status \}\) => status !== "OPEN"\)/
  );
  assert.match(pageSource, /kind: "REQUEST" as const/);
  assert.match(pageSource, /kind: "UPDATE" as const/);
  assert.match(pageSource, /kind: "COORDINATION" as const/);
  assert.match(pageSource, /kind: "RESOLUTION" as const/);
  assert.match(
    pageSource,
    /first\.occurredAt\.getTime\(\) - second\.occurredAt\.getTime\(\)/
  );
  assert.match(pageSource, /open=\{query\.saved === "1"\}/);
  assert.match(pageSource, /providerResolutionConfidence/);
  assert.match(pageSource, /providerResolutionSummary/);
  assert.match(
    pageSource,
    /<ProviderCaseSupportCarousel[\s\S]*activityLabel="UPDATE"[\s\S]*hideLegacyCompatibilityFacts/
  );
  assert.match(pageSource, /No updates yet\./);
});

test("provider simplified saves retain open-case contributor enforcement", () => {
  const start = actionSource.indexOf(
    "export async function createCaseSupportEntry"
  );
  const end = actionSource.indexOf(
    "export async function createCaseSupportCoordination",
    start
  );
  const createEntryAction = actionSource.slice(start, end);

  assert.match(createEntryAction, /status: "OPEN"/);
  assert.match(createEntryAction, /accessLevel: "CONTRIBUTOR"/);
  assert.match(createEntryAction, /revokedAt: null/);
  assert.match(createEntryAction, /formData\.get\("documentationMode"\) === "SIMPLIFIED"/);
  assert.match(createEntryAction, /usesSimplifiedDocumentation/);
  assert.match(createEntryAction, /redirect\(`\/portal\/case-support\/\$\{identity\.data\.clientId\}\?saved=1`\)/);
});

test("simplified updates persist compatibility defaults without changing legacy parsing", () => {
  assert.match(actionSource, /coverageStatus: "UNCLEAR" as const/);
  assert.match(actionSource, /scheduleImpacts: \[\] as string\[\]/);
  assert.match(actionSource, /requestedBy: undefined/);
  assert.match(actionSource, /communication: undefined/);
  assert.match(actionSource, /followUp: undefined/);
  assert.match(actionSource, /documentationMode: "SIMPLIFIED"/);
  assert.match(pageSource, /hideLegacyCompatibilityFacts/);
  assert.match(pageSource, /Assigned client coverage/);
  assert.match(pageSource, /Schedule impact/);
});

test("resolution confidence is required and preserved in the resolution audit event", () => {
  assert.match(
    actionSource,
    /resolutionConfidence: z\.enum\(\["CONFIDENT", "UNSURE"\]\)/
  );
  assert.match(
    actionSource,
    /resolutionConfidence: parsed\.data\.resolutionConfidence/
  );
  assert.match(resolutionControlSource, /value="CONFIDENT"/);
  assert.match(resolutionControlSource, /value="UNSURE"/);
  assert.match(resolutionControlSource, /required/);
  assert.match(
    resolutionControlSource,
    /confidence === "UNSURE"[\s\S]*Note any remaining uncertainty/
  );
  assert.doesNotMatch(actionSource, /resolutionConfidence === "UNSURE"/);
});

test("resolution confidence stays a restrained two-column measure on standard mobile", () => {
  assert.match(
    globalStyles,
    /\.case-support-resolution-confidence > legend[\s\S]*font-weight: 500/
  );
  assert.match(
    globalStyles,
    /\.case-support-resolution-options \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(
    globalStyles,
    /\.case-support-resolution-options \{[\s\S]*margin-top: 16px/
  );
  assert.match(
    globalStyles,
    /\.case-support-resolution-options > label:has\(input:checked\)/
  );
  assert.match(
    globalStyles,
    /@media \(max-width: 340px\)[\s\S]*\.case-support-resolution-options[\s\S]*grid-template-columns: minmax\(0, 1fr\)/
  );
  assert.doesNotMatch(
    globalStyles,
    /@media \(max-width: 620px\)[\s\S]{0,200}\.case-support-resolution-options/
  );
});

test("server redirects reopen the requested five-card destination", () => {
  assert.match(pageSource, /query\.resolved === "1"[\s\S]*\? 4/);
  assert.match(
    pageSource,
    /query\.saved === "1" \|\| query\.reviewed === "1"[\s\S]*\? 0/
  );
  assert.match(pageSource, /query\.accessUpdated === "1"[\s\S]*\? 2/);
  assert.match(
    pageSource,
    /query\.compose === "1" \|\| Boolean\(clarificationTarget\)[\s\S]*\? 1/
  );
});

test("resolved history is Card 5 and renders directly without an active case", () => {
  assert.match(
    pageSource,
    /\{resolvedCasesCard\}[\s\S]*<\/CaseSupportWorkspaceCarousel>/
  );
  assert.equal(
    (
      pageSource.match(
        /<h2 className="case-support-section-title">Resolved Cases<\/h2>/g
      ) ?? []
    ).length,
    1
  );
  assert.match(pageSource, /No resolved cases yet\./);
  assert.match(
    pageSource,
    /!supportCase && isSupervisor && resolvedCases\.length > 0[\s\S]*resolvedCasesCard/
  );
  assert.doesNotMatch(carouselSource, /historyOnly/);
  assert.match(
    carouselSource,
    /disabled=\{activeCard === WORKSPACE_CARD_COUNT - 1\}/
  );
});

test("collapsed resolved cases keep only title, date, and disclosure affordance", () => {
  const summaryStart = pageSource.indexOf(
    '<summary className="case-support-case-group-summary">'
  );
  const summaryEnd = pageSource.indexOf("</summary>", summaryStart);
  const resolvedSummary = pageSource.slice(summaryStart, summaryEnd);

  assert.match(resolvedSummary, /resolvedCase\.title/);
  assert.match(resolvedSummary, /resolvedCase\.resolvedAt \?\? resolvedCase\.updatedAt/);
  assert.doesNotMatch(resolvedSummary, /ARCHIVED|RESOLVED/);
  assert.doesNotMatch(resolvedSummary, /resolvedOwnerName/);
  assert.doesNotMatch(resolvedSummary, /documentation|coordination/);
  assert.match(
    globalStyles,
    /\.case-support-case-group-summary::after[\s\S]*content: "⌄"/
  );
});

test("case access separates provider identity from the semantic checkbox", () => {
  assert.match(pageSource, /className="case-support-provider-access-row"/);
  assert.match(pageSource, /className="case-support-provider-identity"/);
  assert.match(pageSource, /className="case-support-provider-access-control"/);
  assert.match(
    pageSource,
    /className="case-support-provider-access-control"[\s\S]*type="checkbox"[\s\S]*name="providerIds"/
  );
  assert.match(
    globalStyles,
    /\.case-support-provider-access-row[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/
  );
  assert.match(
    globalStyles,
    /\.case-support-provider-access-control:focus-within/
  );
});

test("access and resolution retain their existing server actions", () => {
  assert.match(pageSource, /action=\{updateCaseSupportAccess\}/);
  assert.match(pageSource, /action=\{resolveCaseSupportCase\}/);

  const resolveStart = actionSource.indexOf(
    "export async function resolveCaseSupportCase"
  );
  const resolveEnd = actionSource.indexOf(
    "export async function updateCaseSupportAccess",
    resolveStart
  );
  const resolutionAction = actionSource.slice(resolveStart, resolveEnd);
  assert.match(resolutionAction, /ownerSupervisorId: session\.providerId/);
  assert.match(resolutionAction, /status: "RESOLVED"/);
  assert.match(resolutionAction, /action: "CASE_RESOLVED"/);

  const accessStart = resolveEnd;
  const accessEnd = actionSource.indexOf(
    "export async function markCaseSupportEntryReviewed",
    accessStart
  );
  const accessAction = actionSource.slice(accessStart, accessEnd);
  assert.match(accessAction, /ownerSupervisorId: session\.providerId/);
  assert.match(accessAction, /organization: \{ type: "AGENCY" \}/);
});

test("case activity merges updates and legacy coordination without a coordination form", () => {
  assert.match(pageSource, /const caseActivity = \[/);
  assert.match(pageSource, /kind: "UPDATE" as const/);
  assert.match(pageSource, /kind: "COORDINATION" as const/);
  assert.match(pageSource, /second\.occurredAt\.getTime\(\) - first\.occurredAt\.getTime\(\)/);
  assert.match(pageSource, />Case activity</);
  assert.match(pageSource, /No updates yet\./);
  assert.match(pageSource, /open=\{query\.saved === "1" \|\| query\.reviewed === "1"\}/);
  assert.match(pageSource, /activityLabel="UPDATE"/);
  assert.match(pageSource, /activityLabel="COORDINATION"/);
  assert.match(pageSource, /<CoordinationEntry/);
  assert.doesNotMatch(pageSource, /function CoordinationForm/);
  assert.doesNotMatch(pageSource, /coordinate=internal|coordinate=external/);
  assert.match(actionSource, /export async function createCaseSupportCoordination/);
});

test("resolved cases are newest first and show confidence only when recorded", () => {
  assert.match(
    pageSource,
    /second\.resolvedAt \?\? second\.updatedAt[\s\S]*first\.resolvedAt \?\? first\.updatedAt/
  );
  assert.match(pageSource, /"resolutionConfidence"/);
  assert.match(pageSource, /resolutionConfidence \? \(/);
  assert.match(pageSource, /label="Resolution confidence"/);
});

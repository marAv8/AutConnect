/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../../..");
const helperPath = path.join(root, "app/libs/caseSupportNotifications.ts");
const actionsPath = path.join(root, "app/actions/manageCaseSupport.ts");
const dashboardPath = path.join(root, "app/dashboard/page.tsx");
const inboxPath = path.join(
  root,
  "app/portal/case-support/requests/page.tsx"
);
const schemaPath = path.join(root, "prisma/schema.prisma");

const helperSource = fs.readFileSync(helperPath, "utf8");
const actionsSource = fs.readFileSync(actionsPath, "utf8");
const dashboardSource = fs.readFileSync(dashboardPath, "utf8");
const inboxSource = fs.readFileSync(inboxPath, "utf8");
const schemaSource = fs.readFileSync(schemaPath, "utf8");

function loadHelper() {
  const output = ts.transpileModule(helperSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(output, {
    module: loadedModule,
    exports: loadedModule.exports,
    Set,
    Error,
  });
  return loadedModule.exports;
}

const {
  eligibleCaseSupportNotificationRecipientIds,
  caseSupportNotificationAccessWhere,
  createCaseSupportNotifications,
} = loadHelper();

test("a provider update targets the owner and other active case members", () => {
  assert.deepEqual(
    Array.from(
      eligibleCaseSupportNotificationRecipientIds({
        ownerSupervisorId: "owner",
        activeMemberIds: ["author", "requester", "member"],
        actorId: "author",
      })
    ),
    ["owner", "requester", "member"]
  );
});

test("a supervisor update targets active members and never the supervisor author", () => {
  assert.deepEqual(
    Array.from(
      eligibleCaseSupportNotificationRecipientIds({
        ownerSupervisorId: "owner",
        activeMemberIds: ["provider-a", "provider-b"],
        actorId: "owner",
      })
    ),
    ["provider-a", "provider-b"]
  );
});

test("unrelated agency users and client-only assignees are absent from recipients", () => {
  const recipients = Array.from(
    eligibleCaseSupportNotificationRecipientIds({
      ownerSupervisorId: "owner",
      activeMemberIds: ["explicit-member"],
      actorId: "author",
    })
  );
  assert.equal(recipients.includes("other-agency"), false);
  assert.equal(recipients.includes("client-only-assignee"), false);
});

test("revoked or inactive case members are excluded before recipient selection", () => {
  assert.match(helperSource, /members:\s*\{\s*where:\s*\{ revokedAt: null \}/);
  const accessWhere = caseSupportNotificationAccessWhere("recipient");
  assert.equal(
    accessWhere.case.OR[1].members.some.revokedAt,
    null
  );
});

test("the author never receives a self-notification, including duplicate membership", () => {
  assert.deepEqual(
    Array.from(
      eligibleCaseSupportNotificationRecipientIds({
        ownerSupervisorId: "author",
        activeMemberIds: ["author", "author"],
        actorId: "author",
      })
    ),
    []
  );
});

test("one underlying event creates one row per recipient and is retry-safe", async () => {
  const writes = [];
  const tx = {
    caseSupportCase: {
      findUnique: async () => ({
        ownerSupervisorId: "owner",
        clientId: "client",
        members: [{ providerId: "provider" }, { providerId: "provider" }],
      }),
    },
    providerClient: {
      findMany: async () => [
        { providerId: "owner" },
        { providerId: "provider" },
      ],
    },
    caseSupportNotification: {
      createMany: async (input) => writes.push(input),
    },
  };
  await createCaseSupportNotifications(tx, {
    caseId: "case",
    actorId: "author",
    eventType: "CASE_UPDATE",
    eventKey: "CASE_UPDATE:event",
  });
  assert.deepEqual(
    Array.from(writes[0].data, ({ recipientId }) => recipientId),
    ["owner", "provider"]
  );
  assert.equal(writes[0].skipDuplicates, true);
  assert.match(
    schemaSource,
    /@@unique\(\[recipientId, eventKey\]\)/
  );
});

test("unauthorized users cannot mark a notification read", () => {
  const lookup = actionsSource.slice(
    actionsSource.indexOf("export async function openCaseSupportNotification"),
    actionsSource.indexOf("export async function createCaseSupportCase")
  );
  assert.match(lookup, /caseSupportNotificationAccessWhere\(session\.providerId\)/);
  assert.match(lookup, /if \(!notification\)/);
});

test("opening one notification marks only that recipient row read", () => {
  assert.match(
    actionsSource,
    /id: notification\.id,[\s\S]*recipientId: session\.providerId,[\s\S]*readAt: null/
  );
  assert.match(actionsSource, /data: \{ readAt: new Date\(\) \}/);
});

test("dashboard loading counts unread events but never marks them read", () => {
  assert.match(dashboardSource, /caseSupportNotification\.count/);
  assert.match(dashboardSource, /readAt: null/);
  assert.doesNotMatch(dashboardSource, /caseSupportNotification\.update/);
});

test("the supervisor icon count combines new intake requests and unread events", () => {
  assert.match(
    dashboardSource,
    /request\.status === "REQUESTED"[\s\S]*\.length \+ caseSupportNotificationCount/
  );
});

test("notification content is minimal and opens only through the authorized action", () => {
  assert.match(inboxSource, /clientDisplayCode/);
  assert.match(inboxSource, /notification\.case\.title/);
  assert.match(inboxSource, /formatProviderDisplayName/);
  assert.match(inboxSource, /notification\.createdAt\.toLocaleString/);
  assert.match(inboxSource, /action=\{openCaseSupportNotification\}/);
  assert.doesNotMatch(
    inboxSource.slice(
      inboxSource.indexOf("const notifications"),
      inboxSource.indexOf("const successMessage")
    ),
    /concern|desiredOutcome|whatOccurred|supportProvided/
  );
});

test("case writes and notification writes share the same transactions", () => {
  for (const eventKey of [
    "CASE_OPENED:${request.id}",
    "CASE_RESOLVED:${resolvedEvent.id}",
    "CLARIFICATION:${entry.id}",
    "CASE_UPDATE:${entry.id}",
  ]) {
    assert.equal(actionsSource.includes(eventKey), true);
  }
  assert.match(
    actionsSource,
    /await db\.\$transaction\(async \(tx\) => \{[\s\S]*createCaseSupportNotifications\(tx/
  );
});

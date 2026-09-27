/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = process.cwd();
const originalLoad = Module._load;
const originalTs = Module._extensions['.ts'];
const originalTsx = Module._extensions['.tsx'];
const calls = [];
const now = new Date('2026-09-20T12:00:00Z');
const future = new Date('2026-09-21T12:00:00Z');
const pending = { normalizedEmail: 'recipient@example.test', acceptedAt: null, revokedAt: null, expiresAt: future };
const records = {
  agencyAccessRequest: [
    { status: 'PENDING', reviewedAt: null }, { status: 'APPROVED', reviewedAt: now },
    { status: 'DECLINED', reviewedAt: now }, { status: 'PENDING', reviewedAt: now },
  ],
  organizationInvitation: [pending, { ...pending, normalizedEmail: 'unrelated@example.test' },
    { ...pending, acceptedAt: now }, { ...pending, revokedAt: now }, // revoked/replaced
    { ...pending, expiresAt: now }, { ...pending, expiresAt: new Date(0) }],
  clientAttachRequest: [
    { clientId: 'authorized', status: 'PENDING', decidedAt: null },
    { clientId: 'other', status: 'PENDING', decidedAt: null },
    ...['APPROVED', 'REJECTED', 'CANCELLED'].map(status => ({ clientId: 'authorized', status, decidedAt: now })),
    { clientId: 'authorized', status: 'PENDING', decidedAt: now },
  ],
};
const db = Object.fromEntries(Object.entries(records).map(([model, rows]) => [model, { count: async ({ where }) => {
  calls.push({ model, where });
  return rows.filter(row => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object') {
      if (value.in) return value.in.includes(row[key]);
      if (value.gt) return row[key] > value.gt;
    }
    return row[key] === value;
  })).length;
} }]));
function loader(module, filename) {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }, fileName: filename }).outputText, filename);
}
Module._extensions['.ts'] = loader;
Module._extensions['.tsx'] = loader;
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/db') return { db };
  if (request === '@/lib/organizationInvitations') return { normalizeInvitationEmail: email => email.trim().toLowerCase() };
  if (request === '@/lib/platformAdminPolicy') return { isPlatformAdminEmail: email => email === 'platform@example.test' };
  if (request === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
  if (request === './useDismissibleMenu') return { useDismissibleMenu: () => ({ open: true, closeMenu() {}, toggleMenu() {}, triggerRef: null, menuRef: null }) };
  if (request === './dashboardInteractionTraceClient') return { traceDashboardInteractionHandled() {}, traceDashboardInteractionState() {} };
  return originalLoad(request, parent, isMain);
};
const { getDashboardAttentionCounts } = require(path.join(root, 'app/dashboard/dashboardAttentionCounts.ts'));
const Inbox = require(path.join(root, 'app/dashboard/DashboardInboxControl.tsx')).default;
test.after(() => {
  Module._load = originalLoad;
  Module._extensions['.ts'] = originalTs;
  Module._extensions['.tsx'] = originalTsx;
});
const account = { email: ' Recipient@Example.test ', role: 'Supervisor', status: 'ACTIVE' };
const count = (provider = account, ids = ['authorized'], sessionRole = provider.role) =>
  getDashboardAttentionCounts({ provider, sessionRole, authorizedTeamClientIds: ids, now });

test('recipient and exact manager aggregates exclude unrelated, completed, expired, revoked/replaced and decided records', async () => {
  calls.length = 0;
  assert.deepEqual(await count(), { organizationAccessRequests: null, myOrganizationInvitations: 1, clientParticipationRequests: 1 });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.find(call => call.model === 'clientAttachRequest').where.clientId, { in: ['authorized'] });
});
test('only platform administrators count undecided access requests; organization administrators get no implicit Client authority', async () => {
  assert.deepEqual(await count({ ...account, email: 'platform@example.test' }, []), {
    organizationAccessRequests: 1, myOrganizationInvitations: 0, clientParticipationRequests: null,
  });
  calls.length = 0;
  assert.deepEqual(await count({ ...account, email: 'other@example.test' }, []), {
    organizationAccessRequests: null, myOrganizationInvitations: 0, clientParticipationRequests: null,
  });
  assert.deepEqual(calls.map(call => call.model), ['organizationInvitation']);
});
test('inactive or mismatched sessions never query counts; non-Supervisors never inherit manager authority', async () => {
  for (const [provider, sessionRole] of [[{ ...account, status: 'INACTIVE' }, 'Supervisor'], [account, 'Educator']]) {
    calls.length = 0;
    assert.deepEqual(await count(provider, ['authorized'], sessionRole), { organizationAccessRequests: null, myOrganizationInvitations: 0, clientParticipationRequests: null });
    assert.equal(calls.length, 0);
  }
  assert.equal((await count({ ...account, role: 'Educator' })).clientParticipationRequests, null);
});
const base = { canAccessCaseSupport: true, canReviewOrganizationInvitations: true, caseSupportCount: 0, organizationInvitationCount: 0 };
const empty = { organizationAccessRequests: null, myOrganizationInvitations: 0, clientParticipationRequests: null };
const render = props => renderToStaticMarkup(React.createElement(Inbox, { ...base, ...props }));
test('each positive category independently activates the icon and total accessible name', () => {
  for (const props of [
    { caseSupportCount: 1 }, { organizationInvitationCount: 1 },
    ...Object.keys(empty).map(key => ({ attentionCounts: { ...empty, [key]: 1 } })),
  ]) {
    const html = render(props);
    assert.match(html, /aria-label="Inbox, 1 pending action"/);
    assert.doesNotMatch(html, /dashboard-case-support-icon--quiet/);
    assert.match(html, /dashboard-case-support-badge/);
  }
});
test('separate rows retain category counts and existing review destinations while total is summed once', () => {
  const html = render({ caseSupportCount: 2, organizationInvitationCount: 3,
    attentionCounts: { organizationAccessRequests: 4, myOrganizationInvitations: 5, clientParticipationRequests: 6 } });
  assert.match(html, /aria-label="Inbox, 20 pending actions"/);
  for (const [href, label, value] of [
    ['/portal/case-support/requests', 'Case Support Requests', 2],
    ['/portal/organization/client-invitations', 'Client Organization Invitations', 3],
    ['/platform/agency-requests', 'Organization Access Requests', 4],
    ['/portal/organization/invitations', 'My Organization Invitations', 5],
    ['/portal/supervisor/edit-providers', 'Client Participation Requests', 6],
  ]) assert.match(html, new RegExp(`href="${href}"[^>]*><span>${label}</span><span>${value}</span>`));
});
test('zero counts stay quiet and unauthorized rows and their counts are absent', () => {
  const html = render({ canAccessCaseSupport: false, canReviewOrganizationInvitations: false, caseSupportCount: 99, organizationInvitationCount: 99 });
  assert.match(html, /Inbox, 0 pending actions/);
  assert.match(html, /dashboard-case-support-icon--quiet/);
  assert.doesNotMatch(html, /dashboard-case-support-badge|Case Support Requests|Client Organization Invitations|Organization Access Requests|Client Participation Requests|99/);
  assert.match(html, /My Organization Invitations/);
});
test('both server entry points use freshly authorized scope; direct OWNER/ADMIN Client invitations remain scoped and pending', () => {
  for (const file of ['app/dashboard/page.tsx', 'app/portal/supervisor/create-first-client/page.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /getDashboardAttentionCounts\(\{\s*provider, sessionRole: session.role/);
    assert.match(source, /active: true,\s*role: \{ in: \["OWNER", "ADMIN"\] \}/);
    assert.match(source, /canReviewOrganizationInvitations\s*\? await db.clientOrganization.count/);
    assert.match(source, /organizationId: \{ in: administeredOrganizationIds \},\s*role: "PARTICIPATING",\s*status: "PENDING",\s*revokedAt: null/);
  }
  const source = fs.readFileSync(path.join(root, 'app/dashboard/page.tsx'), 'utf8');
  assert.match(source, /hasActiveClientTeamManagerAuthority\(\s*session.providerId,\s*client.id/);
  assert.match(source, /authorizedTeamClientIds: administrativeCapabilities.careTeamClientIds/);
});
test('Field Observation retains its accessible h1 without a title row', () => {
  const source = fs.readFileSync(path.join(root, 'app/portal/supervisor/field-observation/[clientId]/FieldObservationForm.tsx'), 'utf8');
  assert.match(source, /<h1 className=\{styles.srOnly\}>Field Observation<\/h1>/);
  assert.doesNotMatch(source, /styles.titleRow|styles.title\}/);
});

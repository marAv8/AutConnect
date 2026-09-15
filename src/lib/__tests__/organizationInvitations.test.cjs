/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const source = fs.readFileSync(path.resolve(file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(mod, mod.exports, name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/lib/')) return load(`src/lib/${name.slice(6)}.ts`, mocks);
    if (name.startsWith('@/app/')) return load(`app/${name.slice(6)}.ts`, mocks);
    if (name.startsWith('./')) return load(path.join(path.dirname(file), name + '.ts'), mocks);
    return require(name);
  });
  return mod.exports;
}
const state = load('src/lib/organizationInvitationState.ts');
const mocks = { '@/lib/db': { db: {} }, './organizationInvitationState': state, '@/lib/organizationInvitationState': state };
const library = load('src/lib/organizationInvitations.ts', mocks);
function fixture(overrides = {}) {
  const writes = [];
  const account = { email: 'person@example.test', role: 'BehaviorTherapist', status: 'ACTIVE', ...overrides.account };
  const invitation = { id: 'invitation-test', normalizedEmail: 'person@example.test', organizationId: 'organization-test', providerRole: 'BehaviorTherapist', membershipRole: 'MEMBER', acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 86400000), organization: { name: 'Synthetic Agency' }, ...overrides.invitation };
  let membership = overrides.membership ?? null;
  const tx = {
    provider: { findUnique: async () => account },
    organizationInvitation: {
      findUnique: async () => overrides.missing ? null : invitation,
      updateMany: async () => { if (overrides.lostRace) return { count: 0 }; writes.push('accepted'); invitation.acceptedAt = new Date(); return { count: 1 }; },
    },
    organizationMembership: {
      findUnique: async () => membership,
      upsert: async data => { writes.push('membership'); membership = membership ? { ...membership, ...data.update } : data.create; return membership; },
    },
  };
  return { tx, writes, invitation, get membership() { return membership; } };
}
const input = { token: 'synthetic-token', email: 'PERSON@example.test', providerId: 'synthetic-provider', currentRole: 'BehaviorTherapist' };
for (const [name, overrides, code] of [
  ['unknown token', { missing: true }, 'unavailable'],
  ['wrong recipient', { invitation: { normalizedEmail: 'other@example.test' } }, 'wrong-account'],
  ['role mismatch', { invitation: { providerRole: 'Supervisor' } }, 'role-mismatch'],
  ['inactive account', { account: { status: 'INACTIVE' } }, 'inactive-account'],
  ['expired', { invitation: { expiresAt: new Date(0) } }, 'expired'],
  ['revoked or replaced', { invitation: { revokedAt: new Date() } }, 'revoked'],
  ['accepted without membership', { invitation: { acceptedAt: new Date() } }, 'access-removed'],
  ['accepted with removed membership', { invitation: { acceptedAt: new Date() }, membership: { role: 'OWNER', active: false } }, 'access-removed'],
  ['concurrent decision lost', { lostRace: true }, 'retry'],
]) test(`${name} grants no membership`, async () => {
  const f = fixture(overrides);
  await assert.rejects(library.acceptOrganizationInvitation(f.tx, input), error => error.code === code);
  assert.deepEqual(f.writes, []);
});
test('acceptance normalizes against persisted account and creates one membership, with no Client writes', async () => {
  const f = fixture();
  await library.acceptOrganizationInvitation(f.tx, input);
  assert.deepEqual(f.writes, ['accepted', 'membership']);
  assert.equal(f.membership.role, 'MEMBER');
  assert.equal(f.membership.active, true);
  await library.acceptOrganizationInvitation(f.tx, input);
  assert.deepEqual(f.writes, ['accepted', 'membership']);
});
for (const role of ['OWNER', 'ADMIN']) test(`existing active ${role} is not downgraded`, async () => {
  const f = fixture({ membership: { role, active: true } });
  await library.acceptOrganizationInvitation(f.tx, input);
  assert.equal(f.membership.role, role);
});
test('repeated accepted admin invitation cannot elevate a current member', async () => {
  const f = fixture({ invitation: { acceptedAt: new Date(), membershipRole: 'ADMIN' }, membership: { role: 'MEMBER', active: true } });
  await library.acceptOrganizationInvitation(f.tx, input);
  assert.equal(f.membership.role, 'MEMBER');
  assert.deepEqual(f.writes, []);
});
test('browser supplied email cannot replace the authenticated account email', async () => {
  const f = fixture();
  await assert.rejects(library.acceptOrganizationInvitation(f.tx, { ...input, email: 'other@example.test' }), error => error.code === 'wrong-account');
  assert.deepEqual(f.writes, []);
});
test('inbox requires a full invitation link; email, ID and arbitrary URL are not credentials', () => {
  const token = 'x'.repeat(43);
  assert.equal(state.invitationTokenFromLink(`https://preview.example.test/create-account?invite=${token}`), token);
  for (const value of ['person@example.test', 'invitation-id', token, 'https://example.test/dashboard?invite=' + token, 'javascript:alert(1)']) assert.equal(state.invitationTokenFromLink(value), '');
});
test('every signup error retains the invitation for the existing-account Login link', async () => {
  const token = 'x'.repeat(43);
  for (const error of ['invalid', 'invalid-invite', 'email-exists', 'supervisor-invite-required']) {
    const url = new URL(state.invitationAuthPath('/create-account', token, error), 'https://preview.example.test');
    assert.equal(url.searchParams.get('invite'), token);
    assert.equal(url.searchParams.get('error'), error);
  }
  const redirects = [];
  const actions = load('app/actions/createProvider.ts', {
    ...mocks,
    '@/lib/session': { setSession: async () => { throw Error('must not create session'); } },
    '@/lib/db': { db: { provider: { findFirst: async () => ({ id: 'existing' }) } } },
    '@/lib/organizationInvitations': { ...library, getAvailableOrganizationInvitation: async () => ({ normalizedEmail: 'person@example.test', providerRole: 'BehaviorTherapist' }) },
    'next/navigation': { redirect: url => { redirects.push(url); throw Error('REDIRECT'); } },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ inviteToken: token, email: 'person@example.test', password: 'synthetic-test-only', firstName: 'Synthetic', lastName: 'Person', role: 'BehaviorTherapist' })) form.set(key, value);
  await assert.rejects(actions.createProvider(form), /REDIRECT/);
  const redirected = new URL(redirects[0], 'https://preview.example.test');
  assert.equal(redirected.searchParams.get('error'), 'email-exists');
  assert.equal(redirected.searchParams.get('invite'), token);
});
test('ordinary account cannot create staff invitations without organization administration', async () => {
  const actions = load('app/actions/manageOrganizationInvitations.ts', {
    ...mocks,
    '@/lib/authorization': { requireCurrentProvider: async () => ({ id: 'outsider' }), getManagedOrganizationIds: async () => [] },
    '@/lib/organizationInvitations': library,
    'next/cache': { revalidatePath: () => {} },
  });
  const form = new FormData();
  form.set('organizationId', '11111111-1111-4111-8111-111111111111');
  form.set('email', 'person@example.test'); form.set('providerRole', 'BehaviorTherapist');
  const result = await actions.createOrganizationInvitation({ status: 'idle' }, form);
  assert.equal(result.status, 'error');
  assert.match(result.message, /owners and administrators/);
});
test('inactive former OWNER does not regain owner authority from a new member invitation', async () => {
  const f = fixture({ membership: { role: 'OWNER', active: false } });
  await library.acceptOrganizationInvitation(f.tx, input);
  assert.equal(f.membership.role, 'MEMBER');
});
for (const decision of ['revoke', 'reissue']) test(`unauthorized ${decision} is scoped to managed organizations`, async () => {
  let writes = 0;
  let checkedScope = false;
  const tx = { organizationInvitation: {
    findFirst: async ({ where }) => { assert.deepEqual(where.organizationId.in, []); checkedScope = true; return null; },
    updateMany: async () => { writes++; }, create: async () => { writes++; },
  } };
  const actions = load('app/actions/manageOrganizationInvitations.ts', {
    ...mocks, '@/lib/organizationInvitations': library,
    '@/lib/authorization': { requireCurrentProvider: async () => ({ id: 'outsider' }), getManagedOrganizationIds: async (_id, transaction) => { assert.equal(transaction, tx); return []; } },
    '@/lib/db': { db: { $transaction: async callback => callback(tx) } },
    'next/cache': { revalidatePath: () => {} },
  });
  const form = new FormData(); form.set('invitationId', 'synthetic'); form.set('decision', decision); form.set('replaceConfirmed', 'yes');
  assert.equal((await actions.manageOrganizationInvitation({ status: 'idle' }, form)).status, 'error');
  assert.equal(checkedScope, true); assert.equal(writes, 0);
});
test('ordinary inbox acceptance cannot grant membership using an invitation ID alone', async () => {
  const actions = load('app/actions/manageOrganizationInvitations.ts', {
    ...mocks, '@/lib/organizationInvitations': library,
    '@/lib/authorization': { requireCurrentProvider: async () => ({ id: 'synthetic', role: 'BehaviorTherapist' }) },
    '@/lib/db': { db: { provider: { findUniqueOrThrow: async () => ({ email: 'person@example.test' }) }, $transaction: async () => { throw Error('must not run'); } } },
    'next/cache': { revalidatePath: () => {} },
  });
  const form = new FormData(); form.set('invitationId', 'synthetic'); form.set('decision', 'accept');
  const result = await actions.decideOrganizationInvitation({ status: 'idle' }, form);
  assert.equal(result.status, 'error'); assert.match(result.message, /complete invitation link/);
});
test('revoked history is labeled replaced only by a newer invitation for the same recipient and organization', () => {
  const old = { acceptedAt: null, revokedAt: new Date(100), expiresAt: new Date(1000), createdAt: new Date(1), organizationId: 'agency-a', normalizedEmail: 'person@example.test' };
  const newer = { ...old, revokedAt: null, createdAt: new Date(200) };
  assert.equal(state.invitationHistoryStatus(old, [old, newer]), 'Replaced');
  assert.equal(state.invitationHistoryStatus(old, [old, { ...newer, organizationId: 'agency-b' }]), 'Revoked');
  assert.equal(state.invitationHistoryStatus(old, [old, { ...newer, normalizedEmail: 'other@example.test' }]), 'Revoked');
});
for (const scenario of ['accepted', 'wrong-account', 'normal-login']) test(`password login handles ${scenario} with explicit recovery destination`, async () => {
  let destination; let sessions = 0; let accepted = 0;
  const actions = load('app/actions/loginProvider.ts', {
    ...mocks,
    'bcryptjs': { compare: async () => true },
    '@/lib/db': { db: { provider: { findFirst: async () => ({ id: 'synthetic', email: 'person@example.test', passwordHash: 'fixture', role: 'BehaviorTherapist', status: 'ACTIVE' }) }, $transaction: async callback => callback({}) } },
    '@/lib/session': { setSession: async () => { sessions++; } },
    '@/lib/organizationInvitations': { acceptOrganizationInvitation: async () => { accepted++; if (scenario === 'wrong-account') throw new state.OrganizationInvitationError('wrong-account'); } },
    'next/navigation': { redirect: url => { destination = url; throw Error('REDIRECT'); } },
  });
  const form = new FormData(); form.set('email', 'person@example.test'); form.set('password', 'synthetic-only');
  if (scenario !== 'normal-login') form.set('inviteToken', 'x'.repeat(43));
  await assert.rejects(actions.loginProvider({ error: null }, form), /REDIRECT/);
  assert.equal(sessions, 1);
  assert.equal(accepted, scenario === 'normal-login' ? 0 : 1);
  assert.equal(destination, scenario === 'accepted' ? '/portal/organization/invitations?joined=1' : scenario === 'wrong-account' ? '/portal/organization/invitations?issue=wrong-account' : '/dashboard');
});
test('clipboard writer receives the complete unchanged displayed invitation URL', async () => {
  const displayed = new URL('/create-account?invite=' + 'x'.repeat(43), 'https://synthetic-preview.vercel.app').href;
  let clipboard;
  const feedback = await state.copyInvitationLink(displayed, async value => { clipboard = value; });
  assert.equal(clipboard, displayed);
  assert.equal(new URL(clipboard).pathname, '/create-account');
  assert.equal(new URL(clipboard).searchParams.get('invite').length, 43);
  assert.equal(feedback, 'Link copied.');
});
test('denied clipboard permission reports manual copy instead of success', async () => {
  const feedback = await state.copyInvitationLink('synthetic-link', async () => { throw Error('clipboard unavailable'); });
  assert.match(feedback, /copy it manually/);
  assert.doesNotMatch(feedback, /Link copied/);
});

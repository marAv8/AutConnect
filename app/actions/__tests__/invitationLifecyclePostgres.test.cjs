/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const testUrl = process.env.AUTCONNECT_INVITATION_TEST_DATABASE_URL;
const enabled = !!testUrl;
if (enabled) {
  const target = new URL(testUrl);
  if (target.hostname !== '127.0.0.1' || target.port !== '55549') throw Error('Invitation mutations require the isolated localhost test cluster.');
}
const db = enabled ? new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] }) : null;
let actor;
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', output)(mod, mod.exports, name => {
    if (name === '@/lib/db') return { db };
    if (name === '@/lib/session') return { getSession: async () => actor ? { providerId: actor.id, role: actor.role } : null };
    if (name === 'next/cache') return { revalidatePath: () => {} };
    if (name.startsWith('@/') || name.startsWith('.')) {
      const bases = name.startsWith('@/') ? [path.resolve(name.slice(2)), path.resolve('src', name.slice(2))] : [path.resolve(path.dirname(file), name)];
      for (const base of bases) if (fs.existsSync(base + '.ts')) return load(base + '.ts');
    }
    return require(name);
  });
  return mod.exports;
}
const form = values => { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; };
test('isolated PostgreSQL: copied-link lifecycle, recipient correction and membership boundaries', { skip: !enabled }, async t => {
  const actions = load('app/actions/manageOrganizationInvitations.ts');
  const library = load('src/lib/organizationInvitations.ts');
  const suffix = require('node:crypto').randomUUID();
  const org = await db.organization.create({ data: { name: 'Synthetic Invitation Test', normalizedName: 'synthetic-' + suffix, type: 'AGENCY' } });
  const makePerson = (email, role) => db.provider.create({ data: { email, firstName: 'Synthetic', lastName: suffix, role, providerRole: role } });
  const owner = await makePerson(`owner-${suffix}@example.test`, 'Supervisor');
  const recipient = await makePerson(`person-${suffix}@example.com`, 'BehaviorTherapist');
  const wrongPerson = await makePerson(`person-${suffix}@exqmple.com`, 'BehaviorTherapist');
  await db.organizationMembership.create({ data: { organizationId: org.id, providerId: owner.id, role: 'OWNER' } });
  const initialAccount = await db.provider.findUnique({ where: { id: wrongPerson.id } });
  const issue = async email => {
    actor = owner;
    const result = await actions.createOrganizationInvitation({ status: 'idle' }, form({ organizationId: org.id, email, providerRole: 'BehaviorTherapist', replaceConfirmed: 'yes' }));
    assert.equal(result.status, 'success');
    const url = new URL(result.invitationPath, 'https://synthetic-preview.vercel.app');
    const token = url.searchParams.get('invite');
    const row = await db.organizationInvitation.findUniqueOrThrow({ where: { tokenHash: library.hashInvitationToken(token) } });
    return { row, token, url: url.href };
  };
  const correctOriginal = await issue(recipient.email);
  const typo = await issue(wrongPerson.email);
  const decide = async (invitation, link = invitation.url) => {
    actor = recipient;
    return actions.decideOrganizationInvitation({ status: 'idle' }, form({ invitationId: invitation.row.id, invitationLink: link, decision: 'accept' }));
  };
  await t.test('ordinary login URL receives a specific error and grants no membership', async () => {
    const result = await decide(correctOriginal, 'https://synthetic-preview.vercel.app/login');
    assert.equal(result.status, 'error'); assert.match(result.message, /ordinary login URL/);
    assert.equal(await db.organizationMembership.count({ where: { providerId: recipient.id } }), 0);
  });
  await t.test('misspelled invitation cannot be accepted by the existing correct-email account', async () => {
    const result = await decide(typo);
    assert.equal(result.status, 'error'); assert.match(result.message, /does not match/);
    assert.ok(!result.message.includes(wrongPerson.email));
    assert.equal(await db.organizationMembership.count({ where: { providerId: recipient.id } }), 0);
  });
  let corrected;
  await t.test('confirmed correction revokes wrong and previous correct links without editing either account', async () => {
    actor = owner;
    const unconfirmed = await actions.manageOrganizationInvitation({ status: 'idle' }, form({ invitationId: typo.row.id, decision: 'correct', correctedEmail: recipient.email }));
    assert.equal(unconfirmed.status, 'error');
    assert.equal((await db.organizationInvitation.findUnique({ where: { id: typo.row.id } })).revokedAt, null);
    const result = await actions.manageOrganizationInvitation({ status: 'idle' }, form({ invitationId: typo.row.id, decision: 'correct', correctedEmail: recipient.email, correctionConfirmed: 'yes' }));
    assert.equal(result.status, 'success');
    const url = new URL(result.invitationPath, 'https://synthetic-preview.vercel.app');
    const token = url.searchParams.get('invite');
    corrected = { url: url.href, token, row: await db.organizationInvitation.findUniqueOrThrow({ where: { tokenHash: library.hashInvitationToken(token) } }) };
    assert.ok((await db.organizationInvitation.findUnique({ where: { id: typo.row.id } })).revokedAt);
    assert.ok((await db.organizationInvitation.findUnique({ where: { id: correctOriginal.row.id } })).revokedAt);
    assert.deepEqual(await db.provider.findUnique({ where: { id: wrongPerson.id } }), initialAccount);
    assert.equal((await db.provider.findUnique({ where: { id: recipient.id } })).email, recipient.email);
    assert.equal(await db.organizationMembership.count({ where: { organizationId: org.id } }), 1);
  });
  await t.test('older replaced, expired and revoked links grant no membership', async () => {
    assert.equal((await decide(correctOriginal)).status, 'error');
    const staleInCurrentCard = await decide(corrected, correctOriginal.url);
    assert.equal(staleInCurrentCard.status, 'error');
    assert.match(staleInCurrentCard.message, /revoked or replaced/);
    for (const lifecycle of ['expired', 'revoked']) {
      const token = library.createInvitationToken();
      const row = await db.organizationInvitation.create({ data: { organizationId: org.id, invitedByProviderId: owner.id, email: recipient.email, normalizedEmail: recipient.email, providerRole: recipient.role, tokenHash: library.hashInvitationToken(token), expiresAt: lifecycle === 'expired' ? new Date(0) : new Date(Date.now() + 86400000), revokedAt: lifecycle === 'revoked' ? new Date() : null } });
      assert.equal((await decide({ row, url: `https://synthetic-preview.vercel.app/create-account?invite=${token}` })).status, 'error');
    }
    assert.equal(await db.organizationMembership.count({ where: { providerId: recipient.id } }), 0);
  });
  await t.test('correct existing-user acceptance creates exactly one intended membership, including retries', async () => {
    assert.equal((await decide(corrected)).status, 'success');
    const repeated = await decide(corrected);
    assert.equal(repeated.status, 'success'); assert.match(repeated.message, /You’ve joined Synthetic Invitation Test/);
    const memberships = await db.organizationMembership.findMany({ where: { providerId: recipient.id } });
    assert.equal(memberships.length, 1); assert.equal(memberships[0].organizationId, org.id); assert.equal(memberships[0].role, 'MEMBER');
    assert.equal(await db.organizationMembership.count({ where: { providerId: wrongPerson.id } }), 0);
    assert.equal(await db.providerClient.count({ where: { providerId: recipient.id } }), 0);
  });
  await t.test('ordinary recipient cannot correct or revoke organization invitations', async () => {
    actor = recipient;
    for (const decision of ['correct', 'reissue', 'revoke']) {
      const result = await actions.manageOrganizationInvitation({ status: 'idle' }, form({ invitationId: typo.row.id, decision, correctedEmail: recipient.email, correctionConfirmed: 'yes', replaceConfirmed: 'yes' }));
      assert.equal(result.status, 'error');
    }
  });
});
test.after(async () => { if (db) await db.$disconnect(); });

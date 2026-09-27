/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const test = require('node:test');
const vm = require('node:vm');
function load(file, dependencies = {}, globals = {}) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { module: mod, exports: mod.exports, URLSearchParams, ...globals, require: name => dependencies[name] ?? require(name) });
  return mod.exports;
}
const flags = load('app/dashboard/firstActivationFlag.ts');
test('exact single flag only; login destination is fixed, not a supplied return URL', () => {
  for (const values of [[], ['0'], ['true'], ['01'], ['1', '1'], ['https://example.test'], ['/dashboard?debugFirstActivation=1']]) {
    const form = new FormData(); values.forEach(value => form.append('debugFirstActivation', value));
    form.set('returnTo', 'https://example.test');
    assert.equal(flags.firstActivationLoginDestination(form), '/dashboard');
  }
  const form = new FormData(); form.set('debugFirstActivation', '1');
  assert.equal(flags.firstActivationLoginDestination(form), '/dashboard?debugFirstActivation=1');
  for (const pathname of ['/login', '/dev/provider-first-activation', '/portal/notes', '/dashboard/']) {
    assert.equal(flags.isFirstActivationDashboard({ pathname, search: '?debugFirstActivation=1' }), false);
  }
  assert.equal(flags.isFirstActivationDashboard({ pathname: '/dashboard', search: '?debugFirstActivation=1' }), true);
  assert.equal(flags.isFirstActivationDashboard({ pathname: '/dashboard', search: '?debugFirstActivation=1&debugFirstActivation=1' }), false);
});
test('existing URL builders preserve only explicit dashboard opt-in and leave ordinary navigation unchanged', () => {
  const location = { pathname: '/dashboard', search: '?debugFirstActivation=1' };
  const scoped = load('app/dashboard/firstActivationFlag.ts', {}, { window: { location } });
  assert.equal(scoped.preserveFirstActivationFlag('/dashboard?view=orbit'), '/dashboard?view=orbit&debugFirstActivation=1');
  assert.equal(scoped.preserveFirstActivationFlag('/portal/notes'), '/portal/notes');
  location.search = '';
  assert.equal(scoped.preserveFirstActivationFlag('/dashboard?view=orbit'), '/dashboard?view=orbit');
});
test('real password action authenticates normally, bounds flagged destination and preserves invitation precedence', async () => {
  let sessionCount = 0;
  const action = load('app/actions/loginProvider.ts', {
    '@/app/dashboard/firstActivationFlag': flags,
    bcryptjs: { compare: async () => true },
    'next/navigation': { redirect: destination => { throw { destination }; } },
    '@/lib/db': { db: { provider: { findFirst: async () => ({ id: 'synthetic', email: 'test@example.test', status: 'ACTIVE', passwordHash: 'synthetic', role: 'OccupationalTherapist' }) }, $transaction: async callback => callback({}) } },
    '@/lib/session': { setSession: async () => { sessionCount++; } },
    '@/lib/organizationInvitationState': { OrganizationInvitationError: class extends Error {} },
    '@/lib/organizationInvitations': { acceptOrganizationInvitation: async () => {} },
  });
  for (const [flag, invite, expected] of [[undefined, false, '/dashboard'], ['1', false, '/dashboard?debugFirstActivation=1'], ['true', false, '/dashboard'], ['1', true, '/portal/organization/invitations?joined=1']]) {
    const form = new FormData(); form.set('email', 'test@example.test'); form.set('password', 'synthetic-test-only');
    if (flag) form.set('debugFirstActivation', flag);
    if (invite) form.set('inviteToken', 'synthetic');
    await assert.rejects(action.loginProvider({ error: null }, form), error => error.destination === expected);
  }
  assert.equal(sessionCount, 4);
});
test('authenticated owner gates capture; recording and local delivery remain separate', () => {
  const page = fs.readFileSync('app/dashboard/page.tsx', 'utf8');
  assert.ok(page.indexOf('if (!session)') < page.indexOf('<FirstActivationDiagnostic'));
  assert.match(page, /resolvedSearchParams.debugFirstActivation === "1" \? <FirstActivationDiagnostic/);
  for (const file of ['diagnostics/provider-first-activation.js', 'app/dashboard/FirstActivationDiagnosticClient.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|XMLHttpRequest|sendBeacon|console\./);
    if (file.endsWith('.js')) assert.doesNotMatch(source, /fetch\(/);
  }
  const ui = fs.readFileSync('app/dashboard/FirstActivationDiagnosticClient.tsx', 'utf8');
  assert.match(ui, /CAPTURE_INTERVAL_MS = 20_000/);
  assert.match(ui, /JSON.stringify\(probe.read\(\)\)/);
  assert.equal((ui.match(/fetch\(/g) || []).length, 1);
  assert.match(ui, /fetch\("\/api\/dev\/diagnostic-trace"/);
  assert.match(ui, /process.env.NODE_ENV === "development"/);
  const bootstrap = fs.readFileSync('app/dashboard/FirstActivationDiagnostic.tsx', 'utf8');
  assert.match(bootstrap, /process.env.NODE_ENV === "development" && !process.env.VERCEL/);
  const delivery = fs.readFileSync('diagnostics/localTraceDelivery.js', 'utf8');
  assert.match(delivery, /sends > 24/);
  assert.match(delivery, /setInterval\(deliver, 5000\)/);
  assert.match(delivery, /\/api\/dev\/diagnostic-trace/);
  assert.doesNotMatch(delivery, /localStorage|sessionStorage|document.cookie/);
  assert.match(ui, /if \(!ready \|\| stopped \|\| !position\) return null/);
  assert.doesNotMatch(ui, /\.focus\(|\.select\(|history\.|preventDefault|stopPropagation/);
  const probe = fs.readFileSync('diagnostics/provider-first-activation.js', 'utf8');
  assert.match(probe, /events.length > 600/);
  assert.match(probe, /events.splice\(64, events.length - 600\)/);
  assert.match(probe, /events.length = 0/);
});

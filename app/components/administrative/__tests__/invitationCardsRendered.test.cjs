/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', output)(mod, mod.exports, name => {
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
    if (name === '@/app/actions/manageOrganizationInvitations') return { createOrganizationInvitation: async () => ({}), manageOrganizationInvitation: async () => ({}), decideOrganizationInvitation: async () => ({}) };
    if (name.startsWith('@/') || name.startsWith('.')) {
      const bases = name.startsWith('@/') ? [path.resolve(name.slice(2)), path.resolve('src', name.slice(2))] : [path.resolve(path.dirname(file), name)];
      for (const base of bases) for (const ext of ['.ts', '.tsx']) if (fs.existsSync(base + ext)) return load(base + ext);
      throw Error('Unresolved test module: ' + name);
    }
    return require(name);
  });
  return mod.exports;
}
const Carousel = load('app/components/administrative/AdministrativeCarousel.tsx').default;
const InvitationCard = load('app/portal/organization/invitations/InvitationCards.tsx').default;
const Form = load('app/portal/supervisor/invitations/OrganizationInvitationForm.tsx').default;
const render = props => renderToStaticMarkup(React.createElement(Carousel, { ariaLabel: 'Invitations', navigationMode: 'records', ...props }));
test('empty record collection renders no misleading count or controls', () => assert.equal(render({ cards: [] }), ''));
test('single record renders one real shared card without chevrons or 1 of N', () => {
  const html = render({ cards: [{ id: 'one', label: 'One invitation', content: 'Pending' }] });
  assert.match(html, /<article/); assert.doesNotMatch(html, /Carousel controls|Previous card|Next card|1 of 1/);
});
test('multiple records reuse chevrons, correct count and retained hidden cards', () => {
  const html = render({ cards: ['one', 'two'].map(id => ({ id, label: id, content: id })) });
  assert.match(html, /1 of 2/); assert.match(html, /icon-chevron-control--carousel/);
  assert.match(html, /aria-label="Previous card" disabled=""/); assert.match(html, /hidden=""/);
});
test('pending invitation includes identity, access consequence, link prerequisite and both actions together', () => {
  const html = render({ cards: [{ id: 'one', label: 'Synthetic Agency', content: React.createElement(InvitationCard, { invitation: { id: 'test', organization: 'Synthetic Agency', email: 'long.synthetic.person@example.test', role: 'BehaviorTherapist', membershipRole: 'MEMBER', status: 'Pending', expiration: 'September 20, 2026 UTC' } }) }] });
  for (const text of ['Synthetic Agency', 'long.synthetic.person@example.test', 'Behavior Therapist', 'Pending', 'Expires', 'Accept Invitation', 'Decline', 'does not assign Clients', 'Invitation link', 'aria-expanded="false"']) assert.ok(html.includes(text), text);
});
test('invitation form uses existing select and same-card creation feedback without a nested carousel', () => {
  const html = render({ cards: [{ id: 'create', label: 'Create Invitation', content: React.createElement(Form, { organizations: [{ id: 'synthetic', name: 'Synthetic Agency' }] }) }] });
  assert.equal((html.match(/<article/g) ?? []).length, 1);
  assert.match(html, /<select/); assert.match(html, /No email is sent/); assert.match(html, /replaceConfirmed/);
});

/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(file, deps) {
  const mod={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{module:mod,exports:mod.exports,require:name=>deps[name]??require(name)});
  return mod.exports;
}
const clientId='00000000-0000-4000-8000-000000000001';
const goalId='00000000-0000-4000-8000-000000000003';
function setup(role, assigned=true) {
  const rows=[],updates=[],assignments=[];
  const action=load(path.resolve('app/actions/createEducatorTarget.ts'),{
    '@/lib/session':{getSession:async()=>({providerId:'synthetic-provider',role})},
    'next/cache':{revalidatePath:()=>{}},
    '@/app/libs/professionTemplates':{getProfessionTemplate:()=>null},
    '@/lib/db':{db:{providerClient:{findFirst:async args=>{assignments.push(args);return assigned?{id:'synthetic-assignment',role}:null;}},goalDefinition:{
      findFirst:async()=>rows.length?{id:goalId}:null,
      create:async args=>{rows.push(args.data);return {id:goalId};},
      updateMany:async args=>{updates.push(args);return {count:1};},
    }}}});
  const form=new FormData();
  for(const [k,v]of Object.entries({clientId,target:'Synthetic target',goal:'Synthetic goal',measurementProfile:'Frequency'}))form.set(k,v);
  return {action,form,rows,updates,assignments};
}
for(const role of ['OccupationalTherapist','Educator','SpeechPathologist','BehaviorTherapist']) {
  test(`${role}: real create stores final profile once and existing duplicate guard remains`,async()=>{
    const {action,form,rows,assignments}=setup(role);
    assert.equal((await action.createEducatorTarget(form)).ok,true);
    assert.equal(rows.length,1); assert.equal(rows[0].measurementProfile,'Frequency');
    assert.equal(rows[0].clientId,clientId);assert.equal(rows[0].goal,'Synthetic goal');
    assert.equal(assignments[0].where.revokedAt,null);
    assert.equal((await action.createEducatorTarget(form)).reason,'duplicate_target'); assert.equal(rows.length,1);
  });
  test(`${role}: edit keeps the same owner-scoped target and chosen profile`,async()=>{
    const {action,form,updates}=setup(role); form.set('goalId',goalId);form.set('goal','Updated synthetic goal');
    assert.equal((await action.updateEducatorTarget(form)).ok,true);
    assert.equal(updates.length,1);const {where,data}=updates[0];
    assert.equal(where.id,goalId);assert.equal(where.clientId,clientId);assert.equal(where.providerId,'synthetic-provider');
    assert.equal(where.isActive,true);assert.equal(where.isMastered,false);
    assert.equal(data.goal,'Updated synthetic goal');assert.equal(data.measurementProfile,'Frequency');
  });
}
test('unassigned and invalid creates cannot write',async()=>{
  const {action,form,rows}=setup('OccupationalTherapist',false);
  assert.equal((await action.createEducatorTarget(form)).reason,'forbidden');
  form.set('goal','');assert.equal((await action.createEducatorTarget(form)).reason,'invalid_data');assert.equal(rows.length,0);
});

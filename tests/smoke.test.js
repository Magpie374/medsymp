// Lightweight smoke tests of the matching helpers in the same JS used by the page.
// This intentionally tests local behavior only, not live FDA availability.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
// Extract the portion preceding DOM event hookup; definitions remain unchanged.
const beforeEventHook = source.split('$("drugs").addEventListener("input",updateTypos);')[0];
if (!beforeEventHook.includes('function suggestion(')) throw Error('Expected matcher not found');
const context = vm.createContext({URL, URLSearchParams, console, setTimeout, clearTimeout});
vm.runInContext(beforeEventHook, context);
const suggest = (s, type) => vm.runInContext(`suggestion(${JSON.stringify(s)}, ${type})`,context);
assert.equal(suggest('rosuvastain','DRUG_DICTIONARY'),'rosuvastatin');
assert.equal(suggest('insuli','DRUG_DICTIONARY'),'insulin');
assert.equal(suggest('insulin','DRUG_DICTIONARY'),null);
// Evaluate actual matcher separately with DOM bindings stubbed.
const matchContext = vm.createContext({URL, URLSearchParams, console, setTimeout, clearTimeout, document:{getElementById:()=>({addEventListener(){},value:'',replaceChildren(){},classList:{add(){},remove(){}},append(){},set textContent(_){} })}});
vm.runInContext(source, matchContext);
const check = (record,sym) => vm.runInContext(`matchSections(${JSON.stringify(record)}, ${JSON.stringify(sym)})`,matchContext);
let hits=check({warnings_and_cautions:['Increases in HbA1c and fasting serum glucose levels have been reported.']},'glucose increase');
assert.ok(hits.some(x=>!x.uncertain), 'Increased glucose warning should be identifiable');
hits=check({adverse_reactions:['Hypoglycemia is the most common adverse reaction associated with insulin.']},'glucose decrease');
assert.ok(hits.some(x=>!x.uncertain), 'Hypoglycemia adverse reaction should be identifiable');
hits=check({adverse_reactions:['Nausea was reported.']},'muscle pain');
assert.equal(hits.length,0);
console.log('MedSymp local smoke tests passed (5 checks).');

// Regression: rosuvastatin labels may describe the same oral tablets differently.
const profileRecord = (form, route='ORAL', ingredient='ROSUVASTATIN CALCIUM') => ({
 openfda:{generic_name:['ROSUVASTATIN CALCIUM'],substance_name:[ingredient],route:[route],dosage_form:[form]},
 adverse_reactions:['Myalgia was reported as an adverse reaction.'], effective_time:'20260101',set_id:form
});
const rr=[profileRecord('TABLET, FILM COATED'),profileRecord('TABLET')];
const classified=vm.runInContext(`filterProductRecords(${JSON.stringify(rr)},'rosuvastatin')`,matchContext);
assert.equal(classified.records.length,2,'Equivalent tablet descriptions should stay in one product group');
const differing=[...rr,profileRecord('INJECTION','INTRAVENOUS')];
const mixed=vm.runInContext(`filterProductRecords(${JSON.stringify(differing)},'rosuvastatin')`,matchContext);
assert.ok(mixed.records.length>0,'Different formulations should not erase all results');
assert.equal(mixed.competingGroups,true,'Excluded groups must be flagged as incomplete');
console.log('Product-aware regression tests passed.');

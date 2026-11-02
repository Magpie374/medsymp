// Run: node tests/recent_label_fallback.test.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('script.js','utf8');
const snippet=code.match(/const VERIFIED_RECENT_LABELS = Object.freeze\(\[[\s\S]*?function verifiedRecentLabel\(drug\)\{[\s\S]*?\n\}/)[0];
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const ctx={normalize};vm.createContext(ctx);vm.runInContext(snippet+';this.lookup=verifiedRecentLabel;',ctx);
for(const drug of ['HIBSAGO','bepirovirsen']){
 const result=ctx.lookup(drug); assert(result); assert(result.url.endsWith('.pdf'));
}
assert.equal(ctx.lookup('not a real drug'),null);
console.log('Verified recent-label fallback tests passed');

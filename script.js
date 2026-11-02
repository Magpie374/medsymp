"use strict";
// Educational prototype: never interprets matches as clinical causation.
const API = "https://api.fda.gov/drug/label.json";
const MAX_DRUGS = 5, MAX_SYMPTOMS = 8, LIMIT_PER_SEARCH = 35;
const $ = (id) => document.getElementById(id);
let found = [], symptoms = [], runId = 0;
const SYNS = Object.freeze({
  dizziness:["dizziness","dizzy","lightheadedness","light-headedness"],
  headache:["headache","head pain"],
  nausea:["nausea","nauseated"],
  "muscle pain":["muscle pain","myalgia","muscle aches","muscle ache"],
  fatigue:["fatigue","tiredness"],
  rash:["rash","skin eruption"],
  diarrhea:["diarrhea","diarrhoea"],
  itching:["itching","pruritus"],
  swelling:["swelling","edema","oedema"],
  "glucose decrease":["hypoglycemia","low blood sugar","low blood glucose","decreased blood glucose","blood glucose decreased","decreased serum glucose","glucose decrease","blood sugar decrease"],
  "glucose increase":["increases in hba1c and fasting serum glucose levels","increases in hba1c","increased fasting serum glucose","increases in fasting serum glucose","increased blood glucose","blood glucose increased","blood sugar increased","increased blood sugar","hyperglycemia","elevated blood glucose","high blood sugar"]
});
const normalize = (s) => String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function lines(raw,max,label){
  const list=[...new Set(raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];
  if(!list.length)throw Error(`Enter at least one ${label}.`);
  if(list.length>max)throw Error(`Enter no more than ${max} ${label}s.`);
  if(list.some(s=>s.length>90||!/[a-z0-9]/i.test(s)))throw Error(`Check the ${label} entries (maximum 90 characters each).`);
  return list;
}
function setMessage(msg,isError=false){$("message").textContent=msg;$("message").className="message"+(isError?" error":"");}
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function add(parent,tag,text,cls){const node=el(tag,text,cls);parent.append(node);return node;}
function labelName(record){return names(record)[0]||"Unidentified label";}
function names(record){
  const o=record.openfda||{};
  // SPL sometimes contains brand/generic names outside the openfda annotation.
  return [...(o.brand_name||[]),...(o.generic_name||[]),...(record.brand_name||[]),...(record.generic_name||[])];
}
function isNameMatch(record,wanted){return names(record).some(n=>normalize(n)===normalize(wanted));}
function shortRecord(record){const o=record.openfda||{};return [labelName(record),(o.generic_name||[])[0],(o.dosage_form||[])[0],(o.manufacturer_name||[])[0]].filter(Boolean).join(" | ");}
// Page through the matching FDA label records. Each set_id identifies a label
// lineage: use its newest effective_time, not a fixed number of candidates.
const PAGE_SIZE=100;
const MAX_FDA_SKIP=25000;
const SEARCH_DEADLINE_MS=38000;
async function request(search, signal, skip=0){
  const url=new URL(API);
  url.searchParams.set("search",search);
  url.searchParams.set("limit",String(PAGE_SIZE));
  url.searchParams.set("skip",String(skip));
  let response;
  try{response=await fetch(url,{signal,headers:{Accept:"application/json"}});}
  catch(err){if(err.name==="AbortError")throw Error("FDA request timed out.");throw Error("FDA connection failed. Check your connection.");}
  if(response.status===404)return {results:[],total:0};
  if(response.status===429)throw Error("FDA request limit reached. Try later.");
  if(!response.ok)throw Error(`FDA service returned ${response.status}.`);
  let data;try{data=await response.json();}catch{throw Error("FDA returned unreadable data.");}
  if(!Array.isArray(data.results))throw Error("Unexpected FDA response.");
  return {results:data.results,total:Number(data.meta?.results?.total??data.results.length)};
}
// Historical fallback only. Unknown brands are resolved using live data rather than an ever-growing hard-coded list.
const BRAND_TO_INGREDIENT = {repatha:"evolocumab"};
function suitableRecord(record,drug){
  const key=normalize(drug);
  const ingredientKey=BRAND_TO_INGREDIENT[key];
  const n=names(record).map(normalize);
  const substances=(record.openfda?.substance_name||[]).map(normalize);
  if(n.some(x=>x===key))return 4;
  if(n.some(x=>x.startsWith(key+" ")||x.endsWith(" "+key)))return 3;
  if(substances.some(x=>x===key))return 2;
  if(ingredientKey && (substances.some(x=>x===ingredientKey) || n.some(x=>x===ingredientKey)))return 1;
  return 0;
}
function newestLabelKey(record){
  // set_id is stable across versions. Fall back to record ID for bad metadata.
  return record.set_id||record.id||JSON.stringify(record.openfda||{});
}
function keepNewest(bySet,record){
  const key=newestLabelKey(record),prev=bySet.get(key);
  if(!prev || String(record.effective_time||"")>String(prev.effective_time||""))bySet.set(key,record);
}
// Classify product identity before combining label evidence. Missing fields remain visible uncertainty.
function values(r,key){const v=r.openfda?.[key]??r[key]??[];return (Array.isArray(v)?v:[v]).map(x=>String(x).trim()).filter(Boolean);}
function ingredients(r){
  const substances=values(r,'substance_name');
  if(substances.length)return [...new Set(substances.map(normalize))].sort();
  // A missing ingredient field must not be guessed from the drug name.
  return [];
}
function productProfile(r){
  return {ingredients:ingredients(r),forms:values(r,'dosage_form').map(normalize),routes:values(r,'route').map(normalize),
          ids:values(r,'product_ndc'),applications:values(r,'application_number')};
}
function canonicalDosageForm(form){
  const f=normalize(form);
  if(/\btablet\b/.test(f))return 'tablet';
  if(/\bcapsule\b/.test(f))return 'capsule';
  if(/\bsolution\b/.test(f))return 'solution';
  if(/\bsuspension\b/.test(f))return 'suspension';
  if(/\bpatch\b/.test(f))return 'patch';
  if(/\binjection\b/.test(f))return 'injection';
  return f||'form-unavailable';
}
function canonicalRoute(route){
  const r=normalize(route);
  if(/\boral\b/.test(r))return 'oral';
  if(/\b(intravenous|intramuscular|subcutaneous)\b/.test(r))return r;
  return r||'route-unavailable';
}
function productGroupKey(r){
  const p=productProfile(r);
  const forms=[...new Set(p.forms.map(canonicalDosageForm))].sort();
  const routes=[...new Set(p.routes.map(canonicalRoute))].sort();
  return [p.ingredients.join('+')||'ingredients-unavailable',routes.join('+')||'route-unavailable',
    forms.join('+')||'form-unavailable'].join(' | ');
}
function filterProductRecords(records,drug){
  // A generic or ingredient query with one named substance excludes combinations;
  // a brand query may legitimately identify a combination, so group by the
  // highest-scored record instead. Do not combine differing formulation groups.
  const ordered=records.slice().sort((a,b)=>suitableRecord(b,drug)-suitableRecord(a,drug)||String(b.effective_time||'').localeCompare(String(a.effective_time||'')));
  const key=normalize(drug);
  const reference=ordered[0];
  if(!reference)return {records:[],ambiguous:true,reason:'No matching product identified.'};
  const exactBrand=ordered.some(r=>values(r,'brand_name').some(n=>normalize(n)===key) || names(r).some(n=>normalize(n)===key));
  // Only exclude multi-ingredient products when input is actually a single ingredient.
  // An unannotated *brand* is NOT evidence that the drug has one active ingredient.
  const exactIngredient=ordered.some(r=>productProfile(r).ingredients.some(n=>n===key));
  const isIngredientQuery=exactIngredient && !exactBrand;
  let candidates=ordered.filter(r=>{
    const p=productProfile(r);
    if(isIngredientQuery && p.ingredients.length>1)return false; // no combination product for single-ingredient query
    if(exactBrand && !names(r).some(n=>normalize(n)===key))return false;
    if(BRAND_TO_INGREDIENT[key] && !p.ingredients.some(i=>i===BRAND_TO_INGREDIENT[key]) && !values(r,'generic_name').some(n=>normalize(n)===BRAND_TO_INGREDIENT[key]))return false;
    return true;
  });
  // Prefer fully identified products, but never silently treat unknown metadata as equivalent.
  const identified=candidates.filter(r=>productProfile(r).ingredients.length&&productProfile(r).routes.length);
  if(identified.length)candidates=identified;
  const groups=new Map();for(const r of candidates){const g=productGroupKey(r);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r);}
  if(!groups.size)return {records:[],ambiguous:true,reason:'No sufficiently identified matching product. Enter a more specific drug or product name.'};
  const sorted=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length || String(b[1][0].effective_time||'').localeCompare(String(a[1][0].effective_time||'')));
  // Differences in manufacturer descriptions must not erase all findings.
  // If genuinely different formulations remain, check the dominant compatible
  // group but DO NOT allow a negative conclusion about other excluded groups.
  const chosen=sorted[0][1];
  const meta=productProfile(chosen[0]);
  return {records:chosen,ambiguous:false,profile:meta,excluded:records.length-chosen.length,
    competingGroups:sorted.length>1};
}
// Start with a narrow brand lookup; this avoids spending the whole search
// budget on unrelated labels for the ingredient before checking the brand.
async function focusedBrandLookup(drug){
  const alias=BRAND_TO_INGREDIENT[normalize(drug)];
  if(!alias)return null;
  const queries=[`openfda.brand_name.exact:"${drug}"`,
                 `openfda.brand_name:${drug}`,
                 `openfda.generic_name:${alias}`,
                 `openfda.substance_name:${alias}`];
  const bySet=new Map();let successes=0;const errors=[];
  for(const query of queries){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
    try{
      const page=await request(query,controller.signal,0);
      successes++;
      for(const r of page.results)if(suitableRecord(r,drug)>0)keepNewest(bySet,r);
    }catch(e){errors.push(e.message);}finally{clearTimeout(timer);}
    // Prefer a brand-specific match, but do not stop at unrelated generic records.
    if([...bySet.values()].some(r=>values(r,'brand_name').some(n=>normalize(n)===normalize(drug))))break;
  }
  // A branded biologic can be absent from openFDA's name annotation even when
  // its structured FDA labeling record is publicly available. Retrieve its
  // known SET ID as a verified fallback; the adverse-effect answer is NEVER hardcoded.
  if(!bySet.size && normalize(drug)==='repatha'){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const page=await request('set_id:"cd61e902-166d-4aa6-9f3c-a18c1008d07e"',controller.signal,0);
      for(const r of page.results)keepNewest(bySet,r);
    }catch(e){errors.push(e.message);}finally{clearTimeout(timer);}
  }
  if(!bySet.size)return {drug,records:[],incomplete:true,error:errors[0]||'No FDA labeling record found for this brand.'};
  const branded=[...bySet.values()].filter(r=>
    values(r,'brand_name').some(n=>normalize(n)===normalize(drug)) ||
    names(r).some(n=>normalize(n).startsWith(normalize(drug)+' ')));
  const candidates=branded.length?branded:[...bySet.values()].filter(r=>
    values(r,'substance_name').some(n=>normalize(n)===alias) ||
    values(r,'generic_name').some(n=>normalize(n).includes(alias)));
  const groups=filterProductRecords(candidates,drug);
  const filtered=groups.ambiguous?candidates:groups.records;
  // Brand records with incomplete annotations must not vanish solely due to metadata filtering.
  const resolved=filtered.length?filtered:[...bySet.values()];
  const usable=resolved.filter(r=>['adverse_reactions','warnings_and_cautions','boxed_warning','warnings','precautions'].some(k=>sectionText(r,k).trim()));
  return usable.length?{drug,records:usable,incomplete:false,
      selectionNote:branded.length?'Matched FDA brand labeling.':'Matched FDA ingredient labeling; confirm the exact product.'}:
    {drug,records:[],incomplete:true,error:'Matching FDA records lacked searchable safety labeling.'};
}
async function searchDrugCore(drug){
  if(normalize(drug)==="insulin")return {drug,records:[],needsSpecificProduct:true,incomplete:false};
  if(BRAND_TO_INGREDIENT[normalize(drug)])return focusedBrandLookup(drug);
  const safe=drug.replace(/["\\]/g,"").trim();
  const token=safe.replace(/\s+/g,"+");
  const phrase=safe.replace(/\s+/g," ");
  // Prefer annotated brand/generic searches; broad duplicate searches used to
  // consume the time budget and made valid negative results 'Unable to check'.
  // Use fallback fields only if the primary fields produce no matching labels.
  const primarySearches=[`openfda.brand_name:${token}`,`openfda.generic_name:${token}`,`brand_name:${token}`];
  const fallbackSearches=[`generic_name:${token}`,`openfda.substance_name:${token}`];
  const alias=BRAND_TO_INGREDIENT[normalize(drug)];
  if(alias)fallbackSearches.push(`openfda.generic_name:${alias}`,`openfda.substance_name:${alias}`);
  // Resolve a known brand through the ingredient, regardless of whether the brand query returns weak metadata.
  if(alias)primarySearches.unshift(`openfda.substance_name:${alias}`,`openfda.generic_name:${alias}`);
  const searches=[...new Set(primarySearches)];
  const bySet=new Map(),errors=[];
  let complete=true, count=0;
  // One deadline for the drug, not one deadline per query.
  const deadline=Date.now()+SEARCH_DEADLINE_MS;
  for(let searchIndex=0;searchIndex<searches.length;searchIndex++){
    const query=searches[searchIndex];
    let skip=0;
    while(true){
      if(Date.now()>=deadline){complete=false;errors.push("FDA search timed out before all records were checked.");break;}
      if(skip>=MAX_FDA_SKIP){complete=false;errors.push("FDA pagination limit reached.");break;}
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),Math.min(12000,Math.max(100,deadline-Date.now())));
      let page;
      try{page=await request(query,controller.signal,skip);}
      catch(err){complete=false;errors.push(err.message);break;}
      finally{clearTimeout(timer);}
      for(const r of page.results){
        count++;
        if(suitableRecord(r,drug)>0)keepNewest(bySet,r);
      }
      skip+=page.results.length;
      if(page.results.length===0||skip>=page.total)break;
      if(page.results.length<PAGE_SIZE){complete=false;errors.push("FDA returned a partial page.");break;}
    }
    if(searchIndex===primarySearches.length-1 && bySet.size===0){
      searches.push(...fallbackSearches);
    }
    if(Date.now()>=deadline)break;
  }
  const ranked=[...bySet.values()].map(record=>({record,score:suitableRecord(record,drug)}))
    .sort((a,b)=>b.score-a.score||String(b.record.effective_time||"").localeCompare(String(a.record.effective_time||"")));
  if(!ranked.length)return {drug,records:[],incomplete:true,error:errors[0]||"No identifiable FDA label found. Check the medication name."};
  const classified=filterProductRecords(ranked.map(x=>x.record),drug);
  if(classified.ambiguous)return {drug,records:[],incomplete:true,error:classified.reason};
  const usable=classified.records.filter(r=>['adverse_reactions','warnings_and_cautions','boxed_warning','warnings','precautions'].some(k=>sectionText(r,k).trim()));
  if(!usable.length)return {drug,records:[],incomplete:true,error:"Matching labels lacked searchable warning and adverse-reaction sections."};
  // A distinct formulation group is excluded intentionally; its existence is
  // not an API failure. The answer applies to the checked compatible group.
  const partial=!complete;
  return {drug,records:usable,incomplete:partial,profile:classified.profile,
    selectionNote:classified.competingGroups
      ?"Other formulations were excluded. Findings apply to the selected compatible product group only."
      :complete?"":"FDA search incomplete; not all relevant labels could be checked.",
    error:complete?undefined:errors[0]};
}
// Generic medication discovery: newer brands may not be indexed in openFDA labels yet.
// NDC fields identify a product; DailyMed gives a readable official label when
// the openFDA label index is still catching up. Neither is used to invent symptom findings.
const NDC_API = 'https://api.fda.gov/drug/ndc.json';
// OPTIONAL: deploy the provided Cloudflare Worker and paste its URL below.
// A static HTML page cannot bypass DailyMed's cross-origin restrictions.
const SPL_RELAY_BASE = (location.protocol === 'http:' || location.protocol === 'https:') ? location.origin + '/api' : ''; // Same-origin serverless API when deployed; no relay for file://
const DM_API = SPL_RELAY_BASE ? SPL_RELAY_BASE.replace(/\/$/,'') + '/find' : 'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json';
async function jsonLookup(url, timeout=6500){
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
  if(response.status===404)return null;
  if(!response.ok)throw Error('Lookup returned '+response.status);
  return await response.json();
 }finally{clearTimeout(timer);}
}
function sameDrugName(a,b){return normalize(a)===normalize(b);}
async function resolveNdcNames(drug){
 const out=new Set(), fields=['brand_name','generic_name'];
 for(const field of fields){
  const u=new URL(NDC_API);
  u.searchParams.set('search',`${field}.exact:"${drug.replace(/["\\]/g,'')}"`);
  u.searchParams.set('limit','30');
  try{
   const data=await jsonLookup(u,6500);
   for(const item of data?.results||[]){
    if(!sameDrugName(item.brand_name,drug)&&!sameDrugName(item.generic_name,drug))continue;
    const generic=String(item.generic_name||'').trim();
    if(generic && !sameDrugName(generic,drug))out.add(generic);
   }
  }catch{/* A failed secondary directory lookup must not erase the original failure. */}
 }
 return [...out];
}
// Recent FDA approvals may become visible in FDA-hosted PDFs before openFDA
// has indexed the associated structured label. This verified source catalog
// is strictly a last resort for *document discovery*, never symptom scoring.
// Expand or refresh this catalog when FDA publishes new approvals.
const VERIFIED_RECENT_LABELS = Object.freeze([
  {names:['zaynich','cefepime and zidebactam','zidebactam dihydrate and cefepime hydrochloride'],
   pdf:'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/220787Orig1s000lbl.pdf',
   setid:'c84e652e-5e76-4568-8812-bd5fa34803b6',
   title:'ZAYNICH (cefepime and zidebactam), FDA prescribing information (2026)'},
  {names:['hibsago','bepirovirsen','bepirovirsen sodium'],
   pdf:'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/221276Orig1s000lbl.pdf',
   setid:'2cca7226-d8f9-4917-8d10-83e216acf393',
   title:'HIBSAGO (bepirovirsen), FDA prescribing information (October 2026)'}
]);
function verifiedRecentLabel(drug){
 const key=normalize(drug);
 const result=VERIFIED_RECENT_LABELS.find(entry=>entry.names.some(name=>normalize(name)===key));
 return result?{url:result.pdf,label:result.title,source:'FDA PDF',setid:result.setid}:null;
}
async function resolveCurrentLabel(drug){
 // General current-label lookup for *any* brand or generic drug name.
 const u=new URL(DM_API);
 u.searchParams.set(SPL_RELAY_BASE?'drug':'drug_name',drug);
 if(!SPL_RELAY_BASE)u.searchParams.set('name_type','both');
 if(!SPL_RELAY_BASE)u.searchParams.set('pagesize','100');
 try{
  const data=await jsonLookup(u,9000);
  const arr=data?.data?.spl || data?.spls || data?.spl || [];
  const list=Array.isArray(arr)?arr:[];
  const matched=list.find(x=>x.setid||x.set_id||x.setId);
  if(matched){
   const id=matched.setid||matched.set_id||matched.setId;
   if(/^[a-f0-9-]{36}$/i.test(id))return {
    url:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid='+encodeURIComponent(id),
    label:matched.title||drug,source:'Current Structured Product Label',setid:id};
  }
 }catch{/* The optional service may be inaccessible in browsers with file:// restrictions. */}
 return verifiedRecentLabel(drug);
}

// Second-stage source: current SPL/XML label text from the National Library of Medicine.
// The label is a US FDA-submitted Structured Product Label (SPL). This service is
// distinct from Drugs@FDA PDFs; browser CORS policy may prevent file:// retrieval.
const SPL_XML_BASE=SPL_RELAY_BASE ? SPL_RELAY_BASE.replace(/\/$/,'')+'/spl/' : 'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/';
const SPL_FIELDS=[
  ['adverse_reactions',/adverse reactions|undesirable effects/i],
  ['warnings_and_cautions',/warnings and precautions|warnings & precautions|precautions/i],
  ['boxed_warning',/boxed warning/i],
  ['warnings',/^warnings$/i],
  ['drug_interactions',/drug interactions/i]
];
function directXmlChild(node,local){return Array.from(node.children||[]).find(x=>x.localName===local)||null;}
function xmlLabelToRecord(xmlText,setid,drug){
  if(typeof DOMParser==='undefined')throw Error('SPL/XML parsing is not available in this browser.');
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.getElementsByTagName('parsererror').length)throw Error('The SPL/XML label could not be parsed.');
  const result={set_id:setid,openfda:{brand_name:[drug]},_source:'SPL/XML'};
  let used=0;
  for(const section of Array.from(xml.getElementsByTagNameNS('*','section'))){
    const title=directXmlChild(section,'title')?.textContent?.replace(/\s+/g,' ').trim()||'';
    const field=SPL_FIELDS.find(([_,rx])=>rx.test(title))?.[0];
    if(!field)continue;
    // Prefer the direct text elements of this section, excluding nested sections
    // and their unrelated subsections, such as contraindications or indications.
    const parts=[];
    for(const child of Array.from(section.children||[])){
      if(child.localName==='text')parts.push(child.textContent||'');
    }
    const body=parts.join(' ').replace(/\s+/g,' ').trim();
    if(body.length>20){(result[field] ||= []).push(body.slice(0,100000));used++;}
  }
  if(!used)throw Error('The current SPL has no extractable adverse-reaction or warning sections.');
  return result;
}
async function fetchSplRecord(setid,drug){
  if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(setid))throw Error('Invalid SPL set ID.');
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(SPL_XML_BASE+encodeURIComponent(setid)+'.xml',{signal:controller.signal});
    if(!response.ok)throw Error('SPL service returned '+response.status);
    const text=await response.text();
    return xmlLabelToRecord(text,setid,drug);
  }catch(e){
    if(e.name==='AbortError')throw Error('SPL service timed out.');
    if(e instanceof TypeError)throw Error(SPL_RELAY_BASE?'SPL relay is unreachable. Check the deployed Worker URL.':'This browser cannot read DailyMed SPL/XML directly. Configure the SPL relay (see README).');
    throw e;
  }finally{clearTimeout(timer);}
}
async function resolveStructuredRecord(drug){
  const candidate=await resolveCurrentLabel(drug);
  const known=verifiedRecentLabel(drug);
  const setid=candidate?.setid||known?.setid;
  if(!setid)return {record:null,source:candidate,error:'No current structured label SET ID was found.'};
  try{const record=await fetchSplRecord(setid,drug);return {record,source:candidate||known};}
  catch(error){return {record:null,source:candidate||known,error:error.message};}
}

// Generic approval-directory fallback for recently approved medicines. This
// verifies the application name without pretending we have machine-readable
// safety sections or inserting drug-specific symptom answers.
const DRUGSFDA_API = "https://api.fda.gov/drug/drugsfda.json";
// The public FDA indexes do not necessarily update simultaneously. Try both
// exact and token searches, then verify the returned product name locally.
function applicationNumberOf(item){
 const raw=String(item?.application_number||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const match=raw.match(/^(?:NDA|ANDA|BLA)(\d{5,7})$/);
 return match?match[1]:null;
}
function normalizeIngredientName(name){
 return normalize(name).replace(/\b(?:hydrochloride|sodium|calcium|potassium|hydrate|dihydrate)\b/g,'').replace(/\s+/g,' ').trim();
}
function matchingApprovedApplication(item, drug){
 const wanted=normalize(drug);
 return Array.isArray(item.products) && item.products.some(product => {
  const brand=normalize(product.brand_name||'');
  const ingredients=(product.active_ingredients||[]).map(x=>normalize(x.name||''));
  return brand===wanted || ingredients.some(x=>x===wanted || normalizeIngredientName(x)===normalizeIngredientName(wanted)) ||
   (ingredients.length>1 && normalize(ingredients.join(' '))===wanted);
 });
}
async function resolveApprovalByName(drug){
 const safe=String(drug).replace(/["\\]/g,'').trim();
 if(!safe)return null;
 const token=safe.split(/\s+/).filter(Boolean).join('+');
 const queries=[
  `products.brand_name.exact:"${safe}"`,
  `products.active_ingredients.name.exact:"${safe}"`,
  `products.brand_name:${token}`,
  `products.active_ingredients.name:${token}`
 ];
 let hadSuccess=false;
 for(const query of queries){
  const u=new URL(DRUGSFDA_API);u.searchParams.set('search',query);u.searchParams.set('limit','100');
  try{
   const response=await jsonLookup(u,8000);
   hadSuccess=true;
   for(const item of response?.results||[]){
    if(!matchingApprovedApplication(item,drug))continue;
    const application=applicationNumberOf(item);
    if(!application)continue;
    const url=new URL('https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm');
    url.searchParams.set('event','overview.process');url.searchParams.set('ApplNo',application);
    return {url:url.toString(),label:'FDA application information',source:'Drugs@FDA',application};
   }
  }catch{/* A directory failure is not evidence that a drug has no label. */}
 }
 return null;
}

// Same-origin approval verification for deployed versions. Unlike browser-only lookups,
// this backend can request FDA public APIs without browser cross-origin restrictions.
async function resolveApprovalViaServer(drug){
 if(location.protocol==='file:')return null;
 try{
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12000);
  try{
   const res=await fetch('/api/approval?drug='+encodeURIComponent(drug),{signal:ctrl.signal});
   if(!res.ok)return null;
   const obj=await res.json();
   return obj.verified&&/^https:\/\/www\.accessdata\.fda\.gov\//.test(obj.url||'')?obj:null;
  }finally{clearTimeout(timer);}
 }catch{return null;}
}
async function searchDrug(drug){
 const initial=await searchDrugCore(drug);
 if(initial.records?.length || initial.needsSpecificProduct)return initial;
 const genericNames=await resolveNdcNames(drug);
 for(const genericName of genericNames.slice(0,3)){
  BRAND_TO_INGREDIENT[normalize(drug)]=genericName;
  // For an identified brand, use the already-established focused brand path.
  try{
   const retried=await focusedBrandLookup(drug);
   if(retried.records?.length){retried.selectionNote='Brand identified via FDA NDC directory; check labeling for exact product.';return retried;}
  }catch{/* Continue to the verified-label fallback. */}
 }
 const structured=await resolveStructuredRecord(drug);
 if(structured.record)return {drug,records:[structured.record],incomplete:false,
   selectionNote:'Safety text retrieved from current Structured Product Label (SPL/XML).'};
 if(structured.source)return {drug,records:[],incomplete:true,externalLabel:structured.source,
   error:'Automated analysis unavailable for verified official labeling.'};
 const approved=await resolveApprovalViaServer(drug) || await resolveApprovalByName(drug);
 if(approved)return {drug,records:[],incomplete:true,externalLabel:approved,
   error:'Automated analysis unavailable for verified FDA application.'};
 return initial;
}
// Small local typo dictionary. Suggested corrections are only hints, never silent substitutions.
const DRUG_DICTIONARY = ["acetaminophen","tylenol","ibuprofen","advil","motrin","metformin","amoxicillin","lisinopril","atorvastatin","lipitor","omeprazole","levothyroxine","losartan","amlodipine","cetirizine","sertraline","fluoxetine","albuterol","naproxen","aspirin","gabapentin","metoprolol","rosuvastatin","crestor","repatha","evolocumab","simvastatin","pravastatin","lovastatin","fluvastatin","pitavastatin","ezetimibe","fenofibrate","hydrochlorothiazide","valsartan","olmesartan","irbesartan","carvedilol","propranolol","clopidogrel","pantoprazole","escitalopram","duloxetine","venlafaxine","bupropion","montelukast","empagliflozin","dapagliflozin","semaglutide","sitagliptin","glipizide","prednisone","azithromycin","doxycycline","cephalexin","apixaban","rivaroxaban","warfarin","furosemide","spironolactone","pregabalin","tramadol","insulin"];
const SYMPTOM_DICTIONARY = [...new Set(Object.entries(SYNS).flatMap(([key,values])=>[key,...values]).concat(["cough","vomiting","fever","insomnia","constipation","abdominal pain","palpitations","shortness of breath","increased glucose","decreased glucose","blood glucose increase","blood glucose decrease","high blood sugar","low blood sugar","muscle pain","muscle weakness","joint pain","stomach pain","chest pain","lightheadedness","hypoglycemia","hyperglycemia","allergic reaction","blurred vision","weight gain","weight loss","numbness","tingling","dry mouth","sore throat","nasal congestion","sweating","tremor","low blood pressure","high blood pressure"]))];
function editDistance(a,b){
  a=normalize(a);b=normalize(b);if(Math.abs(a.length-b.length)>3)return 99;
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let left=i,diag=i-1;
    for(let j=1;j<=b.length;j++){
      const old=prev[j];prev[j]=Math.min(prev[j]+1,left+1,diag+(a[i-1]===b[j-1]?0:1));diag=old;left=prev[j];
    }
  }
  return prev[b.length];
}
function suggestion(input,dictionary){
  if(dictionary.some(x=>normalize(x)===normalize(input)))return null;
  const ranked=dictionary.map(x=>({text:x,d:editDistance(input,x)})).sort((a,b)=>a.d-b.d);
  const best=ranked[0];return best&&best.d<=Math.min(3,Math.max(1,Math.floor(normalize(input).length/3)))?best.text:null;
}
function renderTypos(drugs, symList){
  const box=$("typoResults");box.replaceChildren();let count=0;
  for(const [kind,values,dictionary] of [["Medication",drugs,DRUG_DICTIONARY],["Symptom",symList,SYMPTOM_DICTIONARY]]){
    for(const entry of values){const maybe=suggestion(entry,dictionary);if(!maybe)continue;count++;
      const line=add(box,"span",`${kind} “${entry}”: did you mean `,"notice");
      const button=add(line,"button",`${maybe} — use this spelling`,"typo-apply");
      button.type="button";
      button.addEventListener("click",()=>{
        const id=kind==="Medication"?"drugs":"symptoms";
        const field=$(id);
        const values=field.value.split(/\r?\n/);
        const index=values.findIndex(value=>normalize(value)===normalize(entry));
        if(index>=0){values[index]=maybe;field.value=values.join("\n");}
        updateTypos();
        field.focus();
      });
    }
  }
  if(!count)box.textContent="No likely typos found.";
}
function currentInputLines(id, max){return $(id).value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,max);}
function updateTypos(){renderTypos(currentInputLines("drugs",MAX_DRUGS),currentInputLines("symptoms",MAX_SYMPTOMS));}
$("drugs").addEventListener("input",updateTypos);
$("symptoms").addEventListener("input",updateTypos);
updateTypos();
function sectionText(record,key){return (Array.isArray(record[key])?record[key]:[]).filter(x=>typeof x==="string").join("\n");}
function sentences(text){
  // Approximate splitting; official labels include tables and non-sentence fragments.
  return text.replace(/\s+/g," ").split(/(?<=[.!?;])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
}
function containsTerm(text,term){
  const hay=normalize(text),needle=normalize(term);
  return needle!==""&&(" "+hay+" ").includes(" "+needle+" ");
}
function termsFor(sym){
 const key=normalize(sym);
 const up=["glucose increase","increased glucose","increase in glucose","high glucose","high blood glucose","high blood sugar","blood sugar increase","increased blood sugar","elevated glucose","elevated blood sugar","hba1c increase","increased hba1c","hyperglycemia"];
 const down=["glucose decrease","decreased glucose","decrease in glucose","low glucose","low blood glucose","low blood sugar","blood sugar decrease","decreased blood sugar","hypoglycemia"];
 const special=up.includes(key)?"glucose increase":down.includes(key)?"glucose decrease":null;
 const mapKey=special||Object.keys(SYNS).find(k=>[k,...SYNS[k]].some(t=>normalize(t)===key));
 return [...new Set([sym,...(mapKey?SYNS[mapKey]:[])])];
}
// Check term meaning within the clause containing it, not within an unrelated
// preceding sentence or table entry. Text matching cannot provide clinical certainty.
function isUncertain(sentence,term){
 const phrase=normalize(sentence),needle=normalize(term);
 const at=phrase.indexOf(needle);
 const context=at<0?phrase:phrase.slice(Math.max(0,at-45),at);
 return /\b(no evidence of|not reported|not observed|absence of|without evidence of|did not experience|not associated with)\b/.test(context);
}
function direction(sym){
 const key=normalize(sym);
 if(termsFor("glucose increase").some(t=>normalize(t)===key))return "up";
 if(termsFor("glucose decrease").some(t=>normalize(t)===key))return "down";
 return null;
}
function matchSections(record,sym){
 const terms=termsFor(sym),hits=[],dir=direction(sym);
 const fields=[["adverse_reactions","Adverse reactions"],["warnings_and_cautions","Warnings and precautions"],["boxed_warning","Boxed warning"],["warnings","Warnings"],["precautions","Precautions"]];
 for(const [field,title] of fields){
   for(const sentence of sentences(sectionText(record,field))){
     const term=terms.find(t=>containsTerm(sentence,t));if(!term)continue;
     const text=normalize(sentence);
     // Identify explicit risk statements, not just occurrences of a clinical word.
     const risk= /\b(adverse reactions?|side effects?|risk of|may cause|can cause|causes?|reported|occurs?|occurred|associated with|increases?|increased|decreases?|decreased|result in|results in|can lead to|lead to|most common|serious|develop|developed|predispose|warning)\b/.test(text);
     const purelyContextual=/\b(treat|treatment of|indicated for|indications|manage|management|monitor for|monitoring for|control of|glucose control|glycemic control)\b/.test(text);
     const contextual=!risk&&purelyContextual;
     const negated=isUncertain(sentence,term);
     // Hypo-/hyperglycemia are directional; do not collapse both to "glucose change".
     // Any term without credible adverse-effect context is "mentioned", not proof.
     const confirmed=!negated&&(field==="adverse_reactions"||risk)&&!contextual;
     hits.push({section:title,term,excerpt:sentence.slice(0,650),uncertain:!confirmed,contextual});
     if(hits.length>=25)return hits;
   }
 }
 return hits;
}
function briefEvidence(hit,sym){
 const k=normalize(sym);
 if(termsFor("glucose increase").some(t=>normalize(t)===k))return "The label describes increased blood glucose or HbA1c as a possible medication-related effect.";
 if(termsFor("glucose decrease").some(t=>normalize(t)===k))return "The label identifies hypoglycemia (low blood glucose) as a possible medication-related effect.";
 return `The label mentions “${hit.term}” in ${hit.section.toLowerCase()}.`;
}
function interactionHits(record,other){
  const result=[];
  for(const sentence of sentences(sectionText(record,"drug_interactions"))){
    if(containsTerm(sentence,other))result.push(sentence.slice(0,850));
    if(result.length===3)break;
  }
  return result;
}
function dateText(r){const d=String(r.effective_time||"");return /^\d{8}$/.test(d)?`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)}`:"not supplied";}
// Official FDA Drugs@FDA search. This is a search page, not a PDF or an
// exact-version document link. Search drug name there to independently check the text.
const FDA_LABEL_SEARCH = "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm";
function attachFdaLabelSearch(parent){
 const link=add(parent,"a","Search FDA labeling ↗","source-link");
 link.href=FDA_LABEL_SEARCH;
 link.target="_blank";
 link.rel="noopener noreferrer";
 return link;
}
function appendEvidence(parent,hits,empty){
  if(!hits.length){add(parent,"p",empty,"small");return;}
  for(const hit of hits){
    const d=add(parent,"details");add(d,"summary",`${hit.section} · term: ${hit.term}${hit.uncertain?" · context review needed":""}`);
    addHighlightedExcerpt(d,hit.excerpt,hit.term);
  }
}
// Highlight the specific matched term without interpreting source label text as HTML.
function addHighlightedExcerpt(container,excerpt,matchedTerm){
 const block=add(container,'blockquote');
 const source=String(excerpt||'');
 const variants=[matchedTerm].filter(Boolean);
 if(!variants.length){block.textContent=source;return block;}
 const term=variants[0];
 // Match the exact wording present in the label; preserve original punctuation.
 const lower=source.toLocaleLowerCase(), target=String(term).toLocaleLowerCase();
 if(!target){block.textContent=source;return block;}
 let start=0,idx;
 while((idx=lower.indexOf(target,start))>=0){
  block.append(document.createTextNode(source.slice(start,idx)));
  add(block,'mark',source.slice(idx,idx+target.length),'matched-term');
  start=idx+target.length;
 }
 block.append(document.createTextNode(source.slice(start)));
 return block;
}
function renderResults(entries){
  const area=$("results");area.replaceChildren();$("resultsSection").classList.remove("hidden");
  for(const entry of entries){
    const group=add(area,"section",undefined,"group");add(group,"h3",entry.drug);
    if(entry.needsSpecificProduct){
      const notice=add(group,"div",undefined,"compact-row");
      add(notice,"strong","Unable to check","status result-unknown");
      add(notice,"p","Please enter a specific insulin product name (for example, insulin lispro or insulin glargine).","short-result");
      continue; // Do not display symptom-by-symptom results for a broad drug family.
    }
    if(!entry.records.length){
      if(entry.externalLabel){
        const statusRow=add(group,"div",undefined,"compact-head");
        add(statusRow,"span","Analysis unavailable","status result-unknown");
        add(group,"p","Official FDA labeling found. Automated analysis is not yet available. Please review the labeling or check back later.","short-result");
      }else{
        const statusRow=add(group,"div",undefined,"compact-head");
        add(statusRow,"span","Analysis unavailable","status result-unknown");
        add(group,"p","MedSymp could not verify or analyze an FDA label for this medication. Check the drug name and review FDA labeling.","short-result");
      }
      if(entry.externalLabel?.url && /^https:\/\/www\.accessdata\.fda\.gov\//.test(entry.externalLabel.url)) {
        const link=add(group,'a','View FDA application information ↗','source-link');
        link.href=entry.externalLabel.url;link.target='_blank';link.rel='noopener noreferrer';
      } else attachFdaLabelSearch(group);
      continue;
    }
    for(const symptom of symptoms){
      const matched=entry.records.map(record=>({record,hits:matchSections(record,symptom)})).filter(x=>x.hits.length);
      const confirmed=matched.find(x=>x.hits.some(h=>!h.uncertain));
      const possible=matched[0];
      const status=confirmed?"Yes":possible?"Mentioned":entry.incomplete?"Unable to check":"No";
      const card=add(group,"div",undefined,"compact-row");
      const head=add(card,"div",undefined,"compact-head");add(head,"strong",symptom);
      add(head,"span",status,"status "+(status==="Yes"?"result-yes":status==="No"?"result-no":"result-unknown"));
      const best=confirmed||possible;
      const hit=best&&(best.hits.find(h=>!h.uncertain)||best.hits[0]);
      const summary=status==="Yes"?briefEvidence(hit,symptom)
        :status==="Mentioned"?"The label contains related wording, but the context does not establish it as an adverse effect. Check the excerpt."
        :status==="No"?"No matching adverse-effect information found in the checked FDA label sections."
        :"FDA search was incomplete; a No result cannot be confirmed. Please retry.";
      add(card,"p",summary,"short-result");
      const record=best?.record||entry.records[0];
      attachFdaLabelSearch(card);
      add(card,"span",` · record date ${dateText(record)}`,"meta");
      if(hit && (status==="Yes"||status==="Mentioned")){const evidence=add(card,"details",undefined,"label-evidence");add(evidence,"summary","View matched label text");add(evidence,"span",hit.section,"meta");addHighlightedExcerpt(evidence,hit.excerpt,hit.term);}
    }
  }
}
$("searchBtn").addEventListener("click",async()=>{
  const own=++runId;$("resultsSection").classList.add("hidden");
  let drugs;try{drugs=lines($( "drugs").value,MAX_DRUGS,"medication");symptoms=lines($("symptoms").value,MAX_SYMPTOMS,"symptom");}catch(err){setMessage(err.message,true);return;}
  renderTypos(drugs,symptoms);
  $("searchBtn").disabled=true;setMessage(`Checking FDA labels for ${drugs.length} medication(s) automatically…`);
  try{
    found=await Promise.all(drugs.map(async drug=>{try{return await searchDrug(drug);}catch(err){return {drug,records:[],incomplete:true,error:err.message};}}));
    if(own!==runId)return;
    renderResults(found);
    setMessage("",false);

  }finally{if(own===runId)$("searchBtn").disabled=false;}
});
$("clearBtn").addEventListener("click",()=>{
  runId++;$("drugs").value="";$("symptoms").value="";found=[];symptoms=[];
  $("resultsSection").classList.add("hidden");$("searchBtn").disabled=false;setMessage("");updateTypos();
});

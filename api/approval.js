// FDA approval verification endpoint; no data retention, no fabricated labels.
// GET /api/approval?drug=JUVMO
const ENDPOINTS=['https://api.fda.gov/drug/drugsfda.json','https://api.fda.gov/drug/ndc.json'];
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const FDA_PAGE='https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm';
function applicationId(raw){const v=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const m=v.match(/^(?:NDA|ANDA|BLA)(\d{5,7})$/);return m?m[1]:null;}
function matches(r,wanted,type){
 if(type==='drugsfda')return (r.products||[]).some(p=>norm(p.brand_name)===wanted||(p.active_ingredients||[]).some(i=>norm(i.name)===wanted));
 return norm(r.brand_name)===wanted||norm(r.generic_name)===wanted||norm(r.substance_name)===wanted||(r.active_ingredients||[]).some(i=>norm(i.name)===wanted);
}
async function query(url){const c=new AbortController();const t=setTimeout(()=>c.abort(),6500);try{const r=await fetch(url,{signal:c.signal});if(!r.ok)return [];const j=await r.json();return Array.isArray(j.results)?j.results:[];}catch{return [];}finally{clearTimeout(t);}}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const drug=String(req.query?.drug||'').trim();
 if(!drug||drug.length>90||!/^[a-z0-9 ,+().\-]+$/i.test(drug))return res.status(400).json({error:'Invalid drug name'});
 const wanted=norm(drug);
 const specs=[
  ['drugsfda',0,`products.brand_name.exact:"${drug}"`],
  ['drugsfda',0,`products.active_ingredients.name.exact:"${drug}"`],
  ['ndc',1,`brand_name.exact:"${drug}"`],
  ['ndc',1,`generic_name.exact:"${drug}"`],
  ['drugsfda',0,`products.brand_name:${drug.split(/\s+/).join('+')}`],
  ['ndc',1,`brand_name:${drug.split(/\s+/).join('+')}`]
 ];
 for(const [type,index,queryText] of specs){
  const url=new URL(ENDPOINTS[index]);url.searchParams.set('search',queryText);url.searchParams.set('limit','100');
  const results=await query(url);
  for(const item of results){
   if(!matches(item,wanted,type))continue;
   const app=applicationId(type==='drugsfda'?item.application_number:item.application_number);
   if(!app)continue;
   const page=new URL(FDA_PAGE);page.searchParams.set('event','overview.process');page.searchParams.set('ApplNo',app);
   res.setHeader('Cache-Control','public,max-age=1800,s-maxage=3600');
   return res.status(200).json({verified:true,url:page.toString(),application:app,source:'FDA application database'});
  }
 }
 return res.status(200).json({verified:false});
}

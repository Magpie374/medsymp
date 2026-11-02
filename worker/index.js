// MedSymp SPL relay — fixed-upstream, read-only proxy. No medical inputs stored.
const ORIGIN = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Accept','Cache-Control':'public, max-age=900'};
function response(body,status=200,kind='text/plain; charset=utf-8') {return new Response(body,{status,headers:{...cors,'Content-Type':kind}});}
export default { async fetch(request) {
 if(request.method==='OPTIONS') return response('',204);
 if(request.method!=='GET') return response('Method not allowed',405);
 const url=new URL(request.url);
 let upstream, kind;
 const match=url.pathname.match(/^\/spl\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i);
 if(match) {upstream=`${ORIGIN}/spls/${match[1]}.xml`;kind='application/xml; charset=utf-8';}
 else if(url.pathname==='/find') {
   const drug=(url.searchParams.get('drug')||'').trim();
   if(!drug || drug.length>100 || !/^[a-z0-9 ,+().\-]+$/i.test(drug))return response('Invalid medication name',400);
   const params=new URLSearchParams({drug_name:drug,name_type:'both',pagesize:'100'});
   upstream=`${ORIGIN}/spls.json?${params}`;kind='application/json; charset=utf-8';
 } else return response('Not found',404);
 try {
  const res=await fetch(upstream,{headers:{Accept:kind.includes('json')?'application/json':'application/xml'},cf:{cacheTtl:900,cacheEverything:true}});
  if(!res.ok)return response(`SPL source returned ${res.status}`,res.status);
  const length=Number(res.headers.get('content-length')||0);
  if(length>4_000_000)return response('SPL document too large',413);
  // Cap streamed document to 4MB even without Content-Length.
  const reader=res.body.getReader();const chunks=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
    if(total>4_000_000){await reader.cancel();return response('SPL document too large',413);}chunks.push(value);}
  return new Response(new Blob(chunks),{status:200,headers:{...cors,'Content-Type':kind}});
 }catch {return response('Label service unavailable',502);}
}};

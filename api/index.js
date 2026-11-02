// Same-origin relay to public DailyMed SPL v2 endpoints. Read-only, no inputs stored.
// GET /api/find?drug=<name> ; GET /api/spl/<uuid>
const ORIGIN = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const url = new URL(req.url,'https://medsymp.example');
  let upstream, contentType;
  if(url.pathname === '/api/find' || url.searchParams.get('mode') === 'find'){
    const drug=(url.searchParams.get('drug')||'').trim();
    if(!drug || drug.length>100 || !/^[a-z0-9 ,+().\-]+$/i.test(drug)) return res.status(400).send('Invalid medication name');
    const qs=new URLSearchParams({drug_name:drug,name_type:'both',pagesize:'100'});
    upstream=`${ORIGIN}/spls.json?${qs}`;contentType='application/json; charset=utf-8';
  } else {
    const m=url.pathname.match(/^\/api\/spl\/([^/]+)$/) || (url.searchParams.get('setid') ? [null,url.searchParams.get('setid')] : null);
    if(!m || !UUID.test(m[1])) return res.status(404).send('Not found');
    upstream=`${ORIGIN}/spls/${m[1]}.xml`;contentType='application/xml; charset=utf-8';
  }
  const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),12000);
  try {
    const response=await fetch(upstream,{signal:ctrl.signal,headers:{Accept:contentType.split(';')[0]}});
    if(!response.ok)return res.status(response.status).send('Label source unavailable');
    const array=await response.arrayBuffer();
    if(array.byteLength>4_000_000)return res.status(413).send('Label document too large');
    res.setHeader('Content-Type',contentType);
    res.setHeader('Cache-Control','public, max-age=300, s-maxage=900');
    return res.status(200).send(Buffer.from(array));
  } catch(error){return res.status(502).send('Label service unavailable');}
  finally {clearTimeout(timer);}
}

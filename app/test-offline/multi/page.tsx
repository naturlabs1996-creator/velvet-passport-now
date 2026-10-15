"use client";
import {useEffect,useState} from "react";
const routes=[{id:"a",name:"Parcours A",tone:1},{id:"b",name:"Parcours B",tone:3}];
const version="vp-offline-06-v1";
function paths(id:string){const tone=id==="a"?1:3;return [`/test-offline/media/visuel/${tone}`,`/test-offline/media/audio/${tone}`];}
export default function Multi(){
 const [status,setStatus]=useState("Commence avec le Wi-Fi actif.");
 const [state,setState]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState(false);
 const [hydrated,setHydrated]=useState(false);
 async function inspect(){
  const next:Record<string,boolean>={};
  for(const route of routes){
   const cache=await caches.open(version+"-"+route.id);
   const entries=await Promise.all(["/test-offline/multi",...paths(route.id)].map(p=>cache.match(p)));
   next[route.id]=entries.every(Boolean);
  }
  setState(next);return next;
 }
 useEffect(()=>{setHydrated(true);void inspect().catch(()=>setStatus("Stockage indisponible."));},[]);
 async function download(id:string){
  if(busy)return;setBusy(true);setStatus("Téléchargement "+id.toUpperCase()+"…");
  const staging=version+"-"+id+"-staging",destination=version+"-"+id;
  try{
   if(!("serviceWorker" in navigator))throw Error("Service worker indisponible");
   const reg=await navigator.serviceWorker.register("/test-offline/sw.js",{scope:"/"});
   await navigator.serviceWorker.ready;await reg.update();
   if(!navigator.serviceWorker.controller)await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(Error("Service worker non actif")),6000);navigator.serviceWorker.addEventListener("controllerchange",()=>{clearTimeout(t);resolve();},{once:true});});
   await caches.delete(staging);const temp=await caches.open(staging);
   const htmlResponse=await fetch("/test-offline/multi",{cache:"no-store",headers:{"X-VP-Offline-Package":"1"}});
   if(!htmlResponse.ok)throw Error("Page inaccessible");
   if(!htmlResponse.headers.get("content-type")?.includes("text/html"))throw Error("La réponse n’est pas HTML");
   const html=await htmlResponse.text();
   if(!html.includes("OFFLINE-06"))throw Error("Page HTML incorrecte");
   const doc=new DOMParser().parseFromString(html,"text/html");
   const assets=new Set<string>();
   for(const node of doc.querySelectorAll("script[src],link[rel=stylesheet][href],link[rel=modulepreload][href]")){const raw=node.getAttribute("src")||node.getAttribute("href");if(!raw)continue;const url=new URL(raw,location.origin);if(url.origin===location.origin&&url.pathname.startsWith("/_next/static/"))assets.add(url.href);}
   await temp.put("/test-offline/multi",new Response(html,{headers:{"Content-Type":"text/html"}}));
   for(const asset of assets){const r=await fetch(asset,{cache:"reload"});if(!r.ok)throw Error("Ressource indisponible");await temp.put(asset,r);}
   for(const p of paths(id)){
    const r=await fetch(p,{cache:"reload"});
    if(!r.ok)throw Error("Fichier inaccessible : "+p);
    const data=await r.arrayBuffer();
    const type=r.headers.get("content-type")||"";
    if(p.includes("/visuel/")){
     if(!type.includes("image/svg+xml")||data.byteLength<50||!new TextDecoder().decode(data).includes("<svg"))throw Error("Illustration invalide : "+p);
    }else if(p.includes("/audio/")){
     if(!type.includes("audio/wav")||data.byteLength<1000)throw Error("Audio invalide : "+p);
    }else if(!data.byteLength)throw Error("Fichier vide : "+p);
    await temp.put(p,new Response(data,{headers:{"Content-Type":r.headers.get("content-type")||"application/octet-stream"}}));
   }
   const checks=await Promise.all(["/test-offline/multi",...assets,...paths(id)].map(p=>temp.match(p)));
   if(checks.some(r=>!r))throw Error("Paquet incomplet");
   const target=await caches.open(destination);
   for(const p of ["/test-offline/multi",...assets,...paths(id)]){const r=await temp.match(p);if(!r)throw Error("Fichier manquant");await target.put(p,r);}
   await caches.delete(staging);
   const check=await inspect();if(!check[id])throw Error("Cache final incomplet");
   setStatus("Parcours "+id.toUpperCase()+" téléchargé et vérifié, page comprise.");
  }catch(e){await caches.delete(staging);setStatus("ÉCHEC : "+(e instanceof Error?e.message:"inconnu"));}
  finally{setBusy(false);}
 }
 async function verify(){
  const result=await inspect();
  let probe: {a?:boolean;b?:boolean;media?:boolean[];version?:string}|null=null;
  try{
   const r=await fetch("/test-offline/offline-probe",{cache:"no-store"});
   if(r.ok)probe=await r.json();
  }catch{}
  const worker=!!navigator.serviceWorker?.controller;
  const pass=!!(result.a&&result.b&&worker&&probe?.a&&probe?.b&&probe?.media?.every(Boolean)&&probe.version==="offline06-probe-2");
  setStatus(pass?"SUCCÈS : les deux pages et les quatre médias sont trouvés directement par le Service Worker. Coupe le Wi-Fi.":"NON VALIDÉ : A="+result.a+", B="+result.b+", Service Worker="+worker+", sonde="+JSON.stringify(probe)+". Garde le Wi-Fi.");
 }
 return <main style={{maxWidth:650,margin:"2rem auto",padding:"0 1rem",fontFamily:"system-ui"}}>
  <h1>OFFLINE-06 — Deux parcours indépendants</h1>
  <p>Laboratoire technique : chaque parcours possède son cache séparé, une image et un son de démonstration.</p>
  <p role="status">{status}</p><p role="status"><strong>Diagnostic JavaScript : {hydrated?"ACTIF — boutons connectés":"INACTIF — page non initialisée"}</strong></p><p><strong>Important :</strong> la mention READY de Vercel ne suffit pas. N’éteins le Wi-Fi qu’après le message SUCCÈS de vérification.</p>
  {routes.map(r=><section key={r.id} style={{padding:16,marginBottom:18,border:"1px solid #888",borderRadius:8}}>
   <h2>{r.name} — {state[r.id]?"Téléchargé":"Non vérifié"}</h2>
   <button disabled={busy} onClick={()=>void download(r.id)}>Télécharger {r.name}</button>
   <p><img src={paths(r.id)[0]} alt={"Image "+r.name} style={{width:"100%",maxWidth:320}} /></p>
   <audio controls preload="none" src={paths(r.id)[1]}/>
  </section>)}
  <button disabled={busy} onClick={()=>void verify()}>Vérifier les deux parcours (sonde hors réseau)</button>
  <p>Test : télécharge A puis B avec Wi-Fi. Attends le message SUCCÈS de la sonde, puis coupe le Wi-Fi, actualise et réécoute les deux sons. Ferme et rouvre la même adresse hors ligne. Utilise le même navigateur pour toutes les étapes.</p>
 </main>;
}
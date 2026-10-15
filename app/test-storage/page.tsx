"use client";
import {useEffect,useState} from "react";
const BASE="vp-storage-01-baseline-v1",TEMP="vp-storage-01-staging-v1";
const FILES=["/test-offline/media/visuel/1","/test-offline/media/audio/1"];
async function signature(cacheName:string){
 const cache=await caches.open(cacheName);
 const sizes:number[]=[];
 for(const path of FILES){const r=await cache.match(path);sizes.push(r?(await r.arrayBuffer()).byteLength:0);}
 return sizes;
}
export default function StorageLab(){
 const [status,setStatus]=useState("Wi-Fi activé : prépare d’abord le parcours témoin.");
 const [baseline,setBaseline]=useState(false);
 const [busy,setBusy]=useState(false);
 const [estimate,setEstimate]=useState("Non mesuré");
 useEffect(()=>{void signature(BASE).then(a=>setBaseline(a.every(n=>n>0))).catch(()=>{});},[]);
 async function storageEstimate(){
  try{
   if(!navigator.storage?.estimate)throw Error("API indisponible");
   const e=await navigator.storage.estimate();
   setEstimate("Utilisé : "+Math.round((e.usage||0)/1024)+" Ko ; quota estimé : "+Math.round((e.quota||0)/1024/1024)+" Mo");
  }catch(e){setEstimate("Estimation indisponible : "+String(e));}
 }
 async function run(){
  if(busy)return;setBusy(true);setStatus("Téléchargement du parcours témoin…");
  try{
   if(!("caches" in window))throw Error("Cache Storage indisponible");

   await caches.delete(TEMP);const staging=await caches.open(TEMP);
   for(let i=0;i<FILES.length;i++){
    const path=FILES[i];
    const r=await fetch(path,{cache:"reload"});
    if(!r.ok)throw Error("Ressource inaccessible : "+path);
    const data=await r.arrayBuffer();
    if(data.byteLength<100)throw Error("Ressource trop courte : "+path);
    await staging.put(path,new Response(data,{headers:{"Content-Type":r.headers.get("content-type")||"application/octet-stream"}}));

   }
   const verified=await signature(TEMP);
   if(!verified.every(n=>n>0))throw Error("Paquet incomplet");
   const target=await caches.open(BASE);
   for(const path of FILES){const r=await staging.match(path);if(!r)throw Error("Fichier manquant");await target.put(path,r);}
   await caches.delete(TEMP);
   const after=await signature(BASE);setBaseline(after.every(n=>n>0));
   setStatus(after.every(n=>n>0)?"TÉMOIN PRÊT : deux médias sauvegardés. Lance maintenant la panne simulée.":"ÉCHEC : témoin incomplet");
  }catch(e){
   await caches.delete(TEMP).catch(()=>{});
   const after=await signature(BASE).catch(()=>[0,0]);
   const same=after.every(n=>n>0);
   setBaseline(after.every(n=>n>0));
   setStatus("ÉCHEC ATTENDU : "+(e instanceof Error?e.name+": "+e.message:String(e))+" — témoin préservé : "+(same?"OUI":"NON")+".");
  }finally{setBusy(false);}
 }
 async function simulate(){
  if(busy)return;
  const before=await signature(BASE).catch(()=>[0,0]);
  setBusy(true);setStatus("Simulation du stockage saturé…");
  try{
   if(!before.every(n=>n>0))throw Error("Témoin absent : prépare-le d’abord");
   await caches.delete(TEMP);const staging=await caches.open(TEMP);
   const r=await fetch(FILES[0],{cache:"reload"});if(!r.ok)throw Error("Fichier indisponible");
   await staging.put(FILES[0],r);
   throw new DOMException("QuotaExceededError simulé après la première écriture","QuotaExceededError");
  }catch(e){
   await caches.delete(TEMP).catch(()=>{});
   const after=await signature(BASE);
   const preserved=before.every((n,i)=>n===after[i]&&n>0);
   const temp=await caches.open(TEMP);const partial=await temp.keys();
   setStatus((preserved&&partial.length===0?"SUCCÈS STORAGE-01 : ":"ÉCHEC STORAGE-01 : ")+(e instanceof Error?e.name:"Erreur")+" ; parcours témoin préservé : "+(preserved?"OUI":"NON")+" ; fichiers temporaires : "+partial.length+".");
  }finally{setBusy(false);}
 }
 return <main style={{maxWidth:650,margin:"2rem auto",padding:"0 1rem",fontFamily:"system-ui",lineHeight:1.6}}>
  <h1>STORAGE-01 — Résistance du stockage</h1>
  <p>Simulation contrôlée d’un stockage saturé. Ne remplit pas la mémoire et ne supprime pas les autres parcours.</p>
  <p role="status" style={{border:"2px solid #666",padding:12}}>{status}</p>
  <p>Parcours témoin : <strong>{baseline?"Présent":"Non confirmé"}</strong></p>
  <button disabled={busy} onClick={()=>void run()}>1. Préparer le parcours témoin</button>
  <p><button disabled={busy||!baseline} onClick={()=>void simulate()}>2. Simuler stockage saturé</button></p>
  <p><button disabled={busy} onClick={()=>void storageEstimate()}>Afficher l’espace estimé</button></p>
  <p>{estimate}</p>
  <p><img src={FILES[0]} alt="Illustration témoin" style={{width:"100%",maxWidth:320}}/></p>
  <audio controls preload="none" src={FILES[1]}/>
  <p>Le succès confirme uniquement la simulation d’un refus d’écriture et la préservation du témoin, pas une saturation réelle du téléphone.</p>
 </main>;
}
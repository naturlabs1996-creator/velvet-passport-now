"use client";
import {useEffect,useState} from "react";
const routes=[{id:"a",name:"Parcours A",tone:1},{id:"b",name:"Parcours B",tone:3}];
const version="vp-offline-06-v1";
function paths(id:string){const tone=id==="a"?1:3;return [`/test-offline/media/visuel/${tone}`,`/test-offline/media/audio/${tone}`];}
export default function Multi(){
 const [status,setStatus]=useState("Commence avec le Wi-Fi actif.");
 const [state,setState]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState(false);
 async function inspect(){
  const next:Record<string,boolean>={};
  for(const route of routes){
   const cache=await caches.open(version+"-"+route.id);
   const entries=await Promise.all(paths(route.id).map(p=>cache.match(p)));
   next[route.id]=entries.every(Boolean);
  }
  setState(next);return next;
 }
 useEffect(()=>{void inspect().catch(()=>setStatus("Stockage indisponible."));},[]);
 async function download(id:string){
  if(busy)return;setBusy(true);setStatus("Téléchargement "+id.toUpperCase()+"…");
  const staging=version+"-"+id+"-staging",destination=version+"-"+id;
  try{
   await caches.delete(staging);const temp=await caches.open(staging);
   for(const p of paths(id)){
    const r=await fetch(p,{cache:"reload"});
    if(!r.ok)throw Error("Fichier inaccessible : "+p);
    const data=await r.arrayBuffer();
    if(data.byteLength<1000)throw Error("Fichier vide ou trop court : "+p);
    await temp.put(p,new Response(data,{headers:{"Content-Type":r.headers.get("content-type")||"application/octet-stream"}}));
   }
   const checks=await Promise.all(paths(id).map(p=>temp.match(p)));
   if(checks.some(r=>!r))throw Error("Paquet incomplet");
   const target=await caches.open(destination);
   for(const p of paths(id)){const r=await temp.match(p);if(!r)throw Error("Fichier manquant");await target.put(p,r);}
   await caches.delete(staging);
   await inspect();setStatus("Parcours "+id.toUpperCase()+" téléchargé et vérifié.");
  }catch(e){await caches.delete(staging);setStatus("ÉCHEC : "+(e instanceof Error?e.message:"inconnu"));}
  finally{setBusy(false);}
 }
 async function verify(){
  const result=await inspect();
  setStatus(result.a&&result.b?"SUCCÈS : les deux parcours sont conservés. Coupe le Wi-Fi, actualise, puis teste les deux sons.":"ATTENTION : au moins un parcours manque.");
 }
 return <main style={{maxWidth:650,margin:"2rem auto",padding:"0 1rem",fontFamily:"system-ui"}}>
  <h1>OFFLINE-06 — Deux parcours indépendants</h1>
  <p>Laboratoire technique : chaque parcours possède son cache séparé, une image et un son de démonstration.</p>
  <p role="status">{status}</p>
  {routes.map(r=><section key={r.id} style={{padding:16,marginBottom:18,border:"1px solid #888",borderRadius:8}}>
   <h2>{r.name} — {state[r.id]?"Téléchargé":"Non vérifié"}</h2>
   <button disabled={busy} onClick={()=>void download(r.id)}>Télécharger {r.name}</button>
   <p><img src={paths(r.id)[0]} alt={"Image "+r.name} style={{width:"100%",maxWidth:320}} /></p>
   <audio controls preload="none" src={paths(r.id)[1]}/>
  </section>)}
  <button onClick={()=>void verify()}>Vérifier les deux parcours</button>
  <p>Test : télécharge A puis B avec Wi-Fi, vérifie les deux, coupe le Wi-Fi, actualise et réécoute les deux sons. Ferme et rouvre la même adresse hors ligne.</p>
 </main>;
}
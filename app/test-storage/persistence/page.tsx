"use client";
import {useEffect,useState} from "react";
const CACHE="vp-storage-02-marker-v1",KEY="/test-storage/persistence-marker";
export default function PersistenceLab(){
 const [status,setStatus]=useState("Diagnostic non commencé.");
 const [details,setDetails]=useState("");
 const [busy,setBusy]=useState(false);
 const [exists,setExists]=useState(false);
 useEffect(()=>{void (async()=>{try{const c=await caches.open(CACHE);const r=await c.match(KEY);setExists(!!r);if(r)setStatus("Témoin conservé depuis la visite précédente.");}catch{setStatus("Cache Storage indisponible.");}})();},[]);
 async function check(){
  if(busy)return;setBusy(true);setStatus("Vérification en cours…");
  try{
   if(!navigator.storage?.estimate)throw Error("API Storage indisponible");
   const before=await navigator.storage.persisted?.();
   let requested:"accordé"|"refusé"|"indisponible"="indisponible";
   if(navigator.storage.persist){requested=await navigator.storage.persist()?"accordé":"refusé";}
   const after=await navigator.storage.persisted?.();
   const estimate=await navigator.storage.estimate();
   const cache=await caches.open(CACHE);
   const marker=JSON.stringify({createdAt:new Date().toISOString(),version:1});
   await cache.put(KEY,new Response(marker,{headers:{"Content-Type":"application/json"}}));
   const response=await cache.match(KEY);
   if(!response||await response.text()!==marker)throw Error("Lecture du témoin impossible");
   setExists(true);
   setDetails("Protection avant : "+String(before)+" ; demande : "+requested+" ; protection après : "+String(after)+" ; usage estimé : "+Math.round((estimate.usage||0)/1024)+" Ko ; quota estimé : "+Math.round((estimate.quota||0)/1048576)+" Mo.");
   setStatus(after?"PROTECTION ACCORDÉE — témoin écrit et relu.":"PROTECTION NON ACCORDÉE — témoin écrit et relu, mais le navigateur peut supprimer les caches.");
  }catch(e){setStatus("ÉCHEC DIAGNOSTIC : "+(e instanceof Error?e.message:String(e)));}
  finally{setBusy(false);}
 }
 async function recheck(){
  try{const c=await caches.open(CACHE);const r=await c.match(KEY);setExists(!!r);setStatus(r?"TÉMOIN RETROUVÉ — conservation confirmée après cette réouverture.":"TÉMOIN ABSENT — données effacées ou autre origine/navigateur.");}catch(e){setStatus("Vérification impossible : "+String(e));}
 }
 return <main style={{maxWidth:650,margin:"2rem auto",padding:"0 1rem",fontFamily:"system-ui",lineHeight:1.6}}>
 <h1>STORAGE-02 — Persistance du stockage</h1>
 <p>Cette page demande au navigateur de conserver les données du site et enregistre un petit témoin. Aucune donnée personnelle ni GPS n'est enregistrée.</p>
 <p role="status" style={{padding:14,border:"2px solid #666",fontWeight:700}}>{status}</p>
 <p>{details}</p>
 <p>Témoin local : <strong>{exists?"présent":"non détecté"}</strong></p>
 <button disabled={busy} onClick={()=>void check()}>1. Vérifier et demander la protection</button>
 <p><button disabled={busy} onClick={()=>void recheck()}>2. Vérifier le témoin après réouverture</button></p>
 <p>Test : avec Wi-Fi, appuie sur 1. Ferme l'onglet, rouvre la même adresse dans le même navigateur, puis appuie sur 2. Le résultat prouve uniquement la conservation durant cet intervalle, jamais une garantie permanente.</p>
 </main>;
}
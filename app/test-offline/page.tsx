"use client";
import { useEffect, useState } from "react";
import { NowRouteNavigator } from "../../lib/now-route-navigator";
const stops=Array.from({length:5},(_,i)=>({id:String(i+1),title:"Arrêt "+(i+1),description:"Histoire de démonstration "+(i+1)+". Contenu technique, non historique."}));
const media=Array.from({length:5},(_,i)=>i+1).flatMap(n=>[`/test-offline/media/visuel/${n}`,`/test-offline/media/audio/${n}`]);
const CACHE="vp-offline-lab-v4", STAGING="vp-offline-lab-v4-staging";
export default function OfflineLab(){
 const [message,setMessage]=useState("Préparation non commencée.");
 const [ready,setReady]=useState(false);
 useEffect(()=>{if(!("serviceWorker" in navigator))setMessage("Service worker non disponible.");},[]);
 async function prepare(){
  setReady(false);setMessage("Préparation des 5 arrêts…");
  try{
   if(!("serviceWorker" in navigator))throw Error("Service worker indisponible");
   const reg=await navigator.serviceWorker.register("/test-offline/sw.js",{scope:"/"});
   await navigator.serviceWorker.ready;await reg.update();
   if(!reg.active)throw Error("Service worker non actif");
   if(!navigator.serviceWorker.controller)await new Promise<void>((resolve,reject)=>{
    const t=setTimeout(()=>reject(Error("Page non contrôlée par le service worker")),6000);
    navigator.serviceWorker.addEventListener("controllerchange",()=>{clearTimeout(t);resolve();},{once:true});
   });
   const response=await fetch("/test-offline",{cache:"reload"});
   if(!response.ok)throw Error("HTML indisponible");
   const html=await response.text();
   if(!html.includes("Velvet Passport"))throw Error("HTML inattendu");
   const doc=new DOMParser().parseFromString(html,"text/html");
   const assets=new Set<string>();
   for(const el of doc.querySelectorAll("script[src],link[rel='stylesheet'][href],link[rel='modulepreload'][href]")){
    const raw=el.getAttribute("src")||el.getAttribute("href");
    if(!raw)continue;const url=new URL(raw,location.origin);
    if(url.origin===location.origin&&url.pathname.startsWith("/_next/static/"))assets.add(url.href);
   }
   await caches.delete(STAGING);
   const staging=await caches.open(STAGING);
   await staging.put("/test-offline",new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8"}}));
   const resources=[...assets,...media];
   let bytes=new TextEncoder().encode(html).length;
   for(let i=0;i<resources.length;i++){
    const path=resources[i];
    setMessage(`Téléchargement ${i+1}/${resources.length}…`);
    const r=await fetch(path,{cache:"reload"});
    if(!r.ok)throw Error("Fichier indisponible : "+path);
    const body=await r.arrayBuffer();
    if(!body.byteLength)throw Error("Fichier vide : "+path);
    if(path.includes("/visuel/")&&!r.headers.get("content-type")?.includes("image/svg+xml"))throw Error("Image invalide : "+path);
    if(path.includes("/audio/")&&(!r.headers.get("content-type")?.includes("audio/wav")||body.byteLength<1000))throw Error("Audio invalide : "+path);
    bytes+=body.byteLength;
    await staging.put(path,new Response(body,{headers:{"Content-Type":r.headers.get("content-type")||"application/octet-stream"}}));
   }
   for(const path of ["/test-offline",...resources]){
    const r=await staging.match(path);
    if(!r||!(await r.arrayBuffer()).byteLength)throw Error("Vérification échouée : "+path);
   }
   // Publish only after all resources pass verification.
   const active=await caches.open(CACHE);
   for(const path of ["/test-offline",...resources]){
    const r=await staging.match(path);if(!r)throw Error("Cache incomplet : "+path);
    await active.put(path,r);
   }
   await caches.delete(STAGING);
   const missing=await Promise.all(media.map(p=>active.match(p)));
   if(missing.some(r=>!r))throw Error("Média manquant après publication");
   setReady(true);
   setMessage(`Téléchargement vérifié : 5 images + 5 sons, ${(bytes/1024).toFixed(0)} Ko au total. Tu peux couper le Wi-Fi.`);
  }catch(e){
   await caches.delete(STAGING).catch(()=>{});
   setMessage("ÉCHEC — téléchargement incomplet : "+(e instanceof Error?e.message:"erreur inconnue")+". Garde le Wi-Fi.");
  }
 }
 return <main style={{maxWidth:680,margin:"2rem auto",padding:"0 1rem",fontFamily:"system-ui",lineHeight:1.6}}>
  <h1>Velvet Passport NOW — OFFLINE-04</h1>
  <p>Laboratoire de 5 arrêts avec 5 images et 5 tonalités audio distinctes (pas des narrations historiques).</p>
  <button type="button" onClick={prepare} style={{padding:12}}>Télécharger les 5 arrêts (10 médias)</button>
  <p role="status">{message}</p>
  {ready&&<p>Après vérification : coupe le Wi-Fi, teste les cinq sons et images, actualise puis ferme et rouvre cette même adresse.</p>}
  {stops.map((stop,i)=><section key={stop.id} style={{borderTop:"1px solid #ccc",marginTop:18}}>
   <h2>{stop.title}</h2><p>{stop.description}</p>
   <img src={`/test-offline/media/visuel/${i+1}`} alt={`Image de test de l'arrêt ${i+1}`} style={{width:"100%",maxWidth:420}}/>
   <div><audio controls preload="none" src={`/test-offline/media/audio/${i+1}`}/></div>
  </section>)}
  <NowRouteNavigator city="quebec" routeId="offline-lab-v4" routeTitle="OFFLINE-04 — 5 arrêts" stops={stops}/>
  <p>Test de laboratoire uniquement : stockage et lecture des véritables parcours restent à certifier.</p>
 </main>;
}
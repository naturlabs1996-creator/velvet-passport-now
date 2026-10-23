"use client";
import { useState } from "react";
import styles from "./studio.module.css";
type Result={action:string;result:string;issues?:string[];reason?:string;mode?:string};
export default function StudioActions(){
 const [busy,setBusy]=useState<string|null>(null);
 const [result,setResult]=useState<Result|null>(null);
 async function execute(action:"prepare"|"verify") {
  setBusy(action);setResult(null);
  try {
   const response=await fetch("/api/studio/commands",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({route_id:"VP-PAR-05",action})});
   const body=await response.json() as Result;
   setResult(body);
  }catch {setResult({action,result:"ERROR",reason:"Unable to read production status. No operation was started."});}
  finally{setBusy(null);}
 }
 return <section className={styles.card}>
  <h3>Production commands — Paris 05</h3>
  <p>Préparer et Vérifier évaluent les conditions réelles du parcours sans modifier les masters.</p>
  <div className={styles.actionButtons}>
   <button type="button" disabled={busy!==null} onClick={()=>void execute("prepare")}>Préparer</button>
   <button type="button" disabled={busy!==null} onClick={()=>void execute("verify")}>Vérifier</button>
   <button type="button" disabled title="Asset rights, subtitles and audiovisual QA not complete">Monter — verrouillé</button>
   <button type="button" disabled title="Publication unavailable until commercial validation">Publier — verrouillé</button>
  </div>
  {busy&&<p role="status">Contrôle en cours…</p>}
  {result&&<div aria-live="polite" className={styles.commandResult}>
   <strong>{result.action}: {result.result}</strong>
   {result.reason&&<p>{result.reason}</p>}
   {result.issues&&result.issues.length>0&&<ul>{result.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
   <small>Aucun rendu ni publication déclenché.</small>
  </div>}
 </section>;
}

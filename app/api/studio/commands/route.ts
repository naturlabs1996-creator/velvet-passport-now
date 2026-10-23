import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Manifest = {
 route_id:string; segments:{id:string;status:string}[];
 languages:Record<string,{audio_master?:string;source_artifact?:{run_id:number;artifact_id:number};subtitle_file?:string|null;listening_qa_passed?:boolean}>;
 assets:{id:string;rights_status:string;local_file?:string|null;use_in_export?:boolean}[];
 rights_signoff:boolean; visual_qa_passed:boolean; timelines?:Record<string,unknown[]>; exports?:Record<string,string|null>;
};
export async function POST(request:Request) {
 const origin=request.headers.get("origin");
 const host=request.headers.get("host");
 if (origin && (!host || new URL(origin).host !== host)) return NextResponse.json({error:"Origin refused"},{status:403});
 const body=await request.json().catch(()=>null) as {action?:string;route_id?:string}|null;
 if(!body||body.route_id!=="VP-PAR-05"||!["prepare","verify","mount","publish"].includes(body.action||"")){
  return NextResponse.json({error:"Unknown request"},{status:400});
 }
 if(body.action==="publish"){
  return NextResponse.json({route_id:body.route_id,action:body.action,result:"BLOCKED",reason:"Release and rendering commands require a reviewed job dispatcher and explicit rights/QA signoff; no changes made."},{status:409,headers:{"Cache-Control":"no-store"}});
 }
 const filepath=path.join(process.cwd(),"docs/production/routes/VP-PAR-05.json");
 const m=JSON.parse(await readFile(filepath,"utf8")) as Manifest;
 const errors:string[]=[];
 if(m.route_id!=="VP-PAR-05") errors.push("Route ID mismatch");
 if(m.segments.length!==11) errors.push("Expected 11 canonical segments");
 for(const lang of ["fr","en"]){
  const l=m.languages[lang];
  if(!l?.source_artifact) errors.push(lang+": source master artifact missing");
  if(!l?.listening_qa_passed) errors.push(lang+": listening review pending");
  if(!l?.subtitle_file) errors.push(lang+": subtitles pending");
  if(!m.timelines?.[lang]?.length) errors.push(lang+": shot timeline pending");
  if(body.action!=="mount" && !m.exports?.[lang]) errors.push(lang+": final export pending");
 }
 if(!m.rights_signoff) errors.push("Commercial rights signoff pending");
 if(body.action!=="mount" && !m.visual_qa_passed) errors.push("Visual QA pending");
 if(m.assets.some(a=>a.use_in_export && (a.rights_status!=="CLEARED_COMMERCIAL"||!a.local_file)))errors.push("Export contains unverified rights or missing asset");
 if(body.action==="mount"){
   if(errors.length)return NextResponse.json({route_id:m.route_id,action:"mount",result:"BLOCKED",issues:errors,reason:"Preflight not complete; render not dispatched"},{status:409,headers:{"Cache-Control":"no-store"}});
   const token=process.env.STUDIO_GITHUB_ACTIONS_TOKEN;
   if(!token)return NextResponse.json({route_id:m.route_id,action:"mount",result:"BLOCKED",reason:"Server-side GitHub Actions dispatch token not configured"},{status:503});
   const result=await fetch("https://api.github.com/repos/naturlabs1996-creator/velvet-passport-now/actions/workflows/paris05-controlled-av-render.yml/dispatches",{
    method:"POST",headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},
    body:JSON.stringify({ref:"main",inputs:{route_id:"VP-PAR-05"}}),cache:"no-store",signal:AbortSignal.timeout(10000)
   }).catch(()=>null);
   if(!result||result.status!==204)return NextResponse.json({route_id:m.route_id,action:"mount",result:"ERROR",reason:"GitHub did not confirm dispatch"},{status:502});
   return NextResponse.json({route_id:m.route_id,action:"mount",result:"DISPATCHED",reason:"Controlled render requested; GitHub Actions must confirm completion before any delivery."},{headers:{"Cache-Control":"no-store"}});
 }
 const response={route_id:m.route_id,action:body.action,result:errors.length?"NOT_READY":"READY_FOR_REVIEW",
   segments:m.segments.length,source_masters:{fr:!!m.languages.fr?.source_artifact,en:!!m.languages.en?.source_artifact},
   issues:errors,mode:"READ_ONLY_NO_JOBS_DISPATCHED"};
 return NextResponse.json(response,{headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
}

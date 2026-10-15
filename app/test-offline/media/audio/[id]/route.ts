import { NextRequest } from "next/server";
export async function GET(_req: NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const n=Number(id);
 if(!Number.isInteger(n)||n<1||n>5)return new Response("Not found",{status:404});
 const rate=8000,samples=rate*2,bytes=new Uint8Array(44+samples*2),v=new DataView(bytes.buffer);
 const word=(at:number,s:string)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i)};
 word(0,"RIFF");v.setUint32(4,bytes.length-8,true);word(8,"WAVE");word(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,"data");v.setUint32(40,samples*2,true);
 for(let i=0;i<samples;i++)v.setInt16(44+i*2,Math.round(Math.sin(2*Math.PI*(300+n*90)*i/rate)*9000),true);
 return new Response(bytes,{headers:{"Content-Type":"audio/wav","Cache-Control":"public, max-age=3600"}});
}
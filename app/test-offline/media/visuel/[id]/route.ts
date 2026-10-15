import { NextRequest } from "next/server";
export async function GET(_req: NextRequest, { params }: { params: Promise<{id:string}> }) {
 const {id}=await params; const n=Number(id);
 if(!Number.isInteger(n)||n<1||n>5) return new Response("Not found",{status:404});
 const colors=["#167d88","#8768ab","#b56b3e","#4f8b62","#ba5e79"];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260" viewBox="0 0 640 260"><rect width="640" height="260" fill="#10263a"/><circle cx="520" cy="66" r="38" fill="${colors[n-1]}"/><path d="M0 240L145 80 270 220 390 110 640 245Z" fill="${colors[n-1]}"/><text x="28" y="45" fill="white" font-family="sans-serif" font-size="30">Velvet Passport — Arrêt ${n}</text></svg>`;
 return new Response(svg,{headers:{"Content-Type":"image/svg+xml","Cache-Control":"public, max-age=3600"}});
}
export async function GET() {
  const sampleRate = 8000, duration = 2, count = sampleRate * duration;
  const bytes = new Uint8Array(44 + count * 2);
  const view = new DataView(bytes.buffer);
  const word = (offset: number, value: string) => { for (let i=0;i<value.length;i++) bytes[offset+i]=value.charCodeAt(i); };
  word(0,"RIFF"); view.setUint32(4,bytes.length-8,true); word(8,"WAVE"); word(12,"fmt ");
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true); view.setUint16(34,16,true);
  word(36,"data"); view.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){const fade=Math.min(1,i/800,(count-i)/800);view.setInt16(44+i*2,Math.round(Math.sin(2*Math.PI*440*i/sampleRate)*4500*fade),true);}
  return new Response(bytes,{headers:{"Content-Type":"audio/wav","Cache-Control":"public, max-age=3600"}});
}

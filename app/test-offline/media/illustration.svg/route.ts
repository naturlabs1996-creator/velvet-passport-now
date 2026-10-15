export async function GET() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280" viewBox="0 0 640 280"><rect width="640" height="280" fill="#163047"/><path d="M0 215L100 145L195 205L305 90L430 210L535 125L640 210V280H0Z" fill="#65a4a1"/><text x="320" y="54" text-anchor="middle" font-size="26" fill="white" font-family="sans-serif">Velvet Passport — illustration test</text></svg>';
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" } });
}

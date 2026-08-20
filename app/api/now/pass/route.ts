import { getPassAccess } from "../../../../lib/pass-access";

export const runtime = "nodejs";

export async function GET() {
  const access = await getPassAccess();

  if (access.state === "active") {
    return Response.json({
      state: "active",
      allowed: true,
      plan: access.pass.plan,
      expiresAt: new Date(access.pass.expiresAt).toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (access.state === "preview") {
    return Response.json({
      state: "preview",
      allowed: true,
      plan: "development",
      expiresAt: null,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({
    state: "inactive",
    allowed: false,
    plan: null,
    expiresAt: null,
  }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

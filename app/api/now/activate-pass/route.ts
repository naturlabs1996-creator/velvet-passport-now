import { cookies } from "next/headers";
import { createPassToken } from "../../../../lib/pass-token";
import { activateStripeNowSession } from "../../../../lib/stripe-entitlement";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const jar = await cookies();
  const purchaseCookie = jar.get("paris_now_purchase")?.value ?? "";
  const sessionId = typeof input.sessionId === "string" && input.sessionId ? input.sessionId : purchaseCookie;
  if (!sessionId) return Response.json({ error: "No purchased Paris NOW Pass was found" }, { status: 400 });

  const passSecret = process.env.PARIS_NOW_PASS_SECRET;
  if (!passSecret) return Response.json({ error: "Pass activation is not configured" }, { status: 503 });

  try {
    const activation = await activateStripeNowSession(sessionId);
    if (!activation.ready) {
      return Response.json(
        { error: activation.retryable ? "Payment confirmation is still finishing" : "This purchase cannot be activated", retryable: activation.retryable, reason: activation.reason },
        { status: activation.retryable ? 409 : 422, headers: { "Cache-Control": "no-store" } },
      );
    }

    const token = createPassToken({
      passId: activation.sessionId,
      city: "paris",
      plan: activation.plan,
      expiresAt: activation.expiresAt,
    }, passSecret);

    jar.set("paris_now_pass", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(activation.expiresAt),
    });
    jar.delete("paris_now_purchase");

    return Response.json({
      activated: true,
      plan: activation.plan,
      activatedAt: activation.activatedAt,
      expiresAt: activation.expiresAt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NOW Pass activation failed", error);
    return Response.json({ error: "Pass activation is temporarily unavailable", retryable: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

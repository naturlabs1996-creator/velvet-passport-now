import { cookies } from "next/headers";
import { verifyPurchasedNowSession } from "../../../../lib/stripe-entitlement";

export const runtime = "nodejs";

function activationUrl(request: Request, state: "ready" | "pending" | "failed") {
  const origin = process.env.NOW_PUBLIC_ORIGIN?.replace(/\/$/, "") || new URL(request.url).origin;
  return `${origin}/activate?checkout=${state}`;
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!sessionId) return Response.redirect(activationUrl(request, "failed"), 303);

  try {
    const purchase = await verifyPurchasedNowSession(sessionId);
    if (!purchase.valid) {
      return Response.redirect(activationUrl(request, purchase.reason === "payment-not-complete" ? "pending" : "failed"), 303);
    }

    const jar = await cookies();
    jar.set("paris_now_purchase", purchase.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });

    return Response.redirect(activationUrl(request, "ready"), 303);
  } catch (error) {
    console.error("NOW checkout completion failed", error);
    return Response.redirect(activationUrl(request, "pending"), 303);
  }
}

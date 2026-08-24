import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyPurchasedNowSession } from "../../../../lib/stripe-entitlement";

export const runtime = "nodejs";

function activationUrl(request: Request, state: "ready" | "pending" | "failed") {
  const origin = process.env.NOW_PUBLIC_ORIGIN?.replace(/\/$/, "") || new URL(request.url).origin;
  return `${origin}/activate?checkout=${state}`;
}

function hashesMatch(expected: string, actual: string) {
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(actual)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(actual, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!sessionId) return Response.redirect(activationUrl(request, "failed"), 303);

  const jar = await cookies();
  const nonce = jar.get("paris_now_checkout_nonce")?.value ?? "";
  if (!nonce) return Response.redirect(activationUrl(request, "failed"), 303);

  try {
    const purchase = await verifyPurchasedNowSession(sessionId);
    if (!purchase.valid) {
      return Response.redirect(activationUrl(request, purchase.reason === "payment-not-complete" ? "pending" : "failed"), 303);
    }

    const sessionNonceHash = purchase.activationNonceHash ?? "";
    const browserNonceHash = createHash("sha256").update(nonce).digest("hex");
    if (!hashesMatch(sessionNonceHash, browserNonceHash)) {
      console.error("NOW checkout browser binding mismatch", sessionId);
      return Response.redirect(activationUrl(request, "failed"), 303);
    }

    jar.set("paris_now_purchase", purchase.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
    jar.delete("paris_now_checkout_nonce");

    return Response.redirect(activationUrl(request, "ready"), 303);
  } catch (error) {
    console.error("NOW checkout completion failed", error);
    return Response.redirect(activationUrl(request, "pending"), 303);
  }
}

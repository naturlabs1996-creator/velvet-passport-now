import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createNowCheckoutSession, isNowPassPlan, isNowSalesChannel } from "../../../../lib/stripe-now";

export const runtime = "nodejs";

function requestOrigin(request: Request) {
  const configured = process.env.NOW_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (!body || typeof body !== "object") return Response.json({ error: "Request body is required" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const plan = input.plan;
  const channel = input.channel ?? "direct";

  if (!isNowPassPlan(plan)) return Response.json({ error: "plan must be 72h or 7d" }, { status: 400 });
  if (!isNowSalesChannel(channel)) return Response.json({ error: "channel must be direct, hotel or affiliate" }, { status: 400 });

  const nonce = randomBytes(32).toString("base64url");
  const activationNonceHash = createHash("sha256").update(nonce).digest("hex");

  try {
    const session = await createNowCheckoutSession({
      plan,
      channel,
      partnerId: typeof input.partnerId === "string" ? input.partnerId : undefined,
      commissionScheme: typeof input.commissionScheme === "string" ? input.commissionScheme : undefined,
      origin: requestOrigin(request),
      activationNonceHash,
    });

    const jar = await cookies();
    jar.set("paris_now_checkout_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return Response.json({ id: session.id, checkoutUrl: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NOW checkout creation failed", error);
    return Response.json({ error: "Checkout is temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

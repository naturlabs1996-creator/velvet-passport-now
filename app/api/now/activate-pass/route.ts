import { cookies } from "next/headers";
import { createPassToken } from "../../../../lib/pass-token";
import { isNowPassPlan, paymentWasRecorded, planDurationMs, retrieveCheckoutSession } from "../../../../lib/stripe-now";

export const runtime = "nodejs";

const EXPECTED_AMOUNTS = { "72h": 1490, "7d": 2290 } as const;

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (!body || typeof body !== "object") return Response.json({ error: "Request body is required" }, { status: 400 });
  const sessionId = typeof (body as Record<string, unknown>).sessionId === "string"
    ? (body as Record<string, unknown>).sessionId as string
    : "";
  if (!sessionId) return Response.json({ error: "sessionId is required" }, { status: 400 });

  const passSecret = process.env.PARIS_NOW_PASS_SECRET;
  if (!passSecret) return Response.json({ error: "Pass activation is not configured" }, { status: 503 });

  try {
    const recorded = await paymentWasRecorded(sessionId);
    if (!recorded) {
      return Response.json({ error: "Payment is not confirmed yet", retryable: true }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const session = await retrieveCheckoutSession(sessionId);
    const metadata = session.metadata ?? {};
    const plan = metadata.pass_duration;
    if (metadata.product_family !== "velvet_passport" || metadata.product !== "paris_now" || !isNowPassPlan(plan)) {
      return Response.json({ error: "This payment is not a Paris NOW Pass" }, { status: 422 });
    }
    if (session.payment_status !== "paid" || session.status !== "complete") {
      return Response.json({ error: "Payment is not complete", retryable: true }, { status: 409 });
    }
    if (session.currency?.toLowerCase() !== "eur" || session.amount_total !== EXPECTED_AMOUNTS[plan]) {
      return Response.json({ error: "Payment amount does not match the selected Pass" }, { status: 422 });
    }

    const expiresAt = Date.now() + planDurationMs(plan);
    const token = createPassToken({
      passId: session.id,
      city: "paris",
      plan,
      expiresAt,
    }, passSecret);

    const jar = await cookies();
    jar.set("paris_now_pass", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
    });

    return Response.json({ activated: true, plan, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NOW Pass activation failed", error);
    return Response.json({ error: "Pass activation is temporarily unavailable", retryable: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

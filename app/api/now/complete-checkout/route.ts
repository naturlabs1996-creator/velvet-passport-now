import { cookies } from "next/headers";
import { createPassToken } from "../../../../lib/pass-token";
import { isNowPassPlan, paymentWasRecorded, planDurationMs, retrieveCheckoutSession } from "../../../../lib/stripe-now";

export const runtime = "nodejs";

const EXPECTED_AMOUNTS = { "72h": 1490, "7d": 2290 } as const;

function appUrl(request: Request, state: "activated" | "pending" | "failed") {
  const origin = process.env.NOW_PUBLIC_ORIGIN?.replace(/\/$/, "") || new URL(request.url).origin;
  return `${origin}/app?checkout=${state}`;
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!sessionId) return Response.redirect(appUrl(request, "failed"), 303);

  const passSecret = process.env.PARIS_NOW_PASS_SECRET;
  if (!passSecret) return Response.redirect(appUrl(request, "failed"), 303);

  try {
    const recorded = await paymentWasRecorded(sessionId);
    if (!recorded) return Response.redirect(appUrl(request, "pending"), 303);

    const session = await retrieveCheckoutSession(sessionId);
    const metadata = session.metadata ?? {};
    const plan = metadata.pass_duration;
    if (metadata.product_family !== "velvet_passport" || metadata.product !== "paris_now" || !isNowPassPlan(plan)) {
      return Response.redirect(appUrl(request, "failed"), 303);
    }
    if (session.payment_status !== "paid" || session.status !== "complete") {
      return Response.redirect(appUrl(request, "pending"), 303);
    }
    if (session.currency?.toLowerCase() !== "eur" || session.amount_total !== EXPECTED_AMOUNTS[plan]) {
      return Response.redirect(appUrl(request, "failed"), 303);
    }

    const expiresAt = Date.now() + planDurationMs(plan);
    const token = createPassToken({ passId: session.id, city: "paris", plan, expiresAt }, passSecret);
    const jar = await cookies();
    jar.set("paris_now_pass", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
    });

    return Response.redirect(appUrl(request, "activated"), 303);
  } catch (error) {
    console.error("NOW checkout completion failed", error);
    return Response.redirect(appUrl(request, "pending"), 303);
  }
}

import { cookies } from "next/headers";
import { verifyPassToken, type PassPayload } from "./pass-token";
import { isStripePassEntitlementActive } from "./stripe-now";

export type PassAccess =
  | { allowed: true; state: "active"; pass: PassPayload; degraded?: boolean }
  | { allowed: true; state: "preview"; pass: null }
  | { allowed: false; state: "inactive"; pass: null };

export async function getPassAccess(): Promise<PassAccess> {
  const secret = process.env.PARIS_NOW_PASS_SECRET;
  const token = (await cookies()).get("paris_now_pass")?.value;

  if (secret && token) {
    const pass = verifyPassToken(token, secret);
    if (pass) {
      try {
        const active = await isStripePassEntitlementActive(pass.passId);
        if (active) return { allowed: true, state: "active", pass };
        return { allowed: false, state: "inactive", pass: null };
      } catch (error) {
        // A valid signed pass should keep the traveler moving during a short Stripe outage.
        // Stripe is rechecked on the next uncached entitlement validation.
        console.error("NOW Stripe entitlement revalidation unavailable", error);
        return { allowed: true, state: "active", pass, degraded: true };
      }
    }
  }

  if (process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development") {
    return { allowed: true, state: "preview", pass: null };
  }

  return { allowed: false, state: "inactive", pass: null };
}

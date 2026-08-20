import { cookies } from "next/headers";
import { verifyPassToken, type PassPayload } from "./pass-token";

export type PassAccess =
  | { allowed: true; state: "active"; pass: PassPayload }
  | { allowed: true; state: "preview"; pass: null }
  | { allowed: false; state: "inactive"; pass: null };

export async function getPassAccess(): Promise<PassAccess> {
  const secret = process.env.PARIS_NOW_PASS_SECRET;
  const token = (await cookies()).get("paris_now_pass")?.value;

  if (secret && token) {
    const pass = verifyPassToken(token, secret);
    if (pass) return { allowed: true, state: "active", pass };
  }

  if (process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development") {
    return { allowed: true, state: "preview", pass: null };
  }

  return { allowed: false, state: "inactive", pass: null };
}

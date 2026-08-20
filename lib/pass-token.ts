import { createHmac, timingSafeEqual } from "node:crypto";

export type PassPayload = {
  passId: string;
  city: "paris";
  plan: "72h" | "7d";
  expiresAt: number;
};

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createPassToken(payload: PassPayload, secret: string) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyPassToken(token: string, secret: string): PassPayload | null {
  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as PassPayload;
    if (payload.city !== "paris" || !["72h", "7d"].includes(payload.plan)) return null;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    if (typeof payload.passId !== "string" || payload.passId.length < 8) return null;
    return payload;
  } catch {
    return null;
  }
}

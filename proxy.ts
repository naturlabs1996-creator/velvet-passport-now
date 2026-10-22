import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const user = process.env.STUDIO_ADMIN_USER;
  const password = process.env.STUDIO_ADMIN_PASSWORD;
  if (!user || !password) {
    return new NextResponse("Production Studio is not configured", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const auth = request.headers.get("authorization") || "";
  let accepted = false;
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const separator = decoded.indexOf(":");
      if (separator !== -1) {
        const candidateUser = decoded.slice(0, separator);
        const candidatePassword = decoded.slice(separator + 1);
        accepted = candidateUser === user && candidatePassword === password;
      }
    } catch {
      accepted = false;
    }
  }
  if (!accepted) {
    return new NextResponse("Private Velvet Passport Production Studio", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Velvet Production Studio", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/studio/:path*", "/api/studio/:path*"] };

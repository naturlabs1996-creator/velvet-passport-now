import { getPassAccess } from "../../../../lib/pass-access";\n\nexport const runtime = "nodejs";\n\ntype GuardianLevel = "checkin" | "assistance" | "medical" | "emergency";

const allowedLevels: GuardianLevel[] = ["checkin", "assistance", "medical", "emergency"];

export async function POST(request: Request) {\n  const access = await getPassAccess();\n  if (!access.allowed) return Response.json({ error: "A valid Paris NOW Pass is required" }, { status: 401 });
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Request body is required" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const level = typeof input.level === "string" && allowedLevels.includes(input.level as GuardianLevel)
    ? input.level as GuardianLevel
    : "checkin";

  const consent = input.hotelConsent === true;
  const area = "Louvre & Opéra";
  const situation = level === "emergency"
    ? "reported an urgent safety situation"
    : level === "medical"
      ? "reported feeling unwell and requested assistance"
      : level === "assistance"
        ? "requested non-emergency travel assistance"
        : "requested a safety check-in";

  return Response.json({
    level,
    routePaused: level !== "checkin",
    priority: level === "emergency" || level === "medical" ? "urgent" : "standard",
    officialServices: [
      { label: "European emergency", number: "112", purpose: "Police, fire or medical emergency" },
      { label: "SAMU — medical emergency", number: "15", purpose: "Urgent medical assistance in France" },
      { label: "Police or gendarmerie", number: "17", purpose: "Immediate danger or police assistance" },
      { label: "Fire and rescue", number: "18", purpose: "Fire, accident or rescue" },
      { label: "Emergency by text", number: "114", purpose: "Accessible emergency contact by text" },
    ],
    hotelContact: {
      status: consent ? "preview_only" : "consent_required",
      consent,
      messagePreview: consent
        ? `A hotel guest has ${situation} near ${area}. The guest has explicitly authorized this preview. No hotel message has been sent.`
        : null,
      deliveryAvailable: false,
    },
    disclaimer: "Guardian does not replace official emergency services or medical advice.",
    mode: "prepared",
    generatedAt: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-NOW-Data-Mode": "prepared",
    },
  });
}

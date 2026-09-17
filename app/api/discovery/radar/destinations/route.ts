import { NextResponse } from "next/server";
import { collectDestinationCapture } from "@/lib/discovery/destination-capture";

export async function GET() {
  try {
    const capture = await collectDestinationCapture();
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      ...capture,
    });
  } catch (error) {
    console.error("VELVET_DESTINATION_CAPTURE_ERROR", error);
    return NextResponse.json({ ok: false, error: "destination_capture_failed" }, { status: 500 });
  }
}

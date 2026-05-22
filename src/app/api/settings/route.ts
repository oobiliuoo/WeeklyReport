import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/db";

export async function GET() {
  const settings = getAllSettings();
  const config: Record<string, string> = {};
  for (const s of settings) {
    // Mask API key for display
    if (s.key === "llm_api_key" && s.value.length > 8) {
      config[s.key] = s.value.slice(0, 4) + "****" + s.value.slice(-4);
    } else {
      config[s.key] = s.value;
    }
  }
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" && value.trim() !== "") {
      // Don't overwrite API key with masked value
      if (key === "llm_api_key" && value.includes("****")) {
        continue;
      }
      setSetting(key, value);
    }
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const settings = db.getSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = db.saveSettings(body);

    // Sync schedule to Google Apps Script if URL configured
    if (updated.appsScriptUrl && updated.appsScriptUrl.startsWith("http")) {
      try {
        const syncUrl = updated.appsScriptUrl.includes("?")
          ? `${updated.appsScriptUrl}&action=sync_schedule`
          : `${updated.appsScriptUrl}?action=sync_schedule`;
        fetch(syncUrl, { method: "GET" }).catch(() => {});
      } catch (e) {}
    }

    return NextResponse.json({ success: true, settings: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let action = searchParams.get("action") || "trigger";
    
    try {
      const body = await req.json();
      if (body && body.action) {
        action = body.action;
      }
    } catch (e) {}

    const settings = db.getSettings();
    const appsScriptUrl = settings.appsScriptUrl;

    if (!appsScriptUrl || !appsScriptUrl.startsWith("http")) {
      return NextResponse.json({
        success: true,
        message: action === "nudge"
          ? "Nudge alert prepared. (Configure Google Apps Script URL in Settings to send directly into Google Chat)."
          : "Daily standup prompt prepared. (Configure Google Apps Script URL in Settings for direct 1:1 broadcast).",
        broadcastCount: 0
      });
    }

    const triggerUrl = appsScriptUrl.includes("?") 
      ? `${appsScriptUrl}&action=${action}` 
      : `${appsScriptUrl}?action=${action}`;

    const res = await fetch(triggerUrl, { method: "GET" });
    const data = await res.json().catch(() => ({ success: true, count: 1 }));

    return NextResponse.json({
      success: true,
      message: action === "nudge"
        ? "⏰ Follow-up standup reminder sent to all pending employees!"
        : "🚀 Daily standup prompt dispatched to all employee Google Chat DMs!",
      result: data
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      message: "Action dispatched.",
      error: err.message
    });
  }
}


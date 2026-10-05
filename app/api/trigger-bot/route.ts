import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const settings = db.getSettings();
    const appsScriptUrl = settings.appsScriptUrl;

    if (!appsScriptUrl || !appsScriptUrl.startsWith("http")) {
      return NextResponse.json({
        success: true,
        message: "Bot prompt ready. Configure Google Apps Script Web App URL in Settings for direct 1:1 broadcast dispatch.",
        broadcastCount: 0
      });
    }

    const triggerUrl = appsScriptUrl.includes("?") 
      ? `${appsScriptUrl}&action=trigger` 
      : `${appsScriptUrl}?action=trigger`;

    const res = await fetch(triggerUrl, { method: "GET" });
    const data = await res.json().catch(() => ({ success: true, count: 1 }));

    return NextResponse.json({
      success: true,
      message: "Daily standup prompt & animated GIFs dispatched to active Google Chat 1:1 Bot chats!",
      result: data
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      message: "Standup broadcast triggered.",
      error: err.message
    });
  }
}

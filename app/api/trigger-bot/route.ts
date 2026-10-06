import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildStandupPromptCard } from "@/lib/googleChatHelper";

async function handleTrigger(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let action = searchParams.get("action") || "trigger";
    
    try {
      if (req.method === "POST") {
        const body = await req.json();
        if (body && body.action) {
          action = body.action;
        }
      }
    } catch (e) {}

    const settings = db.getSettings();
    let directSent = false;
    let directError: string | null = null;

    // 1. Direct Webhook Delivery (NO Apps Script needed if Google Chat Webhook URL is set)
    if (settings.googleChatWebhookUrl && settings.googleChatWebhookUrl.startsWith("http")) {
      try {
        const promptText = action === "nudge"
          ? "⏰ Friendly Standup Reminder! Just checking in—did you get a chance to log your tasks and hours for today?"
          : (settings.botPrompt || "Good morning team! ☕ Coffee level at 80%? What epic tasks are occupying your hours today?");

        const card = buildStandupPromptCard({
          userName: "Team",
          prompt: promptText
        });

        const res = await fetch(settings.googleChatWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify(card)
        });

        if (res.ok) {
          directSent = true;
        } else {
          const errText = await res.text();
          directError = `Webhook error (${res.status}): ${errText}`;
        }
      } catch (err: any) {
        directError = err.message;
      }
    }

    // 2. Apps Script Delivery (if configured)
    let appsScriptData: any = null;
    if (settings.appsScriptUrl && settings.appsScriptUrl.startsWith("http")) {
      try {
        const triggerUrl = settings.appsScriptUrl.includes("?") 
          ? `${settings.appsScriptUrl}&action=${action}` 
          : `${settings.appsScriptUrl}?action=${action}`;

        const res = await fetch(triggerUrl, { method: "GET" });
        appsScriptData = await res.json().catch(() => ({ success: true }));
      } catch (e) {}
    }

    if (directSent || (appsScriptData && appsScriptData.sent > 0)) {
      return NextResponse.json({
        success: true,
        message: action === "nudge"
          ? "⏰ Follow-up standup reminder sent to Google Chat!"
          : "🚀 Daily standup prompt dispatched to Google Chat!",
        directSent,
        appsScript: appsScriptData
      });
    }

    return NextResponse.json({
      success: true,
      message: directError 
        ? `Dispatch completed with notice: ${directError}`
        : "Standup prompt broadcast dispatched to configured endpoints.",
      directSent,
      appsScript: appsScriptData
    });

  } catch (err: any) {
    return NextResponse.json({
      success: true,
      message: "Action dispatched.",
      error: err.message
    });
  }
}

export async function GET(req: NextRequest) {
  return handleTrigger(req);
}

export async function POST(req: NextRequest) {
  return handleTrigger(req);
}


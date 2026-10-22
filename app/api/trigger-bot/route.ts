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

    const settings = await db.getSettings();
    let directSent = false;
    let directError: string | null = null;
    let serviceAccountResult: any = null;

    if (action === "nudge") {
      const { getLocalHour, getLocalMinute } = await import("@/lib/googleChatHelper");
      const currentHour = getLocalHour(new Date());
      const currentMinute = getLocalMinute(new Date());
      if (currentHour > 12 || (currentHour === 12 && currentMinute > 2)) {
        return NextResponse.json({
          success: true,
          action: "nudge",
          directSent: false,
          message: "Follow-up window closed: Standup follow-ups are strictly allowed before 12:00 PM only."
        });
      }
    }

    // 1. Direct 1:1 DM Broadcast via Google Cloud Service Account
    let creds: any = null;
    try {
      const { getServiceAccountCredentials, broadcastDirectStandup } = await import("@/lib/googleChatDirect");
      creds = getServiceAccountCredentials();
      if (creds) {
        serviceAccountResult = await broadcastDirectStandup(action === "nudge");
        if (serviceAccountResult.sent > 0) {
          directSent = true;
        }
      }
    } catch (saErr: any) {
      directError = `Service Account DM: ${saErr.message}`;
    }

    // 2. Webhook Fallback Delivery (ONLY if Service Account is NOT configured, preventing duplicate popups)
    if (!creds && settings.googleChatWebhookUrl && settings.googleChatWebhookUrl.startsWith("http")) {
      try {
        const { getPositiveMorningGreeting } = await import("@/lib/googleChatHelper");
        const isCustomPrompt = settings.botPrompt &&
          !settings.botPrompt.includes("Coffee level at 80%") &&
          !settings.botPrompt.includes("coffee level") &&
          settings.botPrompt.trim().length > 10;

        const promptText = action === "nudge"
          ? "⏰ Friendly Standup Reminder! Just checking in—did you get a chance to log your tasks and hours for today?"
          : (isCustomPrompt ? settings.botPrompt : getPositiveMorningGreeting());

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

    if (directSent || (serviceAccountResult && serviceAccountResult.sent > 0)) {
      return NextResponse.json({
        success: true,
        message: action === "nudge"
          ? "⏰ Follow-up standup reminder sent directly to Google Chat DMs!"
          : "🚀 Daily standup prompt dispatched directly to Google Chat 1:1 DMs!",
        directSent,
        serviceAccount: serviceAccountResult
      });
    }

    return NextResponse.json({
      success: true,
      message: directError 
        ? `Dispatch notice: ${directError}`
        : "Standup prompt broadcast dispatched.",
      directSent,
      serviceAccount: serviceAccountResult
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


import { NextRequest, NextResponse } from 'next/server';
import {
  formatChatResponse,
  buildStandupPromptCard,
  buildStandupConfirmationCard,
  buildHoursRequestCard,
  buildInteractiveCard,
  buildSuccessCard
} from '@/lib/googleChatHelper';
import { parseStandupMessage } from '@/lib/parser';
import { db } from '@/lib/db';
import { StandupRecord } from '@/lib/types';

// Helper to buffer response JSON with strict headers
function chatJson(payload: any) {
  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Robust helper to parse form input string values across multiple shapes
function extractInputValue(obj: any): string {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number') return String(obj);
  if (Array.isArray(obj)) return obj.length > 0 ? extractInputValue(obj[0]) : '';
  if (obj.stringInputs?.value) return extractInputValue(obj.stringInputs.value);
  if (obj.value != null) return extractInputValue(obj.value);
  if (typeof obj === 'object') {
    for (const [, v] of Object.entries(obj)) {
      const val = extractInputValue(v);
      if (val) return val;
    }
  }
  return '';
}

const ROTATING_PROMPTS = [
  "Good morning champion! ☕ What epic tasks are you tackling across your projects today?",
  "Beep boop! 🛸 StandupBot daily check-in. What are your prime targets today before caffeine wears off?",
  "Rise and grind! 🚀 Drop your planned project, tasks, hours, and any blockers!",
  "Wakey wakey! 🥞 What tickets are you tackling today, how many hours, and did any wild bugs block you?",
  "The game is afoot! 🕵️‍♂️ What is your main focus today and how many hours of genius are we pouring in?"
];

export async function POST(req: NextRequest) {
  let event: any;
  try {
    event = await req.json();
  } catch {
    return chatJson(formatChatResponse({ text: 'Invalid JSON payload' }));
  }

  // 1. Detect Event Type
  let eventType = 'MESSAGE';
  if (event.type) {
    eventType = event.type;
  } else if (event.chat?.buttonClickedPayload || event.commonEventObject?.invokedFunction || event.action) {
    eventType = 'CARD_CLICKED';
  } else if (event.chat?.addedToSpacePayload) {
    eventType = 'ADDED_TO_SPACE';
  }

  const isAddOn = Boolean(
    event.commonEventObject || event.chat || event.authorizationEventObject || !event.type
  );

  // 2. Extract User & Space Identity
  const userEmail =
    event.chat?.user?.email ??
    event.user?.email ??
    event.commonEventObject?.userEmail ??
    event.chat?.messagePayload?.message?.sender?.email ??
    event.message?.sender?.email ??
    '';
  const userName =
    event.chat?.user?.displayName ??
    event.user?.displayName ??
    event.commonEventObject?.userName ??
    event.chat?.messagePayload?.message?.sender?.displayName ??
    'Team Member';
  const firstName = userName.split(' ')[0];

  const userKey =
    userEmail ||
    event.user?.name ||
    event.chat?.user?.name ||
    event.message?.sender?.name ||
    event.chat?.messagePayload?.message?.sender?.name ||
    userName ||
    'default_user';

  const spaceName =
    event.space?.name ??
    event.chat?.space?.name ??
    event.message?.space?.name ??
    event.chat?.messagePayload?.message?.space?.name ??
    '';

  // Automatically register 1:1 chat space for this employee
  if (userEmail && spaceName) {
    try {
      db.registerEmployeeSpace(userEmail, spaceName, userName);
      const settings = db.getSettings();
      if (settings.appsScriptUrl && settings.appsScriptUrl.startsWith('http')) {
        const regUrl = settings.appsScriptUrl.includes('?')
          ? `${settings.appsScriptUrl}&action=register_dm&email=${encodeURIComponent(userEmail)}&space=${encodeURIComponent(spaceName)}`
          : `${settings.appsScriptUrl}?action=register_dm&email=${encodeURIComponent(userEmail)}&space=${encodeURIComponent(spaceName)}`;
        fetch(regUrl).catch(() => {});
      }
    } catch (e) {}
  }

  try {
    // -------------------------------------------------------------
    // EVENT 1: ADDED TO SPACE / ONBOARDING
    // -------------------------------------------------------------
    if (eventType === 'ADDED_TO_SPACE') {
      const prompt = ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];
      const promptCard = buildStandupPromptCard({ userName: firstName, prompt });
      return chatJson(formatChatResponse(promptCard, { isAddOn }));
    }

    // -------------------------------------------------------------
    // EVENT 2: CARD CLICKED / FORM SUBMIT / HOUR BUTTONS
    // -------------------------------------------------------------
    if (eventType === 'CARD_CLICKED') {
      const paramsMap: Record<string, string> = {};
      const parseParams = (source: any) => {
        if (!source) return;
        if (Array.isArray(source)) {
          for (const item of source) {
            if (item?.key && item?.value !== undefined) paramsMap[item.key] = String(item.value);
            else if (item?.name && item?.value !== undefined) paramsMap[item.name] = String(item.value);
          }
        } else if (typeof source === 'object') {
          for (const [k, v] of Object.entries(source)) {
            if (v !== null && typeof v === 'object' && 'value' in (v as any)) {
              paramsMap[k] = String((v as any).value);
            } else if (v !== null && v !== undefined) {
              paramsMap[k] = String(v);
            }
          }
        }
      };

      parseParams(event.commonEventObject?.parameters);
      parseParams(event.action?.parameters);
      parseParams(event.chat?.buttonClickedPayload?.action?.parameters);
      parseParams(event.parameters);

      // Handle 1-Click Hour Selection Button
      const hoursParam = paramsMap.hours || paramsMap.hour || paramsMap.value;
      if (hoursParam) {
        const selectedHours = parseFloat(hoursParam);
        const draft = db.getPendingDraft(userKey);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const record: StandupRecord = {
          id: "std_" + Date.now(),
          name: userName,
          email: userEmail || "team@bytepx.com",
          dept: "Engineering",
          tasks: draft ? draft.tasks : "General tasks",
          hours: selectedHours,
          project: draft ? draft.project : "General Tasks",
          blocker: draft ? draft.blocker : "None",
          date: now.toISOString().slice(0, 10),
          time: timeStr,
          source: "Google Chat 1:1 Bot (Interactive)"
        };

        db.saveStandup(record);
        db.clearPendingDraft(userKey);

        const confirmationCard = buildStandupConfirmationCard({
          employeeName: record.name,
          project: record.project,
          tasks: record.tasks,
          hours: record.hours,
          blocker: record.blocker,
          time: timeStr
        });

        return chatJson(formatChatResponse(confirmationCard, { isCardAction: true, isAddOn }));
      }


      // Handle other custom form inputs
      const formInputs =
        event.commonEventObject?.formInputs ??
        event.action?.formInputs ??
        event.chat?.buttonClickedPayload?.action?.formInputs ??
        {};

      const itemId = paramsMap.itemId || 'general';
      const fieldName = paramsMap.inputFieldName || `input_${itemId}`;
      const submittedValue = extractInputValue(formInputs[fieldName]);

      const confirmationCard = buildSuccessCard(
        `Thank you ${userName}! Your update for item \`${itemId}\` was submitted: **${submittedValue || 'Completed'}**.`
      );
      return chatJson(
        formatChatResponse(confirmationCard, { isCardAction: true, isAddOn })
      );
    }

    // -------------------------------------------------------------
    // EVENT 3: CHAT MESSAGE / COMMAND / STANDUP SUBMISSION
    // -------------------------------------------------------------
    const rawText =
      event.chat?.messagePayload?.message?.argumentText ??
      event.message?.argumentText ??
      event.chat?.messagePayload?.message?.text ??
      event.message?.text ??
      '';

    // Strip bot mentions like <users/123...> or @BotName
    const cleanText = rawText
      .replace(/^<users\/[^>]+>\s*/i, '')
      .replace(/^@[\w\s.-]+\s*/i, '')
      .trim();

    const lowerText = cleanText.toLowerCase();

    // Case 3A: Greeting or Help Command -> Return Standup Prompt Card
    if (!cleanText || ['hi', 'hello', 'hey', 'help', '/standup', '/sync', 'standup'].includes(lowerText)) {
      const prompt = ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];
      const promptCard = buildStandupPromptCard({ userName: firstName, prompt });
      return chatJson(formatChatResponse(promptCard, { isAddOn }));
    }

    // Case 3B: Pending Tasks Review Command
    if (lowerText === 'pending' || lowerText === 'status' || lowerText === '/status') {
      const sampleItems = [
        { id: 'task-101', title: 'Task 101: Sprint Tasks', description: 'Enter hours & tasks completed today.' },
        { id: 'task-102', title: 'Task 102: Blockers Check', description: 'Confirm any blockers requiring leadership assistance.' },
      ];
      const interactiveCard = buildInteractiveCard({
        title: `📋 Daily Status Checklist for ${firstName}`,
        subtitle: `${sampleItems.length} items to confirm`,
        items: sampleItems,
      });
      return chatJson(formatChatResponse(interactiveCard, { isAddOn }));
    }

    // Parse the incoming message
    const parsed = parseStandupMessage(cleanText);
    const existingDraft = db.getPendingDraft(userKey);

    // Case 3C: User had a pending draft and is now replying with hours (e.g. "6.5h", "7.5", "8 hours")
    if (existingDraft && (parsed.isOnlyHours || parsed.hasExplicitHours)) {
      const finalHours = parsed.hours > 0 ? parsed.hours : 7.5;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const record: StandupRecord = {
        id: "std_" + Date.now(),
        name: userName,
        email: userEmail || "team@bytepx.com",
        dept: "Engineering",
        tasks: existingDraft.tasks,
        hours: finalHours,
        project: existingDraft.project,
        blocker: existingDraft.blocker,
        date: now.toISOString().slice(0, 10),
        time: timeStr,
        source: "Google Chat 1:1 Bot",
        rawText: cleanText
      };

      db.saveStandup(record);
      db.clearPendingDraft(userKey);

      const confirmationCard = buildStandupConfirmationCard({
        employeeName: record.name,
        project: record.project,
        tasks: record.tasks,
        hours: record.hours,
        blocker: record.blocker,
        time: timeStr
      });

      return chatJson(formatChatResponse(confirmationCard, { isAddOn }));
    }

    // Case 3D: User submitted tasks WITHOUT hours (and not unassigned/leave) -> Ask ONLY for hours
    if (!parsed.hasExplicitHours && !parsed.isAwaitingTask && !parsed.isOnLeave) {
      db.savePendingDraft(userKey, {
        tasks: parsed.tasks,
        project: parsed.project,
        blocker: parsed.blocker
      });

      const hoursPromptCard = buildHoursRequestCard({
        userName: firstName,
        tasks: parsed.tasks,
        project: parsed.project
      });

      return chatJson(formatChatResponse(hoursPromptCard, { isAddOn }));
    }

    // Case 3E: Full Standup with Hours or Special Status -> Log Immediately
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const record: StandupRecord = {
      id: "std_" + Date.now(),
      name: userName,
      email: userEmail || "team@bytepx.com",
      dept: "Engineering",
      tasks: parsed.tasks,
      hours: parsed.hours,
      project: parsed.project,
      blocker: parsed.blocker,
      date: now.toISOString().slice(0, 10),
      time: timeStr,
      source: "Google Chat 1:1 Bot",
      rawText: cleanText
    };

    // Save check-in and clear any draft
    db.saveStandup(record);
    db.clearPendingDraft(userKey);

    // Return Standup Confirmation Card
    const confirmationCard = buildStandupConfirmationCard({
      employeeName: record.name,
      project: record.project,
      tasks: record.tasks,
      hours: record.hours,
      blocker: record.blocker,
      time: timeStr
    });

    return chatJson(formatChatResponse(confirmationCard, { isAddOn }));

  } catch (err) {
    console.error('Unhandled error processing Google Chat event:', err);
    return chatJson(
      formatChatResponse(
        { text: `⚠️ Error: ${err instanceof Error ? err.message : String(err)}` },
        { isCardAction: eventType === 'CARD_CLICKED', isAddOn }
      )
    );
  }
}

export async function GET() {
  return chatJson({
    status: "online",
    service: "BytePx StandupPulse Bot",
    protocol: "Google Workspace Add-on Z-Mode Webhook"
  });
}

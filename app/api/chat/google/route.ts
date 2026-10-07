import { NextRequest, NextResponse } from 'next/server';
import {
  formatChatResponse,
  buildStandupPromptCard,
  buildStandupConfirmationCard,
  buildHoursRequestCard,
  buildRemainingHoursCard,
  buildInteractiveCard,
  buildSuccessCard,
  formatLocalTime,
  formatLocalDate
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

  const isCardAction = Boolean(
    eventType === 'CARD_CLICKED' ||
    event.chat?.buttonClickedPayload ||
    event.commonEventObject?.invokedFunction ||
    event.action
  );

  // 2. Extract User & Space Identity
  const userName =
    event.chat?.user?.displayName ??
    event.user?.displayName ??
    event.commonEventObject?.userName ??
    event.chat?.messagePayload?.message?.sender?.displayName ??
    'Team Member';
  const firstName = userName.split(' ')[0];

  const rawUserEmail =
    event.chat?.user?.email ??
    event.user?.email ??
    event.commonEventObject?.userEmail ??
    event.chat?.messagePayload?.message?.sender?.email ??
    event.message?.sender?.email ??
    '';

  const userEmail = rawUserEmail || (
    userName.toLowerCase().includes('rudra') ? 'rudra@bytepx.com' :
    userName.toLowerCase().includes('tanmay') ? 'tanmay.jain@bytepx.com' :
    userName.toLowerCase().includes('pavana') ? 'pavana@bytepx.com' :
    userName.toLowerCase().includes('prerna') ? 'prerna@bytepx.com' :
    (userName && userName !== 'Team Member' ? `${userName.toLowerCase().trim().replace(/\s+/g, '.')}@bytepx.com` : '')
  );

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

  // Automatically register 1:1 chat space for this employee synchronously
  if (spaceName) {
    try {
      const regEmail = userEmail || `${userName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@bytepx.com`;
      db.registerEmployeeSpace(regEmail, spaceName, userName);
      const settings = db.getSettings();
      if (settings.appsScriptUrl && settings.appsScriptUrl.startsWith('http')) {
        const regUrl = settings.appsScriptUrl.includes('?')
          ? `${settings.appsScriptUrl}&action=register_dm&email=${encodeURIComponent(regEmail)}&space=${encodeURIComponent(spaceName)}&name=${encodeURIComponent(userName)}`
          : `${settings.appsScriptUrl}?action=register_dm&email=${encodeURIComponent(regEmail)}&space=${encodeURIComponent(spaceName)}&name=${encodeURIComponent(userName)}`;
        
        // Await with timeout so Vercel does not terminate lambda before fetch completes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch(regUrl, { method: 'GET', signal: controller.signal }).catch(() => {});
        clearTimeout(timeoutId);
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
      return chatJson(formatChatResponse(promptCard));
    }

    // -------------------------------------------------------------
    // EVENT 2: CARD CLICKED / FORM SUBMIT / HOUR BUTTONS
    // -------------------------------------------------------------
    if (isCardAction) {
      const paramsMap: Record<string, string> = {};
      const sources = [
        event.commonEventObject?.parameters,
        event.action?.parameters,
        event.chat?.buttonClickedPayload?.action?.parameters,
        event.parameters
      ];
      for (const src of sources) {
        if (!src) continue;
        if (Array.isArray(src)) {
          for (const item of src) {
            if (item?.key !== undefined && item?.value !== undefined) {
              paramsMap[String(item.key)] = String(item.value);
            } else if (item?.name !== undefined && item?.value !== undefined) {
              paramsMap[String(item.name)] = String(item.value);
            }
          }
        } else if (typeof src === 'object') {
          for (const [k, v] of Object.entries(src)) {
            if (v !== null && typeof v === 'object' && 'value' in (v as any)) {
              paramsMap[k] = String((v as any).value);
            } else if (v !== null && v !== undefined) {
              paramsMap[k] = String(v);
            }
          }
        }
      }

      const now = new Date();
      const timeStr = formatLocalTime(now);
      const dateStr = formatLocalDate(now);

      // Branch 2A: Handle Remaining Hours Selection (submitRemaining)
      if (paramsMap.actionName === 'submitRemaining') {
        const draft = db.getPendingDraft(userKey);
        const buttonType = paramsMap.type || 'same_project';
        const remHours = parseFloat(paramsMap.hours || '3.0') || 3.0;
        const primaryHrs = draft && draft.hours ? draft.hours : 5.0;
        const primaryProj = (draft && draft.project && draft.project !== 'General Tasks') ? draft.project : '';
        const primaryTasks = (draft && draft.tasks && draft.tasks !== 'General tasks') ? draft.tasks : '';

        let finalProject = primaryProj || 'Daily Tasks';
        let finalHours = 8.0;
        let finalTasks = primaryTasks || `${finalHours} hrs logged`;
        let finalBlocker = draft ? draft.blocker : 'None';

        if (buttonType === 'same_project') {
          finalHours = 8.0;
          finalTasks = primaryTasks ? `${primaryTasks} (Full Day: 8.0 hrs)` : `8.0 hrs on ${primaryProj || 'Daily Tasks'}`;
        } else if (buttonType === 'awaiting') {
          finalHours = 8.0;
          finalProject = primaryProj ? `${primaryProj} + Standby` : 'Standby / Awaiting Tasks';
          finalTasks = primaryTasks
            ? `${primaryTasks} (${primaryHrs} hrs), Awaiting Tasks (${remHours} hrs)`
            : `Awaiting Tasks (${remHours} hrs)`;
          finalBlocker = `Awaiting task allocation for ${remHours} hrs`;
        } else if (buttonType === 'half_day') {
          finalHours = primaryHrs;
          finalProject = primaryProj || 'Half-Day Leave';
          finalTasks = primaryTasks ? `${primaryTasks} (Half-Day Leave)` : 'Half-Day Leave';
          finalBlocker = 'Half-Day Leave';
        }

        const record: StandupRecord = {
          id: "std_" + Date.now(),
          name: userName,
          email: userEmail || "team@bytepx.com",
          dept: "Engineering",
          tasks: finalTasks,
          hours: finalHours,
          project: finalProject,
          blocker: finalBlocker,
          date: dateStr,
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

        return chatJson(formatChatResponse(confirmationCard, { isCardAction: true }));
      }

      // Branch 2B: Handle Initial 1-Click Hour Selection (submitHours)
      const hoursParam = paramsMap.hours || paramsMap.hour || paramsMap.value;
      if (hoursParam) {
        const parsedFloat = parseFloat(hoursParam.trim());
        const selectedHours = Number.isFinite(parsedFloat) && parsedFloat >= 0 && parsedFloat <= 24 ? parsedFloat : 8.0;
        const draft = db.getPendingDraft(userKey);

        // If selected hours is less than 8.0, prompt for remaining capacity!
        if (selectedHours < 8.0) {
          const remaining = +(8.0 - selectedHours).toFixed(1);
          db.savePendingDraft(userKey, {
            tasks: draft?.tasks || "",
            project: draft?.project || "",
            blocker: draft?.blocker || "None",
            hours: selectedHours,
            remainingHours: remaining
          });

          const capacityCard = buildRemainingHoursCard({
            userName: firstName,
            project: draft?.project || "",
            tasks: draft?.tasks || "",
            loggedHours: selectedHours,
            remainingHours: remaining
          });

          return chatJson(formatChatResponse(capacityCard, { isCardAction: true }));
        }

        const cleanProj = (draft && draft.project && draft.project !== 'General Tasks') ? draft.project : 'Daily Tasks';
        const cleanTsk = (draft && draft.tasks && draft.tasks !== 'General tasks') ? draft.tasks : `${selectedHours} hrs logged`;

        const record: StandupRecord = {
          id: "std_" + Date.now(),
          name: userName,
          email: userEmail || "team@bytepx.com",
          dept: "Engineering",
          tasks: cleanTsk,
          hours: selectedHours,
          project: cleanProj,
          blocker: draft ? draft.blocker : "None",
          date: dateStr,
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

        return chatJson(formatChatResponse(confirmationCard, { isCardAction: true }));
      }

      // Handle other custom form inputs
      const formInputs =
        event.commonEventObject?.formInputs ??
        event.action?.formInputs ??
        event.chat?.buttonClickedPayload?.action?.formInputs ??
        {};

      const itemId = paramsMap.itemId || paramsMap.recordId || 'general';
      const fieldName = paramsMap.inputFieldName || `input_${itemId}`;
      const submittedValue = extractInputValue(formInputs[fieldName]);

      const confirmationCard = buildSuccessCard(
        `Thank you ${userName}! Your update for item \`${itemId}\` was submitted: **${submittedValue || 'Completed'}**.`
      );
      return chatJson(
        formatChatResponse(confirmationCard, { isCardAction: true })
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
      return chatJson(formatChatResponse(promptCard));
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
      return chatJson(formatChatResponse(interactiveCard));
    }

    // Parse the incoming message
    const parsed = parseStandupMessage(cleanText);
    const now = new Date();
    const timeStr = formatLocalTime(now);
    const dateStr = formatLocalDate(now);

    // Determine final hours: use explicit hours if given, or 0 if on leave, or default to 8.0 hrs
    let finalHours = 8.0;
    if (parsed.hours > 0) {
      finalHours = parsed.hours;
    } else if (parsed.isOnLeave || parsed.isAwaitingTask) {
      finalHours = 0.0;
    }

    const finalProject = parsed.project || (parsed.tasks ? parsed.tasks.split(/[,;\n]/)[0].slice(0, 35) : 'Daily Tasks');
    const finalTasks = parsed.tasks || cleanText;

    const record: StandupRecord = {
      id: "std_" + Date.now(),
      name: userName,
      email: userEmail || "team@bytepx.com",
      dept: "Engineering",
      tasks: finalTasks,
      hours: finalHours,
      project: finalProject,
      blocker: parsed.blocker || "None",
      date: dateStr,
      time: timeStr,
      source: "Google Chat 1:1 Bot",
      rawText: cleanText
    };

    // Save check-in immediately to database and cloud
    db.saveStandup(record);
    db.clearPendingDraft(userKey);

    // Return Standup Confirmation Card directly
    const confirmationCard = buildStandupConfirmationCard({
      employeeName: record.name,
      project: record.project,
      tasks: record.tasks,
      hours: record.hours,
      blocker: record.blocker,
      time: timeStr
    });

    return chatJson(formatChatResponse(confirmationCard));

  } catch (err) {
    console.error('Unhandled error processing Google Chat event:', err);
    return chatJson(
      formatChatResponse(
        { text: `⚠️ Error: ${err instanceof Error ? err.message : String(err)}` },
        { isCardAction }
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

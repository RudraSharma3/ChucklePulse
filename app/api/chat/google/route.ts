import { NextRequest, NextResponse } from 'next/server';
import {
  formatChatResponse,
  buildStandupPromptCard,
  buildStandupConfirmationCard,
  buildHoursRequestCard,
  buildRemainingHoursCard,
  buildNonWorkActivityCard,
  buildInteractiveCard,
  buildSuccessCard,
  formatLocalTime,
  formatLocalDate,
  getPositiveMorningGreeting
} from '@/lib/googleChatHelper';
import { parseStandupMessage } from '@/lib/parser';
import { db } from '@/lib/db';
import { StandupRecord } from '@/lib/types';
import { isStandupForToday } from '@/lib/googleChatDirect';

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

function resolveEmployeeIdentity(userName: string, userEmail: string, spaceName?: string) {
  const list = db.getEmployeesSync();
  const uEmail = (userEmail || "").toLowerCase().trim();
  const uName = (userName || "").toLowerCase().trim();
  const uFirst = uName.split(' ')[0];
  const uPrefix = uEmail.split('@')[0];

  // 1. Direct match by spaceName if known 1:1 space
  if (spaceName) {
    const spaceMatch = list.find(e => e.webhookUrl && e.webhookUrl.trim() === spaceName.trim());
    if (spaceMatch) {
      return {
        employeeId: spaceMatch.id,
        name: spaceMatch.name,
        email: spaceMatch.email,
        dept: spaceMatch.dept
      };
    }
  }

  // 2. Canonical matching against registered employees
  let matched = list.find(e => {
    const eEmail = (e.email || "").toLowerCase().trim();
    const eName = (e.name || "").toLowerCase().trim();
    const eFirst = eName.split(' ')[0];
    const ePrefix = eEmail.split('@')[0];

    if (eEmail && uEmail && eEmail === uEmail) return true;
    if (ePrefix && uPrefix && ePrefix === uPrefix) return true;
    if (eName && uName && (eName === uName || eName.includes(uName) || uName.includes(eName))) return true;
    if (eFirst && uFirst && eFirst.length >= 3 && eFirst === uFirst) return true;
    return false;
  });

  if (!matched) {
    if (uName.includes('rudra') || uEmail.includes('rudra')) matched = list.find(e => e.id === 'emp_2');
    else if (uName.includes('tanmay') || uEmail.includes('tanmay')) matched = list.find(e => e.id === 'emp_1');
    else if (uName.includes('pavana') || uEmail.includes('pavana')) matched = list.find(e => e.id === 'emp_3');
    else if (uName.includes('prerna') || uEmail.includes('prerna')) matched = list.find(e => e.id === 'emp_4');
    else if (uName.includes('rohit') || uEmail.includes('rohit')) matched = list.find(e => e.id === 'emp_5');
    else if (uName.includes('mala') || uEmail.includes('mala')) matched = list.find(e => e.id === 'emp_6');
    else if (uName.includes('deepika') || uEmail.includes('deepika')) matched = list.find(e => e.id === 'emp_7');
  }

  const finalName = matched?.name || userName || 'Team Member';
  const finalEmail = matched?.email || userEmail || (
    uName.includes('rudra') ? 'rudra@bytepx.com' :
    uName.includes('tanmay') ? 'tanmay.jain@bytepx.com' :
    uName.includes('pavana') ? 'pavana@bytepx.com' :
    uName.includes('prerna') ? 'prerna@bytepx.com' :
    uName.includes('rohit') ? 'rohit@bytepx.com' :
    uName.includes('mala') ? 'mala@bytepx.com' :
    uName.includes('deepika') ? 'deepika@bytepx.com' :
    (finalName !== 'Team Member' ? `${finalName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@bytepx.com` : 'team@bytepx.com')
  );

  return {
    employeeId: matched?.id || null,
    name: finalName,
    email: finalEmail,
    dept: matched?.dept || "Engineering"
  };
}

// Cache of recently processed event IDs to prevent duplicate webhook delivery
const processedEventIds = new Map<string, number>();

function isDuplicateWebhook(event: any): boolean {
  // Deduplicate strictly by message name or user-scoped action/timestamp
  const messageName =
    event.message?.name ||
    event.chat?.messagePayload?.message?.name;

  const userIdent =
    event.user?.name ||
    event.chat?.user?.name ||
    event.chat?.messagePayload?.message?.sender?.name ||
    event.commonEventObject?.userName ||
    event.user?.displayName ||
    '';

  const eventTime = event.eventTime || '';

  let eventId: string | null = null;
  if (messageName) {
    eventId = `msg::${messageName}`;
  } else if (userIdent && eventTime) {
    eventId = `evt::${userIdent}::${eventTime}`;
  } else if (userIdent && (event.action?.actionMethodName || event.commonEventObject?.invokedFunction)) {
    const action = event.action?.actionMethodName || event.commonEventObject?.invokedFunction;
    const bucket = Math.floor(Date.now() / 3000); // 3-second debounce window scoped to this specific user
    eventId = `act::${userIdent}::${action}::${bucket}`;
  }

  if (!eventId) return false;
  const now = Date.now();
  // Prune entries older than 2 minutes
  for (const [k, time] of processedEventIds.entries()) {
    if (now - time > 120000) processedEventIds.delete(k);
  }

  if (processedEventIds.has(eventId)) {
    return true;
  }
  processedEventIds.set(eventId, now);
  return false;
}

export async function POST(req: NextRequest) {
  let event: any;
  try {
    event = await req.json();
  } catch {
    return chatJson(formatChatResponse({ text: 'Invalid JSON payload' }));
  }

  // Deduplicate rapid webhook retries from Google Chat
  if (isDuplicateWebhook(event)) {
    return chatJson({});
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
    userName.toLowerCase().includes('rohit') ? 'rohit@bytepx.com' :
    userName.toLowerCase().includes('mala') ? 'mala@bytepx.com' :
    userName.toLowerCase().includes('deepika') ? 'deepika@bytepx.com' :
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
    } catch (e) {}
  }

  try {
    // -------------------------------------------------------------
    // EVENT 1: ADDED TO SPACE / ONBOARDING
    // -------------------------------------------------------------
    if (eventType === 'ADDED_TO_SPACE') {
      const prompt = getPositiveMorningGreeting(firstName);
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
        const draft = await db.getPendingDraft(userKey, spaceName, userName);
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

        await db.saveStandup(record);
        await db.clearPendingDraft(userKey, spaceName, userName);

        const confirmationCard = buildStandupConfirmationCard({
          employeeName: record.name,
          project: record.project,
          tasks: record.tasks,
          hours: record.hours,
          blocker: record.blocker,
          time: timeStr,
          date: record.date || dateStr
        });

        return chatJson(formatChatResponse(confirmationCard, { isCardAction: true }));
      }

      // Branch 2B: Handle Initial 1-Click Hour Selection (submitHours)
      const hoursParam = paramsMap.hours || paramsMap.hour || paramsMap.value;
      if (hoursParam) {
        const parsedFloat = parseFloat(hoursParam.trim());
        const selectedHours = Number.isFinite(parsedFloat) && parsedFloat >= 0 && parsedFloat <= 24 ? parsedFloat : 8.0;
        const draft = await db.getPendingDraft(userKey, spaceName, userName);

        const cleanProj = (draft && draft.project && draft.project !== 'General Tasks') ? draft.project : 'Daily Tasks';
        const cleanTsk = (draft && draft.tasks && draft.tasks !== 'General tasks') ? draft.tasks : `${selectedHours} hrs logged`;
        const availHrs = draft?.availableHours || 0;
        const totalAccounted = +(selectedHours + availHrs).toFixed(1);
        const finalBlocker = draft ? draft.blocker : "None";

        const empInfo = resolveEmployeeIdentity(userName, userEmail, spaceName);
        const record: StandupRecord = {
          id: "std_" + Date.now(),
          employeeId: empInfo.employeeId,
          name: empInfo.name,
          email: empInfo.email,
          dept: empInfo.dept,
          tasks: cleanTsk,
          hours: selectedHours,
          project: cleanProj,
          blocker: finalBlocker,
          date: dateStr,
          time: timeStr,
          source: "Google Chat 1:1 Bot (Interactive)"
        };

        await db.saveStandup(record);

        if (selectedHours < 8.0) {
          await db.savePendingDraft(userKey, {
            tasks: cleanTsk,
            project: cleanProj,
            hours: selectedHours,
            blocker: finalBlocker,
            date: dateStr
          }, spaceName, userName);

          const rem = +(8.0 - selectedHours).toFixed(1);
          const capacityCard = buildRemainingHoursCard({
            userName: firstName,
            project: cleanProj,
            tasks: cleanTsk,
            loggedHours: selectedHours,
            remainingHours: rem
          });
          return chatJson(formatChatResponse(capacityCard, { isCardAction: true }));
        }

        await db.clearPendingDraft(userKey, spaceName, userName);

        const confirmationCard = buildStandupConfirmationCard({
          employeeName: record.name,
          project: record.project,
          tasks: record.tasks,
          hours: record.hours,
          blocker: record.blocker,
          time: timeStr,
          date: record.date || dateStr
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
      const prompt = getPositiveMorningGreeting(firstName);
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

    // If message is a non-work activity (e.g. "personal work", "personal stuff", "break", etc.), reject as invalid task entry
    if (parsed.isNonWorkActivity) {
      const nonWorkCard = buildNonWorkActivityCard({
        userName: firstName,
        inputPhrase: cleanText
      });
      return chatJson(formatChatResponse(nonWorkCard));
    }

    const now = new Date();
    const timeStr = formatLocalTime(now);
    const dateStr = formatLocalDate(now);
    let existingDraft = await db.getPendingDraft(userKey, spaceName, userName);

    // Check if user already submitted a standup today (to flag as update/override)
    const existingStandups = await db.getStandups();
    const existingStandupToday = existingStandups.find(s => {
      if (!isStandupForToday(s.date)) return false;
      const sEmail = (s.email || '').toLowerCase().trim();
      const sName = (s.name || '').toLowerCase().trim();
      const sFirst = sName.split(' ')[0];
      if (userEmail && sEmail && sEmail === userEmail.toLowerCase()) return true;
      if (userName && sName && (sName === userName.toLowerCase() || sName.includes(userName.toLowerCase()))) return true;
      if (firstName && (sFirst === firstName.toLowerCase() || sName.includes(firstName.toLowerCase()))) return true;
      return false;
    });

    const isUpdate = Boolean(existingStandupToday);

    // Check if user explicitly asked to reset/cancel draft
    const isExplicitReset = /^(?:reset|cancel|start\s*over|restart|clear|new\s*standup)$/i.test(cleanText.trim());
    if (existingDraft && isExplicitReset) {
      await db.clearPendingDraft(userKey, spaceName, userName);
      const promptCard = buildStandupPromptCard({
        userName: firstName,
        prompt: "Draft cleared! What are your fresh planned tasks and hours for today?"
      });
      return chatJson(formatChatResponse(promptCard));
    }

    // =========================================================================
    // CASE 1: USER IS REPLYING TO AN EXISTING DRAFT (e.g. providing hours)
    // =========================================================================
    if (existingDraft) {
      const prevHours = (existingDraft.hours && existingDraft.hours > 0) ? existingDraft.hours : 0;
      let chosenHours = prevHours;
      let chosenTasks = existingDraft.tasks || cleanText;
      let chosenProject = existingDraft.project || 'Daily Tasks';
      let chosenBlocker = existingDraft.blocker || 'None';

      const hasExplicitBlocker = (parsed.blocker && parsed.blocker !== 'None') || /^blocker[:\s-]/i.test(cleanText);
      const isAwaiting = parsed.isAwaitingTask || /awaiting|bench|no\s+task|free/i.test(lowerText);
      const isLeave = parsed.isOnLeave || /half\s+day|day\s+off|leave/i.test(lowerText);

      if (hasExplicitBlocker && (!parsed.hasExplicitHours || parsed.isOnlyHours === false)) {
        // Employee is providing their blocker for the remaining time!
        chosenBlocker = parsed.blocker && parsed.blocker !== 'None'
          ? parsed.blocker
          : cleanText.replace(/^blocker[:\s-]*/i, '').trim() || 'Blocked';
        chosenTasks = existingDraft.tasks || chosenTasks;
      } else if (isLeave) {
        chosenTasks = `${existingDraft.tasks} (Half-Day Leave)`;
        chosenBlocker = 'Half-Day Leave';
      } else if (isAwaiting) {
        const rem = prevHours > 0 ? +(8.0 - prevHours).toFixed(1) : 0;
        chosenBlocker = rem > 0 ? `Awaiting task allocation for ${rem} hrs` : 'Awaiting task allocation';
        chosenTasks = existingDraft.tasks || chosenTasks;
      } else if (parsed.isOnlyHours || parsed.hasExplicitHours) {
        // If parsed standup alone accounts for 8.0+ hours, or contains multiple projects,
        // treat it as a complete standup replacement rather than appending to partial draft
        if (parsed.hours >= 8.0 || (parsed.project && parsed.project.includes('+'))) {
          chosenHours = parsed.hours;
          chosenTasks = parsed.tasks;
          chosenProject = parsed.project;
        } else {
          const addHours = parsed.hours > 0 ? parsed.hours : 0;
          chosenHours = prevHours > 0
            ? +(prevHours + addHours).toFixed(1)
            : addHours;

          // Clean any previous typo/hours artifacts from existing draft
          const cleanPrevProject = chosenProject.replace(/\s*\b\d+(?:\.\d+)?\s*(?:hours?|hoyrs?|hrss?|hrs?|hourse?|houre?|hurs?|hur|hors?|hor|ours?|our|hrus|h)\b/gi, '').trim();
          const cleanPrevTasks = chosenTasks.replace(/\s*\b\d+(?:\.\d+)?\s*(?:hours?|hoyrs?|hrss?|hrs?|hourse?|houre?|hurs?|hur|hors?|hor|ours?|our|hrus|h)\b/gi, '').trim();

          if (parsed.tasks && parsed.tasks !== cleanText && parsed.tasks.length > 2 && !parsed.isOnlyHours) {
            chosenTasks = `${cleanPrevTasks}, ${parsed.tasks}`;
          } else if (cleanText && !parsed.isOnlyHours && cleanText.length > 3) {
            chosenTasks = `${cleanPrevTasks}, ${parsed.tasks || cleanText}`;
          }
          if (parsed.project && parsed.project !== 'Daily Tasks' && !cleanPrevProject.toLowerCase().includes(parsed.project.toLowerCase())) {
            chosenProject = `${cleanPrevProject} + ${parsed.project}`;
          } else {
            chosenProject = cleanPrevProject || parsed.project;
          }
        }
      } else {
        // User typed more tasks without explicit hours
        chosenTasks = parsed.tasks && parsed.tasks !== cleanText
          ? `${existingDraft.tasks}, ${parsed.tasks}`
          : `${existingDraft.tasks}, ${cleanText}`;
      }

      // If user had NO hours in draft AND provided no hours in reply, ask for hours
      if (chosenHours <= 0 && !isLeave && !isAwaiting) {
        await db.savePendingDraft(userKey, {
          tasks: chosenTasks,
          project: chosenProject,
          blocker: chosenBlocker,
          date: dateStr
        }, spaceName, userName);

        const hoursCard = buildHoursRequestCard({
          userName: firstName,
          tasks: chosenTasks,
          project: chosenProject
        });

        return chatJson(formatChatResponse(hoursCard));
      }

      const finalBlocker = chosenBlocker || "None";

      // Save standup record immediately to database and dashboard!
      const empInfo = resolveEmployeeIdentity(userName, userEmail, spaceName);
      const record: StandupRecord = {
        id: "std_" + Date.now(),
        employeeId: empInfo.employeeId,
        name: empInfo.name,
        email: empInfo.email,
        dept: empInfo.dept,
        tasks: chosenTasks,
        taskList: parsed.taskList,
        hours: chosenHours,
        project: chosenProject,
        blocker: finalBlocker,
        date: dateStr,
        time: timeStr,
        source: "Google Chat 1:1 Bot",
        rawText: cleanText
      };

      await db.saveStandup(record);

      // If the employee provided an explicit blocker, bench/awaiting, leave, OR reached 8.0 hrs:
      // The standup is complete!
      if (hasExplicitBlocker || isAwaiting || isLeave || chosenHours >= 8.0) {
        await db.clearPendingDraft(userKey, spaceName, userName);

        const confirmationCard = buildStandupConfirmationCard({
          employeeName: record.name,
          project: record.project,
          tasks: record.tasks,
          hours: record.hours,
          blocker: record.blocker,
          time: timeStr,
          date: record.date || dateStr,
          isUpdate
        });

        return chatJson(formatChatResponse(confirmationCard));
      }

      // If still fewer than 8.0 hrs and no blocker given, ask for the remaining hours again
      if (chosenHours < 8.0) {
        await db.savePendingDraft(userKey, {
          tasks: chosenTasks,
          project: chosenProject,
          hours: chosenHours,
          blocker: finalBlocker,
          date: dateStr
        }, spaceName, userName);

        const rem = +(8.0 - chosenHours).toFixed(1);
        const capacityCard = buildRemainingHoursCard({
          userName: firstName,
          project: chosenProject,
          tasks: chosenTasks,
          loggedHours: chosenHours,
          remainingHours: rem
        });
        return chatJson(formatChatResponse(capacityCard));
      }

      await db.clearPendingDraft(userKey, spaceName, userName);

      const confirmationCard = buildStandupConfirmationCard({
        employeeName: record.name,
        project: record.project,
        tasks: record.tasks,
        hours: record.hours,
        blocker: record.blocker,
        time: timeStr,
        date: record.date || dateStr,
        isUpdate
      });

      return chatJson(formatChatResponse(confirmationCard));
    }

    // =========================================================================
    // CASE 2: USER PROVIDED NO HOURS AT ALL (e.g. "Working on feature X")
    // =========================================================================
    // Never default hours automatically — prompt the employee to specify!
    if (!parsed.hasExplicitHours && !parsed.isOnLeave && !parsed.isAwaitingTask) {
      const draftProject = parsed.project || 'Daily Tasks';
      const draftTasks = parsed.tasks || cleanText;

      await db.savePendingDraft(userKey, {
        tasks: draftTasks,
        project: draftProject,
        blocker: parsed.blocker || 'None',
        date: dateStr
      }, spaceName, userName);

      const hoursCard = buildHoursRequestCard({
        userName: firstName,
        tasks: draftTasks,
        project: draftProject
      });

      return chatJson(formatChatResponse(hoursCard));
    }

    // =========================================================================
    // CASE 3: USER PROVIDED BOTH TASKS AND HOURS (e.g. "Working on X for 7 hours")
    // =========================================================================
    let finalHours = parsed.hours > 0 ? parsed.hours : 0.0;
    if (parsed.isOnLeave || parsed.isAwaitingTask) {
      finalHours = 0.0;
    }

    const finalProject = parsed.project || (parsed.tasks ? parsed.tasks.split(/[,;\n]/)[0].slice(0, 35) : 'Daily Tasks');
    const finalTasks = parsed.tasks || cleanText;

    const availHrs = parsed.availableHours || 0;
    const finalBlocker = parsed.blocker || "None";

    const empInfo = resolveEmployeeIdentity(userName, userEmail, spaceName);
    const record: StandupRecord = {
      id: "std_" + Date.now(),
      employeeId: empInfo.employeeId,
      name: empInfo.name,
      email: empInfo.email,
      dept: empInfo.dept,
      tasks: finalTasks,
      taskList: parsed.taskList,
      hours: finalHours,
      project: finalProject,
      blocker: finalBlocker,
      date: dateStr,
      time: timeStr,
      source: "Google Chat 1:1 Bot",
      rawText: cleanText
    };

    // Save check-in immediately to database and cloud so their data is live on the dashboard!
    await db.saveStandup(record);

    // If logged hours < 8.0 hrs (and not on leave or awaiting task), prompt about remaining hours!
    if (finalHours > 0 && finalHours < 8.0 && !parsed.isOnLeave && !parsed.isAwaitingTask) {
      const remHours = +(8.0 - finalHours).toFixed(1);
      await db.savePendingDraft(userKey, {
        tasks: finalTasks,
        project: finalProject,
        hours: finalHours,
        blocker: finalBlocker,
        date: dateStr
      }, spaceName, userName);

      const capacityCard = buildRemainingHoursCard({
        userName: firstName,
        project: finalProject,
        tasks: finalTasks,
        loggedHours: finalHours,
        remainingHours: remHours,
        availableHours: availHrs
      });

      return chatJson(formatChatResponse(capacityCard));
    }

    await db.clearPendingDraft(userKey, spaceName, userName);

    // Return Standup Confirmation Card directly
    const confirmationCard = buildStandupConfirmationCard({
      employeeName: record.name,
      project: record.project,
      tasks: record.tasks,
      hours: record.hours,
      blocker: record.blocker,
      time: timeStr,
      date: record.date || dateStr,
      isUpdate
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

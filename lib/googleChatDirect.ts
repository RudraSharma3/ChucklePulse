import crypto from 'crypto';
import { db } from './db';
import {
  buildStandupPromptCard,
  formatLocalDate,
  getLocalHour,
  getLocalMinute,
  getPositiveMorningGreeting
} from './googleChatHelper';
import { Employee, StandupRecord } from './types';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Resolves Google Cloud Service Account credentials from Environment or Settings
 */
export function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  // 1. Check process.env.GOOGLE_SERVICE_ACCOUNT_KEY (JSON string)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
          project_id: parsed.project_id
        };
      }
    } catch (e) {}
  }

  // 2. Check process.env.GOOGLE_CLIENT_EMAIL and process.env.GOOGLE_PRIVATE_KEY
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      project_id: process.env.GOOGLE_PROJECT_ID
    };
  }

  // 3. Check Settings from DB / Dashboard
  try {
    const settings = db.getSettingsSync();
    if (settings.googleServiceAccountKey) {
      const parsed = JSON.parse(settings.googleServiceAccountKey);
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
          project_id: parsed.project_id
        };
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Generates a Google OAuth2 Bearer Access Token using Service Account JWT assertion
 */
export async function getGoogleChatAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const creds = getServiceAccountCredentials();
  if (!creds) {
    throw new Error("No Google Service Account credentials configured. Set GOOGLE_SERVICE_ACCOUNT_KEY in .env or Settings.");
  }

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const claimSet = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/chat.bot https://www.googleapis.com/auth/chat.messages.create https://www.googleapis.com/auth/chat.messages.readonly https://www.googleapis.com/auth/chat.spaces.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaimSet = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  signer.end();

  const signature = signer.sign(creds.private_key, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    }).toString()
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Google OAuth token request failed (${tokenRes.status}): ${errBody}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600;

  cachedToken = {
    token: accessToken,
    expiresAt: now + expiresIn
  };

  return accessToken;
}

/**
 * Sends a Card v2 or text message directly to a Google Chat space using Service Account
 */
export async function sendDirectMessageToSpace(spaceName: string, payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const token = await getGoogleChatAccessToken();
    const cleanSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
    const url = `https://chat.googleapis.com/v1/${cleanSpace}/messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify(payload)
    });

    const resJson = await res.json();
    if (!res.ok || resJson.error) {
      return {
        success: false,
        error: resJson.error?.message || `Google Chat API error (${res.status})`
      };
    }

    return { success: true, data: resJson };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Scans Google Chat API spaces and memberships in real-time to find 1:1 DMs for all employees
 */
export async function discoverAllSpacesAndMembers(token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const listRes = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=100", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const spaces = data.spaces || [];
      for (const sp of spaces) {
        if (!sp.name) continue;
        try {
          const memRes = await fetch(`https://chat.googleapis.com/v1/${sp.name}/members`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (memRes.ok) {
            const memData = await memRes.json();
            const memberships = memData.memberships || [];
            for (const m of memberships) {
              const member = m.member || {};
              if (member.type === "HUMAN" || !member.name?.includes("app/")) {
                const email = (member.email || "").toLowerCase().trim();
                const displayName = (member.displayName || "").toLowerCase().trim();
                const firstName = displayName.split(' ')[0];

                if (email) map.set(email, sp.name);
                if (displayName) map.set(displayName, sp.name);
                if (firstName) map.set(firstName, sp.name);
              }
            }
          }
        } catch (memErr) {}
      }
    }
  } catch (e) {}
  return map;
}

/**
 * Finds or creates a 1:1 Direct Message Space with an employee via Google Chat API
 */
export async function findOrCreateDmSpace(email: string, token: string): Promise<string | null> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Try findDirectMessage by email
  try {
    const findUrl = `https://chat.googleapis.com/v1/spaces:findDirectMessage?name=users/${encodeURIComponent(cleanEmail)}`;
    const findRes = await fetch(findUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (findRes.ok) {
      const data = await findRes.json();
      if (data.name && (cleanEmail === 'rudra@bytepx.com' || data.name !== 'spaces/iJ9VmqAAAAE')) {
        return data.name;
      }
    }
  } catch (e) {}

  // 2. Try spaces:setup to initialize 1:1 bot DM
  try {
    const setupUrl = `https://chat.googleapis.com/v1/spaces:setup`;
    const setupRes = await fetch(setupUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        space: {
          spaceType: "DIRECT_MESSAGE",
          singleUserBotDm: true
        },
        membership: {
          member: {
            name: `users/${cleanEmail}`,
            type: "HUMAN"
          }
        }
      })
    });
    if (setupRes.ok) {
      const data = await setupRes.json();
      if (data.name && (cleanEmail === 'rudra@bytepx.com' || data.name !== 'spaces/iJ9VmqAAAAE')) {
        return data.name;
      }
    }
  } catch (e) {}

  return null;
}

// Cache of last message dispatch timestamps to prevent double-popups within 20 minutes
const lastDispatchTimestamps: Map<string, number> = new Map();

/**
 * Validates if a standup record belongs to today (supporting local IST date, UTC, or within 18 hours)
 */
export function isStandupForToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const now = new Date();
  const todayLocal = formatLocalDate(now).trim();
  const todayUTC = now.toISOString().slice(0, 10);
  const clean = dateStr.trim();

  if (clean === todayLocal || clean === todayUTC) return true;

  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const pLocal = formatLocalDate(parsed).trim();
      const pUTC = parsed.toISOString().slice(0, 10);
      if (pLocal === todayLocal || pUTC === todayUTC) return true;
      if (now.getTime() - parsed.getTime() < 18 * 60 * 60 * 1000 && now.getTime() >= parsed.getTime()) {
        return true;
      }
    }
  } catch (e) {}

  return false;
}

// Daily nudge tracking to ensure no employee is nudged more than once per day
const dailyNudgedEmployees: Map<string, string> = new Map(); // key -> YYYY-MM-DD

/**
 * Checks if an employee has already submitted their standup, leave, or input for today
 */
export function isEmployeeCompletedToday(emp: Employee, standups: StandupRecord[]): boolean {
  const todayLocal = formatLocalDate(new Date()).trim();

  // 1. Direct check on employee metadata
  if (emp.lastStandupDate && isStandupForToday(emp.lastStandupDate)) {
    return true;
  }

  // 2. Direct check on employee pending draft (if draft exists from today, employee already replied/filled input!)
  if (emp.pendingDraft && (emp.pendingDraft.date === todayLocal || isStandupForToday(emp.pendingDraft.date))) {
    return true;
  }

  const empEmail = (emp.email || "").toLowerCase().trim();
  const empName = (emp.name || "").toLowerCase().trim();
  const empFirst = empName.split(' ')[0];
  const empPrefix = empEmail.split('@')[0];

  // 3. Direct check on synchronous draft
  const syncDraft = db.getPendingDraftSync(empEmail);
  if (syncDraft && (syncDraft.date === todayLocal || isStandupForToday(syncDraft.date))) {
    return true;
  }

  return standups.some(s => {
    if (!isStandupForToday(s.date)) return false;

    const sEmail = (s.email || "").toLowerCase().trim();
    const sName = (s.name || "").toLowerCase().trim();
    const sFirst = sName.split(' ')[0];
    const sPrefix = sEmail.split('@')[0];

    // Check identity match
    let isMatch = false;
    if (empEmail && sEmail && empEmail === sEmail) isMatch = true;
    else if (empPrefix && sPrefix && empPrefix === sPrefix) isMatch = true;
    else if (empPrefix && sPrefix && (empPrefix.replace(/[^a-z]/g, '') === sPrefix.replace(/[^a-z]/g, ''))) isMatch = true;
    else if (empName && sName && (empName === sName || empName.includes(sName) || sName.includes(empName))) isMatch = true;
    else if (empFirst && sFirst && empFirst.length >= 3 && empFirst === sFirst) isMatch = true;

    return isMatch;
  });
}

/**
 * Verifies if there has already been user or bot standup activity in the Google Chat 1:1 space today
 */
export async function hasSpaceActivityToday(spaceName: string, token: string): Promise<boolean> {
  try {
    const cleanSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
    const now = new Date();
    const todayLocal = formatLocalDate(now).trim();
    const todayUTC = now.toISOString().slice(0, 10);

    let messages: any[] = [];
    try {
      // Query newest messages first with orderBy=createTime DESC
      const res = await fetch(`https://chat.googleapis.com/v1/${cleanSpace}/messages?pageSize=25&orderBy=createTime%20DESC`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        messages = data.messages || [];
      }
    } catch (e) {}

    if (messages.length === 0) {
      try {
        const res = await fetch(`https://chat.googleapis.com/v1/${cleanSpace}/messages?pageSize=25`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          messages = data.messages || [];
        }
      } catch (e) {}
    }

    if (!messages || messages.length === 0) return false;

    for (const msg of messages) {
      const createTime: string = msg.createTime || "";
      if (!createTime) continue;
      const msgDate = new Date(createTime);
      const msgLocal = formatLocalDate(msgDate).trim();
      const msgUTC = createTime.slice(0, 10);

      const isToday = msgLocal === todayLocal || msgUTC === todayUTC || (now.getTime() - msgDate.getTime() < 16 * 60 * 60 * 1000);
      if (isToday) {
        // 1. If human sent ANY message today:
        if (msg.sender?.type === 'HUMAN' || msg.sender?.type === 'USER') {
          return true;
        }
        // 2. If bot already processed or replied to input today:
        const textContent = JSON.stringify(msg);
        if (
          textContent.includes('Standup Logged') ||
          textContent.includes('Standup Recorded') ||
          textContent.includes('Standup Updated') ||
          textContent.includes('Capacity Check') ||
          textContent.includes('Daily Capacity Check') ||
          textContent.includes('Confirmation')
        ) {
          return true;
        }
      }
    }
  } catch (e) {}
  return false;
}

/**
 * Broadcasts the standup prompt (or nudge) directly to all employees in 1:1 DMs via Service Account
 */
export async function broadcastDirectStandup(isNudge: boolean = false) {
  // Strictly enforce 12:00 PM cutoff: No follow-up nudges permitted after 12:00 PM local time
  if (isNudge) {
    const currentHour = getLocalHour(new Date());
    const currentMinute = getLocalMinute(new Date());
    // Strictly allowed up to 12:00 PM (with 2-min execution grace up to 12:02 PM)
    if (currentHour > 12 || (currentHour === 12 && currentMinute > 2)) {
      console.log(`[StandupBot] Follow-up window closed (current local time is ${currentHour}:${currentMinute}). Nudges are only sent before 12:00 PM.`);
      return {
        success: true,
        sent: 0,
        totalTargetEmployees: 0,
        targets: [],
        errors: ["Follow-up window closed: Standup follow-ups are strictly allowed before 12:00 PM only."]
      };
    }
  }

  const settings = await db.getSettings();
  const employees = await db.getEmployees();
  const standups = await db.getStandups();
  const todayLocal = formatLocalDate(new Date()).trim();

  // Filter out any employee who has ALREADY completed their standup today.
  // Both morning prompt and follow-up nudge NEVER re-prompt someone who already finished!
  const eligibleEmployees = employees.filter(emp => {
    if (!emp.email && !emp.name) return false;
    if (isEmployeeCompletedToday(emp, standups)) return false;
    return true;
  });

  let sent = 0;
  const errors: string[] = [];
  const successfulTargets: Array<{ name: string; email: string; space: string }> = [];

  let token: string;
  try {
    token = await getGoogleChatAccessToken();
  } catch (tokenErr: any) {
    return {
      success: false,
      sent: 0,
      totalTargetEmployees: eligibleEmployees.length,
      targets: [],
      errors: [`Google Auth Failed: ${tokenErr.message}`]
    };
  }

  let dbUpdated = false;

  // Real-time scan of all Google Chat spaces and members
  let discoveredSpaces = new Map<string, string>();
  try {
    discoveredSpaces = await discoverAllSpacesAndMembers(token);
  } catch (dErr) {}

  for (const emp of eligibleEmployees) {
    const empIdentifier = (emp.email || emp.name).toLowerCase();

    // In nudge mode, strictly enforce once-per-day follow-up
    if (isNudge) {
      const lastNudgeDate = dailyNudgedEmployees.get(empIdentifier);
      if (lastNudgeDate === todayLocal) {
        continue;
      }
    }

    let spaceName = emp.webhookUrl;

    // Sanity check: Ensure Rudra's space is not accidentally assigned to other employees
    if (spaceName && emp.email.toLowerCase() !== 'rudra@bytepx.com' && spaceName === 'spaces/iJ9VmqAAAAE') {
      spaceName = undefined;
      emp.webhookUrl = '';
      dbUpdated = true;
    }

    // Try finding space from real-time discovered spaces
    if (!spaceName || !spaceName.startsWith('spaces/')) {
      const cleanEmail = emp.email.toLowerCase().trim();
      const empName = emp.name.toLowerCase().trim();
      const firstName = empName.split(' ')[0];
      const usernamePrefix = cleanEmail.split('@')[0];

      const found = discoveredSpaces.get(cleanEmail) ||
                    discoveredSpaces.get(empName) ||
                    discoveredSpaces.get(firstName) ||
                    discoveredSpaces.get(usernamePrefix);

      if (found && (cleanEmail === 'rudra@bytepx.com' || found !== 'spaces/iJ9VmqAAAAE')) {
        spaceName = found;
        emp.webhookUrl = found;
        dbUpdated = true;
      }
    }

    // Fallback: Try findOrCreateDmSpace
    if (!spaceName || !spaceName.startsWith('spaces/')) {
      const discoveredSpace = await findOrCreateDmSpace(emp.email, token);
      if (discoveredSpace && (emp.email.toLowerCase() === 'rudra@bytepx.com' || discoveredSpace !== 'spaces/iJ9VmqAAAAE')) {
        spaceName = discoveredSpace;
        emp.webhookUrl = discoveredSpace;
        dbUpdated = true;
      }
    }

    if (!spaceName) {
      errors.push(`${emp.name} (${emp.email}): 1:1 DM space pending (employee has not opened chat with Bot yet)`);
      continue;
    }

    // Anti-spam guard: Never re-prompt the same employee within 30 minutes (prevents duplicate crons/clicks)
    const dispatchKey = `${empIdentifier}::${spaceName}`;
    const lastDispatched = lastDispatchTimestamps.get(dispatchKey) || 0;
    const nowMs = Date.now();
    if (nowMs - lastDispatched < 30 * 60 * 1000) {
      continue;
    }

    // Direct Google Chat Space History check: Has this space already seen user activity or confirmation today?
    const hasSpaceActivity = await hasSpaceActivityToday(spaceName, token);
    if (hasSpaceActivity) {
      continue;
    }

    const firstName = emp.name.split(' ')[0] || "Champion";
    const userKey = emp.email.toLowerCase();

    // In nudge mode: if employee already replied or has a draft, DO NOT send a follow-up popup!
    if (isNudge) {
      const draft = await db.getPendingDraft(userKey, spaceName, emp.name);
      if (draft && (draft.date === todayLocal || isStandupForToday(draft.date))) {
        continue;
      }
    }

    const isCustomPrompt = settings.botPrompt &&
      !settings.botPrompt.includes("Coffee level at 80%") &&
      !settings.botPrompt.includes("coffee level") &&
      settings.botPrompt.trim().length > 10;

    const promptText = isNudge
      ? "⏰ Friendly Standup Reminder! Just checking in—did you get a chance to log your tasks and hours for today?"
      : (isCustomPrompt ? settings.botPrompt : getPositiveMorningGreeting(firstName));

    const card = buildStandupPromptCard({
      userName: firstName,
      prompt: promptText
    });

    const result = await sendDirectMessageToSpace(spaceName, card);
    if (result.success) {
      lastDispatchTimestamps.set(dispatchKey, nowMs);
      if (isNudge) {
        dailyNudgedEmployees.set(empIdentifier, todayLocal);
      }
      sent++;
      successfulTargets.push({ name: emp.name, email: emp.email, space: spaceName });
    } else {
      errors.push(`${emp.name} (${emp.email}): ${result.error}`);
    }
  }

  if (dbUpdated) {
    db.saveEmployees(employees);
  }

  return {
    success: sent > 0 || errors.length === 0,
    sent,
    totalTargetEmployees: eligibleEmployees.length,
    targets: successfulTargets,
    errors
  };
}

/**
 * Scans active employee Google Chat spaces to reconstruct today's standup entries directly
 * from real-time Google Chat messages (resolves serverless cold container desync!).
 */
export async function syncStandupsFromGoogleChat(): Promise<StandupRecord[]> {
  try {
    const creds = getServiceAccountCredentials();
    if (!creds) return [];
    const token = await getGoogleChatAccessToken();
    const employees = await db.getEmployees();
    const now = new Date();
    const todayLocal = formatLocalDate(now).trim();
    const todayUTC = now.toISOString().slice(0, 10);
    const updatedStandups: StandupRecord[] = [];

    for (const emp of employees) {
      const spaceName = emp.webhookUrl;
      if (!spaceName || !spaceName.startsWith('spaces/')) continue;
      const cleanSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;

      try {
        const res = await fetch(`https://chat.googleapis.com/v1/${cleanSpace}/messages?pageSize=15&orderBy=createTime%20DESC`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) continue;
        const data = await res.json();
        const messages = data.messages || [];

        // Find today's latest human message or confirmation card
        for (const msg of messages) {
          const createTime = msg.createTime || "";
          if (!createTime) continue;
          const msgDate = new Date(createTime);
          const msgLocal = formatLocalDate(msgDate).trim();
          const msgUTC = createTime.slice(0, 10);
          const isToday = msgLocal === todayLocal || msgUTC === todayUTC || (now.getTime() - msgDate.getTime() < 18 * 60 * 60 * 1000);
          if (!isToday) continue;

          // If human sent a standup message
          if ((msg.sender?.type === 'HUMAN' || msg.sender?.type === 'USER') && msg.text) {
            const cleanText = msg.text.replace(/^<users\/[^>]+>\s*/i, '').replace(/^@[\w\s.-]+\s*/i, '').trim();
            if (cleanText.length >= 3 && !['hi', 'hello', 'hey', 'help'].includes(cleanText.toLowerCase())) {
              const { parseStandupMessage } = await import('./parser');
              const parsed = parseStandupMessage(cleanText);
              if (parsed.hasExplicitHours || parsed.isOnLeave || parsed.isAwaitingTask || parsed.hours > 0) {
                const rec: StandupRecord = {
                  id: `std_${msgDate.getTime()}`,
                  employeeId: emp.id,
                  name: emp.name,
                  email: emp.email,
                  dept: emp.dept || 'Engineering',
                  tasks: parsed.tasks,
                  taskList: parsed.taskList,
                  hours: parsed.hours,
                  project: parsed.project,
                  blocker: parsed.blocker,
                  date: msgLocal,
                  time: msgDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: true }),
                  source: "Google Chat 1:1 Bot",
                  rawText: cleanText
                };
                await db.saveStandup(rec);
                updatedStandups.push(rec);
                break;
              }
            }
          }
        }
      } catch (e) {}
    }
    return updatedStandups;
  } catch (err) {
    return [];
  }
}


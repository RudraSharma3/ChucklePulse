import crypto from 'crypto';
import { db } from './db';
import { buildStandupPromptCard, buildRemainingHoursCard, formatLocalDate } from './googleChatHelper';
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
    const settings = db.getSettings();
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
    scope: "https://www.googleapis.com/auth/chat.bot https://www.googleapis.com/auth/chat.messages.create https://www.googleapis.com/auth/chat.spaces.readonly",
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

/**
 * Checks if an employee has already submitted their full standup or leave for today
 */
export function isEmployeeCompletedToday(emp: Employee, standups: StandupRecord[]): boolean {
  const empEmail = (emp.email || "").toLowerCase().trim();
  const empName = (emp.name || "").toLowerCase().trim();
  const empFirst = empName.split(' ')[0];
  const empPrefix = empEmail.split('@')[0];

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

    if (!isMatch) return false;

    // A completed standup has logged hours >= 8, valid tasks, or marked leave
    const hasHours = s.hours !== undefined && s.hours >= 8.0;
    const hasTasks = Boolean(s.tasks && s.tasks.trim().length > 3 && s.tasks.toLowerCase() !== 'general tasks');
    const isLeave = Boolean(
      (s.blocker && s.blocker.toLowerCase().includes('leave')) ||
      (s.tasks && s.tasks.toLowerCase().includes('leave'))
    );

    return hasHours || hasTasks || isLeave;
  });
}

/**
 * Broadcasts the standup prompt (or nudge) directly to all employees in 1:1 DMs via Service Account
 */
export async function broadcastDirectStandup(isNudge: boolean = false) {
  const settings = await db.getSettings();
  const employees = await db.getEmployees();
  const standups = await db.getStandups();

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

    // Anti-spam guard: Never re-prompt the same employee within 20 minutes (prevents duplicate crons/clicks)
    const dispatchKey = `${(emp.email || emp.name).toLowerCase()}::${spaceName}`;
    const lastDispatched = lastDispatchTimestamps.get(dispatchKey) || 0;
    const nowMs = Date.now();
    if (nowMs - lastDispatched < 20 * 60 * 1000) {
      continue;
    }

    const firstName = emp.name.split(' ')[0] || "Champion";
    const userKey = emp.email.toLowerCase();
    const draft = isNudge ? (await db.getPendingDraft(userKey, spaceName, emp.name)) : null;

    let card;
    if (isNudge && draft && draft.hours && draft.hours > 0 && draft.remainingHours > 0) {
      // Personalized follow-up showing logged hours so far & asking for remainder
      card = buildRemainingHoursCard({
        userName: firstName,
        project: draft.project,
        tasks: draft.tasks,
        loggedHours: draft.hours,
        remainingHours: draft.remainingHours
      });
    } else {
      const promptText = isNudge
        ? "⏰ Friendly Standup Reminder! Just checking in—did you get a chance to log your tasks and hours for today?"
        : (settings.botPrompt || "Good morning champion! ☕ What epic tasks are you tackling today?");

      card = buildStandupPromptCard({
        userName: firstName,
        prompt: promptText
      });
    }

    const result = await sendDirectMessageToSpace(spaceName, card);
    if (result.success) {
      lastDispatchTimestamps.set(dispatchKey, nowMs);
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


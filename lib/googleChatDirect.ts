import crypto from 'crypto';
import { db } from './db';
import { buildStandupPromptCard } from './googleChatHelper';

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
      if (data.name) return data.name;
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
      if (data.name) return data.name;
    }
  } catch (e) {}

  // 3. Fallback: Scan all active spaces where bot is added
  try {
    const listRes = await fetch("https://chat.googleapis.com/v1/spaces", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const spaces = data.spaces || [];
      for (const sp of spaces) {
        if (sp.name) {
          try {
            const memRes = await fetch(`https://chat.googleapis.com/v1/${sp.name}/members`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (memRes.ok) {
              const memData = await memRes.json();
              const memberships = memData.memberships || [];
              for (const m of memberships) {
                if (m.member?.email?.toLowerCase() === cleanEmail || m.member?.name?.toLowerCase().includes(cleanEmail.split('@')[0])) {
                  return sp.name;
                }
              }
            }
          } catch (memErr) {}
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Broadcasts the standup prompt (or nudge) directly to all employees in 1:1 DMs via Service Account
 */
export async function broadcastDirectStandup(isNudge: boolean = false) {
  const settings = db.getSettings();
  const employees = db.getEmployees();
  const standups = db.getStandups();
  const today = new Date().toISOString().slice(0, 10);

  const completedEmails = new Set(
    standups.filter(s => s.date === today).map(s => s.email.toLowerCase())
  );

  const eligibleEmployees = employees.filter(emp => {
    if (isNudge && completedEmails.has(emp.email.toLowerCase())) return false;
    return Boolean(emp.email);
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

  for (const emp of eligibleEmployees) {
    let spaceName = emp.webhookUrl;

    // Sanity check: Ensure Rudra's space is not accidentally assigned to other employees
    if (spaceName && emp.email.toLowerCase() !== 'rudra@bytepx.com' && spaceName === 'spaces/iJ9VmqAAAAE') {
      spaceName = undefined;
      emp.webhookUrl = '';
      dbUpdated = true;
    }

    // If spaceName not yet saved for employee, auto-discover 1:1 DM space
    if (!spaceName || !spaceName.startsWith('spaces/')) {
      const discoveredSpace = await findOrCreateDmSpace(emp.email, token);
      if (discoveredSpace && discoveredSpace !== 'spaces/iJ9VmqAAAAE') {
        spaceName = discoveredSpace;
        emp.webhookUrl = discoveredSpace;
        dbUpdated = true;
      }
    }

    if (!spaceName) {
      errors.push(`${emp.name} (${emp.email}): 1:1 DM space pending (employee has not opened chat with Bot yet)`);
      continue;
    }

    const firstName = emp.name.split(' ')[0] || "Champion";
    const promptText = isNudge
      ? "⏰ Friendly Standup Reminder! Just checking in—did you get a chance to log your tasks and hours for today?"
      : (settings.botPrompt || "Good morning champion! ☕ What epic tasks are you tackling today?");

    const card = buildStandupPromptCard({
      userName: firstName,
      prompt: promptText
    });

    const result = await sendDirectMessageToSpace(spaceName, card);
    if (result.success) {
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

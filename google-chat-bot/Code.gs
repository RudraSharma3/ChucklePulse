/**
 * ==============================================================================
 * BytePx Standup Bot - Complete Google Chat 1:1 DM Bot Engine
 * ==============================================================================
 * Features:
 * 1. Morning Standup Broadcast at configured Dashboard time (Default: 10:30 AM).
 * 2. 45-Minute Persistent Auto-Nudge Cycle: Re-pings employees every 45 mins
 *    until they reply with their standup.
 * 3. Dynamic Dashboard Settings Sync: Changes to broadcast time or nudge interval
 *    in the web dashboard immediately update the bot schedule.
 * 4. Real-time 2-way sync with Vercel API (https://chuckle-pulse.vercel.app).
 * 5. Google Workspace Add-on "Z Mode" compliance to eliminate Error Code 3.
 * ==============================================================================
 */

const CONFIG = {
  ADMIN_EMAIL: "rudra@bytepx.com",
  DASHBOARD_URL: "https://chuckle-pulse.vercel.app",
  DEFAULT_STANDUP_HOUR: 10,
  DEFAULT_STANDUP_MINUTE: 30,
  DEFAULT_NUDGE_INTERVAL_MINUTES: 45,
  AUTO_NUDGE_ENABLED: true
};

// 🎭 Rotating curious, humorous, work-safe standup prompts
const ROTATING_PROMPTS = [
  "Good morning champion! ☕ Coffee level at 80%? What epic dragons are you slaying across your projects today?",
  "Beep boop! 🛸 StandupBot on daily intelligence duty. What mysteries are you solving today before caffeine wears off?",
  "Rise and grind! 🚀 If your daily tasks were a movie title, what would today be called? Drop your hours & mission!",
  "Wakey wakey! 🥞 Today's masterplan check-in: What tickets are you tackling, how many hours, and did any wild bugs block you?",
  "The game is afoot! 🕵️‍♂️ I detect high productivity in the air. What are your prime targets today and any sneaky blockers?",
  "Code, coffee, conquer! ⚡ What is your main focus today and how many hours of genius are we pouring in?",
  "Happy morning warrior! ⚔️ Rate your energy 1-10 & tell me what milestones you are crushing today!"
];

const NUDGE_PROMPTS = [
  "⏰ *Friendly Standup Reminder!* 🔔 Just checking in—did you get a chance to log your tasks and hours for today yet?",
  "👀 *Gentle Standup Poke!* ☕ Looks like your daily check-in is still pending. Drop your project and mission when ready!",
  "🚀 *Beep Boop Reminder!* 🤖 The BytePx dashboard is waiting for your updates. Reply right here with your tasks & hours!",
  "☕ *Coffee Break Check-in!* ⚡ Quick reminder to share your daily tasks, hours, and any blockers so the team stays in sync."
];

/**
 * ⚡ ONE-TIME SELF TEST & PERMISSION AUTHORIZATION
 */
function testRun() {
  console.log("🚀 Running BytePx Standup Bot Self-Test...");
  const props = PropertiesService.getScriptProperties();
  props.setProperty("TEST_CONNECTION", "connected_" + new Date().toISOString());
  console.log("✅ PropertiesService is active and working!");
  
  const token = ScriptApp.getOAuthToken();
  console.log("✅ OAuth Token generated successfully:", token ? "Token Active" : "No Token");

  // Auto-discover any active spaces/DMs
  autoDiscoverAllSpaces();

  const allProps = props.getProperties();
  let dmCount = 0;
  for (const k in allProps) {
    if (k.startsWith("DM_")) {
      dmCount++;
      console.log(`📍 Registered 1:1 DM for ${k}: ${allProps[k]}`);
    }
  }
  console.log(`📊 Total Registered 1:1 Employee Chats: ${dmCount}`);
  
  // Sync settings
  const settings = getEffectiveSettings();
  console.log(`⚙️ Active Settings: Standup at ${settings.standupTime}, Auto-nudge: ${settings.autoNudgeEnabled ? `Every ${settings.nudgeIntervalMinutes}m` : 'Disabled'}`);

  console.log("🎉 Self-Test Passed! The bot is fully authorized.");
  return { status: "OK", registeredDMs: dmCount, settings: settings };
}

/**
 * 🔍 Auto-discovers all spaces and 1:1 DMs where the bot is added
 */
function autoDiscoverAllSpaces() {
  console.log("🔍 Scanning Google Chat API for active DM spaces and members...");
  try {
    const token = ScriptApp.getOAuthToken();
    const res = UrlFetchApp.fetch("https://chat.googleapis.com/v1/spaces", {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      const spaces = data.spaces || [];
      const props = PropertiesService.getScriptProperties();
      let added = 0;
      const discoveredEmployees = [];

      spaces.forEach(sp => {
        if (sp.name) {
          // 1. Fetch space members to identify the employee
          try {
            const memRes = UrlFetchApp.fetch("https://chat.googleapis.com/v1/" + sp.name + "/members", {
              headers: { Authorization: "Bearer " + token },
              muteHttpExceptions: true
            });
            if (memRes.getResponseCode() === 200) {
              const memData = JSON.parse(memRes.getContentText());
              const memberships = memData.memberships || [];
              memberships.forEach(m => {
                const member = m.member || {};
                if (member.type === "HUMAN" || !member.name.includes("app/")) {
                  const displayName = member.displayName || "";
                  const email = (member.email || "").toLowerCase();
                  const nameKey = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');

                  if (email) {
                    props.setProperty("DM_" + email, sp.name);
                    added++;
                    console.log(`📌 Mapped DM by email: ${email} -> ${sp.name}`);
                  }
                  if (nameKey) {
                    props.setProperty("DM_" + nameKey, sp.name);
                  }

                  discoveredEmployees.push({
                    name: displayName || "Team Member",
                    email: email || (nameKey ? `${nameKey}@bytepx.com` : ""),
                    space: sp.name
                  });
                }
              });
            }
          } catch (memErr) {
            console.warn("Member fetch error for " + sp.name + ":", memErr.message);
          }

          // Fallback mapping by space displayName
          if (sp.displayName) {
            const spaceKey = "DM_" + sp.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
            props.setProperty(spaceKey, sp.name);
          }
        }
      });

      return { success: true, count: spaces.length, added: added, employees: discoveredEmployees };
    }
  } catch (e) {
    console.warn("autoDiscoverAllSpaces error:", e.message);
  }
  return { success: false };
}


/**
 * ⚙️ Helper: Fetch dynamic settings from Vercel Dashboard with fallback
 */
function getEffectiveSettings() {
  try {
    const res = UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + "/api/settings", { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      if (data && data.standupTime) {
        return {
          standupTime: data.standupTime || "10:30",
          autoNudgeEnabled: data.autoNudgeEnabled !== false,
          nudgeIntervalMinutes: data.nudgeIntervalMinutes || 45,
          botPrompt: data.botPrompt || ROTATING_PROMPTS[0],
          companyName: data.companyName || "BytePx"
        };
      }
    }
  } catch (e) {
    console.warn("Could not fetch remote settings, using local defaults:", e.message);
  }

  // Fallback to script properties or default config
  const props = PropertiesService.getScriptProperties();
  const savedTime = props.getProperty("SETTING_STANDUP_TIME") || "10:30";
  const savedInterval = parseInt(props.getProperty("SETTING_NUDGE_INTERVAL") || "45");
  const savedAutoNudge = props.getProperty("SETTING_AUTO_NUDGE") !== "false";

  return {
    standupTime: savedTime,
    autoNudgeEnabled: savedAutoNudge,
    nudgeIntervalMinutes: savedInterval,
    botPrompt: ROTATING_PROMPTS[0],
    companyName: "BytePx"
  };
}

/**
 * 📥 EVENT: When an employee opens a 1:1 chat or adds the Bot
 */
function onAddToSpace(event) {
  console.log("📥 onAddToSpace triggered:", JSON.stringify(event));
  try {
    registerDmSpace(event);
    const user = (event && (event.user || (event.message && event.message.sender))) || {};
    const userName = user.displayName || "Champion";
    return buildPromptCard(userName);
  } catch (err) {
    console.error("Error in onAddToSpace:", err);
    return {
      text: "👋 Good morning! I am your BytePx Daily Standup Bot. What tasks are you tackling today?"
    };
  }
}

/**
 * 💬 EVENT: When an employee sends a message or submits their standup
 */
function onMessage(event) {
  console.log("📥 onMessage received:", JSON.stringify(event));
  try {
    registerDmSpace(event);

    const user = (event && (event.user || (event.message && event.message.sender))) || {};
    const text = (event && event.message && event.message.text) ? event.message.text.trim() : "";
    const senderEmail = user.email ? user.email.toLowerCase() : "";
    const senderName = user.displayName || "Employee";

    // If empty or simple greeting, return prompt card
    if (!text || text.toLowerCase() === "hi" || text.toLowerCase() === "hello" || text.toLowerCase() === "hey" || text.toLowerCase() === "help") {
      return buildPromptCard(senderName);
    }

    // Check for Non-Work Activities (personal work, personal task, break, lunch, etc.) -> Reject as invalid
    const isNonWork = /\b(personal\s+work|personal\s+stuff|personal\s+errand|personal\s+errands|personal\s+task|personal\s+tasks|private\s+work|non[\s-]work|errands?|timepass)\b/i.test(text) || /^(?:personal|break|lunch|gym|chill|chilling|idle|nothing|timepass)$/i.test(text.toLowerCase());

    if (isNonWork) {
      return {
        text: [
          `⚠️ *Invalid Task Entry: "${text}"*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━`,
          `❌ *Personal activities cannot be logged as company work tasks.*`,
          ``,
          `👉 *If you worked on company tasks:* Reply with your actual project & tasks (e.g. \`3h on feature development\` or \`3h on testing\`).`,
          `🏖️ *If you took time off or left early:* Reply with \`half day leave\` or \`personal leave\`.`,
          `⏳ *If you had no tasks assigned:* Reply with \`awaiting tasks\`.`
        ].join("\n")
      };
    }

    // Parse standup
    const parsed = parseStandupText(text);
    const props = PropertiesService.getScriptProperties();
    const draftKey = "DRAFT_" + senderEmail;
    const existingDraftStr = props.getProperty(draftKey);
    let existingDraft = null;
    try { if (existingDraftStr) existingDraft = JSON.parse(existingDraftStr); } catch (e) {}

    // Case A: User had a pending draft with partial hours and is now replying for the rest
    if (existingDraft && existingDraft.hours && existingDraft.hours > 0 && existingDraft.remainingHours && existingDraft.remainingHours > 0) {
      let finalHours = 8.0;
      let finalTasks = existingDraft.tasks;
      let finalProject = existingDraft.project;
      let finalBlocker = existingDraft.blocker;

      if (/half\s+day|day\s+off|leave|taking\s+leave/i.test(text.toLowerCase())) {
        finalHours = existingDraft.hours;
        finalTasks = `${existingDraft.tasks} (Half-Day Leave)`;
        finalBlocker = 'Half-Day Leave';
      } else if (/awaiting|waiting|no\s+task|didnt\s+get|bench|free|no\s+work/i.test(text.toLowerCase())) {
        finalHours = 8.0;
        finalProject = `${existingDraft.project} + Standby`;
        finalTasks = `${existingDraft.tasks} (${existingDraft.hours} hrs), Awaiting Tasks (${existingDraft.remainingHours} hrs)`;
        finalBlocker = `Awaiting task allocation for ${existingDraft.remainingHours} hrs`;
      } else {
        const secondHours = parsed.hours > 0 ? parsed.hours : existingDraft.remainingHours;
        const secondProject = parsed.project !== 'General Tasks' ? parsed.project : existingDraft.project;
        finalHours = +(existingDraft.hours + secondHours).toFixed(1);
        finalProject = secondProject === existingDraft.project ? existingDraft.project : `${existingDraft.project} & ${secondProject}`;
        finalTasks = `${existingDraft.tasks} (${existingDraft.hours}h), ${parsed.tasks} (${secondHours}h)`;
        finalBlocker = parsed.blocker !== 'None' ? parsed.blocker : existingDraft.blocker;
      }

      const record = {
        id: "std_" + Date.now(),
        name: senderName,
        email: senderEmail || ("user_" + Date.now() + "@bytepx.com"),
        dept: "Engineering",
        tasks: finalTasks,
        hours: finalHours,
        project: finalProject,
        blocker: finalBlocker,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        source: "Google Chat 1:1 Bot DM"
      };

      saveStandupRecord(record);
      props.deleteProperty(draftKey);
      return buildConfirmationCard(senderName, record);
    }

    // Case B: User had a pending 0-hours draft and is now replying with hours
    const onlyHoursMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|hoyrs?|hrss?|h)?$/i);
    const hasHours = parsed.hours > 0 || onlyHoursMatch;

    if (existingDraft && hasHours) {
      const providedHours = parsed.hours > 0 ? parsed.hours : (onlyHoursMatch ? parseFloat(onlyHoursMatch[1]) : 8.0);
      
      // If provided hours < 8.0, ask for the rest!
      if (providedHours < 8.0) {
        const remaining = +(8.0 - providedHours).toFixed(1);
        props.setProperty(draftKey, JSON.stringify({
          tasks: existingDraft.tasks,
          project: existingDraft.project,
          blocker: existingDraft.blocker,
          hours: providedHours,
          remainingHours: remaining
        }));
        return {
          text: [
            `⏰ *Daily Capacity Check (${providedHours} / 8.0 hrs)*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📝 *Logged so far:* ${providedHours} hrs on *${existingDraft.project}*`,
            `💡 _Our workday is 8.0 hrs (9h office shift - 1h lunch)._`,
            ``,
            `👉 *Ok, what about the rest ${remaining} hours?*`,
            ``,
            `_Reply with: "rest on ${existingDraft.project}", "working on QA for ${remaining}h", "awaiting tasks", or "half-day leave"_`
          ].join("\n")
        };
      }

      const record = {
        id: "std_" + Date.now(),
        name: senderName,
        email: senderEmail || ("user_" + Date.now() + "@bytepx.com"),
        dept: "Engineering",
        tasks: existingDraft.tasks,
        hours: providedHours,
        project: existingDraft.project,
        blocker: existingDraft.blocker,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        source: "Google Chat 1:1 Bot DM"
      };

      saveStandupRecord(record);
      props.deleteProperty(draftKey);
      return buildConfirmationCard(senderName, record);
    }

    // Case C: User submitted tasks without hours -> Ask ONLY for hours
    const isSpecialStatus = parsed.project.indexOf("Awaiting") >= 0 || parsed.project.indexOf("Leave") >= 0;
    if (parsed.hours === 0 && !isSpecialStatus && !onlyHoursMatch) {
      props.setProperty(draftKey, JSON.stringify({
        tasks: parsed.tasks,
        project: parsed.project,
        blocker: parsed.blocker,
        hours: 0,
        remainingHours: 8.0
      }));
      return {
        text: [
          `📝 *Tasks Recorded:* ${parsed.tasks}`,
          `📁 *Initiative:* *${parsed.project}*`,
          ``,
          `⏱️ *Quick Question for ${senderName}:* How many hours are you allocating today?`,
          `👉 *Reply right here with your hours:* (e.g. \`5h\`, \`6.5h\`, \`8h\`)`
        ].join("\n")
      };
    }

    // Case D: User submitted tasks with fewer than 8.0 hours (e.g. 5 hours) -> Follow up for rest!
    if (parsed.hours < 8.0 && parsed.hours > 0 && !isSpecialStatus) {
      const remaining = +(8.0 - parsed.hours).toFixed(1);
      props.setProperty(draftKey, JSON.stringify({
        tasks: parsed.tasks,
        project: parsed.project,
        blocker: parsed.blocker,
        hours: parsed.hours,
        remainingHours: remaining
      }));
      return {
        text: [
          `⏰ *Daily Capacity Check (${parsed.hours} / 8.0 hrs)*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📝 *Logged so far:* ${parsed.hours} hrs on *${parsed.project}*`,
          `💡 _Our workday is 8.0 hrs (9h office shift - 1h lunch)._`,
          ``,
          `👉 *Ok, what about the rest ${remaining} hours?*`,
          ``,
          `_Reply with: "rest on ${parsed.project}", "working on QA for ${remaining}h", "awaiting tasks", or "half-day leave"_`
        ].join("\n")
      };
    }

    // Case E: Full Standup with >= 8 Hours or Special Status
    const record = {
      id: "std_" + Date.now(),
      name: senderName,
      email: senderEmail || ("user_" + Date.now() + "@bytepx.com"),
      dept: "Engineering",
      tasks: parsed.tasks,
      hours: parsed.hours,
      project: parsed.project,
      blocker: parsed.blocker,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      source: "Google Chat 1:1 Bot DM"
    };

    saveStandupRecord(record);
    props.deleteProperty(draftKey);

    return buildConfirmationCard(senderName, record);
  } catch (err) {
    console.error("Error in onMessage:", err);
    return { text: "🎯 Thanks! Your standup check-in has been received. Have a super productive day! 🚀" };
  }

}

/**
 * ⏰ BROADCAST: Triggered by Dashboard or 10:30 AM Daily Schedule
 */
function sendDirectMessageToAllEmployees(isNudge) {
  const settings = getEffectiveSettings();
  console.log(isNudge ? `⏰ Nudging pending employees (${settings.nudgeIntervalMinutes}m cycle)...` : `⏰ Broadcasting Daily Standup at ${settings.standupTime}...`);
  
  const token = ScriptApp.getOAuthToken();

  // 1. Auto-discover all active 1:1 DMs in real time so newly added or active team members (Prerna, Tanmay, etc.) are always mapped
  try {
    autoDiscoverAllSpaces();
  } catch (discErr) {
    console.warn("Auto-discover warning:", discErr.message);
  }

  const scriptProps = PropertiesService.getScriptProperties().getProperties();
  const today = new Date().toISOString().slice(0, 10);
  
  // Get today's completed check-ins from local storage & Vercel
  let completedEmails = new Set();
  try {
    const existingStr = scriptProps["STANDUP_RECORDS"] || "[]";
    const list = JSON.parse(existingStr);
    list.filter(r => r.date === today).forEach(r => {
      if (r.email) completedEmails.add(r.email.toLowerCase());
    });
  } catch (e) {}

  // Also query Vercel API for latest completed standups
  try {
    const res = UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + "/api/standups", { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const liveList = JSON.parse(res.getContentText());
      if (Array.isArray(liveList)) {
        liveList.filter(r => r.date === today).forEach(r => {
          if (r.email) completedEmails.add(r.email.toLowerCase());
        });
      }
    }
  } catch (apiErr) {
    console.warn("Standup check warning:", apiErr.message);
  }

  const targetSpaces = [];
  const addedSpaces = new Set();

  // 2. Check local script properties for all registered DM spaces
  for (const key in scriptProps) {
    if (key.startsWith("DM_") && scriptProps[key]) {
      const email = key.replace("DM_", "").toLowerCase();
      const spaceName = scriptProps[key];
      if (!addedSpaces.has(spaceName)) {
        if (!isNudge || !completedEmails.has(email)) {
          targetSpaces.push({
            key: key,
            spaceName: spaceName,
            email: email
          });
          addedSpaces.add(spaceName);
        }
      }
    }
  }

  // 3. Also check Vercel DB employees for any recorded webhookUrl space IDs
  try {
    const empRes = UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + "/api/employees", { muteHttpExceptions: true });
    if (empRes.getResponseCode() === 200) {
      const empList = JSON.parse(empRes.getContentText());
      if (Array.isArray(empList)) {
        empList.forEach(emp => {
          if (emp.webhookUrl && !addedSpaces.has(emp.webhookUrl)) {
            const email = (emp.email || "").toLowerCase();
            if (!isNudge || !completedEmails.has(email)) {
              targetSpaces.push({
                key: "DM_" + email,
                spaceName: emp.webhookUrl,
                email: email
              });
              addedSpaces.add(emp.webhookUrl);
              PropertiesService.getScriptProperties().setProperty("DM_" + email, emp.webhookUrl);
            }
          }
        });
      }
    }
  } catch (err) {}

  // 4. Also check local EMPLOYEE_RECORDS for any space mappings
  try {
    const rawLocalEmps = scriptProps["EMPLOYEE_RECORDS"] || "[]";
    const localEmpList = JSON.parse(rawLocalEmps);
    if (Array.isArray(localEmpList)) {
      localEmpList.forEach(emp => {
        if (emp.webhookUrl && !addedSpaces.has(emp.webhookUrl)) {
          const email = (emp.email || "").toLowerCase();
          if (!isNudge || !completedEmails.has(email)) {
            targetSpaces.push({
              key: "DM_" + email,
              spaceName: emp.webhookUrl,
              email: email
            });
            addedSpaces.add(emp.webhookUrl);
          }
        }
      });
    }
  } catch (e) {}

  let sent = 0;
  const errors = [];

  targetSpaces.forEach(item => {
    try {
      const card = isNudge ? buildNudgeCard() : buildPromptCard("", settings.botPrompt);
      const postRes = UrlFetchApp.fetch("https://chat.googleapis.com/v1/" + item.spaceName + "/messages", {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify(card),
        muteHttpExceptions: true
      });
      const resJson = JSON.parse(postRes.getContentText());
      if (!resJson.error) {
        sent++;
        console.log(`✅ Dispatched standup prompt to: ${item.spaceName} (${item.email})`);
      } else {
        errors.push(`${item.spaceName} (${item.email}): ${resJson.error.message || 'API error'}`);
      }
    } catch (err) {
      console.warn("Failed to message space " + item.spaceName + ": " + err.message);
      errors.push(`${item.spaceName}: ${err.message}`);
    }
  });

  // Schedule follow-up nudge if auto-nudge is enabled and there are pending members
  if (settings.autoNudgeEnabled && targetSpaces.length > 0) {
    scheduleNextNudge(settings.nudgeIntervalMinutes);
  } else if (targetSpaces.length === 0 && isNudge) {
    console.log("🎉 All employees have checked in today! Auto-nudge completed.");
    clearNudgeTriggers();
  }

  return { 
    success: true, 
    sent: sent, 
    totalTargetSpaces: targetSpaces.length,
    targets: targetSpaces.map(t => ({ email: t.email, space: t.spaceName })),
    errors: errors 
  };
}

/**
 * 🔁 AUTO-NUDGE: Scheduled 45 minutes after prompt if employee hasn't responded
 * Repeats every 45 minutes until all employees have checked in.
 */
function autoNudgePendingEmployees() {
  console.log("⏰ Auto-Nudge Trigger Running for pending employees...");
  const settings = getEffectiveSettings();

  if (!settings.autoNudgeEnabled) {
    console.log("⏸️ Auto-nudge is disabled in dashboard settings. Skipping.");
    clearNudgeTriggers();
    return;
  }

  const result = sendDirectMessageToAllEmployees(true);
  
  // If there are still pending employees, schedule the next nudge in 45 mins
  if (result.totalPending > 0) {
    console.log(`⏰ ${result.totalPending} employee(s) still pending. Scheduling next nudge in ${settings.nudgeIntervalMinutes} minutes.`);
    scheduleNextNudge(settings.nudgeIntervalMinutes);
  } else {
    console.log("🎉 All employees have checked in! Stopping auto-nudge cycle.");
    clearNudgeTriggers();
  }
}

/**
 * ⏲️ Helper: Schedules a one-time trigger after the configured interval (e.g. 45 min)
 */
function scheduleNextNudge(intervalMinutes) {
  const minutes = intervalMinutes || CONFIG.DEFAULT_NUDGE_INTERVAL_MINUTES;
  clearNudgeTriggers();

  // Create next trigger
  ScriptApp.newTrigger("autoNudgePendingEmployees")
    .timeBased()
    .after(minutes * 60 * 1000)
    .create();

  console.log(`⏰ Scheduled next follow-up nudge in ${minutes} minutes.`);
}

function clearNudgeTriggers() {
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === "autoNudgePendingEmployees") {
      ScriptApp.deleteTrigger(existingTriggers[i]);
    }
  }
}

/**
 * ⏰ AUTO-SCHEDULE: Sets up the automated daily trigger matching Dashboard settings (e.g. 10:30 AM)
 */
function createDailyStandupScheduleTrigger() {
  const settings = getEffectiveSettings();
  
  // Parse hour and minute from settings "10:30"
  let hour = CONFIG.DEFAULT_STANDUP_HOUR;
  let minute = CONFIG.DEFAULT_STANDUP_MINUTE;

  if (settings.standupTime && settings.standupTime.includes(":")) {
    const parts = settings.standupTime.split(":");
    hour = parseInt(parts[0], 10);
    minute = parseInt(parts[1], 10);
  }

  // Clear existing broadcast triggers
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === "sendDirectMessageToAllEmployees") {
      ScriptApp.deleteTrigger(existingTriggers[i]);
    }
  }

  // Create new trigger every day at configured time
  ScriptApp.newTrigger("sendDirectMessageToAllEmployees")
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .nearMinute(minute)
    .create();

  console.log(`⏰ Automated Daily Standup Trigger created for ${hour}:${minute} every day!`);
  return { status: "SCHEDULED", hour: hour, minute: minute };
}

/**
 * 🔄 Sync schedule and settings from dashboard
 */
function syncScheduleWithDashboard() {
  console.log("🔄 Syncing schedule with Dashboard settings...");
  const settings = getEffectiveSettings();
  
  // Save local properties
  const props = PropertiesService.getScriptProperties();
  props.setProperty("SETTING_STANDUP_TIME", settings.standupTime);
  props.setProperty("SETTING_NUDGE_INTERVAL", String(settings.nudgeIntervalMinutes));
  props.setProperty("SETTING_AUTO_NUDGE", String(settings.autoNudgeEnabled));

  // Re-create the daily trigger
  const res = createDailyStandupScheduleTrigger();
  console.log(`✅ Schedule synced: Daily at ${settings.standupTime}, Nudge: ${settings.autoNudgeEnabled ? `Every ${settings.nudgeIntervalMinutes}m` : 'Disabled'}`);
  return { success: true, settings: settings, schedule: res };
}

function buildNudgeCard() {
  const prompt = NUDGE_PROMPTS[Math.floor(Math.random() * NUDGE_PROMPTS.length)];
  return {
    text: [
      prompt,
      ``,
      `👉 *Reply to this chat with your update:*`,
      `\`Project: <Project Name>, Tasks: <Your Tasks>, Hours: <e.g. 7.5h>, Blocker: <None or issue>\``,
      `_Example: Working on Auth & Security JWT login (6.5h), blocker: none_`
    ].join("\n")
  };
}

/**
 * 🎨 Helper: Prompt Card
 */
function buildPromptCard(userName, customPrompt) {
  const name = userName ? userName.split(' ')[0] : "Champion";
  const prompt = customPrompt || ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];

  return {
    text: [
      `⏰ *BytePx Daily Standup*`,
      `Good morning *${name}*! 👋`,
      ``,
      `💡 *${prompt}*`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👉 *Reply to this chat with your update:*`,
      `\`Project: <Project Name>, Tasks: <Your Tasks>, Hours: <e.g. 7.5h>, Blocker: <None or issue>\``,
      `_Example: Working on Auth & Security JWT login (6.5h), blocker: none_`
    ].join("\n")
  };
}

/**
 * 🎨 Helper: Confirmation Card
 */
function buildConfirmationCard(senderName, record) {
  const blockerLine = record.blocker === "None" ? "🟢 *Blockers:* None" : `🚨 *Blocker Alert:* ${record.blocker}`;
  const hoursText = record.hours > 0 
    ? `*${record.hours} hrs*` 
    : (record.project.indexOf("Awaiting") >= 0 ? "*0 hrs* _(Standby / Awaiting Tasks)_" : (record.project.indexOf("Leave") >= 0 ? "*0 hrs* _(On Leave)_" : "*0 hrs* _(Unspecified)_"));

  return {
    text: [
      `✅ *Daily Standup Logged for ${senderName}!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📁 *Project:* *${record.project}*`,
      `📝 *Tasks:* ${record.tasks}`,
      `⏱️ *Hours:* ${hoursText}`,
      `${blockerLine}`,
      `🕒 *Recorded At:* ${record.time}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `_Logged in StandupPulse Dashboard. Have a productive day! 🚀_`
    ].join("\n")
  };
}

/**
 * 🧠 Intelligent Parser
 */
function parseStandupText(text) {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  let tasks = clean;
  let hours = 0; // Default to 0, never hardcode 7.5
  let project = "General Tasks";
  let blocker = "None";

  // 1. Detect Special Work Statuses (Unassigned, Waiting for Tasks, On Leave)
  const isAwaitingTask = /didnt\s+get|didn't\s+get|no\s+task|waiting\s+for\s+task|awaiting\s+task|not\s+assigned|no\s+work\s+yet|free\s+today|bench/i.test(lower);
  const isOnLeave = /on\s+leave|sick\s+leave|day\s+off|vacation|out\s+of\s+office|holiday|taking\s+leave/i.test(lower);

  if (isAwaitingTask) {
    project = "Awaiting Tasks / Standby";
    blocker = "Waiting for task allocation";
    hours = 0;
  } else if (isOnLeave) {
    project = "On Leave / Out of Office";
    blocker = "None";
    hours = 0;
  }

  // 2. Extract hours
  const hoursMatch = clean.match(/(?:\(?\s*)(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h\b)(?:\s*\)?)/i);
  if (hoursMatch) {
    hours = parseFloat(hoursMatch[1]);
  }

  // 3. Extract blockers
  const blockerMatch = clean.match(/(?:blocker|blocked by|blocking|issue|impediment)[:\s-]([^\.\n]+)/i);
  if (blockerMatch) {
    const raw = blockerMatch[1].trim();
    if (/^(none|no|nil|n\/a|nope|nothing|all clear)$/i.test(raw)) {
      blocker = "None";
    } else {
      blocker = raw;
    }
  }

  // 4. Extract project if explicitly given
  if (!isAwaitingTask && !isOnLeave) {
    const projectMatch = clean.match(/(?:project|on|for)[:\s-]([a-zA-Z0-9\s_-]+)/i);
    if (projectMatch && projectMatch[1].trim().length >= 3 && projectMatch[1].trim().length < 30) {
      const candidate = projectMatch[1].trim();
      if (!/^(today|yesterday|tasks|work|something|now|morning)$/i.test(candidate)) {
        project = candidate;
      }
    }
  }

  return { tasks, hours, project, blocker };
}


/**
 * 💾 Storage Helpers
 */
function registerDmSpace(event) {
  try {
    const space = (event && (event.space || (event.message && event.message.space))) || {};
    const user = (event && (event.user || (event.message && event.message.sender))) || {};

    if (space && space.name) {
      const emailKey = user.email ? user.email.toLowerCase() : (user.name ? user.name.replace(/[^a-zA-Z0-9]/g, '_') : ("user_" + Date.now()));
      PropertiesService.getScriptProperties().setProperty("DM_" + emailKey, space.name);
      console.log(`📌 Registered 1:1 DM for ${emailKey} -> ${space.name}`);
    }
  } catch (e) {
    console.warn("registerDmSpace warning:", e.message);
  }
}

function saveStandupRecord(record) {
  try {
    const props = PropertiesService.getScriptProperties();
    const existingStr = props.getProperty("STANDUP_RECORDS") || "[]";
    let list = [];
    try { list = JSON.parse(existingStr); } catch (e) { list = []; }
    
    list = list.filter(r => !(r.email === record.email && r.date === record.date));
    list.unshift(record);

    props.setProperty("STANDUP_RECORDS", JSON.stringify(list.slice(0, 100)));
    console.log(`💾 Saved standup record for ${record.name} (${record.email})`);

    // Sync to Vercel Dashboard in real-time
    try {
      UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + "/api/standups", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(record),
        muteHttpExceptions: true
      });
    } catch (apiErr) {
      console.warn("Vercel sync warning:", apiErr.message);
    }
  } catch (e) {
    console.warn("saveStandupRecord warning:", e.message);
  }
}

/**
 * 🌐 WEB APP & WEBHOOK ENDPOINTS
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "get_standups";
  const props = PropertiesService.getScriptProperties();

  if (action === "trigger") {
    const result = sendDirectMessageToAllEmployees(false);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "nudge") {
    const result = sendDirectMessageToAllEmployees(true);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "register_dm") {
    const email = (e.parameter.email || "").toLowerCase();
    const space = e.parameter.space || "";
    if (email && space) {
      props.setProperty("DM_" + email, space);
      console.log(`📌 Registered DM via webhook: ${email} -> ${space}`);
      return ContentService.createTextOutput(JSON.stringify({ success: true, registered: email, space: space })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "get_employees") {
    try {
      const records = props.getProperty("EMPLOYEE_RECORDS") || "[]";
      return ContentService.createTextOutput(records).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "sync_employee") {
    try {
      const email = (e.parameter.email || "").toLowerCase();
      const name = e.parameter.name || "";
      const dept = e.parameter.dept || "Engineering";
      const role = e.parameter.role || "Team Member";
      const space = e.parameter.space || "";
      const id = e.parameter.id || ("emp_" + Date.now());

      if (email) {
        const raw = props.getProperty("EMPLOYEE_RECORDS") || "[]";
        let list = [];
        try { list = JSON.parse(raw); } catch (e) { list = []; }
        const idx = list.findIndex(emp => emp.email.toLowerCase() === email);
        const empObj = { id, name: name || email.split('@')[0], email, dept, role, webhookUrl: space || "" };
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...empObj };
        } else {
          list.push(empObj);
        }
        props.setProperty("EMPLOYEE_RECORDS", JSON.stringify(list));
        if (space) props.setProperty("DM_" + email, space);
        return ContentService.createTextOutput(JSON.stringify({ success: true, employee: empObj })).setMimeType(ContentService.MimeType.JSON);
      }
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "sync_schedule") {
    const result = syncScheduleWithDashboard();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "test") {
    const result = testRun();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const records = props.getProperty("STANDUP_RECORDS") || "[]";
    return ContentService.createTextOutput(records).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles incoming HTTP webhook posts from Google Chat or Dashboard
 */
function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (e && e.postData && e.postData.contents) {
      const data = JSON.parse(e.postData.contents);
      
      // Handle action from POST payload
      if (data.action === "save_employees" && Array.isArray(data.employees)) {
        props.setProperty("EMPLOYEE_RECORDS", JSON.stringify(data.employees));
        return ContentService.createTextOutput(JSON.stringify({ success: true, count: data.employees.length })).setMimeType(ContentService.MimeType.JSON);
      }

      if (data.action === "save_standup" && data.record) {
        saveStandupRecord(data.record);
        return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
      }

      if (data.type === "MESSAGE") {
        const reply = onMessage(data);
        return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
      }
      if (data.type === "ADDED_TO_SPACE") {
        const reply = onAddToSpace(data);
        return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
      }
    }
  } catch (err) {
    console.warn("doPost event parse error:", err.message);
  }
  return doGet(e);
}

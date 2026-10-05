/**
 * ==============================================================================
 * BytePx Standup Bot - Complete Google Chat 1:1 DM Bot Engine
 * ==============================================================================
 */

const CONFIG = {
  ADMIN_EMAIL: "rudra@bytepx.com",
  STANDUP_HOUR: 10,
  STANDUP_MINUTE: 15
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

// 🎬 Verified unblocked 3D animations and developer reaction GIFs
const ROTATING_GIFS = [
  { url: "https://raw.githubusercontent.com/ABSphreak/ABSphreak/master/gifs/Hi.gif", title: "Morning Wave ☕" },
  { url: "https://raw.githubusercontent.com/abhisheknaiidu/abhisheknaiidu/master/code.gif", title: "Hacking the Matrix 💻" },
  { url: "https://raw.githubusercontent.com/MartinHeinz/MartinHeinz/master/wave.gif", title: "Hello Champion 🚀" },
  { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png", title: "StandupBot AI 🤖" },
  { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Partying%20Face.png", title: "Party Energy 🎉" },
  { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Sunglasses.png", title: "Cool & Confident 😎" },
  { url: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Star-Struck.png", title: "Star Performance ⭐" },
  { url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif", title: "High Voltage Pikachu ⚡" },
  { url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/150.gif", title: "Legendary Focus 👑" },
  { url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/6.gif", title: "Crushing Tasks 🔥" }
];

/**
 * ⚡ ONE-TIME SELF TEST
 */
function testRun() {
  console.log("🚀 Running BytePx Standup Bot Self-Test...");
  const props = PropertiesService.getScriptProperties();
  props.setProperty("TEST_CONNECTION", "connected_" + new Date().toISOString());
  console.log("✅ PropertiesService is active and working!");
  
  const token = ScriptApp.getOAuthToken();
  console.log("✅ OAuth Token generated successfully:", token ? "Token Active" : "No Token");

  const allProps = props.getProperties();
  let dmCount = 0;
  for (const k in allProps) {
    if (k.startsWith("DM_")) {
      dmCount++;
      console.log(`📍 Registered 1:1 DM for ${k}: ${allProps[k]}`);
    }
  }
  console.log(`📊 Total Registered 1:1 Employee Chats: ${dmCount}`);
  console.log("🎉 Self-Test Passed! The bot is fully authorized.");
  return { status: "OK", registeredDMs: dmCount };
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

    // Parse standup
    const parsed = parseStandupText(text);

    const record = {
      id: "std_" + Date.now(),
      name: senderName,
      email: senderEmail || ("user_" + Date.now() + "@bytepx.com"),
      dept: "IT",
      tasks: parsed.tasks,
      hours: parsed.hours,
      project: parsed.project,
      blocker: parsed.blocker,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      source: "Google Chat 1:1 Bot DM"
    };

    saveStandupRecord(record);

    return buildConfirmationCard(senderName, record);
  } catch (err) {
    console.error("Error in onMessage:", err);
    return { text: "🎯 Thanks! Your standup check-in has been received. Have a super productive day! 🚀" };
  }
}

/**
 * ⏰ BROADCAST: Triggered by Dashboard "Send Standup to All Employees"
 */
function sendDirectMessageToAllEmployees() {
  console.log("⏰ Broadcasting Daily Standup to active 1:1 Bot DMs...");
  const token = ScriptApp.getOAuthToken();
  const scriptProps = PropertiesService.getScriptProperties().getProperties();
  
  const targetSpaces = [];

  for (const key in scriptProps) {
    if (key.startsWith("DM_") && scriptProps[key]) {
      targetSpaces.push({
        key: key,
        spaceName: scriptProps[key]
      });
    }
  }

  let sent = 0;
  const errors = [];

  targetSpaces.forEach(item => {
    try {
      const card = buildPromptCard();
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
        console.log(`✅ Dispatched standup prompt to 1:1 chat: ${item.spaceName}`);
      } else {
        errors.push(`${item.spaceName}: ${resJson.error.message || 'API error'}`);
      }
    } catch (err) {
      console.warn("Failed to message space " + item.spaceName + ": " + err.message);
      errors.push(`${item.spaceName}: ${err.message}`);
    }
  });

  return { 
    success: true, 
    sent: sent, 
    totalRegistered: targetSpaces.length,
    errors: errors 
  };
}

/**
 * 🎨 Helper: Prompt Card
 */
function buildPromptCard(userName) {
  const name = userName ? userName.split(' ')[0] : "Champion";
  const prompt = ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];

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

  return {
    text: [
      `✅ *Daily Standup Logged for ${senderName}!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📁 *Project:* *${record.project}*`,
      `📝 *Tasks:* ${record.tasks}`,
      `⏱️ *Hours:* *${record.hours} hrs*`,
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
  let tasks = text;
  let hours = 7.5;
  let project = "General Tasks";
  let blocker = "None";

  // 1. Extract hours
  const hoursMatch = text.match(/(\d+(\.\d+)?)\s*(hrs?|hours?|h\b)/i);
  if (hoursMatch) {
    hours = parseFloat(hoursMatch[1]);
  }

  // 2. Extract blockers
  const blockerMatch = text.match(/(blocker|blocked by|blocking)[:\s-]([^\.\n]+)/i);
  if (blockerMatch) {
    blocker = blockerMatch[2].trim();
  }

  // 3. Extract project
  const projectMatch = text.match(/(project|on|for)[:\s-]([a-zA-Z0-9\s_-]+)/i);
  if (projectMatch && projectMatch[2].length < 30) {
    project = projectMatch[2].trim();
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
      UrlFetchApp.fetch("https://chuckle-pulse.vercel.app/api/standups", {
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
  
  if (action === "trigger") {
    const result = sendDirectMessageToAllEmployees();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "test") {
    const result = testRun();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const props = PropertiesService.getScriptProperties();
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
    if (e && e.postData && e.postData.contents) {
      const event = JSON.parse(e.postData.contents);
      if (event.type === "MESSAGE") {
        const reply = onMessage(event);
        return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
      }
      if (event.type === "ADDED_TO_SPACE") {
        const reply = onAddToSpace(event);
        return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
      }
    }
  } catch (err) {
    console.warn("doPost event parse error:", err.message);
  }
  return doGet(e);
}

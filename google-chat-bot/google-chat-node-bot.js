/**
 * ChucklePulse - Google Chat API Node.js Daemon Service
 * 
 * Uses official Google Cloud Service Account to direct message each employee
 * in Google Chat at 10:15 AM every weekday with interactive CardsV2 and GIFs.
 */

const { google } = require('googleapis');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// 1. Google Workspace Service Account Auth
// Place your service-account-key.json in this directory
const KEY_FILE = path.join(__dirname, 'service-account-key.json');

const auth = new google.auth.GoogleAuth({
  keyFile: fs.existsSync(KEY_FILE) ? KEY_FILE : undefined,
  scopes: [
    'https://www.googleapis.com/auth/chat.bot',
    'https://www.googleapis.com/auth/chat.spaces',
    'https://www.googleapis.com/auth/chat.messages'
  ]
});

const chat = google.chat({
  version: 'v1',
  auth: auth
});

// Employee Google Workspace roster
const EMPLOYEES = [
  { name: 'Sarah Jenkins', email: 'sarah.jenkins@company.com' },
  { name: 'Alex Rivera', email: 'alex.rivera@company.com' },
  { name: 'Devin Cooper', email: 'devin.cooper@company.com' },
  { name: 'Maya Patel', email: 'maya.patel@company.com' },
  { name: 'Liam Zhang', email: 'liam.zhang@company.com' },
  { name: 'Chloe Bennett', email: 'chloe.bennett@company.com' }
];

const HUMOR_PROMPTS = [
  "Good morning captain! ☕ Coffee level at 80%? Before the boss asks: What epic quests are consuming your precious hours today?",
  "Beep boop! 🛸 ChuckleBot on daily intelligence duty. What mysteries are you solving today? Give me the breakdown before caffeine wears off!",
  "Rise and shine champion! 🚀 What dragons are we slaying across your projects today, and how many hours of genius are we putting in?"
];

const GIFS = [
  "https://media.giphy.com/media/o0vwzuFwCGAFO/giphy.gif",
  "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif",
  "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif"
];

function buildGoogleChatCard(name) {
  const prompt = HUMOR_PROMPTS[Math.floor(Math.random() * HUMOR_PROMPTS.length)];
  const gifUrl = GIFS[Math.floor(Math.random() * GIFS.length)];

  return {
    cardsV2: [{
      cardId: "daily_standup_card",
      card: {
        header: {
          title: "⏰ 10:15 AM Daily Standup Check-in!",
          subtitle: `Hey ${name}! Time to log today's master plan`,
          imageUrl: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
          imageType: "CIRCLE"
        },
        sections: [
          {
            widgets: [
              { textParagraph: { text: `<b>${prompt}</b>` } },
              { image: { imageUrl: gifUrl, altText: "Morning Humor" } }
            ]
          },
          {
            header: "📝 Log Your Daily Work & Hours",
            widgets: [
              {
                textInput: {
                  name: "tasks",
                  label: "What tasks are you tackling today?",
                  type: "MULTIPLE_LINE"
                }
              },
              {
                textInput: {
                  name: "hours",
                  label: "Estimated Hours Today",
                  value: "7.0",
                  type: "SINGLE_LINE"
                }
              },
              {
                textInput: {
                  name: "blocker",
                  label: "Any Blockers? (Optional)",
                  type: "SINGLE_LINE"
                }
              },
              {
                buttonList: {
                  buttons: [{
                    text: "🚀 Submit Daily Standup",
                    color: { red: 0.54, green: 0.36, blue: 0.96, alpha: 1 },
                    onClick: { action: { actionMethodName: "submitStandupCard" } }
                  }]
                }
              }
            ]
          }
        ]
      }
    }]
  };
}

async function sendDirectMessageToEmployee(employee) {
  try {
    console.log(`📡 Creating/finding DM Space for ${employee.name} (${employee.email})...`);
    
    // Find or create direct message space with employee
    const spaceRes = await chat.spaces.setup({
      requestBody: {
        space: {
          spaceType: 'DIRECT_MESSAGE',
          singleUserBotDm: true
        },
        memberships: [
          { member: { name: `users/${employee.email}`, type: 'HUMAN' } }
        ]
      }
    });

    const spaceName = spaceRes.data.name;
    const cardPayload = buildGoogleChatCard(employee.name);

    await chat.spaces.messages.create({
      parent: spaceName,
      requestBody: cardPayload
    });

    console.log(`✅ Morning standup card dispatched to ${employee.name} in Google Chat!`);
  } catch (error) {
    console.error(`❌ Failed to send DM to ${employee.name}:`, error.message);
  }
}

// 10:15 AM Scheduled Cron Job
cron.schedule('15 10 * * 1-5', async () => {
  console.log('⏰ [10:15 AM] Running Daily Google Chat Standup Broadcast to all employees...');
  for (const emp of EMPLOYEES) {
    await sendDirectMessageToEmployee(emp);
  }
});

console.log('🤖 ChucklePulse Google Chat Node.js Service initialized and scheduled for 10:15 AM!');

module.exports = { sendDirectMessageToEmployee, EMPLOYEES };

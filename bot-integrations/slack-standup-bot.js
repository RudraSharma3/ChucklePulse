/**
 * Standalone Slack Daily Standup Bot
 * Schedule: 10:15 AM Monday-Friday
 * Features: Humorous prompts, work-safe GIFs, modal form & webhook logging.
 */

const { App } = require('@slack/bolt');
const cron = require('node-cron');
const axios = require('axios');

// Configuration via environment variables
const app = new App({
  token: process.env.SLACK_BOT_TOKEN || 'xoxb-your-token',
  signingSecret: process.env.SLACK_SIGNING_SECRET || 'your-signing-secret',
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN || 'xapp-your-app-token'
});

const STANDUP_CHANNEL = process.env.STANDUP_CHANNEL || '#daily-standup';
const DASHBOARD_WEBHOOK_URL = process.env.DASHBOARD_WEBHOOK_URL || 'http://localhost:3000/api/standup';

// Humorous work-safe prompts
const HUMOR_PROMPTS = [
  "Good morning captain! ☕ Coffee level at 80%? Before the boss asks: What epic quests are consuming your precious hours today?",
  "Beep boop! 🛸 ChuckleBot on daily intelligence duty. What mysteries are you solving today? Give me the breakdown before caffeine wears off!",
  "Rise and shine champion! 🚀 What dragons are we slaying across your projects today, and how many hours of genius are we putting in?",
  "The game is afoot! 🕵️‍♂️ I detect high productivity in the air. What are your prime target tickets today, and are any sneaky blockers getting in the way?",
  "Wakey wakey! 🥞 Drop your master plan: What's on your agenda, hours planned, and did any wild bugs block your path?"
];

const WORK_SAFE_GIFS = [
  "https://media.giphy.com/media/o0vwzuFwCGAFO/giphy.gif",
  "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif",
  "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif"
];

// Scheduled trigger: 10:15 AM on Mon-Fri
cron.schedule('15 10 * * 1-5', async () => {
  console.log('⏰ Triggering 10:15 AM Standup in Slack...');
  const prompt = HUMOR_PROMPTS[Math.floor(Math.random() * HUMOR_PROMPTS.length)];
  const gif = WORK_SAFE_GIFS[Math.floor(Math.random() * WORK_SAFE_GIFS.length)];

  try {
    await app.client.chat.postMessage({
      channel: STANDUP_CHANNEL,
      text: prompt,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "⏰ 10:15 AM Daily Standup Check-In!" }
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*${prompt}*` },
          accessory: {
            type: "image",
            image_url: gif,
            alt_text: "Morning Motivation Meme"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "🚀 Share Daily Plan & Hours" },
              style: "primary",
              action_id: "open_standup_modal"
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Error sending scheduled Slack standup message:', error);
  }
});

// Standup Modal Trigger
app.action('open_standup_modal', async ({ ack, body, client }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_standup_modal',
        title: { type: 'plain_text', text: 'Daily Standup' },
        blocks: [
          {
            type: 'input',
            block_id: 'project_block',
            element: {
              type: 'static_select',
              action_id: 'project_select',
              placeholder: { type: 'plain_text', text: 'Select Project' },
              options: [
                { text: { type: 'plain_text', text: 'v2.4 Release QA' }, value: 'v2.4 Release QA' },
                { text: { type: 'plain_text', text: 'API Billing Redesign' }, value: 'API Billing Redesign' },
                { text: { type: 'plain_text', text: 'Mobile Checkout UX' }, value: 'Mobile Checkout UX' },
                { text: { type: 'plain_text', text: 'Marketing Q4 Campaign' }, value: 'Marketing Q4 Campaign' },
                { text: { type: 'plain_text', text: 'Infrastructure Migration' }, value: 'Infrastructure Migration' }
              ]
            },
            label: { type: 'plain_text', text: 'Primary Project' }
          },
          {
            type: 'input',
            block_id: 'tasks_block',
            element: {
              type: 'plain_text_input',
              action_id: 'tasks_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: "e.g., Wrestling cache bugs (4 hrs), reviewing PRs (2 hrs)" }
            },
            label: { type: 'plain_text', text: "What's on your agenda today?" }
          },
          {
            type: 'input',
            block_id: 'hours_block',
            element: {
              type: 'plain_text_input',
              action_id: 'hours_input',
              initial_value: '7.5'
            },
            label: { type: 'plain_text', text: 'Estimated Total Hours' }
          },
          {
            type: 'input',
            block_id: 'blocker_block',
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'blocker_input',
              placeholder: { type: 'plain_text', text: 'None / Blocked on DevOps API token...' }
            },
            label: { type: 'plain_text', text: 'Any Blockers?' }
          }
        ],
        submit: { type: 'plain_text', text: 'Submit Standup' }
      }
    });
  } catch (error) {
    console.error('Error opening Slack modal:', error);
  }
});

// Modal Submission Handler
app.view('submit_standup_modal', async ({ ack, body, view, client }) => {
  await ack();
  const user = body.user.name || body.user.id;
  const values = view.state.values;

  const project = values.project_block.project_select.selected_option.value;
  const tasks = values.tasks_block.tasks_input.value;
  const hours = parseFloat(values.hours_block.hours_input.value) || 7.0;
  const blocker = values.blocker_block.blocker_input.value || 'None';

  const payload = {
    employee: user,
    project,
    tasks,
    hours,
    blocker,
    timestamp: new Date().toISOString()
  };

  console.log('Sending payload to Executive Dashboard:', payload);
  try {
    await axios.post(DASHBOARD_WEBHOOK_URL, payload);
  } catch (err) {
    console.log('Webhook forwarding note:', err.message);
  }
});

(async () => {
  await app.start(process.env.PORT || 3001);
  console.log('⚡️ ChucklePulse Slack Standup Bot is online!');
})();

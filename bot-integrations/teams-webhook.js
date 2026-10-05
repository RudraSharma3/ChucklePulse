/**
 * Microsoft Teams Standup Webhook Dispatcher
 * Can be run via Windows Task Scheduler or cron at 10:15 AM
 */

const axios = require('axios');

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || 'https://yourcompany.webhook.office.com/webhookb2/...';

const GIFS = [
  "https://media.giphy.com/media/o0vwzuFwCGAFO/giphy.gif",
  "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif"
];

async function sendTeamsStandupCard() {
  const cardPayload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "8B5CF6",
    "summary": "⏰ 10:15 AM ChucklePulse Standup Call",
    "sections": [{
      "activityTitle": "⏰ **10:15 AM Daily Standup Check-in!**",
      "activitySubtitle": "ChucklePulse Work Log Assistant",
      "activityImage": "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
      "text": "Good morning team! ☕ Coffee level at 80%? Tell us what you're tackling today, hours planned, and any blockers!",
      "images": [{
        "image": GIFS[0]
      }]
    }],
    "potentialAction": [{
      "@type": "OpenUri",
      "name": "🚀 Open ChucklePulse Web App",
      "targets": [{
        "os": "default",
        "uri": "http://localhost:3000"
      }]
    }]
  };

  try {
    const res = await axios.post(TEAMS_WEBHOOK_URL, cardPayload);
    console.log('✅ MS Teams Adaptive Standup Card sent successfully!', res.status);
  } catch (err) {
    console.error('Error posting to Teams webhook:', err.message);
  }
}

if (require.main === module) {
  sendTeamsStandupCard();
}

module.exports = { sendTeamsStandupCard };

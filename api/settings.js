// Vercel Serverless Function: GET & POST /api/settings
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_FILE = path.join(os.tmpdir(), 'settings.json');

const DEFAULT_SETTINGS = {
  companyName: "BytePx",
  standupStartTime: "10:00",
  standupEndTime: "10:30",
  googleChatWebhookUrl: "",
  botPrompt: "Good morning team! ☕ Coffee level at 80%? What epic tasks are occupying your hours today?",
  theme: "dark"
};

function getSettings() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

function saveSettings(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json(getSettings());
  }

  if (req.method === 'POST') {
    try {
      const newSettings = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const current = getSettings();
      const updated = { ...current, ...newSettings };
      saveSettings(updated);
      return res.status(200).json({ success: true, settings: updated });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

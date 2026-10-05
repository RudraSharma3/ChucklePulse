// Vercel Serverless Function: GET & POST /api/standups
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_FILE = path.join(os.tmpdir(), 'standups.json');

function getStandups() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveStandups(data) {
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
    const list = getStandups();
    return res.status(200).json(list);
  }

  if (req.method === 'POST') {
    try {
      const entry = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const list = getStandups();
      const now = new Date();
      const newRecord = {
        id: 'log_' + Date.now(),
        name: entry.name || 'Unknown Employee',
        email: entry.email || '',
        dept: entry.dept || 'IT',
        tasks: entry.tasks || 'General check-in',
        hours: parseFloat(entry.hours) || 7.5,
        project: entry.project || 'General Tasks',
        blocker: entry.blocker || 'None',
        date: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: entry.source || 'Google Chat'
      };

      list.unshift(newRecord);
      saveStandups(list);
      return res.status(201).json({ success: true, record: newRecord });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

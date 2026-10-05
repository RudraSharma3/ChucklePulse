/**
 * ChucklePulse - Clean, Simple Backend Server & Google Chat Dispatcher
 * Persists real company employees, standup logs, and settings to local JSON.
 * Supports individual employee webhooks for direct 1:1 visual GIF delivery.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');
const STANDUPS_FILE = path.join(DATA_DIR, 'standups.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readJSON(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return fallback;
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Curated diverse work-safe morning animations (100% reliable, direct CDNs that never block Google Chat)
const WORK_SAFE_GIFS = [
  "https://raw.githubusercontent.com/ABSphreak/ABSphreak/master/gifs/Hi.gif",
  "https://raw.githubusercontent.com/abhisheknaiidu/abhisheknaiidu/master/code.gif",
  "https://raw.githubusercontent.com/MartinHeinz/MartinHeinz/master/wave.gif",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Partying%20Face.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Sunglasses.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Star-Struck.png",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/150.gif",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/6.gif"
];

const ROTATING_PROMPTS = [
  "Good morning champion! ☕ Coffee level at 80%? What epic tasks are occupying your hours today?",
  "Beep boop! 🛸 ChuckleBot on daily intelligence duty. What mysteries are you solving today before caffeine wears off?",
  "Rise and grind! 🚀 If your daily tasks were a movie title, what would today be called? Drop your hours & mission!",
  "Wakey wakey! 🥞 Today's masterplan check-in: What tickets are you tackling, how many hours, and did any wild bugs block you?",
  "The game is afoot! 🕵️‍♂️ I detect high productivity in the air. What are your prime targets today and any sneaky blockers?",
  "Code, coffee, conquer! ⚡ What is your main focus today and how many hours of genius are we pouring in?"
];

// Helper to send a rich CardsV2 message with embedded visual GIF to any Google Chat webhook
function sendCardsV2Webhook(webhookUrl, employeeName, companyName, customPrompt) {
  return new Promise((resolve, reject) => {
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return reject(new Error('Invalid webhook URL'));
    }

    const randomGif = WORK_SAFE_GIFS[Math.floor(Math.random() * WORK_SAFE_GIFS.length)];
    const promptText = customPrompt || ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];
    const greeting = employeeName ? `Good morning ${employeeName.split(' ')[0]}!` : "Good morning!";

    const cardPayload = {
      cardsV2: [{
        cardId: "standup_card_" + Date.now(),
        card: {
          header: {
            title: `⏰ ${companyName || 'Company'} Daily Standup`,
            subtitle: `${greeting} Time to share today's mission!`,
            imageUrl: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `<b>${promptText}</b>`
                  }
                },
                {
                  image: {
                    imageUrl: randomGif,
                    altText: "Morning Humor GIF"
                  }
                },
                {
                  textParagraph: {
                    text: "<i>👉 Reply to this chat with your planned tasks, hours, and blockers!</i>"
                  }
                }
              ]
            }
          ]
        }
      }]
    };

    try {
      const urlObj = new URL(webhookUrl);
      const postData = JSON.stringify(cardPayload);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
        let resBody = '';
        res.on('data', d => { resBody += d; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, statusCode: res.statusCode });
          } else {
            reject(new Error(`Google Chat returned status ${res.statusCode}: ${resBody}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function fetchWithRedirects(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    try {
      const urlObj = new URL(targetUrl);
      const reqModule = urlObj.protocol === 'https:' ? https : http;

      reqModule.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            redirectUrl = urlObj.origin + redirectUrl;
          }
          return resolve(fetchWithRedirects(redirectUrl, maxRedirects - 1));
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: data });
        });
      }).on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 0. POST /api/chat-bot (Direct Google Chat Webhook Handler)
  if (pathname === '/api/chat-bot' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const event = JSON.parse(body || '{}');
        console.log('📥 Incoming Google Chat Event:', event.type);

        const user = event.user || (event.message && event.message.sender) || {};
        const text = (event.message && event.message.text) ? event.message.text.trim() : '';
        const senderName = user.displayName || 'Champion';
        const senderEmail = user.email ? user.email.toLowerCase() : '';

        // If greeting or empty, reply with standup prompt & animated GIF
        if (!text || ['hi', 'hello', 'hey', 'help', '/standup'].includes(text.toLowerCase())) {
          const prompt = ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];
          const gif = WORK_SAFE_GIFS[Math.floor(Math.random() * WORK_SAFE_GIFS.length)];

          const reply = {
            text: `⏰ *BytePx Daily Standup*\nGood morning ${senderName}!\n\n*${prompt}*\n\n👉 _Reply directly to this chat with your planned tasks, hours, and any blockers!_`,
            cardsV2: [{
              cardId: 'prompt_' + Date.now(),
              card: {
                header: {
                  title: '⏰ BytePx Daily Standup',
                  subtitle: `Good morning ${senderName}!`,
                  imageUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
                  imageType: 'CIRCLE'
                },
                sections: [{
                  widgets: [
                    { textParagraph: { text: `<b>${prompt}</b>` } },
                    { image: { imageUrl: gif, altText: 'Morning GIF' } },
                    { textParagraph: { text: '<i>👉 Reply directly with your planned tasks, hours, and blockers!</i>' } }
                  ]
                }]
              }
            }]
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(reply));
          return;
        }

        // Parse and record standup in local database
        const hoursMatch = text.match(/(\d+(\.\d+)?)\s*(hrs?|hours?|h\b)/i);
        const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 7.5;
        const blockerMatch = text.match(/(blocker|blocked by|blocking)[:\s-]([^\.\n]+)/i);
        const blocker = blockerMatch ? blockerMatch[2].trim() : 'None';
        const projectMatch = text.match(/(project|on|for)[:\s-]([a-zA-Z0-9\s_-]+)/i);
        const project = (projectMatch && projectMatch[2].length < 30) ? projectMatch[2].trim() : 'General Tasks';

        const standups = readJSON(STANDUPS_FILE, []);
        const employees = readJSON(EMPLOYEES_FILE, []);

        const matchedEmp = employees.find(e => 
          (senderEmail && e.email.toLowerCase() === senderEmail) ||
          (e.name.toLowerCase() === senderName.toLowerCase())
        );

        const record = {
          id: 'log_' + Date.now(),
          employeeId: matchedEmp ? matchedEmp.id : null,
          name: matchedEmp ? matchedEmp.name : senderName,
          email: matchedEmp ? matchedEmp.email : (senderEmail || 'team@bytepx.com'),
          dept: matchedEmp ? matchedEmp.dept : 'IT',
          tasks: text,
          hours: hours,
          project: project,
          blocker: blocker,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'Google Chat 1:1 Bot'
        };

        const existingIdx = standups.findIndex(s => s.email.toLowerCase() === record.email.toLowerCase() && s.date === record.date);
        if (existingIdx >= 0) {
          standups[existingIdx] = record;
        } else {
          standups.unshift(record);
        }
        writeJSON(STANDUPS_FILE, standups);

        const blockerLine = record.blocker === 'None' ? '🟢 *No Blockers*' : `⚠️ *Blocker:* ${record.blocker}`;
        const reply = {
          text: `✅ *Daily Standup Logged for ${senderName}!* \n\n📝 *Tasks:* ${record.tasks}\n⏱️ *Hours:* ${record.hours} hrs  |  📁 *Project:* ${record.project}\n${blockerLine}\n\n_Have a great and productive day! 🚀_`
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply));
      } catch (err) {
        console.error('Error handling chat webhook:', err);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text: "✅ Standup check-in received!" }));
      }
    });
    return;
  }

  // 1. GET /api/employees
  if (pathname === '/api/employees' && method === 'GET') {
    const employees = readJSON(EMPLOYEES_FILE, []);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(employees));
    return;
  }

  // 2. POST /api/employees (Add or Update Employee)
  if (pathname === '/api/employees' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const newEmp = JSON.parse(body);
        if (!newEmp.name || !newEmp.email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Name and Email are required' }));
          return;
        }

        const employees = readJSON(EMPLOYEES_FILE, []);
        const employeeRecord = {
          id: newEmp.id || ('emp_' + Date.now()),
          name: newEmp.name.trim(),
          email: newEmp.email.trim().toLowerCase(),
          dept: newEmp.dept ? newEmp.dept.trim() : 'General',
          role: newEmp.role ? newEmp.role.trim() : 'Team Member',
          createdAt: newEmp.createdAt || new Date().toISOString()
        };

        const existingIdx = employees.findIndex(e => e.id === employeeRecord.id);
        if (existingIdx >= 0) {
          employees[existingIdx] = employeeRecord;
        } else {
          employees.push(employeeRecord);
        }

        writeJSON(EMPLOYEES_FILE, employees);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(employeeRecord));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
    });
    return;
  }

  // 3. DELETE /api/employees/:id
  if (pathname.startsWith('/api/employees/') && method === 'DELETE') {
    const empId = pathname.split('/')[3];
    let employees = readJSON(EMPLOYEES_FILE, []);
    employees = employees.filter(e => e.id !== empId);
    writeJSON(EMPLOYEES_FILE, employees);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Employee removed' }));
    return;
  }

  // 4. GET /api/standups (Returns local records and syncs with Apps Script cloud store if configured)
  if (pathname === '/api/standups' && method === 'GET') {
    const standups = readJSON(STANDUPS_FILE, []);
    const settings = readJSON(SETTINGS_FILE, {});
    const appsScriptUrl = settings.appsScriptUrl;

    if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
      const syncUrl = appsScriptUrl.includes('?') ? (appsScriptUrl + '&action=get_standups') : (appsScriptUrl + '?action=get_standups');
      fetchWithRedirects(syncUrl)
        .then(resData => {
          try {
            const cloudRecords = JSON.parse(resData.body);
            if (Array.isArray(cloudRecords) && cloudRecords.length > 0) {
              let updated = false;
              cloudRecords.forEach(cr => {
                const existingIdx = standups.findIndex(s => s.email && s.email.toLowerCase() === cr.email.toLowerCase() && s.date === cr.date);
                if (existingIdx >= 0) {
                  standups[existingIdx] = { ...standups[existingIdx], ...cr };
                  updated = true;
                } else {
                  standups.unshift(cr);
                  updated = true;
                }
              });
              if (updated) writeJSON(STANDUPS_FILE, standups);
            }
          } catch (e) {}
        })
        .catch(() => {});
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(standups));
    return;
  }

  // 5. POST /api/standups (Log a standup)
  if (pathname === '/api/standups' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const entry = JSON.parse(body);
        const standups = readJSON(STANDUPS_FILE, []);
        const employees = readJSON(EMPLOYEES_FILE, []);

        const matchedEmp = employees.find(e => 
          (entry.email && e.email.toLowerCase() === entry.email.toLowerCase()) ||
          (entry.name && e.name.toLowerCase() === entry.name.toLowerCase())
        );

        const now = new Date();
        const newRecord = {
          id: 'log_' + Date.now(),
          employeeId: matchedEmp ? matchedEmp.id : null,
          name: matchedEmp ? matchedEmp.name : (entry.name || entry.displayName || 'Unknown Employee'),
          email: matchedEmp ? matchedEmp.email : (entry.email || ''),
          dept: matchedEmp ? matchedEmp.dept : (entry.dept || 'General'),
          tasks: entry.tasks || entry.text || 'No tasks provided',
          hours: parseFloat(entry.hours) || 7.5,
          project: entry.project || 'General Tasks',
          blocker: entry.blocker || 'None',
          date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: entry.source || 'Google Chat'
        };

        const existingIdx = standups.findIndex(s => 
          s.email && s.email.toLowerCase() === newRecord.email.toLowerCase() && s.date === newRecord.date
        );

        if (existingIdx >= 0) {
          standups[existingIdx] = newRecord;
        } else {
          standups.unshift(newRecord);
        }

        writeJSON(STANDUPS_FILE, standups);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, record: newRecord }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 6. GET /api/settings & POST /api/settings
  if (pathname === '/api/settings' && method === 'GET') {
    const settings = readJSON(SETTINGS_FILE, {
      companyName: "My Company",
      appsScriptUrl: "",
      standupStartTime: "10:00",
      standupEndTime: "10:30",
      googleChatWebhookUrl: "",
      botPrompt: "Good morning team! ☕ Coffee level at 80%? What epic tasks are occupying your hours today?",
      theme: "dark"
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(settings));
    return;
  }

  if (pathname === '/api/settings' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const newSettings = JSON.parse(body);
        const current = readJSON(SETTINGS_FILE, {});
        const updated = { ...current, ...newSettings };
        writeJSON(SETTINGS_FILE, updated);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, settings: updated }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid settings' }));
      }
    });
    return;
  }

  // 7. POST /api/trigger-bot (Dispatches to all individual employee chats via Apps Script Web App)
  if (pathname === '/api/trigger-bot' && method === 'POST') {
    const settings = readJSON(SETTINGS_FILE, {});
    const appsScriptUrl = settings.appsScriptUrl;
    const generalWebhook = settings.googleChatWebhookUrl;

    const promises = [];

    // 1. Trigger Apps Script Web App (Broadcasts 1:1 to all employees)
    if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
      const triggerUrl = appsScriptUrl.includes('?') ? (appsScriptUrl + '&action=trigger') : (appsScriptUrl + '?action=trigger');
      promises.push(
        fetchWithRedirects(triggerUrl)
          .then(data => {
            try {
              const resObj = JSON.parse(data.body);
              return { target: 'BytePx Standup Bot 1:1 Chats', success: true, count: resObj.count || 1 };
            } catch (e) {
              return { target: 'BytePx Standup Bot 1:1 Chats', success: data.statusCode === 200, count: 1 };
            }
          })
          .catch(err => ({ target: 'BytePx Standup Bot', success: false, error: err.message }))
      );
    }

    // 2. Fallback webhook if present
    if (generalWebhook && generalWebhook.startsWith('http')) {
      promises.push(
        sendCardsV2Webhook(generalWebhook, 'Team Space', settings.companyName, settings.botPrompt)
          .then(() => ({ target: 'Team Space Webhook', success: true, count: 1 }))
          .catch(err => ({ target: 'Team Space Webhook', success: false, error: err.message }))
      );
    }

    if (promises.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Please paste your Google Apps Script Web App URL in Settings first!' 
      }));
      return;
    }

    Promise.all(promises).then(results => {
      const successful = results.filter(r => r.success).length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: `Standup prompt & 3D animation dispatched successfully!`,
        results 
      }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // 8. POST /api/trigger-employee/:id (Ping a specific individual employee)
  if (pathname.startsWith('/api/trigger-employee/') && method === 'POST') {
    const empId = pathname.split('/')[3];
    const employees = readJSON(EMPLOYEES_FILE, []);
    const settings = readJSON(SETTINGS_FILE, {});
    const emp = employees.find(e => e.id === empId);

    if (!emp) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Employee not found' }));
      return;
    }

    const targetUrl = emp.webhookUrl || settings.googleChatWebhookUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `No Webhook URL configured for ${emp.name}. Please edit this employee and add their Google Chat webhook.` }));
      return;
    }

    sendCardsV2Webhook(targetUrl, emp.name, settings.companyName, settings.botPrompt)
      .then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Dispatched standup prompt & GIF to ${emp.name}!` }));
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  // Static File Server
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, fallback) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallback, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n==================================================================`);
    console.log(`🚀 ChucklePulse Dashboard & Google Chat Bot is RUNNING!`);
    console.log(`👉 Open in browser: http://localhost:${PORT}`);
    console.log(`==================================================================\n`);
  });
}

module.exports = server;


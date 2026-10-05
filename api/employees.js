// Vercel Serverless Function: GET & POST /api/employees
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_FILE = path.join(os.tmpdir(), 'employees.json');
const SEED_FILE = path.join(__dirname, '..', 'data', 'employees.json');

function getEmployees() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    if (fs.existsSync(SEED_FILE)) {
      const data = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
      return data;
    }
  } catch (e) {}
  return [
    { id: 'emp_1', name: 'Tanmay Jain', email: 'tanmay.jain@bytepx.com', dept: 'IT', role: 'DE Intern' },
    { id: 'emp_2', name: 'Rudra Sharma', email: 'rudra@bytepx.com', dept: 'IT', role: 'Associate ML Engineer' }
  ];
}

function saveEmployees(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const list = getEmployees();
    return res.status(200).json(list);
  }

  if (req.method === 'POST') {
    try {
      const emp = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const list = getEmployees();
      const newEmp = {
        id: emp.id || ('emp_' + Date.now()),
        name: (emp.name || '').trim(),
        email: (emp.email || '').trim().toLowerCase(),
        dept: emp.dept || 'General',
        role: emp.role || 'Team Member'
      };

      const idx = list.findIndex(e => e.id === newEmp.id);
      if (idx >= 0) list[idx] = newEmp;
      else list.push(newEmp);

      saveEmployees(list);
      return res.status(201).json(newEmp);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

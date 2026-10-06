import fs from 'fs';
import path from 'path';
import os from 'os';
import { Employee, StandupRecord, CompanySettings } from './types';

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'data') : path.join(process.cwd(), 'data');
const SEED_DIR = path.join(process.cwd(), 'data');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {}

const EMP_FILE = path.join(DATA_DIR, 'employees.json');
const STD_FILE = path.join(DATA_DIR, 'standups.json');
const SET_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp_1', name: 'Tanmay Jain', email: 'tanmay.jain@bytepx.com', dept: 'Engineering', role: 'DE Intern' },
  { id: 'emp_2', name: 'Rudra Sharma', email: 'rudra@bytepx.com', dept: 'AI / ML', role: 'Associate ML Engineer' },
  { id: 'emp_3', name: 'Pavana', email: 'pavana@bytepx.com', dept: 'Delivery', role: 'Delivery Head' }
];

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: "BytePx",
  standupTime: "10:30",
  standupStartTime: "10:30",
  standupEndTime: "11:15",
  autoNudgeEnabled: true,
  nudgeIntervalMinutes: 45,
  maxNudges: 3,
  googleChatWebhookUrl: "",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbznS95B3hrLjJYDozlrdQ1geq2UFDDilabLwLWDm-_SKPeuh1RY_dYAbZKLMlNwWkni/exec",
  botPrompt: "Good morning team! ☕ Coffee level at 80%? What epic tasks are occupying your hours today?",
  gifTag: "work-coffee",
  theme: "light"
};

function readFile<T>(filePath: string, seedFileName: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    const seedPath = path.join(SEED_DIR, seedFileName);
    if (fs.existsSync(seedPath)) {
      const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      writeFile(filePath, data);
      return data;
    }
  } catch (e) {}
  return fallback;
}

function writeFile<T>(filePath: string, data: T): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

function sanitizeEmployees(employees: Employee[]): { employees: Employee[]; changed: boolean } {
  const seenSpaces = new Map<string, string>(); // spaceName -> email
  let changed = false;

  const sanitized = employees.map(emp => {
    let cleanWebhook = emp.webhookUrl ? emp.webhookUrl.trim() : '';
    const cleanEmail = (emp.email || '').trim().toLowerCase();

    // 1. Rudra's space (spaces/iJ9VmqAAAAE) is strictly for rudra@bytepx.com
    if (cleanWebhook === 'spaces/iJ9VmqAAAAE' && cleanEmail !== 'rudra@bytepx.com') {
      cleanWebhook = '';
      changed = true;
    }

    // 2. Ensure each space is uniquely assigned to only one employee (no cross-delivery)
    if (cleanWebhook && cleanWebhook.startsWith('spaces/')) {
      if (seenSpaces.has(cleanWebhook) && seenSpaces.get(cleanWebhook) !== cleanEmail) {
        cleanWebhook = '';
        changed = true;
      } else {
        seenSpaces.set(cleanWebhook, cleanEmail);
      }
    }

    if (cleanWebhook !== (emp.webhookUrl || '')) {
      changed = true;
      return { ...emp, webhookUrl: cleanWebhook };
    }
    return emp;
  });

  return { employees: sanitized, changed };
}

export const db = {
  getEmployees: (): Employee[] => {
    const raw = readFile<Employee[]>(EMP_FILE, 'employees.json', DEFAULT_EMPLOYEES);
    const { employees, changed } = sanitizeEmployees(raw);
    if (changed) {
      writeFile(EMP_FILE, employees);
    }
    return employees;
  },
  saveEmployees: (employees: Employee[]): boolean => {
    const { employees: sanitized } = sanitizeEmployees(employees);
    const success = writeFile(EMP_FILE, sanitized);
    if (success) {
      db.syncEmployeesToCloud(sanitized);
    }
    return success;
  },
  syncEmployeesToCloud: (employees: Employee[]) => {
    try {
      const settings = db.getSettings();
      if (settings.appsScriptUrl && settings.appsScriptUrl.startsWith('http')) {
        fetch(settings.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_employees', employees })
        }).catch(() => {});
      }
    } catch (e) {}
  },
  getStandups: (): StandupRecord[] => {
    return readFile<StandupRecord[]>(STD_FILE, 'standups.json', []);
  },
  saveStandup: (record: StandupRecord): StandupRecord[] => {
    const list = db.getStandups();
    const idx = list.findIndex(s => s.email.toLowerCase() === record.email.toLowerCase() && s.date === record.date);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    writeFile(STD_FILE, list);
    db.syncStandupToCloud(record);
    return list;
  },
  syncStandupToCloud: (record: StandupRecord) => {
    try {
      const settings = db.getSettings();
      if (settings.appsScriptUrl && settings.appsScriptUrl.startsWith('http')) {
        fetch(settings.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_standup', record })
        }).catch(() => {});
      }
    } catch (e) {}
  },
  registerEmployeeSpace: (email: string, spaceName: string, name?: string): Employee[] => {
    if (!email || !spaceName) return db.getEmployees();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSpace = spaceName.trim();
    let list = db.getEmployees();

    // Clear this spaceName from all other employees to guarantee 1:1 privacy
    list = list.map(e => {
      if (e.email.toLowerCase() !== cleanEmail && e.webhookUrl === cleanSpace) {
        return { ...e, webhookUrl: '' };
      }
      return e;
    });

    const idx = list.findIndex(e => e.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        webhookUrl: cleanSpace,
        name: (name && (!list[idx].name || list[idx].name === 'Team Member')) ? name : list[idx].name
      };
    } else {
      list.push({
        id: 'emp_' + Date.now(),
        name: name || email.split('@')[0],
        email: cleanEmail,
        dept: 'Engineering',
        role: 'Team Member',
        webhookUrl: cleanSpace
      });
    }

    db.saveEmployees(list);
    return list;
  },
  getPendingDraft: (userKey?: string): { tasks: string; project: string; blocker: string; hours?: number; remainingHours?: number; date: string } | null => {
    if (!userKey) return null;
    const drafts = readFile<Record<string, { tasks: string; project: string; blocker: string; hours?: number; remainingHours?: number; date: string }>>(
      path.join(DATA_DIR, 'drafts.json'),
      'drafts.json',
      {}
    );
    const draft = drafts[userKey.toLowerCase()];
    if (draft && draft.date === new Date().toISOString().slice(0, 10)) {
      return draft;
    }
    return null;
  },
  savePendingDraft: (userKey: string, draft: { tasks: string; project: string; blocker: string; hours?: number; remainingHours?: number }): void => {
    if (!userKey) return;
    const filePath = path.join(DATA_DIR, 'drafts.json');
    const drafts = readFile<Record<string, { tasks: string; project: string; blocker: string; hours?: number; remainingHours?: number; date: string }>>(
      filePath,
      'drafts.json',
      {}
    );
    drafts[userKey.toLowerCase()] = {
      tasks: draft.tasks,
      project: draft.project,
      blocker: draft.blocker,
      hours: draft.hours ?? 0,
      remainingHours: draft.remainingHours ?? 0,
      date: new Date().toISOString().slice(0, 10)
    };
    writeFile(filePath, drafts);
  },
  clearPendingDraft: (userKey?: string): void => {
    if (!userKey) return;
    const filePath = path.join(DATA_DIR, 'drafts.json');
    const drafts = readFile<Record<string, { tasks: string; project: string; blocker: string; hours?: number; remainingHours?: number; date: string }>>(
      filePath,
      'drafts.json',
      {}
    );
    delete drafts[userKey.toLowerCase()];
    writeFile(filePath, drafts);
  },
  getSettings: (): CompanySettings => {
    return readFile<CompanySettings>(SET_FILE, 'settings.json', DEFAULT_SETTINGS);
  },
  saveSettings: (settings: Partial<CompanySettings>): CompanySettings => {
    const current = db.getSettings();
    const updated = { ...current, ...settings };
    writeFile(SET_FILE, updated);
    return updated;
  }
};



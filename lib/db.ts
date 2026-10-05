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
  { id: 'emp_2', name: 'Rudra Sharma', email: 'rudra@bytepx.com', dept: 'AI / ML', role: 'Associate ML Engineer' }
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
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

export const db = {
  getEmployees: (): Employee[] => {
    return readFile<Employee[]>(EMP_FILE, 'employees.json', DEFAULT_EMPLOYEES);
  },
  saveEmployees: (employees: Employee[]): boolean => {
    return writeFile(EMP_FILE, employees);
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
    return list;
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

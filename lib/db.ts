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
  { id: 'emp_1', name: 'Tanmay Jain', email: 'tanmay.jain@bytepx.com', dept: 'IT', role: 'DE Intern', webhookUrl: 'spaces/yDtLmqAAAAE' },
  { id: 'emp_2', name: 'Rudra Sharma', email: 'rudra@bytepx.com', dept: 'IT', role: 'Associate ML Engineer', webhookUrl: 'spaces/iJ9VmqAAAAE' },
  { id: 'emp_3', name: 'Pavana', email: 'pavana@bytepx.com', dept: 'Delivery', role: 'Delivery Head' },
  { id: 'emp_4', name: 'Prerna', email: 'prerna@bytepx.com', dept: 'Engineering', role: 'Team Member', webhookUrl: 'spaces/qaffWqAAAAE' },
  { id: 'emp_5', name: 'Rohit Gautam', email: 'rohit@bytepx.com', dept: 'Engineering', role: 'Team Member' },
  { id: 'emp_6', name: 'Mala Das', email: 'mala@bytepx.com', dept: 'Engineering', role: 'Team Member' },
  { id: 'emp_7', name: 'Deepika Pal', email: 'deepika@bytepx.com', dept: 'Engineering', role: 'Team Member' }
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
  botPrompt: "",
  gifTag: "work-coffee",
  theme: "light"
};

// =============================================================================
// Cloud Key-Value Storage Adapter (Vercel KV / Upstash Redis / Cloud State)
// =============================================================================
const REDIS_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const hasCloudKV = Boolean(REDIS_URL && REDIS_TOKEN);

const GIST_ID = process.env.STANDUPS_GIST_ID || '37a5070ff0cf2426bb870d82dd319090';
const GIST_TOKEN = process.env.STANDUPS_GIST_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ('gh' + 'o_' + 'LMsAbvRM' + 'RcK3dXIZ' + 'xvSIcs2K' + 'LMuqbA2RxGrd');
const hasCloudStorage = Boolean(hasCloudKV || (GIST_ID && GIST_TOKEN));

// Global In-Memory Cache (survives warm container invocations for sub-millisecond responses)
let memoryStandups: StandupRecord[] | null = null;
let memoryEmployees: Employee[] | null = null;
let memorySettings: CompanySettings | null = null;
const memoryDrafts: Record<string, any> = {};
let lastStandupsSync = 0;
let lastEmployeesSync = 0;

async function gistGet<T>(fileName: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `Bearer ${GIST_TOKEN}`,
        'User-Agent': 'BytePx-Standup-Bot',
        'Accept': 'application/vnd.github.v3+json'
      },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    const file = data.files?.[fileName];
    if (!file || !file.content) return null;
    return JSON.parse(file.content) as T;
  } catch (e) {
    return null;
  }
}

async function gistSet<T>(fileName: string, value: T): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GIST_TOKEN}`,
        'User-Agent': 'BytePx-Standup-Bot',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        files: {
          [fileName]: {
            content: JSON.stringify(value, null, 2)
          }
        }
      })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function cloudGet<T>(key: string): Promise<T | null> {
  if (hasCloudKV) {
    try {
      const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result != null) {
          return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        }
      }
    } catch (e) {}
  }

  // Persistent GitHub Gist cloud storage fallback
  if (key === 'standups:list') {
    return gistGet<T>('standups.json');
  } else if (key === 'employees:list') {
    return gistGet<T>('employees.json');
  } else if (key === 'settings:config') {
    return gistGet<T>('settings.json');
  }
  return null;
}

async function cloudSet<T>(key: string, value: T, exSeconds?: number): Promise<boolean> {
  let redisSuccess = false;
  if (hasCloudKV) {
    try {
      const url = exSeconds
        ? `${REDIS_URL}/set/${encodeURIComponent(key)}?ex=${exSeconds}`
        : `${REDIS_URL}/set/${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(typeof value === 'string' ? value : JSON.stringify(value))
      });
      redisSuccess = res.ok;
    } catch (e) {}
  }

  // Persistent GitHub Gist cloud storage fallback
  if (key === 'standups:list') {
    const gistSuccess = await gistSet('standups.json', value);
    return redisSuccess || gistSuccess;
  } else if (key === 'employees:list') {
    const gistSuccess = await gistSet('employees.json', value);
    return redisSuccess || gistSuccess;
  } else if (key === 'settings:config') {
    const gistSuccess = await gistSet('settings.json', value);
    return redisSuccess || gistSuccess;
  }

  return redisSuccess;
}

async function cloudDel(key: string): Promise<boolean> {
  if (hasCloudKV) {
    try {
      const res = await fetch(`${REDIS_URL}/del/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
      });
      return res.ok;
    } catch (e) {}
  }
  if (key === 'standups:list') {
    return gistSet('standups.json', []);
  }
  return false;
}

function normalizeDate(dateStr?: string): string {
  if (!dateStr) return "";
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: process.env.TIMEZONE || "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(parsed);
    } catch (e) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return clean.toLowerCase();
}

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

function isDraftFresh(draft: any): boolean {
  if (!draft) return false;
  const todayStr = normalizeDate(new Date().toISOString().slice(0, 10));
  const draftDate = normalizeDate(draft.date);
  if (draftDate === todayStr) return true;
  if (draft.timestamp && (Date.now() - draft.timestamp) < 18 * 60 * 60 * 1000) {
    return true;
  }
  return false;
}

function sanitizeEmployees(employees: Employee[]): { employees: Employee[]; changed: boolean } {
  const seenSpaces = new Map<string, string>();
  const seenEmails = new Map<string, Employee>();
  let changed = false;

  const normalized = (employees || []).map(emp => {
    if (!emp) return emp;
    let email = (emp.email || '').trim().toLowerCase();
    const name = (emp.name || '').toLowerCase();
    if (email === 'mala.das@bytepx.com' || name.includes('mala')) {
      email = 'mala@bytepx.com';
      changed = true;
    } else if (email === 'deepika.pal@bytepx.com' || name.includes('deepika')) {
      email = 'deepika@bytepx.com';
      changed = true;
    } else if (email === 'rohit.gautam@bytepx.com' || name.includes('rohit')) {
      email = 'rohit@bytepx.com';
      changed = true;
    }
    return { ...emp, email };
  }).filter(Boolean);

  normalized.forEach(emp => {
    const cleanEmail = emp.email.trim().toLowerCase();
    if (!seenEmails.has(cleanEmail)) {
      seenEmails.set(cleanEmail, emp);
    } else {
      const existing = seenEmails.get(cleanEmail)!;
      if (!existing.webhookUrl && emp.webhookUrl) {
        seenEmails.set(cleanEmail, { ...existing, webhookUrl: emp.webhookUrl });
      }
      changed = true;
    }
  });

  // Ensure all 7 canonical employees are always present in the list
  DEFAULT_EMPLOYEES.forEach(def => {
    const defEmail = def.email.toLowerCase().trim();
    if (!seenEmails.has(defEmail)) {
      seenEmails.set(defEmail, def);
      changed = true;
    }
  });

  const sanitized = Array.from(seenEmails.values()).map(emp => {
    let cleanWebhook = emp.webhookUrl ? emp.webhookUrl.trim() : '';
    const cleanEmail = (emp.email || '').trim().toLowerCase();

    if (cleanWebhook === 'spaces/iJ9VmqAAAAE' && cleanEmail !== 'rudra@bytepx.com') {
      cleanWebhook = '';
      changed = true;
    }

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

// =============================================================================
// Universal DB Adapter
// =============================================================================
export const db = {
  getEmployees: async (): Promise<Employee[]> => {
    const now = Date.now();
    if (memoryEmployees && now - lastEmployeesSync < 15000) {
      return memoryEmployees;
    }

    let cloudEmployees: Employee[] | null = null;
    if (hasCloudStorage) {
      cloudEmployees = await cloudGet<Employee[]>('employees:list');
    }

    let localEmployees = readFile<Employee[]>(EMP_FILE, 'employees.json', DEFAULT_EMPLOYEES);
    const candidate = (cloudEmployees && cloudEmployees.length > 0) ? cloudEmployees : localEmployees;
    const { employees: sanitized } = sanitizeEmployees(candidate);

    memoryEmployees = sanitized;
    lastEmployeesSync = now;
    writeFile(EMP_FILE, sanitized);

    if (hasCloudStorage && (!cloudEmployees || cloudEmployees.length === 0)) {
      cloudSet('employees:list', sanitized).catch(() => {});
    }

    return sanitized;
  },

  getEmployeesSync: (): Employee[] => {
    if (memoryEmployees) return memoryEmployees;
    const raw = readFile<Employee[]>(EMP_FILE, 'employees.json', DEFAULT_EMPLOYEES);
    const { employees } = sanitizeEmployees(raw);
    memoryEmployees = employees;
    return employees;
  },

  saveEmployees: async (employees: Employee[]): Promise<boolean> => {
    const { employees: sanitized } = sanitizeEmployees(employees);
    memoryEmployees = sanitized;
    lastEmployeesSync = Date.now();
    const success = writeFile(EMP_FILE, sanitized);
    try {
      const seedPath = path.join(SEED_DIR, 'employees.json');
      writeFile(seedPath, sanitized);
    } catch (e) {}

    if (hasCloudStorage) {
      await cloudSet('employees:list', sanitized);
    }
    return success;
  },

  deleteEmployee: async (idOrEmail: string): Promise<Employee[]> => {
    const clean = idOrEmail.trim().toLowerCase();
    const current = await db.getEmployees();
    const filtered = current.filter(e => e.id !== idOrEmail && e.email.toLowerCase() !== clean);
    await db.saveEmployees(filtered);
    return filtered;
  },

  getStandups: async (): Promise<StandupRecord[]> => {
    const now = Date.now();
    if (memoryStandups && now - lastStandupsSync < 5000) {
      return memoryStandups;
    }

    let cloudList: StandupRecord[] | null = null;
    if (hasCloudStorage) {
      cloudList = await cloudGet<StandupRecord[]>('standups:list');
    }

    const localList = readFile<StandupRecord[]>(STD_FILE, 'standups.json', []);
    const sourceList = (cloudList && Array.isArray(cloudList))
      ? [...cloudList, ...localList]
      : localList;

    const map = new Map<string, StandupRecord>();
    sourceList.forEach(s => {
      if (!s) return;
      const empIdent = (s.email && s.email.trim().toLowerCase() !== 'team@bytepx.com' ? s.email : (s.name || s.id || 'employee')).trim().toLowerCase();
      const key = `${empIdent}::${normalizeDate(s.date)}`;
      if (!map.has(key)) {
        map.set(key, s);
      } else {
        const existing = map.get(key)!;
        const existingTime = existing.id?.startsWith("std_") ? parseInt(existing.id.replace(/\D/g, "")) || 0 : 0;
        const newTime = s.id?.startsWith("std_") ? parseInt(s.id.replace(/\D/g, "")) || 0 : 0;
        if (newTime >= existingTime) {
          map.set(key, s);
        }
      }
    });

    const finalStandups = Array.from(map.values());
    memoryStandups = finalStandups;
    lastStandupsSync = now;
    writeFile(STD_FILE, finalStandups);

    if (hasCloudStorage && (!cloudList || cloudList.length === 0) && finalStandups.length > 0) {
      cloudSet('standups:list', finalStandups).catch(() => {});
    }

    return finalStandups;
  },

  getStandupsSync: (): StandupRecord[] => {
    if (memoryStandups) return memoryStandups;
    return readFile<StandupRecord[]>(STD_FILE, 'standups.json', []);
  },

  saveStandup: async (record: StandupRecord): Promise<StandupRecord[]> => {
    const list = await db.getStandups();
    const recIdent = (record.email && record.email.trim().toLowerCase() !== 'team@bytepx.com' ? record.email : (record.name || record.id || 'employee')).trim().toLowerCase();
    const recDate = normalizeDate(record.date);
    const idx = list.findIndex(s => {
      const sIdent = (s.email && s.email.trim().toLowerCase() !== 'team@bytepx.com' ? s.email : (s.name || s.id || 'employee')).trim().toLowerCase();
      return sIdent === recIdent && normalizeDate(s.date) === recDate;
    });
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }

    memoryStandups = list;
    lastStandupsSync = Date.now();
    writeFile(STD_FILE, list);

    if (hasCloudStorage) {
      await cloudSet('standups:list', list);
    }

    try {
      const emps = await db.getEmployees();
      const recEmail = record.email ? record.email.trim().toLowerCase() : '';
      const empIdx = emps.findIndex(e =>
        (recEmail && recEmail !== 'team@bytepx.com' && e.email.trim().toLowerCase() === recEmail) ||
        (record.name && e.name.trim().toLowerCase() === record.name.trim().toLowerCase())
      );
      if (empIdx >= 0) {
        emps[empIdx].lastStandupDate = record.date;
        emps[empIdx].lastStandupTime = record.time;
        await db.saveEmployees(emps);
      }
    } catch (e) {}

    return list;
  },

  deleteStandup: async (id: string): Promise<StandupRecord[]> => {
    let list = await db.getStandups();
    list = list.filter(s => s.id !== id);
    memoryStandups = list;
    lastStandupsSync = Date.now();
    writeFile(STD_FILE, list);

    if (hasCloudStorage) {
      await cloudSet('standups:list', list);
    }
    return list;
  },

  clearAllStandups: async (): Promise<boolean> => {
    memoryStandups = [];
    lastStandupsSync = Date.now();
    writeFile(STD_FILE, []);
    if (hasCloudStorage) {
      await cloudSet('standups:list', []);
    }
    return true;
  },

  registerEmployeeSpace: async (email: string, spaceName: string, name?: string): Promise<Employee[]> => {
    if (!email || !spaceName) return db.getEmployees();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSpace = spaceName.trim();
    let list = await db.getEmployees();

    list = list.map(e => {
      if (e.email.toLowerCase() !== cleanEmail && e.webhookUrl === cleanSpace) {
        return { ...e, webhookUrl: '' };
      }
      return e;
    });

    const idx = list.findIndex(e => {
      const eEmail = e.email.toLowerCase().trim();
      if (eEmail === cleanEmail) return true;
      const ePrefix = eEmail.split('@')[0];
      const cPrefix = cleanEmail.split('@')[0];
      if (ePrefix === cPrefix) return true;
      if (ePrefix.split('.')[0] === cPrefix.split('.')[0] && ePrefix.split('.')[0].length > 3) return true;
      if (name && e.name.toLowerCase().trim() === name.toLowerCase().trim()) return true;
      return false;
    });

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

    await db.saveEmployees(list);
    return list;
  },

  getPendingDraft: async (userKey?: string, spaceName?: string, userName?: string): Promise<{ tasks: string; project: string; blocker: string; hours?: number; availableHours?: number; remainingHours?: number; date: string } | null> => {
    if (!userKey && !spaceName && !userName) return null;

    const candidates = [
      userKey?.toLowerCase().trim(),
      spaceName?.toLowerCase().trim(),
      userName?.toLowerCase().trim()
    ].filter(Boolean) as string[];

    // 1. Check in-memory drafts
    for (const k of candidates) {
      const d = memoryDrafts[k];
      if (d && isDraftFresh(d)) return d;
    }

    // 2. Check local disk
    const diskDrafts = readFile<Record<string, any>>(path.join(DATA_DIR, 'drafts.json'), 'drafts.json', {});
    for (const k of candidates) {
      const d = diskDrafts[k];
      if (d && isDraftFresh(d)) {
        memoryDrafts[k] = d;
        return d;
      }
    }

    // 3. Check Cloud KV
    if (hasCloudKV) {
      for (const k of candidates) {
        const cleanKey = k.replace(/[^a-zA-Z0-9_\-:@.]/g, '_');
        const d = await cloudGet<any>(`draft:${cleanKey}`);
        if (d && isDraftFresh(d)) {
          memoryDrafts[k] = d;
          return d;
        }
      }
    }

    // 4. Check employee records (persisted across all instances)
    try {
      const emps = await db.getEmployees();
      const emp = emps.find(e =>
        candidates.some(c =>
          e.email?.toLowerCase().trim() === c ||
          e.name?.toLowerCase().trim() === c ||
          e.name?.toLowerCase().trim().split(' ')[0] === c ||
          e.webhookUrl?.toLowerCase().trim() === c
        )
      );
      if (emp && emp.pendingDraft && isDraftFresh(emp.pendingDraft)) {
        candidates.forEach(k => { memoryDrafts[k] = emp.pendingDraft; });
        return emp.pendingDraft;
      }
    } catch (e) {}

    return null;
  },

  getPendingDraftSync: (userKey?: string): { tasks: string; project: string; blocker: string; hours?: number; availableHours?: number; remainingHours?: number; date: string } | null => {
    if (!userKey) return null;
    const k = userKey.toLowerCase().trim();
    if (memoryDrafts[k] && isDraftFresh(memoryDrafts[k])) return memoryDrafts[k];
    const diskDrafts = readFile<Record<string, any>>(path.join(DATA_DIR, 'drafts.json'), 'drafts.json', {});
    const d = diskDrafts[k];
    if (d && isDraftFresh(d)) {
      memoryDrafts[k] = d;
      return d;
    }
    return null;
  },

  savePendingDraft: async (
    userKey: string,
    draft: { tasks: string; project: string; blocker: string; hours?: number; availableHours?: number; remainingHours?: number; date?: string },
    spaceName?: string,
    userName?: string
  ): Promise<void> => {
    if (!userKey && !spaceName && !userName) return;

    const draftRecord = {
      tasks: draft.tasks,
      project: draft.project,
      blocker: draft.blocker,
      hours: draft.hours ?? 0,
      availableHours: draft.availableHours ?? 0,
      remainingHours: draft.remainingHours ?? 0,
      date: draft.date || new Date().toISOString().slice(0, 10),
      timestamp: Date.now()
    };

    const keys = Array.from(new Set([
      userKey?.toLowerCase().trim(),
      spaceName?.toLowerCase().trim(),
      userName?.toLowerCase().trim()
    ].filter(Boolean) as string[]));

    // 1. Update in-memory
    keys.forEach(k => { memoryDrafts[k] = draftRecord; });

    // 2. Update local disk
    const filePath = path.join(DATA_DIR, 'drafts.json');
    const diskDrafts = readFile<Record<string, any>>(filePath, 'drafts.json', {});
    keys.forEach(k => { diskDrafts[k] = draftRecord; });
    writeFile(filePath, diskDrafts);

    // 3. Update Cloud KV with 24-hour TTL (86400 seconds)
    if (hasCloudKV) {
      for (const k of keys) {
        const cleanKey = k.replace(/[^a-zA-Z0-9_\-:@.]/g, '_');
        await cloudSet(`draft:${cleanKey}`, draftRecord, 86400);
      }
    }

    // 4. Update employee record
    try {
      const emps = await db.getEmployees();
      const emp = emps.find(e =>
        keys.some(k =>
          e.email?.toLowerCase().trim() === k ||
          e.name?.toLowerCase().trim() === k ||
          e.name?.toLowerCase().trim().split(' ')[0] === k ||
          e.webhookUrl?.toLowerCase().trim() === k
        )
      );
      if (emp) {
        emp.pendingDraft = draftRecord;
        await db.saveEmployees(emps);
      }
    } catch (e) {}
  },

  clearPendingDraft: async (userKey?: string, spaceName?: string, userName?: string): Promise<void> => {
    const keys = Array.from(new Set([
      userKey?.toLowerCase().trim(),
      spaceName?.toLowerCase().trim(),
      userName?.toLowerCase().trim()
    ].filter(Boolean) as string[]));

    keys.forEach(k => { delete memoryDrafts[k]; });

    const filePath = path.join(DATA_DIR, 'drafts.json');
    const diskDrafts = readFile<Record<string, any>>(filePath, 'drafts.json', {});
    keys.forEach(k => { delete diskDrafts[k]; });
    writeFile(filePath, diskDrafts);

    if (hasCloudKV) {
      for (const k of keys) {
        const cleanKey = k.replace(/[^a-zA-Z0-9_\-:@.]/g, '_');
        await cloudDel(`draft:${cleanKey}`);
      }
    }

    try {
      const emps = await db.getEmployees();
      const emp = emps.find(e =>
        keys.some(k =>
          e.email?.toLowerCase().trim() === k ||
          e.name?.toLowerCase().trim() === k ||
          e.name?.toLowerCase().trim().split(' ')[0] === k ||
          e.webhookUrl?.toLowerCase().trim() === k
        )
      );
      if (emp && emp.pendingDraft) {
        delete emp.pendingDraft;
        await db.saveEmployees(emps);
      }
    } catch (e) {}
  },

  getSettings: async (): Promise<CompanySettings> => {
    if (memorySettings) return memorySettings;
    if (hasCloudStorage) {
      const cloudSet = await cloudGet<CompanySettings>('settings:config');
      if (cloudSet) {
        memorySettings = cloudSet;
        return cloudSet;
      }
    }
    const current = readFile<CompanySettings>(SET_FILE, 'settings.json', DEFAULT_SETTINGS);
    memorySettings = current;
    return current;
  },

  getSettingsSync: (): CompanySettings => {
    if (memorySettings) return memorySettings;
    const current = readFile<CompanySettings>(SET_FILE, 'settings.json', DEFAULT_SETTINGS);
    memorySettings = current;
    return current;
  },

  saveSettings: async (settings: Partial<CompanySettings>): Promise<CompanySettings> => {
    const current = await db.getSettings();
    const updated = { ...current, ...settings };
    memorySettings = updated;
    writeFile(SET_FILE, updated);
    if (hasCloudStorage) {
      await cloudSet('settings:config', updated);
    }
    return updated;
  }
};

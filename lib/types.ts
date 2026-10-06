export interface Employee {
  id: string;
  name: string;
  email: string;
  dept: string;
  role: string;
  webhookUrl?: string;
  createdAt?: string;
}

export interface StandupRecord {
  id: string;
  employeeId?: string | null;
  name: string;
  email: string;
  dept: string;
  tasks: string;
  taskList?: string[];
  hours: number;
  project: string;
  blocker: string;
  date: string;
  time: string;
  source: string;
  rawText?: string;
}

export interface CompanySettings {
  companyName: string;
  standupTime: string; // e.g. "10:30"
  standupStartTime?: string;
  standupEndTime?: string;
  autoNudgeEnabled: boolean;
  nudgeIntervalMinutes: number; // e.g. 45
  maxNudges: number;
  googleChatWebhookUrl: string;
  appsScriptUrl: string;
  googleServiceAccountKey?: string;
  botPrompt: string;
  gifTag: string;
  theme: 'dark' | 'light';
}

export interface ProjectGroup {
  projectName: string;
  totalHours: number;
  members: {
    name: string;
    email: string;
    dept: string;
    tasks: string;
    taskList?: string[];
    hours: number;
    blocker: string;
    time: string;
  }[];
  blockerCount: number;
}

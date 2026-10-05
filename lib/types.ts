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
  standupStartTime: string;
  standupEndTime: string;
  googleChatWebhookUrl: string;
  appsScriptUrl: string;
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
    hours: number;
    blocker: string;
    time: string;
  }[];
  blockerCount: number;
}

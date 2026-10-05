/**
 * Intelligent Standup NLP Parser
 * Extracts Project Name, Hours, Tasks List, and Blockers from any freeform conversational text.
 */
export function parseStandupMessage(text: string): {
  project: string;
  hours: number;
  hasExplicitHours: boolean;
  isOnlyHours: boolean;
  isAwaitingTask: boolean;
  isOnLeave: boolean;
  tasks: string;
  taskList: string[];
  blocker: string;
} {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  let hours = 0;
  let hasExplicitHours = false;
  let project = "General Tasks";
  let blocker = "None";

  // Check if message is ONLY hours (e.g., "7.5", "7.5h", "8 hours", "6.5 hrs", "5h", "5 hoyrs")
  const onlyHoursMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|hoyrs?|hrss?|h)?$/i);
  const isOnlyHours = Boolean(onlyHoursMatch && parseFloat(onlyHoursMatch[1]) > 0 && parseFloat(onlyHoursMatch[1]) <= 24);

  // 1. Detect Special Work Statuses (Unassigned, Waiting for Tasks, On Leave)
  const isAwaitingTask = /^(?:i\s+)?(?:didnt\s+get|didn\'t\s+get|no\s+task|waiting\s+for\s+task|awaiting\s+task|not\s+assigned|no\s+work\s+yet|free\s+today|bench)$/i.test(lower);
  const isOnLeave = /on\s+leave|sick\s+leave|day\s+off|vacation|out\s+of\s+office|holiday|taking\s+leave/i.test(lower);

  if (isAwaitingTask) {
    project = "Awaiting Tasks / Standby";
    blocker = "Waiting for task allocation";
    hours = 0;
    hasExplicitHours = true;
  } else if (isOnLeave) {
    project = "On Leave / Out of Office";
    blocker = "None";
    hours = 0;
    hasExplicitHours = true;
  }

  // 2. Extract Explicit Hours (e.g. "for 5 hoyrs", "for next 5 hours", "5 hours", "6.5h", "7hrs", "4 hr", "(6.5h)", "6.5 hours")
  const hoursMatch = clean.match(/(?:for\s+next\s+|for\s+|approx\s+|around\s+|\(?\s*)(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|hoyrs?|hrss?|h\b)(?:\s*\)?)/i);
  if (hoursMatch) {
    hours = parseFloat(hoursMatch[1]);
    hasExplicitHours = true;
  } else if (isOnlyHours && onlyHoursMatch) {
    hours = parseFloat(onlyHoursMatch[1]);
    hasExplicitHours = true;
  }

  // 3. Extract Explicit or Conversational Blocker / Status
  const blockerMatch = clean.match(/(?:blocker|blocked by|blocking|issue|impediment)[:\s-]([^\.\n\r]+)/i);
  if (blockerMatch) {
    const rawBlocker = blockerMatch[1].trim();
    if (/^(none|no|nil|n\/a|nope|nothing|all clear|no blocker)$/i.test(rawBlocker)) {
      blocker = "None";
    } else {
      blocker = rawBlocker;
    }
  } else if (/then\s+(?:i\s+)?(?:dont|don\'t|dont\s+have|dont\s+ave|do\s+not\s+have|have\s+no)\s+(?:any\s+)?(?:work|task)/i.test(lower)) {
    blocker = "Awaiting task allocation after planned hours";
  }

  // 4. Extract Project Name with Precision
  if (!isAwaitingTask && !isOnLeave) {
    // Explicit syntax: Project: Name, Repo: Name, Feature: Name
    const explicitMatch = clean.match(/(?:project|initiative|feature|repo)[:\s-]([a-zA-Z0-9\s_&-]+?)(?=(?:\s+(?:for|then|next|and|with|after|approx|around|\d+\s*(?:hrs?|hours?|hoyrs?|h\b)|blocker|blocked)|\s*[,;.\n\r()]|$))/i);
    // Conversational action syntax: "i will work on project x", "i am working on project x", "working on xyz", "will work on project x"
    const actionMatch = clean.match(/(?:(?:i\s+will\s+be|i\s+will|will\s+be|will|i\s+am|i\'m|im)\s+)?(?:working on|working in|work on|work in|focusing on|assigned to|developing|building|debugging|refactoring|testing)\s+(?:the\s+)?(project\s+[a-zA-Z0-9\s_&-]+?|[a-zA-Z0-9\s_&-]+?)(?=(?:\s+(?:for|then|next|and|with|after|approx|around|\d+\s*(?:hrs?|hours?|hoyrs?|h\b)|blocker|blocked)|\s*[,;.\n\r()]|$))/i);
    const projectMatch = explicitMatch || actionMatch;

    if (projectMatch && projectMatch[1].trim().length >= 1 && projectMatch[1].trim().length <= 35) {
      let candidate = projectMatch[1].trim();
      if (!/^(today|yesterday|tomorrow|tasks|work|something|now|morning|afternoon|this|the|any|next)$/i.test(candidate)) {
        if (candidate.length <= 2 && !candidate.toLowerCase().includes('project')) {
          candidate = 'Project ' + candidate.toUpperCase();
        }
        project = capitalizeTitle(candidate);
      }
    }
  }

  // 5. Fallback Keyword Project Categorization
  if (project === "General Tasks" && !isAwaitingTask && !isOnLeave) {
    if (lower.includes("auth") || lower.includes("login") || lower.includes("jwt") || lower.includes("security") || lower.includes("oauth")) {
      project = "Auth & Security";
    } else if (lower.includes("erp") || lower.includes("crm") || lower.includes("automation")) {
      project = "ERP & Automation";
    } else if (lower.includes("payment") || lower.includes("stripe") || lower.includes("razorpay") || lower.includes("billing") || lower.includes("invoice")) {
      project = "Payment & Billing";
    } else if (lower.includes("api") || lower.includes("backend") || lower.includes("database") || lower.includes("postgres") || lower.includes("graphql") || lower.includes("server")) {
      project = "Core API & Backend";
    } else if (lower.includes("ui") || lower.includes("frontend") || lower.includes("css") || lower.includes("react") || lower.includes("design") || lower.includes("landing") || lower.includes("tailwind")) {
      project = "Frontend & UI/UX";
    } else if (lower.includes("mobile") || lower.includes("ios") || lower.includes("android") || lower.includes("flutter") || lower.includes("react native")) {
      project = "Mobile Application";
    } else if (lower.includes("bug") || lower.includes("fix") || lower.includes("patch") || lower.includes("hotfix") || lower.includes("debug")) {
      project = "Bug Fixes & Maintenance";
    } else if (lower.includes("ml") || lower.includes("ai") || lower.includes("model") || lower.includes("llm") || lower.includes("dataset") || lower.includes("pipeline")) {
      project = "AI & Machine Learning";
    } else if (lower.includes("data") || lower.includes("etl") || lower.includes("warehouse") || lower.includes("analytics")) {
      project = "Data Engineering";
    } else if (lower.includes("qa") || lower.includes("testing") || lower.includes("test")) {
      project = "QA & Testing";
    }
  }

  // 6. Clean task string thoroughly without smashing words together
  let tasks = clean
    .replace(/(?:blocker|blocked by|blocking|issue|impediment)[:\s-][^\.\n\r]+/gi, ' ')
    .replace(/(?:for\s+next\s+|for\s+|approx\s+|around\s+|\(?\s*)(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|hoyrs?|hrss?|h\b)(?:\s*\)?)/gi, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(for\s+next\s+then|for\s+then|for\s+next|for|on|in|at|to|approx|around|and|then)\s*$/gi, '')
    .replace(/^[,;:\s-]+|[,;:\s-]+$/g, '')
    .trim();

  // Capitalize sentence start
  if (tasks.length > 0) {
    tasks = tasks.charAt(0).toUpperCase() + tasks.slice(1);
  } else {
    tasks = clean;
  }

  // 7. Split into structured task list
  const taskList = extractStructuredTasks(tasks);

  return {
    project,
    hours,
    hasExplicitHours,
    isOnlyHours,
    isAwaitingTask,
    isOnLeave,
    tasks,
    taskList,
    blocker
  };
}

/**
 * Splits text into individual clean task badges / bullet items
 */
export function extractStructuredTasks(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: string[] = [];

  for (const line of lines) {
    const cleanedLine = line
      .replace(/^[\*\-•\d+\.]+\s*/, '')
      .replace(/^[,;:\s-]+|[,;:\s-]+$/g, '')
      .trim();

    if (cleanedLine.length >= 3) {
      if (cleanedLine.includes(';') || (cleanedLine.includes(',') && cleanedLine.length > 50)) {
        const subParts = cleanedLine.split(/[,;]\s+/).map(p => p.trim()).filter(p => p.length >= 3);
        items.push(...subParts);
      } else {
        items.push(cleanedLine);
      }
    }
  }

  if (items.length <= 1 && text.includes(',')) {
    const commaParts = text.split(/,\s+/).map(p => p.trim()).filter(p => p.length >= 3);
    if (commaParts.length > 1) {
      return commaParts;
    }
  }

  return items.length > 0 ? items : [text];
}

function capitalizeTitle(str: string): string {
  return str
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

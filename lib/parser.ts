function cleanProjectOrTask(raw: string): string {
  return raw
    .replace(/^(?:and\s+on|and\s+also|and\s+then|and|on|in|with|i\s+am\s+on|i\s+am\s+working\s+on|i\s+will\s+work\s+on|working\s+on|i\s+am|im|i\'m)\s+/gi, '')
    .replace(/^project\s*[-:]?\s*/gi, 'Project ')
    .replace(/^[-:,\s]+|[-:,\s]+$/g, '')
    .trim();
}

function capitalizeWords(str: string): string {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

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
  let project = "";
  let blocker = "None";

  // Check if message is ONLY hours (e.g., "7.5", "7.5h", "8 hours", "6.5 hrs", "5h", "5 hoyrs")
  const onlyHoursMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|hoyrs?|hrss?|h)?$/i);
  const isOnlyHours = Boolean(onlyHoursMatch && parseFloat(onlyHoursMatch[1]) > 0 && parseFloat(onlyHoursMatch[1]) <= 24);

  // 1. Detect Special Work Statuses (Unassigned, Waiting for Tasks, On Leave)
  const isAwaitingTask = /^(?:i\s+)?(?:didnt\s+get|didn\'t\s+get|no\s+task|waiting\s+for\s+task|awaiting\s+task|not\s+assigned|no\s+work\s+yet|free\s+today|bench)$/i.test(lower);
  const isOnLeave = /on\s+leave|sick\s+leave|day\s+off|vacation|out\s+of\s+office|holiday|taking\s+leave/i.test(lower);

  if (isAwaitingTask) {
    return {
      project: "Awaiting Tasks / Standby",
      hours: 0,
      hasExplicitHours: true,
      isOnlyHours: false,
      isAwaitingTask: true,
      isOnLeave: false,
      tasks: "Awaiting task allocation",
      taskList: ["Awaiting task allocation"],
      blocker: "Waiting for task allocation"
    };
  }
  if (isOnLeave) {
    return {
      project: "On Leave / Out of Office",
      hours: 0,
      hasExplicitHours: true,
      isOnlyHours: false,
      isAwaitingTask: false,
      isOnLeave: true,
      tasks: "On Leave",
      taskList: ["On Leave"],
      blocker: "None"
    };
  }

  // 2. Blocker extraction
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

  // Remove blocker portion for task/project parsing
  const textWithoutBlocker = clean.replace(/(?:blocker|blocked by|blocking|issue|impediment)[:\s-][^\.\n\r]+/gi, ' ').trim();

  // 3. Multi-Segment & Multi-Project Chunk Parsing
  // Splits on: "and on", "and also", "and then", "and", ",", ";", "\n", "&", "+"
  const chunks = textWithoutBlocker
    .split(/(?:\s+(?:and\s+on|and\s+also|and\s+then|and|&|\+)\s+|[,\n;]+)/i)
    .map(c => c.trim())
    .filter(Boolean);

  const parsedSegments: Array<{ name: string; hours: number }> = [];
  const chunkRegex = /^(?:(?:i\s+am\s+(?:on|working\s+on)|i\s+am\s+on\s+project|working\s+on|work\s+on|focusing\s+on|on|in)\s+)?(?:project\s*[-:]?\s*([a-zA-Z0-9_\-]+)|([a-zA-Z0-9_\-\s]+?))\s*(?:for\s+|-|:|\(|\bat\b)\s*(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|hoyrs?|hrss?|h\b)?(?:\s*\))?$/i;

  for (const chunk of chunks) {
    const m = chunk.match(chunkRegex);
    if (m) {
      const rawName = (m[1] ? 'Project ' + m[1] : m[2]);
      let cleanedName = cleanProjectOrTask(rawName);
      if (cleanedName.length === 1) cleanedName = 'Project ' + cleanedName.toUpperCase();
      if (/^project\s+[a-z]$/i.test(cleanedName)) {
        cleanedName = cleanedName.toUpperCase().replace('PROJECT', 'Project');
      } else {
        cleanedName = capitalizeWords(cleanedName);
      }
      const hrs = parseFloat(m[3]);
      if (!isNaN(hrs) && hrs > 0 && hrs <= 24) {
        parsedSegments.push({ name: cleanedName, hours: hrs });
      }
    }
  }

  if (parsedSegments.length > 0) {
    const totalHours = +(parsedSegments.reduce((acc, s) => acc + s.hours, 0).toFixed(1));
    const projectNames = Array.from(new Set(parsedSegments.map(s => s.name)));
    const combinedProject = projectNames.join(' + ');
    const taskList = parsedSegments.map(s => `${s.name} (${s.hours} ${s.hours === 1 ? 'hr' : 'hrs'})`);
    const tasks = taskList.join(', ');

    return {
      project: combinedProject,
      hours: totalHours,
      hasExplicitHours: true,
      isOnlyHours: false,
      isAwaitingTask: false,
      isOnLeave: false,
      tasks,
      taskList,
      blocker
    };
  }

  // 4. Fallback Single-Project / Explicit Hours Extraction across full text
  const hoursRegex = /(?:for\s+next\s+|for\s+|approx\s+|around\s+|\(?\s*)(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|hoyrs?|hrss?|h\b)(?:\s*\)?)/gi;
  const allMatches = Array.from(textWithoutBlocker.matchAll(hoursRegex));
  if (allMatches.length > 0) {
    let sum = 0;
    for (const m of allMatches) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > 0 && val <= 24) {
        sum += val;
      }
    }
    if (sum > 0) {
      hours = +(sum.toFixed(1));
      hasExplicitHours = true;
    }
  } else if (isOnlyHours && onlyHoursMatch) {
    hours = parseFloat(onlyHoursMatch[1]);
    hasExplicitHours = true;
  }

  // 5. Extract Single Project Name with Smart Priority
  const STOP_WORDS = /^(today|yesterday|tomorrow|tasks?|work|something|now|morning|afternoon|this|the|any|next|me|us|him|her|them|myself|ourselves|tickets?|ticket|full|part|assigned|for|and|with|on|in|at)$/i;

  // 5A. [Name] project e.g. "Cygnos project", "Cygnos Project", "Apollo project"
  const suffixMatch = textWithoutBlocker.match(/\b([a-zA-Z0-9_-]{2,25})\s+project\b/i);
  if (suffixMatch && !STOP_WORDS.test(suffixMatch[1])) {
    project = capitalizeWords(suffixMatch[1].trim());
  }

  // 5B. Project: [Name] or Project [Name] e.g. "project Apollo", "Project - Pegasus", "project X"
  if (!project) {
    const explicitMatch = textWithoutBlocker.match(/\bproject[:\s-]+([a-zA-Z0-9_-]+)/i);
    if (explicitMatch && !STOP_WORDS.test(explicitMatch[1])) {
      let name = explicitMatch[1].trim();
      if (name.length === 1) name = 'Project ' + name.toUpperCase();
      project = capitalizeWords(name);
    }
  }

  // 5C. Quoted project / feature names e.g. "AI adoption", 'Payment Gateway'
  if (!project) {
    const quotedMatch = textWithoutBlocker.match(/["']([^"']{2,30})["']/);
    if (quotedMatch && !STOP_WORDS.test(quotedMatch[1])) {
      project = capitalizeWords(quotedMatch[1].trim());
    }
  }

  // 5D. Action phrases: "work on Cygnos full time", "working on Pegasus", "focusing on Apollo"
  if (!project) {
    const actionMatch = textWithoutBlocker.match(/(?:(?:i\s+will\s+be|i\s+will|will\s+be|will|i\s+am|i\'m|im)\s+)?(?:working on|working in|work on|work in|focusing on|focus on|developing|building|debugging|refactoring|testing)\s+(?:the\s+)?(?:project\s+)?([a-zA-Z0-9_-]+)/i);
    if (actionMatch && !STOP_WORDS.test(actionMatch[1])) {
      let name = actionMatch[1].trim();
      if (name.length === 1) name = 'Project ' + name.toUpperCase();
      project = capitalizeWords(name);
    }
  }

  // 6. Fallback Keyword Project Categorization
  if (!project) {
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

  // 7. Clean task string
  let tasks = textWithoutBlocker
    .replace(/(?:for\s+next\s+|for\s+|approx\s+|around\s+|\(?\s*)(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|hoyrs?|hrss?|h\b)(?:\s*\)?)/gi, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(for\s+next\s+then|for\s+then|for\s+next|for|on|in|at|to|approx|around|and|then)\s*$/gi, '')
    .replace(/^[,;:\s-]+|[,;:\s-]+$/g, '')
    .trim();

  if (tasks.length > 0) {
    tasks = tasks.charAt(0).toUpperCase() + tasks.slice(1);
  } else {
    tasks = clean;
  }

  const taskList = extractStructuredTasks(tasks);

  return {
    project: project || "Daily Tasks",
    hours,
    hasExplicitHours,
    isOnlyHours,
    isAwaitingTask: false,
    isOnLeave: false,
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

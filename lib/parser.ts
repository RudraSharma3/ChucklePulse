/**
 * Intelligent Standup NLP Parser
 * Extracts Project Name, Hours, Tasks List, and Blockers from any freeform conversational text.
 */
export function parseStandupMessage(text: string): {
  project: string;
  hours: number;
  tasks: string;
  taskList: string[];
  blocker: string;
} {
  const clean = text.trim();
  let hours = 7.5;
  let project = "General Tasks";
  let blocker = "None";

  // 1. Extract Hours (e.g. "5 hours", "6.5h", "7hrs", "4 hr", "(6.5h)", "6.5 hours")
  const hoursMatch = clean.match(/(?:\(?\s*)(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h\b)(?:\s*\)?)/i);
  if (hoursMatch) {
    hours = parseFloat(hoursMatch[1]);
  }

  // 2. Extract Blocker (e.g. "blocker: waiting for PR", "blocked by client key", "no blocker")
  const blockerMatch = clean.match(/(?:blocker|blocked by|blocking|issue|impediment)[:\s-]([^\.\n\r]+)/i);
  if (blockerMatch) {
    const rawBlocker = blockerMatch[1].trim();
    if (/^(none|no|nil|n\/a|nope|nothing|all clear)$/i.test(rawBlocker)) {
      blocker = "None";
    } else {
      blocker = rawBlocker;
    }
  }

  // 3. Extract Explicit Project (e.g. "project: auth", "working on project xyz", "for client portal")
  const projectPrefixMatch = clean.match(/(?:project|initiative|feature|repo|on|for)[:\s-]([a-zA-Z0-9\s_&-]+?)(?:,|\.|\n|\(|\)|hours?|hrs?|blocker|$)/i);
  if (projectPrefixMatch && projectPrefixMatch[1].trim().length >= 3 && projectPrefixMatch[1].trim().length <= 35) {
    const candidate = projectPrefixMatch[1].trim();
    if (!/^(today|yesterday|tomorrow|tasks|work|something|now|morning|afternoon|this|the)$/i.test(candidate)) {
      project = capitalizeTitle(candidate);
    }
  }

  // 4. Fallback Keyword Project Categorization if not explicitly named
  if (project === "General Tasks") {
    const lower = clean.toLowerCase();
    if (lower.includes("auth") || lower.includes("login") || lower.includes("jwt") || lower.includes("security") || lower.includes("oauth")) {
      project = "Auth & Security";
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
    }
  }

  // 5. Clean task string thoroughly: remove hours, blocker strings, empty parentheses, leftover punctuation
  let tasks = clean
    .replace(/(?:blocker|blocked by|blocking|issue|impediment)[:\s-][^\.\n\r]+/gi, '')
    .replace(/(?:\(?\s*)(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h\b)(?:\s*\)?)/gi, '')
    .replace(/\(\s*\)/g, '') // remove empty parentheses
    .replace(/^[,;:\s-]+|[,;:\s-]+$/g, '') // remove leading/trailing punctuation
    .trim();

  // If tasks string became empty or only whitespace/punctuation
  if (!tasks || tasks.length < 3) {
    tasks = clean;
  }

  // 6. Split into structured task list (by newlines, numbered lists, bullet points, or semicolons/commas)
  const taskList = extractStructuredTasks(tasks);

  return {
    project,
    hours,
    tasks,
    taskList,
    blocker
  };
}

/**
 * Splits text into individual clean task badges / bullet items
 */
export function extractStructuredTasks(text: string): string[] {
  // First check if user used bullet points or numbered lists
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: string[] = [];

  for (const line of lines) {
    // Strip bullet marks: "- ", "* ", "1. ", "• "
    const cleanedLine = line
      .replace(/^[\*\-•\d+\.]+\s*/, '')
      .replace(/^[,;:\s-]+|[,;:\s-]+$/g, '')
      .trim();

    if (cleanedLine.length >= 3) {
      // Check if comma or semicolon separated within the line
      if (cleanedLine.includes(';') || (cleanedLine.includes(',') && cleanedLine.length > 50)) {
        const subParts = cleanedLine.split(/[,;]\s+/).map(p => p.trim()).filter(p => p.length >= 3);
        items.push(...subParts);
      } else {
        items.push(cleanedLine);
      }
    }
  }

  // If only 1 line but contains multiple sentences or commas
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

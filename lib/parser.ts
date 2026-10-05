/**
 * Intelligent Standup NLP Parser
 * Extracts Project Name, Hours, Tasks, and Blockers from any freeform conversational text.
 */
export function parseStandupMessage(text: string): {
  project: string;
  hours: number;
  tasks: string;
  blocker: string;
} {
  const clean = text.trim();
  let hours = 7.5;
  let project = "General Tasks";
  let blocker = "None";
  let tasks = clean;

  // 1. Extract Hours (e.g. "5 hours", "6.5h", "7hrs", "4 hr")
  const hoursMatch = clean.match(/(\d+(\.\d+)?)\s*(hrs?|hours?|h\b)/i);
  if (hoursMatch) {
    hours = parseFloat(hoursMatch[1]);
  }

  // 2. Extract Blocker (e.g. "blocker: waiting for PR", "blocked by client key", "no blocker")
  const blockerMatch = clean.match(/(?:blocker|blocked by|blocking|issue|impediment)[:\s-]([^\.\n\r]+)/i);
  if (blockerMatch) {
    const rawBlocker = blockerMatch[1].trim();
    if (/^(none|no|nil|n\/a|nope|nothing)$/i.test(rawBlocker)) {
      blocker = "None";
    } else {
      blocker = rawBlocker;
    }
  }

  // 3. Extract Explicit Project (e.g. "project: auth", "working on project xyz", "for client portal")
  const projectPrefixMatch = clean.match(/(?:project|initiative|feature|repo|on|for)[:\s-]([a-zA-Z0-9\s_-]+?)(?:,|\.|\n|hours?|hrs?|blocker|$)/i);
  if (projectPrefixMatch && projectPrefixMatch[1].trim().length >= 3 && projectPrefixMatch[1].trim().length <= 35) {
    const candidate = projectPrefixMatch[1].trim();
    if (!/^(today|yesterday|tomorrow|tasks|work|something|now|morning|afternoon)$/i.test(candidate)) {
      project = capitalizeTitle(candidate);
    }
  }

  // 4. Fallback Keyword Project Categorization if not explicitly named
  if (project === "General Tasks") {
    const lower = clean.toLowerCase();
    if (lower.includes("auth") || lower.includes("login") || lower.includes("jwt") || lower.includes("security")) {
      project = "Auth & Security";
    } else if (lower.includes("payment") || lower.includes("stripe") || lower.includes("razorpay") || lower.includes("billing")) {
      project = "Payment & Billing";
    } else if (lower.includes("api") || lower.includes("backend") || lower.includes("database") || lower.includes("postgres") || lower.includes("graphql")) {
      project = "Core API & Backend";
    } else if (lower.includes("ui") || lower.includes("frontend") || lower.includes("css") || lower.includes("react") || lower.includes("design") || lower.includes("landing")) {
      project = "Frontend & UI/UX";
    } else if (lower.includes("mobile") || lower.includes("ios") || lower.includes("android") || lower.includes("flutter") || lower.includes("react native")) {
      project = "Mobile Application";
    } else if (lower.includes("bug") || lower.includes("fix") || lower.includes("patch") || lower.includes("hotfix")) {
      project = "Bug Fixes & Maintenance";
    } else if (lower.includes("ml") || lower.includes("ai") || lower.includes("model") || lower.includes("llm") || lower.includes("dataset")) {
      project = "AI & Machine Learning";
    } else if (lower.includes("pipeline") || lower.includes("etl") || lower.includes("data") || lower.includes("warehouse")) {
      project = "Data Engineering";
    }
  }

  // Clean task string
  tasks = clean
    .replace(/(?:blocker|blocked by)[:\s-][^\.\n\r]+/gi, '')
    .replace(/\b\d+(\.\d+)?\s*(hrs?|hours?|h\b)/gi, '')
    .trim() || clean;

  return {
    project,
    hours,
    tasks,
    blocker
  };
}

function capitalizeTitle(str: string): string {
  return str
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

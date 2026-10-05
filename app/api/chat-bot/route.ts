import { NextRequest, NextResponse } from "next/server";
import { parseStandupMessage } from "@/lib/parser";
import { db } from "@/lib/db";
import { StandupRecord } from "@/lib/types";

const ROTATING_PROMPTS = [
  "Good morning champion! ☕ What epic tasks are you tackling across your projects today?",
  "Beep boop! 🛸 StandupBot daily check-in. What are your prime targets today before caffeine wears off?",
  "Rise and grind! 🚀 Drop your planned project, tasks, hours, and any blockers!",
  "Wakey wakey! 🥞 What tickets are you tackling today, how many hours, and did any wild bugs block you?",
  "The game is afoot! 🕵️‍♂️ What is your main focus today and how many hours of genius are we pouring in?"
];

export async function POST(req: NextRequest) {
  try {
    const event = await req.json().catch(() => ({}));
    console.log("📥 Incoming Google Chat Event:", event.type || "MESSAGE");

    // Extract sender information
    const user = event.user || (event.message && event.message.sender) || {};
    const text = (event.message && event.message.text) ? event.message.text.trim() : "";
    const senderName = user.displayName || "Team Member";
    const senderEmail = user.email ? user.email.toLowerCase() : "";
    const firstName = senderName.split(" ")[0];

    // Case 1: Greeting / Added to space / Help command
    const isGreeting = !text || ["hi", "hello", "hey", "help", "/standup", "/sync", "standup"].includes(text.toLowerCase());
    if (isGreeting || event.type === "ADDED_TO_SPACE") {
      const prompt = ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];

      const messageText = [
        `⏰ *BytePx Daily Standup*`,
        `Good morning *${firstName}*! 👋`,
        ``,
        `💡 *${prompt}*`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👉 *Reply to this chat with your update:*`,
        `\`Project: <Project Name>, Tasks: <Your Tasks>, Hours: <e.g. 7.5h>, Blocker: <None or issue>\``,
        `_Example: Working on Auth system & JWT refresh (6h), blocker: none_`
      ].join("\n");

      return NextResponse.json({
        text: messageText
      });
    }

    // Case 2: Standup Check-in Submission
    const parsed = parseStandupMessage(text);
    const employees = db.getEmployees();
    const matched = employees.find(e => 
      (senderEmail && e.email.toLowerCase() === senderEmail) ||
      e.name.toLowerCase() === senderName.toLowerCase()
    );

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const record: StandupRecord = {
      id: "std_" + Date.now(),
      employeeId: matched ? matched.id : null,
      name: matched ? matched.name : senderName,
      email: matched ? matched.email : (senderEmail || "team@bytepx.com"),
      dept: matched ? matched.dept : "Engineering",
      tasks: parsed.tasks,
      hours: parsed.hours,
      project: parsed.project,
      blocker: parsed.blocker,
      date: now.toISOString().slice(0, 10),
      time: timeStr,
      source: "Google Chat 1:1 Bot",
      rawText: text
    };

    // Save check-in
    db.saveStandup(record);

    const blockerLine = record.blocker === "None"
      ? "🟢 *Blockers:* None"
      : `🚨 *Blocker Alert:* ${record.blocker}`;

    const confirmationText = [
      `✅ *Daily Standup Logged for ${record.name}!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📁 *Project:* *${record.project}*`,
      `📝 *Tasks:* ${record.tasks}`,
      `⏱️ *Hours:* *${record.hours} hrs*`,
      `${blockerLine}`,
      `🕒 *Recorded At:* ${timeStr}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `_Logged in StandupPulse Dashboard. Have a productive day! 🚀_`
    ].join("\n");

    return NextResponse.json({
      text: confirmationText
    });
  } catch (err: any) {
    console.error("Error in chat-bot route:", err);
    return NextResponse.json({
      text: "✅ Standup check-in received and recorded! Have a great day!"
    });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    bot: "BytePx StandupPulse Bot",
    protocol: "Google Chat HTTP Webhook"
  });
}

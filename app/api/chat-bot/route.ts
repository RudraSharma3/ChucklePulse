import { NextRequest, NextResponse } from "next/server";
import { parseStandupMessage } from "@/lib/parser";
import { db } from "@/lib/db";
import { StandupRecord } from "@/lib/types";

const WORK_SAFE_GIFS = [
  "https://raw.githubusercontent.com/ABSphreak/ABSphreak/master/gifs/Hi.gif",
  "https://raw.githubusercontent.com/abhisheknaiidu/abhisheknaiidu/master/code.gif",
  "https://raw.githubusercontent.com/MartinHeinz/MartinHeinz/master/wave.gif",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Partying%20Face.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Sunglasses.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Star-Struck.png",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/150.gif",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/6.gif"
];

const ROTATING_PROMPTS = [
  "Good morning champion! ☕ Coffee level at 80%? What epic dragons are you slaying across your projects today?",
  "Beep boop! 🛸 StandupBot on daily intelligence duty. What mysteries are you solving today before caffeine wears off?",
  "Rise and grind! 🚀 If your daily tasks were a movie title, what would today be called? Drop your hours & mission!",
  "Wakey wakey! 🥞 Today's masterplan check-in: What tickets are you tackling, how many hours, and did any wild bugs block you?",
  "The game is afoot! 🕵️‍♂️ I detect high productivity in the air. What are your prime targets today and any sneaky blockers?",
  "Code, coffee, conquer! ⚡ What is your main focus today and how many hours of genius are we pouring in?"
];

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();
    console.log("📥 Incoming Google Chat Event:", event.type);

    const user = event.user || (event.message && event.message.sender) || {};
    const text = (event.message && event.message.text) ? event.message.text.trim() : "";
    const senderName = user.displayName || "Team Member";
    const senderEmail = user.email ? user.email.toLowerCase() : "";

    // If greeting, empty, or bot command: send the visual prompt card
    if (!text || ["hi", "hello", "hey", "help", "/standup", "/sync"].includes(text.toLowerCase())) {
      const prompt = ROTATING_PROMPTS[Math.floor(Math.random() * ROTATING_PROMPTS.length)];
      const gif = WORK_SAFE_GIFS[Math.floor(Math.random() * WORK_SAFE_GIFS.length)];
      const name = senderName.split(" ")[0];

      return NextResponse.json({
        text: `⏰ *BytePx Daily Standup*\nGood morning ${name}!\n\n*${prompt}*\n\n👉 _Reply directly with your project, planned tasks, hours, and any blockers!_`,
        cardsV2: [{
          cardId: "standup_prompt_" + Date.now(),
          card: {
            header: {
              title: "⏰ BytePx Daily Standup",
              subtitle: `Good morning ${name}! Time to share today's mission.`,
              imageUrl: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
              imageType: "CIRCLE"
            },
            sections: [{
              widgets: [
                { textParagraph: { text: `<b>${prompt}</b>` } },
                { image: { imageUrl: gif, altText: "Morning Reaction GIF" } },
                { textParagraph: { text: "<i>👉 Reply directly to this chat with your project, tasks, hours, and blockers!</i>" } }
              ]
            }]
          }
        }]
      });
    }

    // Parse freeform text with intelligent NLP parser
    const parsed = parseStandupMessage(text);
    const employees = db.getEmployees();
    const matched = employees.find(e => 
      (senderEmail && e.email.toLowerCase() === senderEmail) ||
      e.name.toLowerCase() === senderName.toLowerCase()
    );

    const now = new Date();
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
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      source: "Google Chat 1:1 Bot",
      rawText: text
    };

    // Save to database
    db.saveStandup(record);

    const blockerBadge = record.blocker === "None" ? "🟢 *No Blockers*" : `⚠️ *Blocker:* ${record.blocker}`;

    return NextResponse.json({
      text: `✅ *Daily Standup Logged for ${record.name}!*\n\n📁 *Project:* ${record.project}\n📝 *Tasks:* ${record.tasks}\n⏱️ *Hours:* ${record.hours} hrs\n${blockerBadge}\n\n_Have a great and productive day! 🚀_`,
      cardsV2: [{
        cardId: "standup_confirmation_" + Date.now(),
        card: {
          header: {
            title: `✅ Standup Logged: ${record.project}`,
            subtitle: `Recorded for ${record.name.split(" ")[0]} at ${record.time}`,
            imageUrl: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
            imageType: "CIRCLE"
          },
          sections: [{
            widgets: [
              { textParagraph: { text: `📁 <b>Project:</b> <font color="#6366f1">${record.project}</font>` } },
              { textParagraph: { text: `📝 <b>Tasks:</b> ${record.tasks}` } },
              { textParagraph: { text: `⏱️ <b>Hours:</b> ${record.hours} hrs` } },
              { textParagraph: { text: record.blocker === "None" ? "🟢 <b>No Blockers</b>" : `⚠️ <b>Blocker:</b> <font color="#ef4444">${record.blocker}</font>` } }
            ]
          }]
        }
      }]
    });
  } catch (err: any) {
    console.error("Error in chat-bot route:", err);
    return NextResponse.json({
      text: "✅ Standup check-in received! Thanks!"
    });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    bot: "BytePx StandupPulse Bot",
    protocol: "Google Chat CardsV2 Webhook"
  });
}

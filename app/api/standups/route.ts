import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseStandupMessage } from "@/lib/parser";
import { StandupRecord } from "@/lib/types";
import { formatLocalTime, formatLocalDate } from "@/lib/googleChatHelper";

import { isStandupForToday } from "@/lib/googleChatDirect";

export async function GET(req: NextRequest) {
  let list = await db.getStandups();

  // If local list has 0 entries from today, attempt automatic hydration from Google Chat!
  const hasToday = list.some(s => isStandupForToday(s.date));
  if (!hasToday) {
    try {
      const { syncStandupsFromGoogleChat } = await import("@/lib/googleChatDirect");
      const synced = await syncStandupsFromGoogleChat();
      if (synced && synced.length > 0) {
        list = await db.getStandups();
      }
    } catch (e) {}
  }

  return NextResponse.json(list, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.bulk === true && Array.isArray(body.standups)) {
      for (const s of body.standups) {
        if (s && s.email && s.tasks) {
          await db.saveStandup(s);
        }
      }
      return NextResponse.json({ success: true, standups: await db.getStandups() });
    }

    const parsed = parseStandupMessage(body.tasks || body.rawText || "");
    const now = new Date();
    
    const record: StandupRecord = {
      id: body.id || ("std_" + Date.now()),
      employeeId: body.employeeId || null,
      name: body.name || "Employee",
      email: body.email || "team@bytepx.com",
      dept: body.dept || "Engineering",
      tasks: body.tasks || parsed.tasks,
      hours: body.hours ? parseFloat(body.hours) : parsed.hours,
      project: body.project || parsed.project,
      blocker: body.blocker || parsed.blocker || "None",
      date: body.date || formatLocalDate(now),
      time: body.time || formatLocalTime(now),
      source: body.source || "Dashboard Manual"
    };

    const updated = await db.saveStandup(record);
    return NextResponse.json({ success: true, record, standups: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");

    if (action === "clear_all") {
      await db.clearAllStandups();
      return NextResponse.json({ success: true, message: "All standups cleared successfully" });
    }

    if (id) {
      const updated = await db.deleteStandup(id);
      return NextResponse.json({ success: true, standups: updated });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

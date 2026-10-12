import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseStandupMessage } from "@/lib/parser";
import { StandupRecord } from "@/lib/types";
import { formatLocalTime, formatLocalDate } from "@/lib/googleChatHelper";

export async function GET(req: NextRequest) {
  const list = await db.getStandups();
  return NextResponse.json(list);
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

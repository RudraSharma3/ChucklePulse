import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseStandupMessage } from "@/lib/parser";
import { StandupRecord } from "@/lib/types";
import { formatLocalTime, formatLocalDate } from "@/lib/googleChatHelper";

export async function GET(req: NextRequest) {
  const list = db.getStandups();
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = parseStandupMessage(body.tasks || body.rawText || "");
    const now = new Date();
    
    const record: StandupRecord = {
      id: "std_" + Date.now(),
      employeeId: body.employeeId || null,
      name: body.name || "Employee",
      email: body.email || "team@bytepx.com",
      dept: body.dept || "Engineering",
      tasks: body.tasks || parsed.tasks,
      hours: body.hours ? parseFloat(body.hours) : parsed.hours,
      project: body.project || parsed.project,
      blocker: body.blocker || parsed.blocker,
      date: formatLocalDate(now),
      time: formatLocalTime(now),
      source: body.source || "Dashboard Manual"
    };

    const updated = db.saveStandup(record);
    return NextResponse.json({ success: true, record, standups: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

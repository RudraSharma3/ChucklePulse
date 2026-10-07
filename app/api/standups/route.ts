import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseStandupMessage } from "@/lib/parser";
import { StandupRecord } from "@/lib/types";
import { formatLocalTime, formatLocalDate } from "@/lib/googleChatHelper";

export async function GET(req: NextRequest) {
  let list = db.getStandups();
  if (list.length === 0) {
    try {
      const settings = db.getSettings();
      if (settings.appsScriptUrl && settings.appsScriptUrl.startsWith('http')) {
        const url = settings.appsScriptUrl.includes('?')
          ? `${settings.appsScriptUrl}&action=get_standups`
          : `${settings.appsScriptUrl}?action=get_standups`;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const cloudStandups: StandupRecord[] = await res.json();
          if (Array.isArray(cloudStandups) && cloudStandups.length > 0) {
            cloudStandups.forEach(s => db.saveStandup(s));
            list = db.getStandups();
          }
        }
      }
    } catch (e) {}
  }
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.bulk === true && Array.isArray(body.standups)) {
      body.standups.forEach((s: StandupRecord) => {
        if (s && s.email && s.tasks) {
          db.saveStandup(s);
        }
      });
      return NextResponse.json({ success: true, standups: db.getStandups() });
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

    const updated = db.saveStandup(record);
    return NextResponse.json({ success: true, record, standups: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

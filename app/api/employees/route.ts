import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Employee } from "@/lib/types";

export async function GET() {
  const employees = db.getEmployees();
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle Bulk Sync / Rehydration
    if (body.bulk && Array.isArray(body.employees)) {
      const current = db.getEmployees();
      const empMap = new Map<string, Employee>();
      current.forEach(e => empMap.set(e.email.toLowerCase(), e));
      body.employees.forEach((e: any) => {
        if (e && e.email) {
          const cleanEmail = e.email.toLowerCase();
          const existing = empMap.get(cleanEmail);
          empMap.set(cleanEmail, {
            id: e.id || existing?.id || ("emp_" + Date.now()),
            name: e.name || existing?.name || cleanEmail.split('@')[0],
            email: cleanEmail,
            dept: e.dept || existing?.dept || "Engineering",
            role: e.role || existing?.role || "Team Member",
            webhookUrl: existing?.webhookUrl || e.webhookUrl || "",
            createdAt: e.createdAt || existing?.createdAt || new Date().toISOString()
          });
        }
      });
      const merged = Array.from(empMap.values());
      db.saveEmployees(merged);
      return NextResponse.json({ success: true, count: merged.length });
    }

    if (!body.name || !body.email) {
      return NextResponse.json({ error: "Name and Email are required" }, { status: 400 });
    }

    const employees = db.getEmployees();
    const newEmp: Employee = {
      id: body.id || ("emp_" + Date.now()),
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      dept: body.dept ? body.dept.trim() : "Engineering",
      role: body.role ? body.role.trim() : "Team Member",
      webhookUrl: body.webhookUrl || "",
      createdAt: body.createdAt || new Date().toISOString()
    };

    const idx = employees.findIndex(e => e.email.toLowerCase() === newEmp.email.toLowerCase() || e.id === newEmp.id);
    if (idx >= 0) {
      employees[idx] = { ...employees[idx], ...newEmp, webhookUrl: employees[idx].webhookUrl || newEmp.webhookUrl };
    } else {
      employees.push(newEmp);
    }

    db.saveEmployees(employees);
    return NextResponse.json(newEmp, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    const remaining = db.deleteEmployee(id);
    return NextResponse.json({ success: true, count: remaining.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

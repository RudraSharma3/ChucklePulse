"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Send,
  Users,
  FolderKanban,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Search,
  Bot,
  Terminal,
  Briefcase,
  Layers,
  Check,
  Calendar,
  Sun,
  Moon,
  ChevronRight,
  ListTodo,
  ExternalLink,
  Filter,
  UserCheck,
  UserX,
  X,
  ArrowRight,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  Sparkle
} from "lucide-react";
import { Employee, StandupRecord, CompanySettings, ProjectGroup } from "@/lib/types";
import { extractStructuredTasks } from "@/lib/parser";

export default function StandupDashboard() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"projects" | "tasks" | "feed" | "attendance" | "settings">("projects");
  const [standups, setStandups] = useState<StandupRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [onlyBlockers, setOnlyBlockers] = useState(false);

  // Modals & Drawers
  const [selectedProjectModal, setSelectedProjectModal] = useState<ProjectGroup | null>(null);
  const [selectedEmployeeModal, setSelectedEmployeeModal] = useState<Employee | null>(null);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: "", email: "", dept: "Engineering", role: "Developer" });

  // Manual Standup Modal
  const [showManualStandup, setShowManualStandup] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    name: "",
    email: "",
    project: "",
    tasks: "",
    hours: "7.5",
    blocker: "None"
  });

  const [currentTime, setCurrentTime] = useState("");

  // Theme Initializer: Default to light mode
  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resStd, resEmp, resSet] = await Promise.all([
        fetch("/api/standups").then(r => r.json()),
        fetch("/api/employees").then(r => r.json()),
        fetch("/api/settings").then(r => r.json())
      ]);
      setStandups(Array.isArray(resStd) ? resStd : []);
      setEmployees(Array.isArray(resEmp) ? resEmp : []);
      setSettings(resSet);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Standups
  const filteredStandups = useMemo(() => {
    return standups.filter(s => {
      const matchQuery =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tasks.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.blocker.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = selectedDept === "all" || s.dept.toLowerCase() === selectedDept.toLowerCase();
      const matchProj = selectedProject === "all" || s.project.toLowerCase() === selectedProject.toLowerCase();
      const matchBlocker = !onlyBlockers || (s.blocker && s.blocker !== "None");
      return matchQuery && matchDept && matchProj && matchBlocker;
    });
  }, [standups, searchQuery, selectedDept, selectedProject, onlyBlockers]);

  // Group Standups by Project
  const projectGroups = useMemo(() => {
    const map = new Map<string, ProjectGroup>();

    filteredStandups.forEach(s => {
      const projName = s.project || "General Tasks";
      if (!map.has(projName)) {
        map.set(projName, {
          projectName: projName,
          totalHours: 0,
          members: [],
          blockerCount: 0
        });
      }
      const group = map.get(projName)!;
      group.totalHours += s.hours;
      if (s.blocker && s.blocker !== "None") {
        group.blockerCount++;
      }
      group.members.push({
        name: s.name,
        email: s.email,
        dept: s.dept,
        tasks: s.tasks,
        taskList: s.taskList && s.taskList.length > 0 ? s.taskList : extractStructuredTasks(s.tasks),
        hours: s.hours,
        blocker: s.blocker,
        time: s.time
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredStandups]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalHours = standups.reduce((acc, s) => acc + (s.hours || 0), 0);
    const uniqueProjects = new Set(standups.map(s => s.project || "General Tasks")).size;
    const activeBlockers = standups.filter(s => s.blocker && s.blocker !== "None").length;
    const checkinCount = standups.length;
    const totalEmployees = employees.length;
    const checkinRate = totalEmployees > 0 ? Math.round((checkinCount / totalEmployees) * 100) : 0;

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      uniqueProjects: checkinCount === 0 ? 0 : uniqueProjects,
      activeBlockers,
      checkinCount,
      totalEmployees,
      checkinRate
    };
  }, [standups, employees]);

  // Attendance lists
  const checkedInEmails = useMemo(() => new Set(standups.map(s => s.email.toLowerCase())), [standups]);
  const checkedInEmployees = useMemo(() => employees.filter(e => checkedInEmails.has(e.email.toLowerCase())), [employees, checkedInEmails]);
  const pendingEmployees = useMemo(() => employees.filter(e => !checkedInEmails.has(e.email.toLowerCase())), [employees, checkedInEmails]);

  const projectOptions = useMemo(() => {
    return Array.from(new Set(standups.map(s => s.project || "General Tasks")));
  }, [standups]);

  // 1-Click Broadcast Standup Trigger
  const handleTriggerBot = async () => {
    try {
      setTriggering(true);
      setTriggerMsg(null);
      const res = await fetch("/api/trigger-bot", { method: "POST" });
      const data = await res.json();
      setTriggerMsg(data.message || "Standup prompts dispatched to active Google Chat 1:1 Bot chats!");
      setTimeout(() => setTriggerMsg(null), 6000);
    } catch (err: any) {
      setTriggerMsg("Standup prompt broadcast dispatched.");
      setTimeout(() => setTriggerMsg(null), 6000);
    } finally {
      setTriggering(false);
    }
  };

  // Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.name || !newEmp.email) return;
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmp)
      });
      if (res.ok) {
        setShowAddEmp(false);
        setNewEmp({ name: "", email: "", dept: "Engineering", role: "Developer" });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Are you sure you want to remove this employee?")) return;
    try {
      await fetch(`/api/employees?id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Manual Standup
  const handleManualStandup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/standups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualEntry)
      });
      if (res.ok) {
        setShowManualStandup(false);
        setManualEntry({ name: "", email: "", project: "", tasks: "", hours: "7.5", blocker: "None" });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy Executive Summary for Leadership
  const handleCopySummary = () => {
    const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    let text = `📊 *${settings?.companyName || "BytePx"} Daily Standup Briefing* — ${dateStr}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👥 *Check-ins:* ${metrics.checkinCount}/${metrics.totalEmployees} (${metrics.checkinRate}%) | ⏱️ *Total Hours:* ${metrics.totalHours} hrs | 📁 *Initiatives:* ${metrics.uniqueProjects}\n\n`;

    if (projectGroups.length === 0) {
      text += `_No standups recorded yet today._\n\n`;
    } else {
      projectGroups.forEach(g => {
        text += `📁 *Project: ${g.projectName}* (${g.totalHours} hrs)\n`;
        g.members.forEach(m => {
          const blockerStr = m.blocker && m.blocker !== "None" ? ` ⚠️ [Blocker: ${m.blocker}]` : "";
          text += `  • *${m.name}* (${m.hours}h): ${m.tasks}${blockerStr}\n`;
        });
        text += `\n`;
      });
    }

    if (metrics.activeBlockers > 0) {
      text += `🚨 *Active Blockers Needing Attention (${metrics.activeBlockers}):*\n`;
      standups.filter(s => s.blocker && s.blocker !== "None").forEach(s => {
        text += `  • *${s.name}* (${s.project}): ${s.blocker}\n`;
      });
      text += `\n`;
    }

    text += `_Generated by BytePx StandupPulse Suite_`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = "ID,Name,Email,Department,Project,Tasks,Hours,Blocker,Date,Time,Source\n";
    standups.forEach(s => {
      csv += `"${s.id}","${s.name}","${s.email}","${s.dept}","${s.project}","${s.tasks.replace(/"/g, '""')}","${s.hours}","${s.blocker.replace(/"/g, '""')}","${s.date}","${s.time}","${s.source}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `standups_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className={`${theme === "dark" ? "dark" : ""} min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
        
        {/* Top Header */}
        <header className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-2xl transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white shrink-0">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  {settings?.companyName || "BytePx"} <span className="text-indigo-600 dark:text-indigo-400 font-semibold">StandupPulse</span>
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span> Google Chat Bot Live
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} • <Clock className="w-3.5 h-3.5 ml-1" /> {currentTime || "Live"}
              </p>
            </div>
          </div>

          {/* Right Action Bar with Theme Toggle */}
          <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 transition-all flex items-center gap-2 text-xs font-semibold shadow-sm cursor-pointer"
            >
              {theme === "light" ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Light Mode</span>
                  <span className="w-7 h-4 rounded-full bg-slate-300 relative inline-flex items-center p-0.5 ml-1">
                    <span className="w-3 h-3 rounded-full bg-white transition-transform translate-x-0" />
                  </span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-400 fill-indigo-400" />
                  <span>Dark Mode</span>
                  <span className="w-7 h-4 rounded-full bg-indigo-600 relative inline-flex items-center p-0.5 ml-1">
                    <span className="w-3 h-3 rounded-full bg-white transition-transform translate-x-3" />
                  </span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowManualStandup(true)}
              className="px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Log Check-in
            </button>

            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
              {copied ? "Copied!" : "Copy Briefing"}
            </button>

            <button
              onClick={handleTriggerBot}
              disabled={triggering}
              className="px-4 py-2 text-xs md:text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {triggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {triggering ? "Pinging..." : "Send Standup to Team"}
            </button>
          </div>
        </header>

        {/* Trigger Notification Alert */}
        {triggerMsg && (
          <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-200 text-sm flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{triggerMsg}</span>
            </div>
            <button onClick={() => setTriggerMsg(null)} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-semibold cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* 4 CLICKABLE HERO KPI CARDS WITH DRILL-DOWN */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Check-in Progress -> Click to view Attendance Tab */}
          <div
            onClick={() => setActiveTab("attendance")}
            className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Team Check-ins</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{metrics.checkinCount}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">/ {metrics.totalEmployees} members</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(metrics.checkinRate, 100)}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{metrics.checkinRate}% completion</span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline flex items-center gap-0.5">Roster <ChevronRight className="w-3 h-3" /></span>
            </div>
          </div>

          {/* Metric 2: Active Projects -> Click to view Projects Tab */}
          <div
            onClick={() => { setActiveTab("projects"); setOnlyBlockers(false); setSelectedProject("all"); }}
            className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-md cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Active Initiatives</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{metrics.uniqueProjects}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">initiatives live</span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Distributed focus</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold group-hover:underline flex items-center gap-0.5">Matrix <ChevronRight className="w-3 h-3" /></span>
            </div>
          </div>

          {/* Metric 3: Total Hours -> Click to view Tasks Workspace */}
          <div
            onClick={() => { setActiveTab("tasks"); setOnlyBlockers(false); }}
            className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-md cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Hours Planned</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{metrics.totalHours}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">hours logged</span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Avg {metrics.checkinCount > 0 ? (metrics.totalHours / metrics.checkinCount).toFixed(1) : 0}h / person</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold group-hover:underline flex items-center gap-0.5">Tasks <ChevronRight className="w-3 h-3" /></span>
            </div>
          </div>

          {/* Metric 4: Blockers Alert -> Click to filter Blockers across dashboard */}
          <div
            onClick={() => {
              setOnlyBlockers(!onlyBlockers);
              if (activeTab === "settings" || activeTab === "attendance") setActiveTab("tasks");
            }}
            className={`rounded-2xl p-5 border shadow-sm relative overflow-hidden transition-all cursor-pointer group ${
              onlyBlockers
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30"
                : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500/50 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${metrics.activeBlockers > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
                {onlyBlockers ? "Filtering Blockers" : "Blockers"}
              </span>
              <div className={`w-8 h-8 rounded-lg ${metrics.activeBlockers > 0 ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{metrics.activeBlockers}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">unresolved</span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className={`text-[11px] font-medium ${metrics.activeBlockers > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-emerald-600 dark:text-emerald-400"}`}>
                {metrics.activeBlockers > 0 ? "⚠️ Needs leadership action" : "🟢 All clear"}
              </span>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold group-hover:underline flex items-center gap-0.5">
                {onlyBlockers ? "Clear filter" : "Filter"} <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Filter Bar if Blocker Mode is active */}
        {onlyBlockers && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Showing only check-ins with reported blockers.
            </span>
            <button onClick={() => setOnlyBlockers(false)} className="text-rose-700 dark:text-rose-300 font-bold hover:underline cursor-pointer">
              Show All Updates
            </button>
          </div>
        )}

        {/* 5 PROFESSIONAL MULTI-SPACE TABS */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap gap-4">
          <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "projects" ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Initiatives Hub ({projectGroups.length})
            </button>

            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "tasks" ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ListTodo className="w-4 h-4" /> Tasks & Worklogs
            </button>

            <button
              onClick={() => setActiveTab("attendance")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "attendance" ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" /> Team Attendance ({metrics.checkinCount}/{metrics.totalEmployees})
            </button>

            <button
              onClick={() => setActiveTab("feed")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "feed" ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4" /> Check-in Feed
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "settings" ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Bot className="w-4 h-4" /> Bot & Settings
            </button>
          </nav>

          {/* Global Search & Export Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search project, task, member..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-sm transition-all"
              />
            </div>

            <button
              onClick={handleExportCSV}
              title="Export standups to CSV spreadsheet"
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={fetchData}
              title="Refresh dashboard"
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SPACE 1: INITIATIVES HUB (CLICKABLE PROJECT MATRIX WITH MODAL)      */}
        {/* ==================================================================== */}
        {activeTab === "projects" && (
          <div className="space-y-6 animate-fade-in">
            {projectOptions.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] mr-1">Filter:</span>
                <button
                  onClick={() => setSelectedProject("all")}
                  className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    selectedProject === "all" ? "bg-indigo-600 text-white border-indigo-500" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white shadow-sm"
                  }`}
                >
                  All Initiatives ({projectGroups.length})
                </button>
                {projectOptions.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedProject(p)}
                    className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                      selectedProject === p ? "bg-indigo-600 text-white border-indigo-500" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white shadow-sm"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {projectGroups.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-12 text-center space-y-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-slate-800/80 mx-auto flex items-center justify-center text-indigo-600 dark:text-slate-400">
                  <FolderKanban className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Standups Logged Today</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    Click <b>"Send Standup to Team"</b> to ping employees on Google Chat, or click <b>"Log Check-in"</b> to record an update.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleTriggerBot}
                    disabled={triggering}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-all inline-flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    <Send className="w-4 h-4" /> Send Standup to Team
                  </button>
                  <button
                    onClick={() => setShowManualStandup(true)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-medium transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Log Check-in Manually
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projectGroups.map((group) => (
                  <div
                    key={group.projectName}
                    onClick={() => setSelectedProjectModal(group)}
                    className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl flex flex-col justify-between transition-all hover:border-indigo-500 hover:shadow-lg dark:hover:border-indigo-500/60 hover:-translate-y-0.5 cursor-pointer group"
                  >
                    <div className="space-y-4">
                      {/* Project Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <Briefcase className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-all leading-tight flex items-center gap-1.5">
                              {group.projectName} <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-indigo-600 dark:text-indigo-400" />
                            </h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 inline-block">
                              {group.members.length} {group.members.length === 1 ? "contributor" : "contributors"}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-slate-700/50 text-xs font-bold inline-block">
                            {group.totalHours} hrs
                          </span>
                        </div>
                      </div>

                      {/* Member Contributions in Clean Cards */}
                      <div className="space-y-3">
                        {group.members.map((m, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/50 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {m.name}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] font-medium">{m.hours}h • {m.time}</span>
                            </div>

                            {/* Itemized Tasks */}
                            <div className="space-y-1 pl-3.5 border-l-2 border-indigo-500/40">
                              {m.taskList && m.taskList.length > 0 ? (
                                m.taskList.map((taskItem, tIdx) => (
                                  <div key={tIdx} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-1.5">
                                    <span className="text-indigo-500 font-bold">•</span>
                                    <span>{taskItem}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{m.tasks}</p>
                              )}
                            </div>

                            {m.blocker && m.blocker !== "None" && (
                              <div className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-[11px] font-medium flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span><b>Blocker:</b> {m.blocker}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                      <span className={group.blockerCount > 0 ? "text-rose-600 font-semibold" : ""}>
                        {group.blockerCount > 0 ? `⚠️ ${group.blockerCount} blocker reported` : "🟢 All clear"}
                      </span>
                      <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                        View Project Breakdown <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* SPACE 2: DEDICATED TASKS & WORKLOGS (ITEMIZED WORKSPACE)             */}
        {/* ==================================================================== */}
        {activeTab === "tasks" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-indigo-600" /> Employee Tasks & Worklogs Workspace
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Itemized task lists submitted by each team member with status & hours breakdown.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Showing: <b>{filteredStandups.length} check-in logs</b></span>
              </div>
            </div>

            {filteredStandups.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-12 text-center space-y-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-slate-800/80 mx-auto flex items-center justify-center text-indigo-600 dark:text-slate-400">
                  <ListTodo className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Task Worklogs Yet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  When employees reply to the Google Chat Bot, their individual tasks will appear here as itemized work cards.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredStandups.map((s) => {
                  const taskItems = s.taskList && s.taskList.length > 0 ? s.taskList : extractStructuredTasks(s.tasks);
                  const isBlocked = s.blocker && s.blocker !== "None";

                  return (
                    <div
                      key={s.id}
                      className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        {/* Member Header Bar */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-indigo-500/20">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{s.dept || "Engineering"} • {s.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20 font-bold text-xs">
                              {s.hours} hrs
                            </span>
                          </div>
                        </div>

                        {/* Project Initiative Badge */}
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700/60">
                            <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                            {s.project || "General Tasks"}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">{s.time} via {s.source}</span>
                        </div>

                        {/* Structured Itemized Task Workspace */}
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Assigned Tasks ({taskItems.length}):
                          </span>

                          <div className="space-y-1.5">
                            {taskItems.map((taskText, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 group/item hover:border-indigo-400 dark:hover:border-indigo-500/40 transition-all"
                              >
                                <div className="w-4 h-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                  <Check className="w-3 h-3" />
                                </div>
                                <span className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed flex-1">
                                  {taskText}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Blocker Alert Banner */}
                        {isBlocked && (
                          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Active Blocker:</span> {s.blocker}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                        <span className="font-mono text-[11px]">{s.date}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`• ${s.name} (${s.project}): ${s.tasks}`);
                            alert("Copied task log!");
                          }}
                          className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copy Log
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* SPACE 3: TEAM ATTENDANCE & CHECK-IN ROSTER                          */}
        {/* ==================================================================== */}
        {activeTab === "attendance" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" /> Daily Standup Attendance & Directory
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track who has checked in today vs pending responses in real-time.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddEmp(true)}
                  className="px-3.5 py-2 text-xs md:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-2 shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Team Member
                </button>
              </div>
            </div>

            {/* 2 Roster Columns: Checked In vs Pending */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Column 1: Checked In Members */}
              <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Checked In Today ({checkedInEmployees.length})</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    Logged
                  </span>
                </div>

                {checkedInEmployees.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No employee check-ins recorded yet today.</p>
                ) : (
                  <div className="space-y-3">
                    {checkedInEmployees.map(emp => {
                      const empStandup = standups.find(s => s.email.toLowerCase() === emp.email.toLowerCase());
                      return (
                        <div key={emp.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-sm border border-emerald-500/20">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-xs text-slate-900 dark:text-white">{emp.name}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{emp.role} • {emp.dept}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono block">{empStandup?.hours || 0}h logged</span>
                            <span className="text-[10px] text-slate-400 font-mono">{empStandup?.time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column 2: Pending Members */}
              <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <UserX className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Pending Response ({pendingEmployees.length})</h3>
                  </div>
                  <button
                    onClick={handleTriggerBot}
                    disabled={triggering || pendingEmployees.length === 0}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" /> Nudge Pending
                  </button>
                </div>

                {pendingEmployees.length === 0 ? (
                  <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold space-y-1">
                    <CheckCircle2 className="w-6 h-6 mx-auto" />
                    <p>100% Team Check-in Complete!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingEmployees.map(emp => (
                      <div key={emp.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center text-sm border border-amber-500/20">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">{emp.name}</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{emp.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                            Awaiting DM
                          </span>
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Remove employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SPACE 4: CHECK-IN FEED TABLE                                         */}
        {/* ==================================================================== */}
        {activeTab === "feed" && (
          <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Project / Initiative</th>
                    <th className="p-4">Tasks Planned</th>
                    <th className="p-4">Hours</th>
                    <th className="p-4">Blocker</th>
                    <th className="p-4">Logged At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {filteredStandups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-500">
                        No check-ins recorded yet today.
                      </td>
                    </tr>
                  ) : (
                    filteredStandups.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                        <td className="p-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{s.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{s.email}</div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20 font-semibold text-xs inline-block">
                            {s.project || "General Tasks"}
                          </span>
                        </td>
                        <td className="p-4 max-w-md">
                          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed line-clamp-3">{s.tasks}</p>
                        </td>
                        <td className="p-4">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{s.hours} hrs</span>
                        </td>
                        <td className="p-4">
                          {s.blocker === "None" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> None
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                              <AlertTriangle className="w-3.5 h-3.5" /> {s.blocker}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {s.time} • <span className="text-slate-400">{s.source}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* SPACE 5: BOT CONFIGURATION & SETTINGS                                */}
        {/* ==================================================================== */}
        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {/* Live Webhook Card */}
            <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Google Chat Z-Mode Webhook Endpoint</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Paste this URL into your Google Cloud Console Chat API Configuration.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <code className="text-xs text-emerald-600 dark:text-emerald-400 font-mono break-all select-all font-semibold">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/chat/google` : "/api/chat/google"}
                </code>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/api/chat/google`;
                    navigator.clipboard.writeText(url);
                    setWebhookCopied(true);
                    setTimeout(() => setWebhookCopied(false), 3000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold shrink-0 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {webhookCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  {webhookCopied ? "Copied" : "Copy URL"}
                </button>
              </div>
            </div>

            {/* Apps Script Settings */}
            <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Google Apps Script Web App (Broadcast Dispatcher)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When you click "Send Standup to Team", our server pings this Apps Script Web App to broadcast the prompt to all employee 1:1 DMs.
              </p>
              <input
                type="text"
                value={settings?.appsScriptUrl || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, appsScriptUrl: e.target.value } : null)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2 text-xs md:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
              />
              <button
                onClick={async () => {
                  if (!settings) return;
                  await fetch("/api/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ appsScriptUrl: settings.appsScriptUrl })
                  });
                  alert("Settings saved successfully!");
                }}
                className="px-4 py-2 text-xs md:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/25 cursor-pointer"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: PROJECT DEEP-DIVE DRILL-DOWN MODAL                            */}
        {/* ==================================================================== */}
        {selectedProjectModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {selectedProjectModal.projectName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedProjectModal.members.length} team members • {selectedProjectModal.totalHours} total hours allocated
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedProjectModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">Total Hours</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">{selectedProjectModal.totalHours} hrs</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">Contributors</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">{selectedProjectModal.members.length}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">Blockers</span>
                    <span className={`text-xl font-bold mt-1 block ${selectedProjectModal.blockerCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {selectedProjectModal.blockerCount}
                    </span>
                  </div>
                </div>

                {/* Team Task Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Team Work Breakdown:</h4>
                  <div className="space-y-3">
                    {selectedProjectModal.members.map((m, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 font-bold flex items-center justify-center text-xs">
                              {m.name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-sm text-slate-900 dark:text-white block">{m.name}</span>
                              <span className="text-[11px] text-slate-400">{m.email}</span>
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                            {m.hours} hrs
                          </span>
                        </div>

                        {/* Tasks List */}
                        <div className="space-y-1.5 pl-3 border-l-2 border-indigo-500">
                          {m.taskList && m.taskList.length > 0 ? (
                            m.taskList.map((t, tIdx) => (
                              <div key={tIdx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                                <span className="text-indigo-500 font-bold">•</span>
                                <span>{t}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-700 dark:text-slate-300">{m.tasks}</p>
                          )}
                        </div>

                        {m.blocker && m.blocker !== "None" && (
                          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span><b>Blocker:</b> {m.blocker}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    let text = `📁 Project Briefing: *${selectedProjectModal.projectName}* (${selectedProjectModal.totalHours} hrs)\n`;
                    selectedProjectModal.members.forEach(m => {
                      text += `• ${m.name} (${m.hours}h): ${m.tasks}\n`;
                    });
                    navigator.clipboard.writeText(text);
                    alert("Copied project briefing!");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Project Briefing
                </button>

                <button
                  onClick={() => setSelectedProjectModal(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD EMPLOYEE */}
        {showAddEmp && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-in">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Company Team Member</h3>
              <form onSubmit={handleAddEmployee} className="space-y-3.5 text-xs md:text-sm">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newEmp.name}
                    onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Corporate Email</label>
                  <input
                    type="email"
                    required
                    placeholder="john@bytepx.com"
                    value={newEmp.email}
                    onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Department</label>
                    <input
                      type="text"
                      placeholder="Engineering"
                      value={newEmp.dept}
                      onChange={(e) => setNewEmp({ ...newEmp, dept: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Role</label>
                    <input
                      type="text"
                      placeholder="Frontend Lead"
                      value={newEmp.role}
                      onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEmp(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-sm cursor-pointer"
                  >
                    Add Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: MANUAL STANDUP LOG */}
        {showManualStandup && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-in">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Log Standup Check-in</h3>
              <form onSubmit={handleManualStandup} className="space-y-3.5 text-xs md:text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Employee Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Rudra Sharma"
                      value={manualEntry.name}
                      onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Project Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Auth & Security, Mobile App"
                      value={manualEntry.project}
                      onChange={(e) => setManualEntry({ ...manualEntry, project: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Planned Tasks</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Building JWT refresh token flow, unit tests..."
                    value={manualEntry.tasks}
                    onChange={(e) => setManualEntry({ ...manualEntry, tasks: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={manualEntry.hours}
                      onChange={(e) => setManualEntry({ ...manualEntry, hours: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Blocker (if any)</label>
                    <input
                      type="text"
                      placeholder="None or specify issue"
                      value={manualEntry.blocker}
                      onChange={(e) => setManualEntry({ ...manualEntry, blocker: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowManualStandup(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-sm cursor-pointer"
                  >
                    Save Check-in
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

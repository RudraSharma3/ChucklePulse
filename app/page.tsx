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
  Sparkle,
  Table as TableIcon,
  LayoutGrid
} from "lucide-react";
import { Employee, StandupRecord, CompanySettings, ProjectGroup } from "@/lib/types";
import { extractStructuredTasks } from "@/lib/parser";

export default function StandupDashboard() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"projects" | "tasks" | "feed" | "attendance" | "settings">("tasks");
  const [taskViewMode, setTaskViewMode] = useState<"table" | "cards">("table");
  const [standups, setStandups] = useState<StandupRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Search & Filters
  const [dateFilter, setDateFilter] = useState<"today" | "all">("today");
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
  const [clearingDb, setClearingDb] = useState(false);

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

  // Instant LocalStorage Rehydration: Load cached data immediately on mount/refresh
  useEffect(() => {
    try {
      const cachedStdRaw = localStorage.getItem("bytepx_standups_cache");
      if (cachedStdRaw) {
        const parsed: StandupRecord[] = JSON.parse(cachedStdRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStandups(parsed);
          setLoading(false);
        }
      }
      const cachedEmpRaw = localStorage.getItem("bytepx_employees_cache");
      if (cachedEmpRaw) {
        const parsed: Employee[] = JSON.parse(cachedEmpRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEmployees(parsed);
        }
      }
    } catch (e) {}
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

      let fetchedStandups: StandupRecord[] = Array.isArray(resStd) ? resStd : [];
      let fetchedEmployees: Employee[] = Array.isArray(resEmp) ? resEmp : [];

      // LocalStorage Persistence Layer for Standups: Ensures recorded standups are preserved and deduplicated
      try {
        const cachedStdRaw = localStorage.getItem("bytepx_standups_cache");
        if (cachedStdRaw) {
          const cachedStds: StandupRecord[] = JSON.parse(cachedStdRaw);
          if (Array.isArray(cachedStds) && cachedStds.length > 0) {
            const stdMap = new Map<string, StandupRecord>();
            fetchedStandups.forEach(s => {
              if (s && s.email) {
                const key = `${s.email.trim().toLowerCase()}::${s.date || 'today'}`;
                stdMap.set(key, s);
              }
            });
            cachedStds.forEach(s => {
              if (s && s.email) {
                const key = `${s.email.trim().toLowerCase()}::${s.date || 'today'}`;
                if (!stdMap.has(key)) {
                  stdMap.set(key, s);
                }
              }
            });
            fetchedStandups = Array.from(stdMap.values());
          }
        }
        if (fetchedStandups.length > 0) {
          localStorage.setItem("bytepx_standups_cache", JSON.stringify(fetchedStandups));
        }
      } catch (e) {}

      setStandups(fetchedStandups);
      setEmployees(fetchedEmployees);
      try {
        localStorage.setItem("bytepx_standups_cache", JSON.stringify(fetchedStandups));
        localStorage.setItem("bytepx_employees_cache", JSON.stringify(fetchedEmployees));
      } catch (e) {}
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

  // Helper to accurately identify if a record belongs to today
  const isTodayDate = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const todayLocal = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now);

    const clean = dateStr.trim().toLowerCase();
    if (clean === todayISO || clean === todayLocal) return true;

    const todayEnUS = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toLowerCase();
    if (clean === todayEnUS) return true;

    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      const pISO = parsedDate.toISOString().slice(0, 10);
      return pISO === todayISO || pISO === todayLocal;
    }
    return false;
  };

  // Standups for the active view date mode (today vs all history) - always unique per employee per day
  const dateFilteredStandups = useMemo(() => {
    const rawList = dateFilter === "today" ? standups.filter(s => isTodayDate(s.date)) : standups;
    const uniqueMap = new Map<string, StandupRecord>();
    rawList.forEach(s => {
      if (!s || !s.email) return;
      const key = `${s.email.trim().toLowerCase()}::${s.date || 'today'}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      } else {
        const existing = uniqueMap.get(key)!;
        const existingTime = existing.id?.startsWith("std_") ? parseInt(existing.id.replace(/\D/g, "")) || 0 : 0;
        const newTime = s.id?.startsWith("std_") ? parseInt(s.id.replace(/\D/g, "")) || 0 : 0;
        if (newTime >= existingTime) {
          uniqueMap.set(key, s);
        }
      }
    });
    return Array.from(uniqueMap.values());
  }, [standups, dateFilter]);

  // Filtered Standups with Search & Dept/Project/Blocker filters applied
  const filteredStandups = useMemo(() => {
    return dateFilteredStandups.filter(s => {
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
  }, [dateFilteredStandups, searchQuery, selectedDept, selectedProject, onlyBlockers]);

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
    const activeList = dateFilteredStandups;
    const totalHours = activeList.reduce((acc, s) => acc + (s.hours || 0), 0);
    const uniqueProjects = new Set(activeList.map(s => s.project || "General Tasks")).size;
    const activeBlockers = activeList.filter(s => s.blocker && s.blocker !== "None").length;
    const checkinCount = activeList.length;
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
  }, [dateFilteredStandups, employees]);

  // Daily Live Attendance (Always strictly tracks TODAY's check-ins)
  const todaysStandups = useMemo(() => standups.filter(s => isTodayDate(s.date)), [standups]);
  const checkedInEmails = useMemo(() => new Set(todaysStandups.map(s => s.email.toLowerCase())), [todaysStandups]);
  const checkedInEmployees = useMemo(() => employees.filter(e => checkedInEmails.has(e.email.toLowerCase())), [employees, checkedInEmails]);
  const pendingEmployees = useMemo(() => employees.filter(e => !checkedInEmails.has(e.email.toLowerCase())), [employees, checkedInEmails]);

  const projectOptions = useMemo(() => {
    return Array.from(new Set(dateFilteredStandups.map(s => s.project || "General Tasks")));
  }, [dateFilteredStandups]);

  // 1-Click Broadcast Standup Trigger
  const handleTriggerBot = async () => {
    try {
      setTriggering(true);
      setTriggerMsg(null);
      const res = await fetch("/api/trigger-bot?action=trigger", { method: "POST" });
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

  // Targeted Nudge for Pending Employees (45-min reminder)
  const handleNudgePending = async () => {
    try {
      setTriggering(true);
      setTriggerMsg(null);
      const res = await fetch("/api/trigger-bot?action=nudge", { method: "POST" });
      const data = await res.json();
      setTriggerMsg(data.message || `Follow-up reminder sent to ${pendingEmployees.length} pending employee(s)!`);
      setTimeout(() => setTriggerMsg(null), 6000);
    } catch (err: any) {
      setTriggerMsg("Follow-up reminder dispatched.");
      setTimeout(() => setTriggerMsg(null), 6000);
    } finally {
      setTriggering(false);
    }
  };

  // Save Settings & Sync Schedule with Bot
  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      setTriggering(true);
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setTriggerMsg(`✅ Settings updated! Standup scheduled at ${settings.standupTime || "10:30"} AM with ${settings.autoNudgeEnabled !== false ? `${settings.nudgeIntervalMinutes || 45}m persistent auto-nudge` : "auto-nudge disabled"}.`);
        setTimeout(() => setTriggerMsg(null), 7000);
      }
    } catch (err: any) {
      setTriggerMsg("Failed to save settings. Please try again.");
      setTimeout(() => setTriggerMsg(null), 5000);
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

  // Delete Employee (Instant Optimistic UI Update)
  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Are you sure you want to remove this employee?")) return;
    const cleanId = id.trim().toLowerCase();
    const updated = employees.filter(e => e.id !== id && e.email.toLowerCase() !== cleanId);
    setEmployees(updated);
    try {
      localStorage.setItem("bytepx_employees_cache", JSON.stringify(updated));
    } catch (e) {}
    try {
      await fetch(`/api/employees?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete employee on server:", err);
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
        const data = await res.json();
        setShowManualStandup(false);
        setManualEntry({ name: "", email: "", project: "", tasks: "", hours: "7.5", blocker: "None" });
        if (data.standups && Array.isArray(data.standups)) {
          setStandups(data.standups);
          localStorage.setItem("bytepx_standups_cache", JSON.stringify(data.standups));
        } else {
          fetchData();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear Database (Reset all Standup records on demand)
  const handleClearDatabase = async () => {
    const confirmed = window.confirm(
      "⚠️ Are you sure you want to clear all standup check-in data from the database?\n\nThis will reset today's dashboard records across all views. This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      setClearingDb(true);
      await fetch("/api/standups?action=clear_all", { method: "DELETE" });
      localStorage.removeItem("bytepx_standups_cache");
      setStandups([]);
      setTriggerMsg("🗑️ Database cleared successfully! All standup check-in records have been reset.");
      setTimeout(() => setTriggerMsg(null), 5000);
    } catch (err) {
      console.error("Failed to clear database:", err);
      localStorage.removeItem("bytepx_standups_cache");
      setStandups([]);
      setTriggerMsg("Standup cache cleared locally.");
      setTimeout(() => setTriggerMsg(null), 4000);
    } finally {
      setClearingDb(false);
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
    <div className={`${theme === "dark" ? "dark" : ""} min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
        
        {/* Top Header */}
        <header className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-200 dark:border-zinc-800 shadow-sm dark:shadow-2xl transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black shrink-0">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  BytePx <span className="text-emerald-600 dark:text-emerald-400 font-semibold">StandupPulse</span>
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span> Google Chat Bot Live
                </span>
                <button
                  onClick={() => setActiveTab("settings")}
                  title="Click to customize Standup Time & Auto-Nudge Interval"
                  className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{settings?.standupTime || "10:30"} AM Daily • {settings?.autoNudgeEnabled !== false ? `${settings?.nudgeIntervalMinutes || 45}m Nudge` : "Nudge Off"}</span>
                </button>
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} • <Clock className="w-3.5 h-3.5 ml-1" /> {currentTime || "Live"}
              </p>

            </div>
          </div>

          {/* Right Action Bar with Theme Icon */}
          <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
            {/* Minimalist Sun/Moon Theme Symbol */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#161616] dark:hover:bg-[#222222] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 transition-all flex items-center justify-center shadow-sm cursor-pointer group"
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5 text-emerald-600 group-hover:-rotate-12 transition-transform" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform" />
              )}
            </button>

            <button
              onClick={() => setShowManualStandup(true)}
              className="px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#161616] dark:hover:bg-[#222222] text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Log Check-in
            </button>

            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#161616] dark:hover:bg-[#222222] text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              {copied ? "Copied!" : "Copy Briefing"}
            </button>

            <button
              onClick={handleTriggerBot}
              disabled={triggering}
              className="px-4 py-2 text-xs md:text-sm font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {triggering ? <RefreshCw className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4 text-black" />}
              {triggering ? "Sending..." : "Send Bot"}
            </button>
          </div>
        </header>

        {/* Trigger Notification Alert */}
        {triggerMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-sm flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{triggerMsg}</span>
            </div>
            <button onClick={() => setTriggerMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-semibold cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* 4 CLICKABLE HERO KPI CARDS WITH DRILL-DOWN */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Check-in Progress -> Click to view Attendance Tab */}
          <div
            onClick={() => setActiveTab("attendance")}
            className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-md cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Team Check-ins</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{metrics.checkinCount}</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400">/ {metrics.totalEmployees} members</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(metrics.checkinRate, 100)}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{metrics.checkinRate}% completion</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline flex items-center gap-0.5">Roster <ChevronRight className="w-3 h-3" /></span>
            </div>
          </div>

          {/* Metric 2: Active Projects -> Click to view Projects Tab */}
          <div
            onClick={() => { setActiveTab("projects"); setOnlyBlockers(false); setSelectedProject("all"); }}
            className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all hover:border-teal-400 dark:hover:border-teal-500/50 hover:shadow-md cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">Active Initiatives</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-black transition-colors">
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{metrics.uniqueProjects}</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400">initiatives live</span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">Distributed focus</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold group-hover:underline flex items-center gap-0.5">Matrix <ChevronRight className="w-3 h-3" /></span>
            </div>
          </div>

          {/* Metric 3: Total Hours -> Click to view Tasks Workspace */}
          <div
            onClick={() => { setActiveTab("tasks"); setOnlyBlockers(false); }}
            className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-md cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Hours Planned</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{metrics.totalHours}</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400">hours logged</span>
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
                : "bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-500/50 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${metrics.activeBlockers > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-zinc-400"}`}>
                {onlyBlockers ? "Filtering Blockers" : "Blockers"}
              </span>
              <div className={`w-8 h-8 rounded-lg ${metrics.activeBlockers > 0 ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{metrics.activeBlockers}</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400">unresolved</span>
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
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3 flex-wrap gap-4">
          <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-[#111111] border border-slate-200 dark:border-zinc-800 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "projects" ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black font-bold shadow-sm dark:shadow-emerald-500/20" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Initiatives Hub ({projectGroups.length})
            </button>

            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "tasks" ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black font-bold shadow-sm dark:shadow-emerald-500/20" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ListTodo className="w-4 h-4" /> Tasks & Worklogs
            </button>

            <button
              onClick={() => setActiveTab("attendance")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "attendance" ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black font-bold shadow-sm dark:shadow-emerald-500/20" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" /> Team Attendance ({metrics.checkinCount}/{metrics.totalEmployees})
            </button>

            <button
              onClick={() => setActiveTab("feed")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "feed" ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black font-bold shadow-sm dark:shadow-emerald-500/20" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4" /> Check-in Feed
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3.5 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "settings" ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black font-bold shadow-sm dark:shadow-emerald-500/20" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Bot className="w-4 h-4" /> Bot & Settings
            </button>
          </nav>

          {/* Global Search, Date Switcher & Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
            {/* Date View Switcher (Today vs All History) */}
            <div className="flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-[#111111] border border-slate-200 dark:border-zinc-800">
              <button
                onClick={() => setDateFilter("today")}
                title="View today's live standups and check-in roster"
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  dateFilter === "today"
                    ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black shadow-sm font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dateFilter === "today" ? "bg-emerald-600 dark:bg-black animate-pulse" : "bg-slate-400"}`}></span>
                Today ({todaysStandups.length})
              </button>
              <button
                onClick={() => setDateFilter("all")}
                title="View all historical standup records"
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  dateFilter === "all"
                    ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black shadow-sm font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                All History ({standups.length})
              </button>
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm bg-white dark:bg-[#111111] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500 shadow-sm transition-all"
              />
            </div>

            <button
              onClick={handleExportCSV}
              title="Export standups to CSV spreadsheet"
              className="p-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-[#181818] border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={fetchData}
              title="Refresh dashboard"
              className="p-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-[#181818] border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600 dark:text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={handleClearDatabase}
              disabled={clearingDb || standups.length === 0}
              title="Clear all standup check-ins from database"
              className="p-2 text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-[#111111] hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {clearingDb ? <RefreshCw className="w-4 h-4 animate-spin text-rose-600" /> : <Trash2 className="w-4 h-4" />}
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
                <span className="text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mr-1">Filter:</span>
                <button
                  onClick={() => setSelectedProject("all")}
                  className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    selectedProject === "all" ? "bg-emerald-500 text-black border-emerald-400 font-bold" : "bg-white dark:bg-[#111111] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-white shadow-sm"
                  }`}
                >
                  All Initiatives ({projectGroups.length})
                </button>
                {projectOptions.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedProject(p)}
                    className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                      selectedProject === p ? "bg-emerald-500 text-black border-emerald-400 font-bold" : "bg-white dark:bg-[#111111] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-white shadow-sm"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {projectGroups.length === 0 ? (
              <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-12 text-center space-y-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-[#141414] mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-zinc-800">
                  <FolderKanban className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Standups Logged Today</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto mt-1">
                    Click <b>"Send Standup to Team"</b> to ping employees on Google Chat, or click <b>"Log Check-in"</b> to record an update.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleTriggerBot}
                    disabled={triggering}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black text-sm font-bold hover:opacity-90 transition-all inline-flex items-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-black" /> Send Standup to Team
                  </button>
                  <button
                    onClick={() => setShowManualStandup(true)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#161616] dark:hover:bg-[#222222] text-slate-800 dark:text-zinc-200 text-sm font-medium border border-slate-200 dark:border-zinc-800 transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Log Check-in Manually
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projectGroups.map((group) => (
                  <div
                    key={group.projectName}
                    onClick={() => setSelectedProjectModal(group)}
                    className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm dark:shadow-xl flex flex-col justify-between transition-all hover:border-emerald-500 hover:shadow-lg dark:hover:border-emerald-500/60 hover:-translate-y-0.5 cursor-pointer group"
                  >
                    <div className="space-y-4">
                      {/* Project Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-zinc-800/60 pb-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                            <Briefcase className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-all leading-tight flex items-center gap-1.5">
                              {group.projectName} <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-emerald-600 dark:text-emerald-400" />
                            </h3>
                            <span className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 inline-block">
                              {group.members.length} {group.members.length === 1 ? "contributor" : "contributors"}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-[#161616] text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-zinc-700/50 text-xs font-bold inline-block">
                            {group.totalHours} hrs
                          </span>
                        </div>
                      </div>

                      {/* Member Contributions in Clean Cards */}
                      <div className="space-y-3">
                        {group.members.map((m, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/80 dark:border-zinc-800/60 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {m.name}
                              </span>
                              <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px] font-medium">{m.hours}h • {m.time}</span>
                            </div>

                            {/* Itemized Tasks */}
                            <div className="space-y-1 pl-3.5 border-l-2 border-emerald-500/40">
                              {m.taskList && m.taskList.length > 0 ? (
                                m.taskList.map((taskItem, tIdx) => (
                                  <div key={tIdx} className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed flex items-start gap-1.5">
                                    <span className="text-emerald-500 font-bold">•</span>
                                    <span>{taskItem}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">{m.tasks}</p>
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
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-slate-500">
                      <span className={group.blockerCount > 0 ? "text-rose-600 font-semibold" : ""}>
                        {group.blockerCount > 0 ? `⚠️ ${group.blockerCount} blocker reported` : "🟢 All clear"}
                      </span>
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline flex items-center gap-1">
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
        {/* SPACE 2: PROFESSIONAL LIVE STANDUP RESPONSES TABLE & WORKLOGS       */}
        {/* ==================================================================== */}
        {activeTab === "tasks" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header with Table Controls & View Mode Toggle */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-[#0c0c0c] p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Daily Standup Responses Table
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Live itemized task breakdowns, project allocations, hours, and blockers submitted by team members.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* View Mode Toggle */}
                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#161616] border border-slate-200 dark:border-zinc-700/60">
                  <button
                    onClick={() => setTaskViewMode("table")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      taskViewMode === "table"
                        ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black font-bold shadow-sm"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" /> Table View
                  </button>
                  <button
                    onClick={() => setTaskViewMode("cards")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      taskViewMode === "cards"
                        ? "bg-white dark:bg-emerald-500 text-emerald-700 dark:text-black font-bold shadow-sm"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> Grid Cards
                  </button>
                </div>

                <button
                  onClick={handleCopySummary}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#161616] hover:bg-slate-200 dark:hover:bg-[#222222] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/60 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy Summary"}
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>

                <button
                  onClick={handleClearDatabase}
                  disabled={clearingDb || standups.length === 0}
                  title="Clear all recorded standup check-ins from database"
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#161616] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700/60 flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {clearingDb ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" /> : <Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                  <span>Clear DB</span>
                </button>
              </div>
            </div>

            {filteredStandups.length === 0 ? (
              <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-12 text-center space-y-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-[#141414] mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-zinc-800">
                  <ListTodo className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Standup Responses Recorded Yet</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                  When employees reply to the Google Chat Bot, their updates will populate this live responses table in real time.
                </p>
                <button
                  onClick={handleTriggerBot}
                  disabled={triggering}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-black" /> Send Bot to Team
                </button>
              </div>
            ) : taskViewMode === "table" ? (
              /* ========================================================== */
              /* PROFESSIONAL STANDUP RESPONSES TABLE                       */
              /* ========================================================== */
              <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/90 dark:bg-[#111111] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        <th className="py-3.5 px-4 w-12 text-center">#</th>
                        <th className="py-3.5 px-4 min-w-[200px]">Employee</th>
                        <th className="py-3.5 px-4 min-w-[160px]">Project / Initiative</th>
                        <th className="py-3.5 px-4 min-w-[340px]">Planned Tasks (Itemized)</th>
                        <th className="py-3.5 px-4 min-w-[110px]">Total Hours</th>
                        <th className="py-3.5 px-4 min-w-[160px]">Blockers</th>
                        <th className="py-3.5 px-4 min-w-[130px]">Time & Source</th>
                        <th className="py-3.5 px-4 text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-xs">
                      {filteredStandups.map((s, index) => {
                        const taskItems = s.taskList && s.taskList.length > 0 ? s.taskList : extractStructuredTasks(s.tasks);
                        const isBlocked = s.blocker && s.blocker !== "None";

                        return (
                          <tr
                            key={s.id}
                            className="hover:bg-emerald-50/30 dark:hover:bg-[#151515] transition-colors group"
                          >
                            {/* 1. Index */}
                            <td className="py-4 px-4 text-center font-mono text-slate-400 dark:text-zinc-500 font-medium">
                              {index + 1}
                            </td>

                            {/* 2. Employee Info */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-bold flex items-center justify-center text-xs shrink-0 shadow-sm shadow-emerald-500/20">
                                  {s.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                    {s.name}
                                  </h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-zinc-400 font-medium border border-slate-200/60 dark:border-zinc-700/50">
                                      {s.dept || "Engineering"}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">{s.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* 3. Project Initiative */}
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-100 dark:border-emerald-500/20">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="truncate max-w-[150px]">{s.project || "Daily Tasks"}</span>
                              </span>
                            </td>

                            {/* 4. Itemized Tasks Breakdown (Task 1, Task 2, Task 3) */}
                            <td className="py-4 px-4">
                              <div className="space-y-1.5">
                                {taskItems.map((taskText, tIdx) => (
                                  <div
                                    key={tIdx}
                                    className="p-2 rounded-lg bg-slate-50 dark:bg-[#141414] border border-slate-200/70 dark:border-zinc-800/80 flex items-start gap-2 group/task hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all"
                                  >
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] font-mono shrink-0 border border-emerald-500/20">
                                      Task {tIdx + 1}
                                    </span>
                                    <span className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                                      {taskText}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* 5. Total Hours */}
                            <td className="py-4 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2.5 py-1 rounded-lg font-bold font-mono text-xs border ${
                                    s.hours >= 8.0
                                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                      : s.hours > 0
                                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                                      : "bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                                  }`}>
                                    {s.hours} hrs
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                                  {s.hours >= 8 ? "Full day (8h)" : `${Math.round((s.hours / 8) * 100)}% shift`}
                                </span>
                              </div>
                            </td>

                            {/* 6. Blockers */}
                            <td className="py-4 px-4">
                              {isBlocked ? (
                                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                                  <span className="font-semibold leading-tight">{s.blocker}</span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium border border-emerald-200/60 dark:border-emerald-500/20">
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> None
                                </span>
                              )}
                            </td>

                            {/* 7. Time & Source */}
                            <td className="py-4 px-4">
                              <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 font-mono block">
                                  {s.time}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate">
                                  {s.source || "Google Chat 1:1"}
                                </span>
                              </div>
                            </td>

                            {/* 8. Actions */}
                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={() => {
                                  const textToCopy = `👤 ${s.name} (${s.project || "Daily Tasks"} • ${s.hours}h)\n📝 Tasks:\n${taskItems.map((t, idx) => `  ${idx + 1}. ${t}`).join('\n')}\n⚠️ Blocker: ${s.blocker || "None"}`;
                                  navigator.clipboard.writeText(textToCopy);
                                  alert(`Copied ${s.name}'s standup update!`);
                                }}
                                title="Copy standup entry"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 dark:bg-[#181818] dark:hover:bg-emerald-950/40 text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-300 transition-colors inline-flex items-center justify-center cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Summary */}
                <div className="py-3 px-4 bg-slate-50/90 dark:bg-[#111111] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 flex-wrap gap-2">
                  <span>Showing <b>{filteredStandups.length}</b> total standup entries</span>
                  <div className="flex items-center gap-4">
                    <span>Total Hours: <b className="text-emerald-600 dark:text-emerald-400 font-mono">{metrics.totalHours} hrs</b></span>
                    <span>Blockers: <b className={metrics.activeBlockers > 0 ? "text-rose-600 font-mono" : "text-emerald-600 font-mono"}>{metrics.activeBlockers} active</b></span>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================== */
              /* GRID CARDS VIEW                                            */
              /* ========================================================== */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredStandups.map((s) => {
                  const taskItems = s.taskList && s.taskList.length > 0 ? s.taskList : extractStructuredTasks(s.tasks);
                  const isBlocked = s.blocker && s.blocker !== "None";

                  return (
                    <div
                      key={s.id}
                      className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        {/* Member Header Bar */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-bold flex items-center justify-center text-sm shadow-md shadow-emerald-500/20">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-zinc-400">{s.dept || "Engineering"} • {s.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20 font-bold text-xs">
                              {s.hours} hrs
                            </span>
                          </div>
                        </div>

                        {/* Project Initiative Badge */}
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#161616] text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-zinc-700/60">
                            <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            {s.project || "Daily Tasks"}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">{s.time} via {s.source}</span>
                        </div>

                        {/* Structured Itemized Task Workspace */}
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                            Assigned Tasks ({taskItems.length}):
                          </span>

                          <div className="space-y-1.5">
                            {taskItems.map((taskText, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/80 dark:border-zinc-800 flex items-start gap-2.5 group/item hover:border-emerald-400 dark:hover:border-emerald-500/40 transition-all"
                              >
                                <div className="w-4 h-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                  <Check className="w-3 h-3" />
                                </div>
                                <span className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed flex-1">
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

                      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-slate-400 dark:text-zinc-500">
                        <span className="font-mono text-[11px]">{s.date}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`• ${s.name} (${s.project}): ${s.tasks}`);
                            alert("Copied task log!");
                          }}
                          className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
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
                  <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Daily Standup Attendance & Directory
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Track who has checked in today vs pending responses in real-time.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddEmp(true)}
                  className="px-3.5 py-2 text-xs md:text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-black" /> Add Team Member
                </button>
              </div>
            </div>

            {/* 2 Roster Columns: Checked In vs Pending */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Column 1: Checked In Members */}
              <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Checked In Today ({checkedInEmployees.length})</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    Logged
                  </span>
                </div>

                {checkedInEmployees.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 py-6 text-center">No employee check-ins recorded yet today.</p>
                ) : (
                  <div className="space-y-3">
                    {checkedInEmployees.map(emp => {
                      const empStandup = todaysStandups.find(s => s.email.toLowerCase() === emp.email.toLowerCase());
                      return (
                        <div key={emp.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/20">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-xs text-slate-900 dark:text-white">{emp.name}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400">{emp.role} • {emp.dept}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono block">{empStandup?.hours || 0}h logged</span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{empStandup?.time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column 2: Pending Members */}
              <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <UserX className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Pending Response ({pendingEmployees.length})</h3>
                  </div>
                  <button
                    onClick={handleNudgePending}
                    disabled={triggering || pendingEmployees.length === 0}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Nudge Pending ({pendingEmployees.length})
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
                      <div key={emp.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center text-sm border border-amber-500/20">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">{emp.name}</h4>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400">{emp.email}</p>
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
          <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-sm dark:shadow-xl animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 dark:bg-[#111111] text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Project / Initiative</th>
                    <th className="p-4">Tasks Planned</th>
                    <th className="p-4">Hours</th>
                    <th className="p-4">Blocker</th>
                    <th className="p-4">Logged At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                  {filteredStandups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-zinc-500">
                        No check-ins recorded yet today.
                      </td>
                    </tr>
                  ) : (
                    filteredStandups.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-[#151515] transition-all">
                        <td className="p-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{s.name}</div>
                          <div className="text-xs text-slate-500 dark:text-zinc-400">{s.email}</div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20 font-semibold text-xs inline-block">
                            {s.project || "General Tasks"}
                          </span>
                        </td>
                        <td className="p-4 max-w-md">
                          <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed line-clamp-3">{s.tasks}</p>
                        </td>
                        <td className="p-4">
                          <span className="font-mono font-bold text-slate-900 dark:text-zinc-200">{s.hours} hrs</span>
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
                        <td className="p-4 text-xs text-slate-500 dark:text-zinc-400 font-mono">
                          {s.time} • <span className="text-slate-400 dark:text-zinc-500">{s.source}</span>
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
        {/* SPACE 5: BOT CONFIGURATION & SCHEDULE SETTINGS                      */}
        {/* ==================================================================== */}
        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {/* Standup Schedule & Auto-Nudge Card */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Standup Timing & Automated Reminders</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Change broadcast time directly in this dashboard. Bot automatically updates its schedule.</p>
                </div>
              </div>

              {/* Time Configuration with Quick Presets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
                    Daily Standup Broadcast Time
                  </label>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
                    Active: {settings?.standupTime || "10:30"} AM
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <input
                    type="time"
                    value={settings?.standupTime || "10:30"}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, standupTime: e.target.value } : null)}
                    className="w-full px-4 py-2.5 text-base font-bold bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono shadow-sm"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["09:30", "10:00", "10:30", "11:00"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSettings(prev => prev ? { ...prev, standupTime: t } : null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          settings?.standupTime === t
                            ? "bg-emerald-500 text-black font-bold shadow-sm"
                            : "bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-[#222222]"
                        }`}
                      >
                        {t} {parseInt(t.split(":")[0]) < 12 ? "AM" : "PM"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  ⚡ Bot will automatically ping all registered employees at <b>{settings?.standupTime || "10:30"} AM</b> every morning.
                </p>
              </div>

              {/* Auto-Nudge Interval Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-1.5">
                    Auto-Nudge Interval
                  </label>
                  <select
                    value={settings?.nudgeIntervalMinutes || 45}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, nudgeIntervalMinutes: parseInt(e.target.value) } : null)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value={15}>Every 15 Minutes (Fast Pace)</option>
                    <option value={30}>Every 30 Minutes</option>
                    <option value={45}>Every 45 Minutes (Recommended)</option>
                    <option value={60}>Every 60 Minutes</option>
                    <option value={90}>Every 90 Minutes</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">Auto-Nudge Loop</span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">Re-pings until reply</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings(prev => prev ? { ...prev, autoNudgeEnabled: !prev.autoNudgeEnabled } : null)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                        settings?.autoNudgeEnabled !== false ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white transition-transform block shadow-sm ${
                          settings?.autoNudgeEnabled !== false ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Explanatory Rule Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <b className="font-semibold">Persistent Follow-up Rule:</b> If an employee has not checked in within <b>{settings?.nudgeIntervalMinutes || 45} minutes</b> after the <b>{settings?.standupTime || "10:30"} AM</b> prompt, the bot will automatically send a follow-up reminder every {settings?.nudgeIntervalMinutes || 45} minutes until they reply.
                </div>
              </div>

              {/* Bot Custom Morning Prompt */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-1.5">
                  Custom Morning Standup Prompt
                </label>
                <textarea
                  rows={2}
                  value={settings?.botPrompt || "Good morning team! ☕ What epic dragons are you slaying across your projects today?"}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, botPrompt: e.target.value } : null)}
                  className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {/* Save & Apply Button */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-slate-400 dark:text-zinc-500">Settings save to database & sync with Google Apps Script automatically.</span>
                <button
                  onClick={handleSaveSettings}
                  disabled={triggering}
                  className="px-5 py-2.5 text-xs md:text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {triggering ? <RefreshCw className="w-4 h-4 animate-spin text-black" /> : <Check className="w-4 h-4 text-black" />}
                  Save & Apply Schedule to Bot
                </button>
              </div>
            </div>

            {/* Quick Bot Actions & Live Controls */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Bot Actions & Manual Dispatch</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Trigger morning broadcasts or poke pending employees on-demand without waiting for the automated timer.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleTriggerBot}
                  disabled={triggering}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-500/40 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5 mb-1">
                    <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                    <span className="font-bold text-xs md:text-sm text-slate-900 dark:text-white">Broadcast Standup Now</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Send standup prompts to all registered employee chats.</p>
                </button>

                <button
                  onClick={handleNudgePending}
                  disabled={triggering || pendingEmployees.length === 0}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/40 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5 mb-1">
                    <Clock className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform" />
                    <span className="font-bold text-xs md:text-sm text-slate-900 dark:text-white">Poke Pending Now ({pendingEmployees.length})</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Send 45-min follow-up reminders to unresponded team members.</p>
                </button>
              </div>
            </div>

            {/* Live Webhook Card */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Google Chat Z-Mode Webhook Endpoint</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Endpoint URL configured in Google Cloud Console Google Chat API.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
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
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-800 dark:text-zinc-200 text-xs font-semibold shrink-0 border border-slate-200 dark:border-zinc-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {webhookCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  {webhookCopied ? "Copied" : "Copy URL"}
                </button>
              </div>
            </div>

            {/* Google Cloud Service Account (Direct 1:1 DMs - NO Apps Script) */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Google Cloud Service Account (Direct 1:1 DMs)</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Enables direct 1:1 DM broadcasts from Next.js server with ZERO Apps Script dependencies.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Paste your Google Cloud Service Account JSON Key below (or set <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#181818] text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">GOOGLE_SERVICE_ACCOUNT_KEY</code> in Vercel Environment Variables):
              </p>

              <textarea
                rows={4}
                value={settings?.googleServiceAccountKey || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, googleServiceAccountKey: e.target.value } : null)}
                placeholder='{ "type": "service_account", "project_id": "...", "private_key": "-----BEGIN PRIVATE KEY-----...", "client_email": "...@...iam.gserviceaccount.com" }'
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono shadow-sm"
              />

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={triggering}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs md:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  Save Service Account Credentials
                </button>
              </div>
            </div>

            {/* Apps Script Settings (Optional Fallback) */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Google Apps Script Web App (Optional Fallback)</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Optional connector if you prefer running via Google Apps Script instead of direct Service Account.
              </p>
              <input
                type="text"
                value={settings?.appsScriptUrl || ""}
                onChange={(e) => setSettings(prev => prev ? { ...prev, appsScriptUrl: e.target.value } : null)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2 text-xs md:text-sm bg-white dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono shadow-sm"
              />
            </div>

            {/* Database & Storage Management (Danger Zone) */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-6 border border-rose-200 dark:border-rose-950/50 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/50">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Database & Storage Management</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Manage data persistence, caching, and clean up historical standup check-ins.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Auto-Persistence Active</span>
                </div>
                <p>
                  Your dashboard standup records and registered team members are automatically synced and persisted in local browser storage and server storage. Refreshing or reopening the tab will <b>never</b> lose your data.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">Reset Standup Check-in Records</span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">Clears all {standups.length} recorded standup responses from both the server database and local cache.</span>
                </div>

                <button
                  type="button"
                  onClick={handleClearDatabase}
                  disabled={clearingDb || standups.length === 0}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs md:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {clearingDb ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Clear All Check-ins ({standups.length})</span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ==================================================================== */}
        {/* MODAL: PROJECT DEEP-DIVE DRILL-DOWN MODAL                            */}
        {/* ==================================================================== */}
        {selectedProjectModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-5 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black flex items-center justify-center shadow-md shadow-emerald-500/20">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {selectedProjectModal.projectName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
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
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 text-center">
                    <span className="text-[11px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Total Hours</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">{selectedProjectModal.totalHours} hrs</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 text-center">
                    <span className="text-[11px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Contributors</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">{selectedProjectModal.members.length}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 text-center">
                    <span className="text-[11px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Blockers</span>
                    <span className={`text-xl font-bold mt-1 block ${selectedProjectModal.blockerCount > 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {selectedProjectModal.blockerCount}
                    </span>
                  </div>
                </div>

                {/* Team Task Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Team Work Breakdown:</h4>
                  <div className="space-y-3">
                    {selectedProjectModal.members.map((m, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs">
                              {m.name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-sm text-slate-900 dark:text-white block">{m.name}</span>
                              <span className="text-[11px] text-slate-400 dark:text-zinc-500">{m.email}</span>
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            {m.hours} hrs
                          </span>
                        </div>

                        {/* Tasks List */}
                        <div className="space-y-1.5 pl-3 border-l-2 border-emerald-500">
                          {m.taskList && m.taskList.length > 0 ? (
                            m.taskList.map((t, tIdx) => (
                              <div key={tIdx} className="text-xs text-slate-700 dark:text-zinc-300 flex items-start gap-1.5">
                                <span className="text-emerald-500 font-bold">•</span>
                                <span>{t}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-700 dark:text-zinc-300">{m.tasks}</p>
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
              <div className="p-4 bg-slate-50 dark:bg-[#111111] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    let text = `📁 Project Briefing: *${selectedProjectModal.projectName}* (${selectedProjectModal.totalHours} hrs)\n`;
                    selectedProjectModal.members.forEach(m => {
                      text += `• ${m.name} (${m.hours}h): ${m.tasks}\n`;
                    });
                    navigator.clipboard.writeText(text);
                    alert("Copied project briefing!");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#181818] dark:hover:bg-[#222222] text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Project Briefing
                </button>

                <button
                  onClick={() => setSelectedProjectModal(null)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD EMPLOYEE */}
        {showAddEmp && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-4 animate-scale-in">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Company Team Member</h3>
              <form onSubmit={handleAddEmployee} className="space-y-3.5 text-xs md:text-sm">
                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newEmp.name}
                    onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Corporate Email</label>
                  <input
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={newEmp.email}
                    onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Department</label>
                    <input
                      type="text"
                      placeholder="Engineering"
                      value={newEmp.dept}
                      onChange={(e) => setNewEmp({ ...newEmp, dept: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Role</label>
                    <input
                      type="text"
                      placeholder="Frontend Lead"
                      value={newEmp.role}
                      onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEmp(false)}
                    className="px-4 py-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-[#181818] font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl shadow-sm cursor-pointer"
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
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-4 animate-scale-in">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Log Standup Check-in</h3>
              <form onSubmit={handleManualStandup} className="space-y-3.5 text-xs md:text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Employee Name</label>
                    <input
                      type="text"
                      required
                      placeholder="John Doe"
                      value={manualEntry.name}
                      onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Project Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Auth & Security, Mobile App"
                      value={manualEntry.project}
                      onChange={(e) => setManualEntry({ ...manualEntry, project: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Planned Tasks</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Building JWT refresh token flow, unit tests..."
                    value={manualEntry.tasks}
                    onChange={(e) => setManualEntry({ ...manualEntry, tasks: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={manualEntry.hours}
                      onChange={(e) => setManualEntry({ ...manualEntry, hours: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Blocker (if any)</label>
                    <input
                      type="text"
                      placeholder="None or specify issue"
                      value={manualEntry.blocker}
                      onChange={(e) => setManualEntry({ ...manualEntry, blocker: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowManualStandup(false)}
                    className="px-4 py-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-[#181818] font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl shadow-sm cursor-pointer"
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

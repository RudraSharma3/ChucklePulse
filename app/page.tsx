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
  SlidersHorizontal,
  Bot,
  Terminal,
  ExternalLink,
  Briefcase,
  Layers,
  MessageSquareQuote,
  Flame,
  Check,
  Building2,
  Calendar
} from "lucide-react";
import { Employee, StandupRecord, CompanySettings, ProjectGroup } from "@/lib/types";

export default function StandupDashboard() {
  const [activeTab, setActiveTab] = useState<"projects" | "logs" | "team" | "settings">("projects");
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

  // Add Employee Modal
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
      return matchQuery && matchDept && matchProj;
    });
  }, [standups, searchQuery, selectedDept, selectedProject]);

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
    const totalEmployees = Math.max(employees.length, checkinCount);
    const checkinRate = totalEmployees > 0 ? Math.round((checkinCount / totalEmployees) * 100) : 0;

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      uniqueProjects,
      activeBlockers,
      checkinCount,
      totalEmployees,
      checkinRate
    };
  }, [standups, employees]);

  // Unique Projects & Departments list for dropdowns
  const projectOptions = useMemo(() => {
    return Array.from(new Set(standups.map(s => s.project || "General Tasks")));
  }, [standups]);

  const deptOptions = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.dept || "General")));
  }, [employees]);

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
      setTriggerMsg("Trigger completed.");
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

    projectGroups.forEach(g => {
      text += `📁 *Project: ${g.projectName}* (${g.totalHours} hrs)\n`;
      g.members.forEach(m => {
        const blockerStr = m.blocker && m.blocker !== "None" ? ` ⚠️ [Blocker: ${m.blocker}]` : "";
        text += `  • *${m.name}* (${m.hours}h): ${m.tasks}${blockerStr}\n`;
      });
      text += `\n`;
    });

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
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Top Header */}
      <header className="glass-panel rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {settings?.companyName || "BytePx"} <span className="text-indigo-400 font-semibold">StandupPulse</span>
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Google Chat Bot Live
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} • <Clock className="w-3.5 h-3.5 ml-1" /> {currentTime || "Live"}
            </p>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setShowManualStandup(true)}
            className="px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4 text-indigo-400" /> Log Check-in
          </button>

          <button
            onClick={handleCopySummary}
            className="px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all flex items-center gap-2 shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
            {copied ? "Copied!" : "Copy Briefing"}
          </button>

          <button
            onClick={handleTriggerBot}
            disabled={triggering}
            className="px-4 py-2 text-xs md:text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {triggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {triggering ? "Pinging..." : "Send Standup to Team"}
          </button>
        </div>
      </header>

      {/* Trigger Notification Alert */}
      {triggerMsg && (
        <div className="p-4 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-200 text-sm flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>{triggerMsg}</span>
          </div>
          <button onClick={() => setTriggerMsg(null)} className="text-indigo-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* 4 Hero KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Check-in Progress */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Team Check-ins</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-white">{metrics.checkinCount}</span>
            <span className="text-xs text-slate-400">/ {metrics.totalEmployees} members</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(metrics.checkinRate, 100)}%` }}
            ></div>
          </div>
          <span className="text-[11px] text-emerald-400 font-medium mt-1.5 inline-block">{metrics.checkinRate}% completion today</span>
        </div>

        {/* Metric 2: Active Projects */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Initiatives</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-white">{metrics.uniqueProjects}</span>
            <span className="text-xs text-slate-400">projects identified</span>
          </div>
          <span className="text-[11px] text-blue-400 font-medium mt-4 inline-block">Distributed team focus</span>
        </div>

        {/* Metric 3: Total Hours */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hours Planned</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-white">{metrics.totalHours}</span>
            <span className="text-xs text-slate-400">hours logged</span>
          </div>
          <span className="text-[11px] text-amber-400 font-medium mt-4 inline-block">
            Avg {metrics.checkinCount > 0 ? (metrics.totalHours / metrics.checkinCount).toFixed(1) : 0} hrs / member
          </span>
        </div>

        {/* Metric 4: Blockers */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Blockers</span>
            <div className={`w-8 h-8 rounded-lg ${metrics.activeBlockers > 0 ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"} flex items-center justify-center`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-white">{metrics.activeBlockers}</span>
            <span className="text-xs text-slate-400">unresolved</span>
          </div>
          <span className={`text-[11px] ${metrics.activeBlockers > 0 ? "text-rose-400" : "text-emerald-400"} font-medium mt-4 inline-block`}>
            {metrics.activeBlockers > 0 ? "⚠️ Needs leadership assistance" : "🟢 All paths clear"}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-4">
        <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
          <button
            onClick={() => setActiveTab("projects")}
            className={`px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "projects" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            <FolderKanban className="w-4 h-4" /> By Project & Initiative
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "logs" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" /> Check-in Feed ({filteredStandups.length})
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={`px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "team" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" /> Team Directory ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "settings" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            <Bot className="w-4 h-4" /> Google Chat Webhook & Settings
          </button>
        </nav>

        {/* Global Search & Export Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by project, employee, task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <button
            onClick={handleExportCSV}
            title="Export standups to CSV spreadsheet"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={fetchData}
            title="Refresh dashboard"
            className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* TAB 1: PROJECT GROUP MATRIX (WHO IS WORKING ON WHAT) */}
      {activeTab === "projects" && (
        <div className="space-y-6 animate-fade-in">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] mr-1">Filter:</span>
            <button
              onClick={() => setSelectedProject("all")}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                selectedProject === "all" ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              All Projects ({projectGroups.length})
            </button>
            {projectOptions.map(p => (
              <button
                key={p}
                onClick={() => setSelectedProject(p)}
                className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                  selectedProject === p ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {projectGroups.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                <FolderKanban className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">No Standups Recorded Today</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  Click <b>"Send Standup to Team"</b> to ping your employees on Google Chat, or test an entry with <b>"Log Check-in"</b>.
                </p>
              </div>
              <button
                onClick={() => setShowManualStandup(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Test Standup Check-in
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projectGroups.map((group) => (
                <div
                  key={group.projectName}
                  className="glass-card rounded-2xl p-5 border border-slate-800/80 shadow-xl flex flex-col justify-between transition-all hover:border-indigo-500/40 group"
                >
                  <div className="space-y-4">
                    {/* Project Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-800/60 pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-white group-hover:text-indigo-300 transition-all leading-tight">
                            {group.projectName}
                          </h3>
                          <span className="text-xs text-slate-400 mt-0.5 inline-block">
                            {group.members.length} {group.members.length === 1 ? "contributor" : "contributors"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-300 border border-slate-700/50 text-xs font-bold inline-block">
                          {group.totalHours} hrs
                        </span>
                      </div>
                    </div>

                    {/* Member Contributions */}
                    <div className="space-y-3">
                      {group.members.map((m, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/50 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {m.name}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">{m.hours}h • {m.time}</span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed pl-3.5 border-l-2 border-indigo-500/40">
                            {m.tasks}
                          </p>

                          {m.blocker && m.blocker !== "None" && (
                            <div className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-medium flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span><b>Blocker:</b> {m.blocker}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                    <span>{group.blockerCount > 0 ? `⚠️ ${group.blockerCount} blocker reported` : "🟢 No active blockers"}</span>
                    <span className="text-[11px] font-mono text-slate-400">Total: {group.totalHours} hrs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL CHECK-IN LOGS FEED */}
      {activeTab === "logs" && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-xl animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Project / Initiative</th>
                  <th className="p-4">Tasks Planned</th>
                  <th className="p-4">Hours</th>
                  <th className="p-4">Blocker</th>
                  <th className="p-4">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredStandups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No check-ins match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredStandups.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-all">
                      <td className="p-4">
                        <div className="font-semibold text-white">{s.name}</div>
                        <div className="text-xs text-slate-400">{s.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold text-xs inline-block">
                          {s.project || "General Tasks"}
                        </span>
                      </td>
                      <td className="p-4 max-w-md">
                        <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">{s.tasks}</p>
                      </td>
                      <td className="p-4">
                        <span className="font-mono font-bold text-slate-200">{s.hours} hrs</span>
                      </td>
                      <td className="p-4">
                        {s.blocker === "None" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> None
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="w-3.5 h-3.5" /> {s.blocker}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-400 font-mono">
                        {s.time} • <span className="text-slate-500">{s.source}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TEAM DIRECTORY */}
      {activeTab === "team" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Company Employee Directory ({employees.length})</h3>
            <button
              onClick={() => setShowAddEmp(true)}
              className="px-3.5 py-2 text-xs md:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-2 shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" /> Add Team Member
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((emp) => (
              <div key={emp.id} className="glass-card rounded-2xl p-5 border border-slate-800 flex items-start justify-between gap-3 group">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 text-indigo-400 flex items-center justify-center font-bold text-base border border-slate-700/60 shadow-sm">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-indigo-300 transition-all">{emp.name}</h4>
                    <p className="text-xs text-slate-400">{emp.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/50">
                        {emp.dept || "Engineering"}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">{emp.role || "Member"}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteEmployee(emp.id)}
                  title="Remove Employee"
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: GOOGLE CHAT WEBHOOK & SETTINGS */}
      {activeTab === "settings" && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
          {/* Live Webhook Card */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Google Chat HTTP Webhook Endpoint</h3>
                <p className="text-xs text-slate-400">Paste this URL in your Google Cloud Console Chat API Configuration.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <code className="text-xs text-emerald-400 font-mono break-all select-all">
                {typeof window !== "undefined" ? `${window.location.origin}/api/chat-bot` : "/api/chat-bot"}
              </code>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/api/chat-bot`;
                  navigator.clipboard.writeText(url);
                  setWebhookCopied(true);
                  setTimeout(() => setWebhookCopied(false), 3000);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5"
              >
                {webhookCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                {webhookCopied ? "Copied" : "Copy URL"}
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              💡 <b>Google Cloud Console Setup:</b> Go to <b>APIs & Services ➔ Google Chat API ➔ Configuration</b>, set <b>Connection settings</b> to <b>HTTP endpoint URL</b>, paste the URL above, and click Save.
            </p>
          </div>

          {/* Apps Script Settings */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-base">Google Apps Script Web App (1-Click Broadcast Dispatcher)</h3>
            <p className="text-xs text-slate-400">
              When you click "Send Standup to Team", our server pings this Apps Script Web App to message all employee 1:1 Bot chats.
            </p>
            <input
              type="text"
              value={settings?.appsScriptUrl || ""}
              onChange={(e) => setSettings(prev => prev ? { ...prev, appsScriptUrl: e.target.value } : null)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
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
              className="px-4 py-2 text-xs md:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD EMPLOYEE */}
      {showAddEmp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full border border-slate-800 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-lg font-bold text-white">Add Company Team Member</h3>
            <form onSubmit={handleAddEmployee} className="space-y-3.5 text-xs md:text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newEmp.name}
                  onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  placeholder="john@bytepx.com"
                  value={newEmp.email}
                  onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="Engineering"
                    value={newEmp.dept}
                    onChange={(e) => setNewEmp({ ...newEmp, dept: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Role</label>
                  <input
                    type="text"
                    placeholder="Frontend Lead"
                    value={newEmp.role}
                    onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEmp(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
                >
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL STANDUP LOG */}
      {showManualStandup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-lg w-full border border-slate-800 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-lg font-bold text-white">Log Standup Check-in</h3>
            <form onSubmit={handleManualStandup} className="space-y-3.5 text-xs md:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Employee Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Rudra Sharma"
                    value={manualEntry.name}
                    onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Auth System, Mobile App"
                    value={manualEntry.project}
                    onChange={(e) => setManualEntry({ ...manualEntry, project: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Planned Tasks</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Building JWT refresh token flow and unit testing..."
                  value={manualEntry.tasks}
                  onChange={(e) => setManualEntry({ ...manualEntry, tasks: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={manualEntry.hours}
                    onChange={(e) => setManualEntry({ ...manualEntry, hours: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Blocker (if any)</label>
                  <input
                    type="text"
                    placeholder="None or specify issue"
                    value={manualEntry.blocker}
                    onChange={(e) => setManualEntry({ ...manualEntry, blocker: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualStandup(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
                >
                  Save Check-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ShieldCheck,
  Activity,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function AdminConsolePage() {
  const [activeTab, setActiveTab] = useState("users");

  // User Management State
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // Source Allowlist State
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceTierFilter, setSourceTierFilter] = useState("ALL");
  const [showAddSource, setShowAddSource] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newTier, setNewTier] = useState("CERTIFIED_FACT_CHECKER");
  const [newNotes, setNewNotes] = useState("");
  const [addingSource, setAddingSource] = useState(false);

  // Audit Log State
  const [audits, setAudits] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActorFilter, setAuditActorFilter] = useState("ALL");
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Notification Toast
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const resList = await fetch("/api/admin/users/list");
      if (resList.ok) {
        const d = await resList.json();
        setUsers(d.data || []);
      }
    } catch {
      // Graceful error catch
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch Sources
  const fetchSources = async () => {
    setLoadingSources(true);
    try {
      const params = new URLSearchParams();
      if (sourceSearch) params.set("search", sourceSearch);
      if (sourceTierFilter !== "ALL") params.set("tier", sourceTierFilter);
      const res = await fetch(`/api/admin/sources?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setSources(d.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSources(false);
    }
  };

  // Fetch Audit Logs
  const fetchAudits = async () => {
    setLoadingAudits(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (auditSearch) params.set("search", auditSearch);
      if (auditActorFilter !== "ALL") params.set("actorType", auditActorFilter);
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setAudits(d.data?.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudits(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSources();
    fetchAudits();
  }, []);

  useEffect(() => {
    if (activeTab === "sources") fetchSources();
    if (activeTab === "audits") fetchAudits();
    if (activeTab === "users") fetchUsers();
  }, [activeTab]);

  // Update user role
  const handleRoleChange = async (userId, newRole) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message || "Failed to update role", "error");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showToast(`User role successfully changed to ${newRole}`);
      fetchAudits();
    } catch {
      showToast("Network error updating user role", "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Add source domain
  const handleAddSource = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setAddingSource(true);
    try {
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain.trim(),
          reputationTier: newTier,
          notes: newNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message || "Failed to add domain", "error");
        return;
      }
      showToast(`Domain '${newDomain}' added to allowlist with tier ${newTier}`);
      setNewDomain("");
      setNewNotes("");
      setShowAddSource(false);
      fetchSources();
      fetchAudits();
    } catch {
      showToast("Network error adding source profile", "error");
    } finally {
      setAddingSource(false);
    }
  };

  // Update source tier
  const handleUpdateSourceTier = async (id, domain, tier) => {
    try {
      const res = await fetch(`/api/admin/sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reputationTier: tier }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error?.message || "Failed to update tier", "error");
        return;
      }
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, reputationTier: tier } : s))
      );
      showToast(`Updated '${domain}' to ${tier}`);
      fetchAudits();
    } catch {
      showToast("Network error updating source tier", "error");
    }
  };

  // Delete source domain
  const handleDeleteSource = async (id, domain) => {
    if (!confirm(`Are you sure you want to remove '${domain}' from the source profiles directory?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/sources/${id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Failed to delete source profile", "error");
        return;
      }
      setSources((prev) => prev.filter((s) => s.id !== id));
      showToast(`Removed '${domain}' from source directory`);
      fetchAudits();
    } catch {
      showToast("Network error deleting source profile", "error");
    }
  };

  const getTierBadge = (t) => {
    switch (t) {
      case "OFFICIAL":
        return "bg-purple-950 text-purple-300 border-purple-800";
      case "CERTIFIED_FACT_CHECKER":
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
      case "MAINSTREAM_NEWS":
        return "bg-blue-950 text-blue-300 border-blue-800";
      case "UNRELIABLE":
        return "bg-rose-950 text-rose-300 border-rose-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Administrator Console</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Role: ADMIN
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            User access control, reputation tier allowlists, and immutable audit trail verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/reviewer"
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Reviewer Queue Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-emerald-950 border-emerald-800 text-emerald-200"
              : "bg-rose-950 border-rose-800 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.msg}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold opacity-80 hover:opacity-100 ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "users"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User & Role Management ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sources")}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "sources"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Source Allowlist Editor ({sources.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("audits")}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "audits"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Immutable Audit Log Viewer ({audits.length})</span>
        </button>
      </div>

      {/* TAB 1: USER & ROLE MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">System Users & RBAC Permissions</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign SUBMITTER, REVIEWER, or ADMIN roles. All role promotions/demotions are logged to the audit trail.
              </p>
            </div>
            <button
              onClick={() => fetchUsers()}
              disabled={loadingUsers}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Refresh users"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? "animate-spin text-blue-400" : ""}`} />
            </button>
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-4">Change Role</th>
                    <th className="py-3 px-4">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        {loadingUsers ? "Loading users..." : "No users found."}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {u.name || "Anonymous User"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">{u.email}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase border font-semibold ${
                              u.role === "ADMIN"
                                ? "bg-purple-950 text-purple-300 border-purple-800"
                                : u.role === "REVIEWER"
                                ? "bg-amber-950 text-amber-300 border-amber-800"
                                : "bg-blue-950 text-blue-300 border-blue-800"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            disabled={updatingUserId === u.id}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
                          >
                            <option value="SUBMITTER">SUBMITTER</option>
                            <option value="REVIEWER">REVIEWER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SOURCE ALLOWLIST EDITOR */}
      {activeTab === "sources" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Source Profile Directory & Reputation Allowlist</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure trusted election domains, fact-checking outlets, and untrusted sources used in evidence scoring.
              </p>
            </div>
            <button
              onClick={() => setShowAddSource(!showAddSource)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
            >
              <Plus className="w-4 h-4" />
              <span>Add Trusted Domain</span>
            </button>
          </div>

          {showAddSource && (
            <form
              onSubmit={handleAddSource}
              className="p-5 rounded-xl bg-slate-900 border border-blue-500/40 space-y-4 shadow-md"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Add Source Profile to Directory</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Domain Hostname:</label>
                  <input
                    type="text"
                    required
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="eci.gov.in or altnews.in"
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Reputation Tier:</label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="OFFICIAL">OFFICIAL (Constitutional/Govt)</option>
                    <option value="CERTIFIED_FACT_CHECKER">CERTIFIED_FACT_CHECKER</option>
                    <option value="MAINSTREAM_NEWS">MAINSTREAM_NEWS</option>
                    <option value="USER_GENERATED">USER_GENERATED</option>
                    <option value="UNRELIABLE">UNRELIABLE (Blocked/Suspect)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Audit Notes:</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="E.g. Certified IFCN Signatory"
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={addingSource}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {addingSource ? "Saving..." : "Save Domain Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSource(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Sources Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filter Tier:</span>
              <select
                value={sourceTierFilter}
                onChange={(e) => {
                  setSourceTierFilter(e.target.value);
                  setTimeout(fetchSources, 0);
                }}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
              >
                <option value="ALL">All Tiers</option>
                <option value="OFFICIAL">OFFICIAL</option>
                <option value="CERTIFIED_FACT_CHECKER">CERTIFIED_FACT_CHECKER</option>
                <option value="MAINSTREAM_NEWS">MAINSTREAM_NEWS</option>
                <option value="UNRELIABLE">UNRELIABLE</option>
              </select>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchSources()}
                placeholder="Search domain..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Sources Table */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4">Reputation Tier</th>
                    <th className="py-3 px-4">Domain Age</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {sources.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        {loadingSources ? "Loading sources..." : "No source profiles found."}
                      </td>
                    </tr>
                  ) : (
                    sources.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                          {s.domain}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={s.reputationTier}
                            onChange={(e) => handleUpdateSourceTier(s.id, s.domain, e.target.value)}
                            className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase border font-semibold cursor-pointer ${getTierBadge(
                              s.reputationTier
                            )}`}
                          >
                            <option value="OFFICIAL">OFFICIAL</option>
                            <option value="CERTIFIED_FACT_CHECKER">CERTIFIED_FACT_CHECKER</option>
                            <option value="MAINSTREAM_NEWS">MAINSTREAM_NEWS</option>
                            <option value="USER_GENERATED">USER_GENERATED</option>
                            <option value="UNRELIABLE">UNRELIABLE</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {s.ageDays ? `${s.ageDays} days` : "Unknown"}
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-[300px] truncate">
                          {s.notes || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteSource(s.id, s.domain)}
                            className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                            title="Delete Source Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: IMMUTABLE AUDIT LOG VIEWER */}
      {activeTab === "audits" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Immutable System & Human Review Audit Trail</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographically tracked record of every pipeline step, AI judgement, reviewer approval, and role modification.
              </p>
            </div>
            <button
              onClick={() => fetchAudits()}
              disabled={loadingAudits}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 w-fit"
              title="Refresh audit trail"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudits ? "animate-spin text-blue-400" : ""}`} />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Actor Type:</span>
              <select
                value={auditActorFilter}
                onChange={(e) => {
                  setAuditActorFilter(e.target.value);
                  setTimeout(fetchAudits, 0);
                }}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
              >
                <option value="ALL">All Actors</option>
                <option value="USER">Human Reviewers (USER)</option>
                <option value="SYSTEM">Automated Pipeline (SYSTEM)</option>
              </select>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAudits()}
                placeholder="Search event or entity ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            {audits.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-xs">
                {loadingAudits ? "Loading audit logs..." : "No audit log entries found."}
              </div>
            ) : (
              audits.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2 transition-all hover:border-slate-700"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`font-mono px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                            log.actorType === "USER"
                              ? "bg-amber-950 text-amber-300 border-amber-800"
                              : "bg-blue-950 text-blue-300 border-blue-800"
                          }`}
                        >
                          {log.actorType}
                        </span>
                        <span className="font-bold text-slate-200">{log.event}</span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          Target: {log.entity} #{log.entityId}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-slate-400 hover:text-slate-200 p-1 rounded"
                          title="View JSON metadata"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && log.metadata && (
                      <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                        <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

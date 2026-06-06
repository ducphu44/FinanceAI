"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, XCircle, Bell, RefreshCcw,
  PlayCircle, Filter, ChevronLeft, ChevronRight, Loader2,
  ShieldAlert, TrendingUp, Zap, BarChart3, X,
} from "lucide-react";
import Header from "@/components/layout/Header";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────────
type AlertLevel = "low" | "medium" | "high";
type AlertStatus = "open" | "resolved" | "ignored";
type AlertType =
  | "over_budget"
  | "high_variance"
  | "unusual_increase"
  | "fast_budget_usage";

interface AlertDetail {
  id: number;
  transaction_id: number;
  alert_type: AlertType;
  alert_level: AlertLevel;
  message: string;
  status: AlertStatus;
  created_at: string;
  resolved_by: number | null;
  resolved_at: string | null;
  txn_ref: string | null;
  department: string | null;
  category: string | null;
  month: string | null;
}

interface AlertSummary {
  total_open: number;
  high_open: number;
  medium_open: number;
  low_open: number;
  total_resolved: number;
  by_type: Record<AlertType, number>;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  const stored = localStorage.getItem("financeai_token");
  if (stored) return stored;

  // Fallback: auto-login nếu chưa có token (dành cho trường hợp test trực tiếp)
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "manager@example.com", password: "password123" }),
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("financeai_token", data.access_token);
    return data.access_token;
  }
  throw new Error("Đăng nhập thất bại");
}

// ── Config maps ───────────────────────────────────────────────────────────────
const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; icon: React.ElementType; color: string }> = {
  over_budget:       { label: "Vượt Ngân sách",     icon: ShieldAlert,  color: "text-red-600 bg-red-50 border-red-200" },
  high_variance:     { label: "Biến động Lớn",      icon: BarChart3,    color: "text-orange-600 bg-orange-50 border-orange-200" },
  unusual_increase:  { label: "Tăng Bất thường",    icon: TrendingUp,   color: "text-purple-600 bg-purple-50 border-purple-200" },
  fast_budget_usage: { label: "Dùng Ngân sách Nhanh", icon: Zap,        color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
};

const LEVEL_CONFIG: Record<AlertLevel, { label: string; dotColor: string; rowBg: string; badge: string }> = {
  high:   { label: "CAO",    dotColor: "bg-red-500",    rowBg: "bg-red-50/60",    badge: "bg-red-100 text-red-700 border-red-300" },
  medium: { label: "TB",     dotColor: "bg-amber-500",  rowBg: "bg-amber-50/50",  badge: "bg-amber-100 text-amber-700 border-amber-300" },
  low:    { label: "THẤP",   dotColor: "bg-yellow-500", rowBg: "bg-yellow-50/40", badge: "bg-yellow-100 text-yellow-700 border-yellow-300" },
};

const STATUS_CONFIG: Record<AlertStatus, { label: string; badge: string }> = {
  open:     { label: "Mở",           badge: "bg-blue-100 text-blue-700 border-blue-200" },
  resolved: { label: "Đã giải quyết", badge: "bg-green-100 text-green-700 border-green-200" },
  ignored:  { label: "Bỏ qua",       badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertDetail[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const token = await getToken();
      const res = await fetch(`${API}/alerts/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSummary(await res.json());
    } catch {
      /* silent */
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async (pg = page) => {
    try {
      setLoading(true);
      const token = await getToken();
      const qs = new URLSearchParams();
      if (filterStatus) qs.set("status", filterStatus);
      if (filterType)   qs.set("alert_type", filterType);
      if (filterLevel)  qs.set("level", filterLevel);
      if (filterMonth)  qs.set("month", filterMonth);
      if (filterDept)   qs.set("department", filterDept);
      qs.set("page", String(pg));
      qs.set("limit", String(LIMIT));

      const res = await fetch(`${API}/alerts?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.data);
        setMeta(data.meta);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, filterLevel, filterMonth, filterDept, page]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { setPage(1); fetchAlerts(1); }, [filterStatus, filterType, filterLevel, filterMonth, filterDept]);
  useEffect(() => { fetchAlerts(page); }, [page]);

  const refresh = () => { fetchSummary(); fetchAlerts(page); };

  const runAnalysis = async () => {
    try {
      setAnalysisLoading(true);
      const token = await getToken();
      const res = await fetch(`${API}/alerts/run-analysis`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", data.message);
        refresh();
      } else {
        showToast("error", data.detail || "Lỗi khi chạy phân tích");
      }
    } catch {
      showToast("error", "Không thể kết nối backend");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const resolveAlert = async (id: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/alerts/${id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ note: "" }),
      });
      if (res.ok) {
        showToast("success", "Đã đánh dấu giải quyết");
        refresh();
      } else {
        const err = await res.json();
        showToast("error", err.detail || "Lỗi");
      }
    } catch {
      showToast("error", "Không thể kết nối backend");
    }
  };

  const ignoreAlert = async (id: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/alerts/${id}/ignore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("success", "Đã bỏ qua cảnh báo");
        refresh();
      } else {
        const err = await res.json();
        showToast("error", err.detail || "Lỗi");
      }
    } catch {
      showToast("error", "Không thể kết nối backend");
    }
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterType("");
    setFilterLevel("");
    setFilterMonth("");
    setFilterDept("");
  };

  const hasFilter = filterStatus || filterType || filterLevel || filterMonth || filterDept;
  const totalPages = Math.ceil(meta.total / LIMIT);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Quản lý Cảnh báo" />

      <main className="p-6 space-y-6 max-w-screen-2xl mx-auto">

        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur text-sm font-medium transition-all animate-in slide-in-from-top-2 duration-300 ${
              toast.type === "success"
                ? "bg-green-600 text-white border-green-500"
                : "bg-red-600 text-white border-red-500"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <SummaryCard
            label="Tổng cảnh báo mở"
            value={summary?.total_open ?? 0}
            icon={Bell}
            loading={summaryLoading}
            color="blue"
          />
          <SummaryCard
            label="Mức độ Cao"
            value={summary?.high_open ?? 0}
            icon={AlertTriangle}
            loading={summaryLoading}
            color="red"
            pulse={!!summary && summary.high_open > 0}
          />
          <SummaryCard
            label="Mức độ Trung bình"
            value={summary?.medium_open ?? 0}
            icon={AlertTriangle}
            loading={summaryLoading}
            color="amber"
          />
          <SummaryCard
            label="Mức độ Thấp"
            value={summary?.low_open ?? 0}
            icon={AlertTriangle}
            loading={summaryLoading}
            color="yellow"
          />
          <SummaryCard
            label="Đã giải quyết"
            value={summary?.total_resolved ?? 0}
            icon={CheckCircle2}
            loading={summaryLoading}
            color="green"
          />
        </div>

        {/* By-type cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.entries(ALERT_TYPE_CONFIG) as [AlertType, typeof ALERT_TYPE_CONFIG[AlertType]][]).map(([type, cfg]) => {
              const Icon = cfg.icon;
              const count = summary.by_type[type] ?? 0;
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? "" : type)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    filterType === type
                      ? cfg.color + " border-current shadow-sm"
                      : "bg-white border-transparent hover:border-slate-200"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 leading-tight truncate">{cfg.label}</p>
                    <p className="text-lg font-bold text-slate-800">{count}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Actions + Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Filter className="w-4 h-4" /> Bộ lọc
              </span>

              {/* Status */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="open">Đang mở</option>
                <option value="resolved">Đã giải quyết</option>
                <option value="ignored">Đã bỏ qua</option>
              </select>

              {/* Level */}
              <select
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả mức độ</option>
                <option value="high">Cao</option>
                <option value="medium">Trung bình</option>
                <option value="low">Thấp</option>
              </select>

              {/* Month */}
              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Department */}
              <input
                type="text"
                placeholder="Phòng ban..."
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
              />

              {hasFilter && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Xóa lọc
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <RefreshCcw className="w-4 h-4" /> Làm mới
              </button>
              <button
                onClick={runAnalysis}
                disabled={analysisLoading}
                className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                {analysisLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PlayCircle className="w-4 h-4" />
                )}
                {analysisLoading ? "Đang phân tích..." : "Chạy phân tích"}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mức độ</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Loại cảnh báo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phòng ban</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Khoản mục</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-80">Thông điệp</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tháng</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trạng thái</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <Bell className="w-12 h-12 opacity-30" />
                        <p className="font-medium">Không có cảnh báo nào</p>
                        {hasFilter && (
                          <p className="text-xs">Thử xóa bộ lọc hoặc <button onClick={runAnalysis} className="text-blue-500 hover:underline">chạy phân tích</button></p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  alerts.map(alert => {
                    const lvl = LEVEL_CONFIG[alert.alert_level];
                    const typ = ALERT_TYPE_CONFIG[alert.alert_type];
                    const sts = STATUS_CONFIG[alert.status];
                    const TypeIcon = typ?.icon ?? AlertTriangle;
                    const isOpen = alert.status === "open";
                    return (
                      <tr
                        key={alert.id}
                        className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${
                          isOpen && alert.alert_level === "high" ? "border-l-4 border-l-red-400" :
                          isOpen && alert.alert_level === "medium" ? "border-l-4 border-l-amber-400" :
                          isOpen ? "border-l-4 border-l-yellow-300" : ""
                        }`}
                      >
                        {/* Level */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lvl.dotColor}`} />
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${lvl.badge}`}>
                              {lvl.label}
                            </span>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${typ?.color ?? ""}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typ?.label ?? alert.alert_type}
                          </span>
                        </td>

                        {/* Dept */}
                        <td className="px-4 py-3 text-slate-700 font-medium max-w-[120px] truncate">
                          {alert.department ?? "-"}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">
                          {alert.category ?? "-"}
                        </td>

                        {/* Message */}
                        <td className="px-4 py-3 text-slate-600 max-w-xs">
                          <p className="line-clamp-2 text-xs leading-relaxed">{alert.message}</p>
                        </td>

                        {/* Month */}
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {alert.month ?? "-"}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${sts.badge}`}>
                            {sts.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          {isOpen ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                id={`resolve-${alert.id}`}
                                onClick={() => resolveAlert(alert.id)}
                                title="Đánh dấu đã giải quyết"
                                className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Giải quyết
                              </button>
                              <button
                                id={`ignore-${alert.id}`}
                                onClick={() => ignoreAlert(alert.id)}
                                title="Bỏ qua cảnh báo"
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {alert.resolved_at ? new Date(alert.resolved_at).toLocaleDateString("vi-VN") : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.total > LIMIT && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500">
                Hiển thị {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, meta.total)} / {meta.total} cảnh báo
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed border border-transparent hover:border-slate-200 transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-xs text-slate-600 px-2">Trang {page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed border border-transparent hover:border-slate-200 transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Summary Card Component ────────────────────────────────────────────────────
type ColorKey = "blue" | "red" | "amber" | "yellow" | "green";

const COLOR_MAP: Record<ColorKey, { bg: string; icon: string; text: string; ring: string }> = {
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-600 text-white",   text: "text-blue-700",   ring: "ring-blue-100" },
  red:    { bg: "bg-red-50",    icon: "bg-red-600 text-white",    text: "text-red-700",    ring: "ring-red-100" },
  amber:  { bg: "bg-amber-50",  icon: "bg-amber-500 text-white",  text: "text-amber-700",  ring: "ring-amber-100" },
  yellow: { bg: "bg-yellow-50", icon: "bg-yellow-500 text-white", text: "text-yellow-700", ring: "ring-yellow-100" },
  green:  { bg: "bg-green-50",  icon: "bg-green-600 text-white",  text: "text-green-700",  ring: "ring-green-100" },
};

function SummaryCard({
  label, value, icon: Icon, loading, color, pulse,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  loading?: boolean;
  color: ColorKey;
  pulse?: boolean;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`${c.bg} rounded-2xl p-4 border border-white shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 font-medium leading-tight mb-1">{label}</p>
          {loading ? (
            <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mt-1" />
          ) : (
            <p className={`text-3xl font-black ${c.text}`}>{value}</p>
          )}
        </div>
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
          <Icon className="w-5 h-5" />
          {pulse && (
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${c.icon} ring-2 ${c.ring} animate-ping`} />
          )}
        </div>
      </div>
    </div>
  );
}

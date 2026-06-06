"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, PieChart,
  AlertTriangle, AlertCircle, Info, ChevronDown,
  RefreshCw, Upload, Building2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface KPISummary {
  total_revenue:            number;
  total_expense:            number;
  total_budget:             number;
  budget_used:              number;
  budget_remaining:         number;
  budget_usage_percent:     number;
  number_of_alerts:         number;
  top_spending_department:  string | null;
  top_over_budget_category: string | null;
}
interface MonthlyItem   { month: string; revenue: number; expense: number; }
interface DeptItem      { department: string; expense: number; }
interface OverBudgetItem {
  transaction_id: string; month: string | null;
  department: string;     category: string;
  budget_amount: number;  actual_amount: number;
  variance_amount: number; variance_percent: number;
  status: string;
}
interface AlertItem {
  id:             number;
  transaction_id: number;
  alert_type:     string;
  alert_level:    string;
  message:        string;
  status:         string;
  created_at:     string;
  resolved_by:    number | null;
  resolved_at:    string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = [
  { value: "2024-01", label: "Tháng 01/2024" },
  { value: "2024-02", label: "Tháng 02/2024" },
  { value: "2024-03", label: "Tháng 03/2024" },
  { value: "2024-04", label: "Tháng 04/2024" },
  { value: "2024-05", label: "Tháng 05/2024" },
  { value: "2024-06", label: "Tháng 06/2024" },
];
const DEPARTMENTS = [
  { value: "Faculty of Medicine", label: "Khoa Y" },
  { value: "Faculty of Engineering", label: "Khoa Kỹ thuật" },
  { value: "Faculty of Business", label: "Khoa Kinh doanh" },
  { value: "Admissions Office", label: "Phòng Tuyển sinh" },
  { value: "Student Affairs", label: "Phòng Công tác Sinh viên" },
  { value: "Research Office", label: "Phòng Nghiên cứu" },
];

// ── Formatting ─────────────────────────────────────────────────────────────────
const fmtVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
};

// ── Token helper ──────────────────────────────────────────────────────────────
async function getToken() {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem("financeai_token");
  if (t) return t;
  // Fallback: auto-login với manager account
  const r = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "manager@example.com", password: "password123" }),
  });
  if (!r.ok) return "";
  const d = await r.json();
  localStorage.setItem("financeai_token", d.access_token);
  return d.access_token;
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // Token hết hạn → xóa và thử lại với token mới
    localStorage.removeItem("financeai_token");
    const newToken = await getToken();
    const retry = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (!retry.ok) throw new Error(`API error ${retry.status}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Alert helpers ─────────────────────────────────────────────────────────────
const alertIcon = (level: string) =>
  level === "critical" ? <AlertCircle  className="w-4 h-4 text-red-500 flex-shrink-0" /> :
  level === "warning"  ? <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" /> :
                         <Info          className="w-4 h-4 text-blue-500 flex-shrink-0" />;
const alertBg = (l: string) =>
  l === "critical" ? "bg-red-50 border-red-200" :
  l === "warning"  ? "bg-yellow-50 border-yellow-200" :
                     "bg-blue-50 border-blue-200";

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────
interface KPIProps {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; bg: string; border: string;
  loading?: boolean;
}
function KPICard({ label, value, sub, icon: Icon, color, bg, border, loading }: KPIProps) {
  return (
    <div className={`bg-white rounded-2xl p-4 border ${border} shadow-sm`}>
      <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      {loading ? (
        <><Skeleton className="h-7 w-24 mb-1" /><Skeleton className="h-3 w-16" /></>
      ) : (
        <>
          <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          <p className="text-xs text-slate-500 mt-1">{label}</p>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Select
// ─────────────────────────────────────────────────────────────────────────────
function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-36"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Upload className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">Chưa có Dữ liệu Tài chính</h3>
      <p className="text-slate-400 text-sm mb-5">Tải lên tệp CSV hoặc Excel để xem dữ liệu dashboard của bạn.</p>
      <Link href="/upload"
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors">
        <Upload className="w-4 h-4" />Đi tới Tải lên
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Page
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [month,  setMonth]  = useState("");
  const [dept,   setDept]   = useState("");

  const [kpi,       setKpi]       = useState<KPISummary | null>(null);
  const [monthly,   setMonthly]   = useState<MonthlyItem[]>([]);
  const [deptExp,   setDeptExp]   = useState<DeptItem[]>([]);
  const [overBudget,setOverBudget]= useState<OverBudgetItem[]>([]);
  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");

    const buildQs = (extra: Record<string, string | number> = {}) => {
      const p = new URLSearchParams();
      if (month) p.set("month", month);
      if (dept)  p.set("department", dept);
      for (const [k, v] of Object.entries(extra)) {
        p.set(k, String(v));
      }
      const s = p.toString();
      return s ? `?${s}` : "";
    };

    try {
      const [k, m, d, o, a] = await Promise.all([
        apiFetch<KPISummary>       (`/dashboard/summary${buildQs()}`),
        apiFetch<MonthlyItem[]>    (`/dashboard/monthly-trend${buildQs()}`),
        apiFetch<DeptItem[]>       (`/dashboard/department-expense${buildQs()}`),
        apiFetch<OverBudgetItem[]> (`/dashboard/over-budget${buildQs({ limit: 50 })}`),
        apiFetch<{ data: AlertItem[] }>(`/alerts${buildQs({ status: "open", limit: 20 })}`),
      ]);
      setKpi(k);
      setMonthly(m);
      setDeptExp(d);
      setOverBudget(o);
      setAlerts(a.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Dashboard] Fetch error:", msg);
      setError(`Không tải được dữ liệu dashboard. Chi tiết: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [month, dept]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isEmpty = !loading && !error && kpi && kpi.total_expense === 0 && kpi.total_revenue === 0;

  // ── KPI config ──────────────────────────────────────────────────────────────
  const kpis: KPIProps[] = kpi ? [
    { label:"Tổng Doanh thu",     value: fmtVND(kpi.total_revenue),        sub: fmtShort(kpi.total_revenue),       icon:TrendingUp,   color:"text-emerald-600", bg:"bg-emerald-50", border:"border-emerald-200" },
    { label:"Tổng Chi phí",       value: fmtVND(kpi.total_expense),        sub: fmtShort(kpi.total_expense),       icon:TrendingDown, color:"text-red-600",     bg:"bg-red-50",     border:"border-red-200"    },
    { label:"Tổng Ngân sách",      value: fmtVND(kpi.total_budget),         sub: fmtShort(kpi.total_budget),        icon:DollarSign,   color:"text-blue-600",    bg:"bg-blue-50",    border:"border-blue-200"   },
    { label:"Ngân sách Còn lại",   value: fmtVND(kpi.budget_remaining),     sub: `Đã dùng: ${kpi.budget_usage_percent.toFixed(1)}%`, icon:PieChart, color: kpi.budget_remaining < 0 ? "text-red-600" : "text-cyan-600", bg: kpi.budget_remaining < 0 ? "bg-red-50" : "bg-cyan-50", border: kpi.budget_remaining < 0 ? "border-red-200" : "border-cyan-200" },
    { label:"Cảnh báo Mở",        value: String(kpi.number_of_alerts),     sub: "cần chú ý",                       icon:AlertTriangle,color:"text-orange-600",  bg:"bg-orange-50",  border:"border-orange-200" },
    { label:"Phòng chi tiêu nhiều nhất", value: kpi.top_spending_department ?? "—", sub:"chi phí cao nhất",          icon:Building2,    color:"text-violet-600",  bg:"bg-violet-50",  border:"border-violet-200" },
  ] : [];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <Header title="Dashboard Tài chính" />
      <div className="p-6 space-y-6">

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">Không tải được dữ liệu</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("financeai_token");
                localStorage.removeItem("token");
                fetchAll();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />Xóa cache &amp; thử lại
            </button>
            <button onClick={fetchAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors">
              <RefreshCw className="w-3 h-3" />Thử lại
            </button>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {isEmpty && <EmptyState />}

        {!isEmpty && !error && (
          <>
            {/* ── Filters ────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
              <FilterSelect value={month} onChange={setMonth} options={MONTHS} placeholder="Tất cả các tháng" />
              <FilterSelect value={dept}  onChange={setDept}  options={DEPARTMENTS} placeholder="Tất cả các phòng ban" />
              {(month || dept) && (
                <button onClick={() => { setMonth(""); setDept(""); }}
                  className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                  Xóa bộ lọc
                </button>
              )}
              <button onClick={fetchAll} disabled={loading}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Làm mới
              </button>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {loading
                ? Array.from({length:6}).map((_,i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                      <Skeleton className="h-9 w-9 rounded-xl mb-3" />
                      <Skeleton className="h-6 w-20 mb-1" /><Skeleton className="h-3 w-14" />
                    </div>
                  ))
                : kpis.map(k => <KPICard key={k.label} {...k} />)
              }
            </div>

            {/* ── Budget usage progress ─────────────────────────────────────── */}
            {kpi && !loading && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Tình hình Sử dụng Ngân sách</p>
                  <span className={`text-sm font-bold ${kpi.budget_usage_percent > 100 ? "text-red-600" : "text-blue-600"}`}>
                    {kpi.budget_usage_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ${
                      kpi.budget_usage_percent > 100 ? "bg-red-500" :
                      kpi.budget_usage_percent > 85  ? "bg-orange-400" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(kpi.budget_usage_percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                  <span>0</span>
                  <span>Ngân sách: {fmtShort(kpi.total_budget)}</span>
                </div>
              </div>
            )}

            {/* ── Charts row ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Monthly trend */}
              <div className="xl:col-span-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-700 mb-1">Doanh thu vs Chi phí (Hàng tháng)</h3>
                <p className="text-xs text-slate-400 mb-4">Định dạng bằng VND</p>
                {loading ? <Skeleton className="h-64" /> : monthly.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu xu hướng</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={monthly} margin={{ left: 10 }}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                      <Tooltip formatter={(v: any) => fmtVND(Number(v))} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#10b981" fill="url(#rev)" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Area type="monotone" dataKey="expense" name="Chi phí" stroke="#ef4444" fill="url(#exp)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Dept expense */}
              <div className="xl:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-700 mb-1">Chi phí theo Phòng ban</h3>
                <p className="text-xs text-slate-400 mb-4">Tổng chi phí thực tế</p>
                {loading ? <Skeleton className="h-64" /> : deptExp.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={deptExp.map(d => ({ ...d, dept: d.department.replace("Faculty of ", "Khoa ").replace("Admissions Office", "Phòng Tuyển sinh").replace("Student Affairs", "Phòng Công tác SV").replace("Research Office", "Phòng Nghiên cứu") }))}
                      layout="vertical" margin={{ left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmtShort(v)} />
                      <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} width={72} />
                      <Tooltip formatter={(v: any) => fmtVND(Number(v))} labelFormatter={(l: any) => `Phòng ban: ${l}`} />
                      <Bar dataKey="expense" name="Chi phí" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── Bottom row ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Over budget table */}
              <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-700">Giao dịch Vượt Ngân sách</h3>
                    <p className="text-xs text-slate-400 mt-0.5">chi phí thực tế &gt; ngân sách</p>
                  </div>
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                    {overBudget.length} giao dịch
                  </span>
                </div>
                {loading ? (
                  <div className="p-5 space-y-3">
                    {Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-8 w-full"/>)}
                  </div>
                ) : overBudget.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    ✅ Không có giao dịch vượt ngân sách nào
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Tháng","Phòng ban","Khoản mục","Ngân sách","Thực tế","Chênh lệch"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overBudget.slice(0, 10).map(r => (
                          <tr key={r.transaction_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{r.month}</td>
                            <td className="px-4 py-2.5 text-slate-700 text-xs">{r.department.replace("Faculty of ","Khoa ").replace("Admissions Office", "Phòng Tuyển sinh").replace("Student Affairs", "Phòng Công tác SV").replace("Research Office", "Phòng Nghiên cứu")}</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{r.category}</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs text-right">{fmtShort(r.budget_amount)}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-800 text-xs text-right">{fmtShort(r.actual_amount)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                r.status === "unusual" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                              }`}>
                                +{r.variance_percent.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {overBudget.length > 10 && (
                      <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
                        Hiển thị 10 trên tổng số {overBudget.length} giao dịch vượt ngân sách
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Alerts panel */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-700">Cảnh báo Bất thường</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Cảnh báo chưa giải quyết từ DB</p>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                  {loading ? (
                    Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-16"/>)
                  ) : alerts.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">Không có cảnh báo</div>
                  ) : (
                    alerts.slice(0, 8).map((a) => {
                      return (
                        <div key={a.id} className={`flex gap-3 p-3 rounded-xl border ${alertBg(a.alert_level)}`}>
                          {alertIcon(a.alert_level)}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-700 leading-snug font-medium">
                              {a.message}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(a.created_at).toLocaleDateString("vi-VN")} · Cấp độ: {a.alert_level === "critical" ? "Nghiêm trọng" : a.alert_level === "warning" ? "Cảnh báo" : "Thông tin"}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {kpi && kpi.number_of_alerts > 8 && (
                  <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
                    +{kpi.number_of_alerts - 8} cảnh báo khác · {kpi.number_of_alerts} tổng số cảnh báo mở
                  </div>
                )}
              </div>
            </div>

            {/* ── Top insights row ───────────────────────────────────────────── */}
            {kpi && !loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
                  <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Phòng ban chi tiêu nhiều nhất</p>
                  <p className="text-2xl font-bold">{kpi.top_spending_department ?? "—"}</p>
                  <p className="text-blue-200 text-xs mt-1">Chi phí thực tế cao nhất trong kỳ</p>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
                  <p className="text-orange-100 text-xs font-semibold uppercase tracking-wider mb-1">Khoản mục vượt ngân sách nhiều nhất</p>
                  <p className="text-2xl font-bold">{kpi.top_over_budget_category ?? "—"}</p>
                  <p className="text-orange-100 text-xs mt-1">Danh mục có tần suất vượt ngân sách cao nhất</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

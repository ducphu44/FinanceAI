"use client";
import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { reportsList, reportContent } from "@/lib/mockData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  FileText, Download, RefreshCw, Check, X, Copy, ChevronDown,
  Clock, CheckCircle, FileEdit, AlertCircle, Printer, Send, TrendingUp, TrendingDown, DollarSign, LayoutDashboard, Eye
} from "lucide-react";

interface ReportTypeItem {
  id: string | number;
  title: string;
  period: string;
  type: string;
  status: string;
  createdBy: string;
  approvedBy: string;
  content: string;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  reviewed: "bg-blue-100 text-blue-700",
  draft:    "bg-slate-100 text-slate-600",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  approved: <CheckCircle className="w-3 h-3"/>,
  reviewed: <Clock className="w-3 h-3"/>,
  draft:    <FileEdit className="w-3 h-3"/>,
};

const PERIODS  = ["All Periods", "2024-01", "2024-02", "2024-03", "2024-Q1"];
const TYPES    = ["All Types", "monthly", "quarterly", "annual"];

const fmtVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

// Helper function to parse markdown report into structured data
function parseReportContent(content: string) {
  const result = {
    total_revenue: 0,
    total_expense: 0,
    total_budget: 0,
    usage_percent: 0,
    summary_text: "",
    trends_text: "",
    over_budget_items: [] as Array<{ name: string; department: string; category: string; actual: number; budget: number; variance: number }>
  };

  if (!content) return result;

  // Extract revenue
  const revMatch = content.match(/(?:Tổng doanh thu|Tổng thu):?\s*\*\*?([0-9.,]+)\*\*?/i);
  if (revMatch) result.total_revenue = parseFloat(revMatch[1].replace(/,/g, ''));

  // Extract expense
  const expMatch = content.match(/(?:Tổng chi phí|Tổng chi):?\s*\*\*?([0-9.,]+)\*\*?/i);
  if (expMatch) result.total_expense = parseFloat(expMatch[1].replace(/,/g, ''));

  // Extract budget
  const bgtMatch = content.match(/Tổng ngân sách:?\s*\*\*?([0-9.,]+)\*\*?/i);
  if (bgtMatch) result.total_budget = parseFloat(bgtMatch[1].replace(/,/g, ''));

  // Extract usage percent
  const useMatch = content.match(/(?:Tỷ lệ sử dụng ngân sách|Tỉ lệ sử dụng):?\s*\*\*?([0-9.,]+)%?\*\*?/i);
  if (useMatch) result.usage_percent = parseFloat(useMatch[1]);

  // Extract Summary Text (everything under # Tóm tắt tình hình tài chính until the next heading)
  const summaryBlock = content.match(/# Tóm tắt tình hình tài chính\s*([\s\S]*?)(?=\n#|$)/);
  if (summaryBlock) result.summary_text = summaryBlock[1].trim();

  // Extract Trends Text
  const trendsBlock = content.match(/# Nhận xét về xu hướng thu chi\s*([\s\S]*?)(?=\n#|$)/);
  if (trendsBlock) result.trends_text = trendsBlock[1].trim();

  // Extract over budget items
  const lines = content.split("\n");
  lines.forEach(line => {
    if (line.includes("Thực tế") && line.includes("Ngân sách") && line.includes("Vượt")) {
      const deptCatMatch = line.match(/-\s*\*\*([^(]+)\(([^)]+)\)\*\*/);
      const valuesMatch = line.match(/(?:Thực tế|actual)\s*([0-9.,]+)/i);
      const budgetMatch = line.match(/(?:Ngân sách|budget)\s*([0-9.,]+)/i);
      const varMatch = line.match(/(?:Vượt|variance|variance_percent)\s*\*\*?([0-9.,+-]+)%?\*\*?/i);

      if (deptCatMatch && valuesMatch && budgetMatch) {
        const dept = deptCatMatch[1].trim().replace("Faculty of ", "Khoa ").replace("Admissions Office", "Phòng Tuyển sinh").replace("Student Affairs", "Phòng Công tác SV").replace("Research Office", "Phòng Nghiên cứu");
        const cat = deptCatMatch[2].trim();
        result.over_budget_items.push({
          name: `${dept} (${cat})`,
          department: dept,
          category: cat,
          actual: parseFloat(valuesMatch[1].replace(/,/g, '')),
          budget: parseFloat(budgetMatch[1].replace(/,/g, '')),
          variance: varMatch ? parseFloat(varMatch[1].replace(/[%+]/g, '')) : 0
        });
      }
    }
  });

  return result;
}

export default function ReportsPage() {
  const [period,   setPeriod]   = useState("All Periods");
  const [type,     setType]     = useState("All Types");
  const [reports,  setReports]  = useState<ReportTypeItem[]>([]);
  const [selected, setSelected] = useState<ReportTypeItem | null>(null);
  const [copied,   setCopied]   = useState(false);
  const [generating, setGen]    = useState(false);
  const [loading, setLoading]   = useState(false);
  const [viewTab,  setViewTab]  = useState<"visual" | "document">("visual");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("financeai_token") || localStorage.getItem("token") || "";
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/reports`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.data && resData.data.length > 0) {
          const formatted = resData.data.map((r: any) => ({
            id: r.id,
            title: r.report_title,
            period: r.report_period,
            type: r.report_type,
            status: r.status,
            createdBy: r.created_by ? `User ${r.created_by}` : "AI Assistant",
            approvedBy: r.approved_by ? `User ${r.approved_by}` : "-",
            content: r.content
          }));
          setReports(formatted);
          setSelected(prev => {
            if (prev) {
              const updated = formatted.find((f: any) => f.id === prev.id);
              if (updated) return updated;
            }
            return formatted[0];
          });
        } else {
          const fallback = reportsList.map(r => ({ ...r, content: reportContent }));
          setReports(fallback);
          setSelected(fallback[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      const fallback = reportsList.map(r => ({ ...r, content: reportContent }));
      setReports(fallback);
      setSelected(fallback[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerate = async () => {
    setGen(true);
    try {
      const token = localStorage.getItem("financeai_token") || localStorage.getItem("token") || "";
      const p = period === "All Periods" ? "2024-Q1" : period;
      const t = type === "All Types" ? "monthly" : type;
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/ai/generate-report`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ period: p, report_type: t, departments: [] })
      });
      
      if (!response.ok) throw new Error("API error");
      const data = await response.json();
      
      const newReport = {
        id: data.id,
        title: data.report_title,
        period: data.report_period,
        type: data.report_type,
        status: data.status,
        createdBy: "AI Assistant",
        approvedBy: "-",
        content: data.content
      };
      
      setReports(prev => [newReport, ...prev]);
      setSelected(newReport);
      alert("Tạo báo cáo nháp và lưu vào hệ thống thành công!");
    } catch (error) {
      console.error("Failed to generate report:", error);
      alert("Không thể tạo báo cáo. Vui lòng thử lại sau.");
    } finally {
      setGen(false);
    }
  };

  const handleCopy = () => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.content || "").then(()=>{
      setCopied(true); setTimeout(()=>setCopied(false),2000);
    });
  };

  const handleDownloadMarkdown = () => {
    if (!selected) return;
    const element = document.createElement("a");
    const file = new Blob([selected.content || ""], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `${selected.title.replace(/\s+/g, "_")}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportPDF = () => {
    if (!selected) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const parsedData = parseReportContent(selected.content);

    printWindow.document.write(`
      <html>
        <head>
          <title>${selected.title}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #334155; line-height: 1.6; }
            h1 { font-size: 24px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 20px; }
            h2 { font-size: 18px; color: #1e293b; margin-top: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
            .kpis { display: flex; gap: 15px; margin: 20px 0; }
            .kpi-card { flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
            .kpi-val { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 5px; }
            .progress-bar { width: 100%; bg: #e2e8f0; height: 10px; border-radius: 5px; background: #e2e8f0; margin: 15px 0; overflow: hidden; }
            .progress-fill { height: 100%; background: #3b82f6; width: ${Math.min(parsedData.usage_percent, 100)}%; }
            p { font-size: 14px; margin-bottom: 12px; }
            li { font-size: 14px; margin-left: 20px; margin-bottom: 6px; }
            .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
            .warning { background-color: #fef3c7; border: 1px solid #fde68a; padding: 12px; border-radius: 8px; color: #92400e; margin-top: 24px; font-size: 14px; }
            .item-list { margin-top: 15px; }
            .item-row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 6px 0; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>${selected.title}</h1>
          <div class="meta">Kỳ báo cáo: ${selected.period} | Loại: ${selected.type} | Trạng thái: ${selected.status.toUpperCase()}</div>
          
          <div class="kpis">
            <div class="kpi-card">
              <div style="font-size: 11px; color: #64748b;">Tổng Doanh thu</div>
              <div class="kpi-val">${fmtVND(parsedData.total_revenue)}</div>
            </div>
            <div class="kpi-card">
              <div style="font-size: 11px; color: #64748b;">Tổng Chi phí</div>
              <div class="kpi-val" style="color: #ef4444;">${fmtVND(parsedData.total_expense)}</div>
            </div>
            <div class="kpi-card">
              <div style="font-size: 11px; color: #64748b;">Ngân sách</div>
              <div class="kpi-val" style="color: #3b82f6;">${fmtVND(parsedData.total_budget)}</div>
            </div>
          </div>

          <div style="font-size: 13px; font-weight: bold; margin-top: 15px;">
            Tỉ lệ sử dụng ngân sách: ${parsedData.usage_percent}%
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(parsedData.usage_percent, 100)}%; background: ${parsedData.usage_percent > 100 ? '#ef4444' : parsedData.usage_percent > 85 ? '#f59e0b' : '#3b82f6'}"></div>
          </div>

          <h2>Tóm tắt tình hình tài chính</h2>
          <p>${parsedData.summary_text || 'Chưa có thông tin.'}</p>

          <h2>Nhận xét về xu hướng thu chi</h2>
          <p>${parsedData.trends_text || 'Chưa có thông tin.'}</p>

          <h2>Các khoản vượt ngân sách nghiêm trọng</h2>
          <div class="item-list">
            ${parsedData.over_budget_items.map(item => `
              <div class="item-row">
                <span><strong>${item.department}</strong> - ${item.category}</span>
                <span>Thực tế: ${fmtVND(item.actual)} / Ngân sách: ${fmtVND(item.budget)} (<span style="color: #ef4444; font-weight: bold;">+${item.variance}%</span>)</span>
              </div>
            `).join('')}
          </div>

          <div>
            ${selected.content?.split("\n").map((line: string) => {
              if (line.startsWith("# ") || line.startsWith("## ") || line.includes("Tổng doanh thu") || line.includes("Tổng chi phí") || line.includes("Tổng ngân sách") || line.includes("Tỷ lệ sử dụng")) return "";
              if (line.includes("Thực tế") && line.includes("Ngân sách") && line.includes("Vượt")) return "";
              if (line.includes("_Báo cáo do AI hỗ trợ") || line.includes("Báo cáo này được tạo bởi AI")) {
                return `<div class="warning">${line.replace(/[_*]/g, "")}</div>`;
              }
              return line ? `<p>${line}</p>` : `<br/>`;
            }).join("")}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSubmitReview = async () => {
    if (!selected) return;
    try {
      const token = localStorage.getItem("financeai_token") || localStorage.getItem("token") || "";
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/reports/${selected.id}/submit`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("API error");
      
      alert("Đã gửi báo cáo cho trưởng phòng phê duyệt!");
      fetchReports();
    } catch (err) {
      console.error(err);
      alert("Không thể gửi duyệt báo cáo.");
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    try {
      const token = localStorage.getItem("financeai_token") || localStorage.getItem("token") || "";
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/reports/${selected.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ comment: "Phê duyệt báo cáo" })
      });
      if (!response.ok) throw new Error("API error");
      
      alert("Đã phê duyệt báo cáo thành công!");
      fetchReports();
    } catch (err) {
      console.error(err);
      alert("Không thể phê duyệt báo cáo.");
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      const token = localStorage.getItem("financeai_token") || localStorage.getItem("token") || "";
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/reports/${selected.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ comment: "Từ chối báo cáo" })
      });
      if (!response.ok) throw new Error("API error");
      
      alert("Đã từ chối báo cáo và chuyển lại về trạng thái nháp!");
      fetchReports();
    } catch (err) {
      console.error(err);
      alert("Không thể từ chối báo cáo.");
    }
  };

  const filtered = reports.filter(r=>{
    if (period !== "All Periods" && r.period !== period) return false;
    if (type   !== "All Types"   && r.type   !== type  ) return false;
    return true;
  });

  const parsedData = selected ? parseReportContent(selected.content) : null;

  return (
    <div>
      <Header title="Reports" />
      <div className="p-6 space-y-6">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {[{v:period,s:setPeriod,o:PERIODS},{v:type,s:setType,o:TYPES}].map((f,i)=>(
            <div key={i} className="relative">
              <select value={f.v} onChange={e=>f.s(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                {f.o.map(o=><option key={o}>{o}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            </div>
          ))}
          <button onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm transition-colors shadow-sm cursor-pointer">
            {generating
              ? <><RefreshCw className="w-4 h-4 animate-spin"/>Generating…</>
              : <><FileText className="w-4 h-4"/>Generate Report</>}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Report list */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[750px]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-slate-700">Report List</h3>
                <p className="text-xs text-slate-400 mt-0.5">{filtered.length} reports</p>
              </div>
              {loading && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filtered.map(r=>(
                <button key={r.id} onClick={()=>setSelected(r)}
                  className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer ${selected?.id===r.id?"bg-blue-50 border-l-2 border-blue-500":""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{r.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{r.period} · {r.createdBy}</p>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_STYLES[r.status]}`}>
                      {STATUS_ICONS[r.status]}{r.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Report content */}
          {selected && parsedData && (
            <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[750px]">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-slate-800">{selected.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Created by {selected.createdBy}
                    {selected.approvedBy !== "-" && ` · Approved by ${selected.approvedBy}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[selected.status]}`}>
                    {STATUS_ICONS[selected.status]}{selected.status}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center flex-shrink-0">
                {selected.status === "draft" && (
                  <button onClick={handleSubmitReview}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                    <Send className="w-3.5 h-3.5"/>Submit for Review
                  </button>
                )}
                {selected.status === "reviewed" && (
                  <>
                    <button onClick={handleApprove}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                      <Check className="w-3.5 h-3.5"/>Approve
                    </button>
                    <button onClick={handleReject}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5"/>Reject
                    </button>
                  </>
                )}
                
                {/* Visual View vs Document View Toggle */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                  <button onClick={() => setViewTab("visual")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${viewTab === "visual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    <LayoutDashboard className="w-3.5 h-3.5"/>Dashboard
                  </button>
                  <button onClick={() => setViewTab("document")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${viewTab === "document" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    <Eye className="w-3.5 h-3.5"/>Document
                  </button>
                </div>

                <button onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer ml-auto">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600"/>Copied!</> : <><Copy className="w-3.5 h-3.5"/>Copy</>}
                </button>
                <button onClick={handleDownloadMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                  <Download className="w-3.5 h-3.5"/>Download .MD
                </button>
                <button onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                  <Printer className="w-3.5 h-3.5"/>Export PDF
                </button>
              </div>

              {/* View Content Area */}
              <div className="p-5 overflow-y-auto flex-1 bg-slate-50">
                {viewTab === "visual" ? (
                  <div className="space-y-6">
                    {/* KPI Widget Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600"/>
                        </div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Tổng Doanh thu</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{fmtVND(parsedData.total_revenue)}</p>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center mb-2">
                          <TrendingDown className="w-4 h-4 text-red-600"/>
                        </div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Tổng Chi phí</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{fmtVND(parsedData.total_expense)}</p>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                          <DollarSign className="w-4 h-4 text-blue-600"/>
                        </div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Tổng Ngân sách</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{fmtVND(parsedData.total_budget)}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500 font-semibold uppercase">Tình hình Sử dụng Ngân sách</p>
                        <span className={`text-sm font-bold ${parsedData.usage_percent > 100 ? "text-red-600" : "text-blue-600"}`}>
                          {parsedData.usage_percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-700 ${
                            parsedData.usage_percent > 100 ? "bg-red-500" :
                            parsedData.usage_percent > 85  ? "bg-orange-400" : "bg-blue-500"
                          }`}
                          style={{ width: `${Math.min(parsedData.usage_percent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Bar Chart of Over Budget Departments */}
                    {parsedData.over_budget_items.length > 0 && (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="text-xs text-slate-500 font-semibold uppercase mb-3">Biểu đồ Vượt Ngân sách (Chi tiết thực tế vs Dự toán)</h4>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={parsedData.over_budget_items} margin={{ left: -10, right: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="department" tick={{ fontSize: 9 }} />
                              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                              <Tooltip formatter={(v: any) => fmtVND(Number(v))} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar dataKey="actual" name="Thực tế" fill="#ef4444" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="budget" name="Ngân sách" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* AI Short Summary & Comments */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 border-b pb-1">Tóm tắt tình hình tài chính</h4>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{parsedData.summary_text || 'Chưa có thông tin.'}</p>
                      </div>

                      {parsedData.trends_text && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 border-b pb-1">Nhận xét về xu hướng thu chi</h4>
                          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{parsedData.trends_text}</p>
                        </div>
                      )}
                    </div>

                    {/* Warnings (Over budget items list) */}
                    {parsedData.over_budget_items.length > 0 && (
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <h4 className="text-sm font-semibold text-slate-800 border-b pb-1">Các khoản vượt ngân sách nghiêm trọng</h4>
                        <div className="space-y-2.5">
                          {parsedData.over_budget_items.map((item, idx) => (
                            <div key={idx} className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs">
                              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-bold text-red-800">{item.department} ({item.category})</p>
                                <p className="text-red-700 mt-0.5">
                                  Tiêu dùng thực tế: **{fmtVND(item.actual)}** / Hạn mức ngân sách: **{fmtVND(item.budget)}** (Vượt **+{item.variance}%**)
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Disclaimer */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-xs">
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <p className="font-medium text-amber-800 m-0 leading-relaxed">
                        Báo cáo này được tạo bởi AI trợ lý ảo và cần được người phụ trách kiểm chứng trước khi sử dụng chính thức.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Standard Document View */
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="prose prose-sm max-w-none text-slate-700">
                      {selected.content?.split("\n").map((line: string,i: number)=>{
                        if (line.startsWith("# "))  return <h1  key={i} className="text-xl font-bold text-slate-900 mb-3">{line.slice(2)}</h1>;
                        if (line.startsWith("## ")) return <h2  key={i} className="text-base font-semibold text-slate-800 mt-4 mb-2">{line.slice(3)}</h2>;
                        if (line.startsWith("- "))  return <li  key={i} className="ml-4 text-sm text-slate-600 list-disc">{line.slice(2)}</li>;
                        if (line.startsWith("|"))   return <p   key={i} className="font-mono text-xs text-slate-500">{line}</p>;
                        
                        if (line.includes("_Báo cáo do AI hỗ trợ") || line.includes("Báo cáo này được tạo bởi AI") || line.includes("Ghi chú kiểm chứng")) {
                          return (
                            <div key={i} className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                              <p className="text-sm font-medium text-amber-800 m-0">
                                {line.replace(/[_*#]/g, "")}
                              </p>
                            </div>
                          );
                        }
                        
                        return line ? <p key={i} className="text-sm text-slate-600 mb-1">{line}</p> : <br key={i}/>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

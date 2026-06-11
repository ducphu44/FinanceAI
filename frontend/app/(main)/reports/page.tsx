"use client";
import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { reportsList, reportContent } from "@/lib/mockData";
import { FileText, Download, RefreshCw, Check, X, Copy,
         ChevronDown, Clock, CheckCircle, FileEdit, AlertCircle, Printer, Send } from "lucide-react";

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

export default function ReportsPage() {
  const [period,   setPeriod]   = useState("All Periods");
  const [type,     setType]     = useState("All Types");
  const [reports,  setReports]  = useState<ReportTypeItem[]>([]);
  const [selected, setSelected] = useState<ReportTypeItem | null>(null);
  const [copied,   setCopied]   = useState(false);
  const [generating, setGen]    = useState(false);
  const [loading, setLoading]   = useState(false);

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
          // Fallback to mock data if DB is empty
          const fallback = reportsList.map(r => ({ ...r, content: reportContent }));
          setReports(fallback);
          setSelected(fallback[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      // Fallback
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
    printWindow.document.write(`
      <html>
        <head>
          <title>${selected.title}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #334155; line-height: 1.6; }
            h1 { font-size: 24px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 20px; }
            h2 { font-size: 18px; color: #1e293b; margin-top: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
            p { font-size: 14px; margin-bottom: 12px; }
            li { font-size: 14px; margin-left: 20px; margin-bottom: 6px; }
            .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
            .warning { background-color: #fef3c7; border: 1px solid #fde68a; padding: 12px; border-radius: 8px; color: #92400e; margin-top: 24px; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>${selected.title}</h1>
          <div class="meta">Kỳ báo cáo: ${selected.period} | Loại: ${selected.type} | Trạng thái: ${selected.status.toUpperCase()}</div>
          <div>
            ${selected.content?.split("\n").map((line: string) => {
              if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
              if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
              if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
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
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm transition-colors shadow-sm">
            {generating
              ? <><RefreshCw className="w-4 h-4 animate-spin"/>Generating…</>
              : <><FileText className="w-4 h-4"/>Generate Report</>}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Report list */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-700">Report List</h3>
                <p className="text-xs text-slate-400 mt-0.5">{filtered.length} reports</p>
              </div>
              {loading && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.map(r=>(
                <button key={r.id} onClick={()=>setSelected(r)}
                  className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors ${selected?.id===r.id?"bg-blue-50 border-l-2 border-blue-500":""}`}>
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
          {selected && (
            <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{selected.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Created by {selected.createdBy}
                    {selected.approvedBy !== "-" && ` · Approved by ${selected.approvedBy}`}
                  </p>
                </div>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[selected.status]}`}>
                  {STATUS_ICONS[selected.status]}{selected.status}
                </span>
              </div>

              {/* Action buttons */}
              <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
                {selected.status === "draft" && (
                  <button onClick={handleSubmitReview}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors">
                    <Send className="w-3.5 h-3.5"/>Submit for Review
                  </button>
                )}
                {selected.status === "reviewed" && (
                  <>
                    <button onClick={handleApprove}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors">
                      <Check className="w-3.5 h-3.5"/>Approve
                    </button>
                    <button onClick={handleReject}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors">
                      <X className="w-3.5 h-3.5"/>Reject
                    </button>
                  </>
                )}
                <button onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors ml-auto">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600"/>Copied!</> : <><Copy className="w-3.5 h-3.5"/>Copy</>}
                </button>
                <button onClick={handleDownloadMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                  <Download className="w-3.5 h-3.5"/>Download .MD
                </button>
                <button onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                  <Printer className="w-3.5 h-3.5"/>Export PDF
                </button>
              </div>

              {/* Markdown content */}
              <div className="p-5 overflow-y-auto max-h-[480px]">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

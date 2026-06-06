"use client";
import { useState } from "react";
import Header from "@/components/layout/Header";
import { reportsList, reportContent } from "@/lib/mockData";
import { FileText, Download, RefreshCw, Check, X, Copy,
         Edit, ChevronDown, Clock, CheckCircle, FileEdit, AlertCircle } from "lucide-react";

const STATUS_STYLES: Record<string,string> = {
  approved: "bg-emerald-100 text-emerald-700",
  reviewed: "bg-blue-100 text-blue-700",
  draft:    "bg-slate-100 text-slate-600",
};
const STATUS_ICONS: Record<string,React.ReactNode> = {
  approved: <CheckCircle className="w-3 h-3"/>,
  reviewed: <Clock className="w-3 h-3"/>,
  draft:    <FileEdit className="w-3 h-3"/>,
};

const PERIODS  = ["All Periods","2024-01","2024-02","2024-03","2024-Q1"];
const TYPES    = ["All Types","monthly","quarterly","annual"];

export default function ReportsPage() {
  const [period,   setPeriod]   = useState("All Periods");
  const [type,     setType]     = useState("All Types");
  const [reports,  setReports]  = useState(reportsList.map(r => ({...r, content: reportContent})));
  const [selected, setSelected] = useState(reports[3] || reports[0]);
  const [copied,   setCopied]   = useState(false);
  const [generating, setGen]    = useState(false);

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
        id: data.id || Date.now().toString(),
        title: data.report_title,
        period: data.report_period,
        type: data.report_type,
        status: data.status,
        createdBy: "AI Assistant",
        approvedBy: "-",
        content: data.content
      };
      
      setReports([newReport, ...reports]);
      setSelected(newReport);
    } catch (error) {
      console.error("Failed to generate report:", error);
      alert("Không thể tạo báo cáo. Vui lòng thử lại sau.");
    } finally {
      setGen(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selected.content || "").then(()=>{
      setCopied(true); setTimeout(()=>setCopied(false),2000);
    });
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
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Report List</h3>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} reports</p>
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.map(r=>(
                <button key={r.id} onClick={()=>setSelected(r)}
                  className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors ${selected.id===r.id?"bg-blue-50 border-l-2 border-blue-500":""}`}>
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
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors">
                  <Edit className="w-3.5 h-3.5"/>Edit
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors">
                  <Check className="w-3.5 h-3.5"/>Approve
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors">
                  <X className="w-3.5 h-3.5"/>Reject
                </button>
                <button onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors ml-auto">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600"/>Copied!</> : <><Copy className="w-3.5 h-3.5"/>Copy</>}
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                  <Download className="w-3.5 h-3.5"/>Export
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
                    
                    if (line.includes("_Báo cáo do AI hỗ trợ")) {
                      return (
                        <div key={i} className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                          <p className="text-sm font-medium text-amber-800 m-0">
                            Báo cáo do AI hỗ trợ, cần kiểm tra trước khi sử dụng chính thức.
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

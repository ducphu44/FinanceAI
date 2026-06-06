"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import {
  UploadCloud, FileSpreadsheet, CheckCircle, XCircle,
  AlertCircle, X, AlertTriangle, LayoutDashboard,
  RefreshCw, Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PreviewRow {
  transaction_id:   string;
  date:             string;
  month:            string;
  department:       string;
  category:         string;
  transaction_type: string;
  budget_amount:    number;
  actual_amount:    number;
  variance_amount:  number;
  variance_percent: number;
  row_status:       "normal" | "over_budget" | "unusual";
}

interface UploadResult {
  file_id:          number;
  file_name:        string;
  total_rows:       number;
  valid_rows:       number;
  skipped_rows:     number;
  number_of_alerts: number;
  preview_rows:     PreviewRow[];
  message:          string;
}

interface UploadError {
  error:            string;
  message:          string;
  missing_columns?: string[];
  required_columns?: string[];
  found_columns?:   string[];
  allowed?:         string[];
}

type UploadState = "idle" | "uploading" | "success" | "error";

// ── Constants ─────────────────────────────────────────────────────────────────
const REQUIRED_COLS = [
  "date","month","department","category",
  "transaction_type","budget_amount","actual_amount","description",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Demo token (staff@example.com) – in production replace with auth context
const DEMO_TOKEN_KEY = "financeai_token";

async function getToken(): Promise<string> {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(DEMO_TOKEN_KEY);
  if (stored) return stored;

  // Auto-login with demo credentials
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "staff@example.com", password: "password123" }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  localStorage.setItem(DEMO_TOKEN_KEY, data.access_token);
  return data.access_token;
}

// ── Status badge helpers ──────────────────────────────────────────────────────
const STATUS_STYLE = {
  normal:     "bg-emerald-100 text-emerald-700",
  over_budget:"bg-red-100 text-red-700",
  unusual:    "bg-orange-100 text-orange-700",
};
const STATUS_LABEL = {
  normal:     "Normal",
  over_budget:"Over Budget",
  unusual:    "Unusual",
};

// ─────────────────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const [state,      setState]   = useState<UploadState>("idle");
  const [fileName,   setFileName] = useState("");
  const [dragging,   setDragging] = useState(false);
  const [uploading,  setUploading]= useState(false);
  const [result,     setResult]  = useState<UploadResult | null>(null);
  const [error,      setError]   = useState<UploadError | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File picked (local validation only) ────────────────────────────────────
  const handleFileSelect = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      setError({
        error:   "unsupported_file_type",
        message: `File type '.${ext}' is not supported.`,
        allowed: [".csv", ".xlsx", ".xls"],
      });
      setState("error");
      return;
    }
    setFileName(file.name);
    setSelectedFile(file);
    setError(null);
    setState("idle"); // wait for user to click Upload
  };

  // ── Send to backend ────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setState("uploading");
    setError(null);
    setResult(null);

    try {
      const token = await getToken();
      const form  = new FormData();
      form.append("file", selectedFile);

      const res = await fetch(`${API_BASE}/files/upload`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });

      const data = await res.json();

      if (!res.ok) {
        // Backend error (422, 400, etc.)
        const detail = data.detail || data;
        setError(typeof detail === "string" ? { error: "server_error", message: detail } : detail);
        setState("error");
      } else {
        setResult(data);
        setState("success");
      }
    } catch (err: unknown) {
      setError({
        error:   "network_error",
        message: "Cannot connect to server. Make sure the backend is running on port 8000.",
      });
      setState("error");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setState("idle");
    setFileName("");
    setSelectedFile(null);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <Header title="Upload Financial Data" />
      <div className="p-6 max-w-5xl mx-auto space-y-5">

        {/* ── Drop zone (shown unless success) ─────────────────────────── */}
        {state !== "success" && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
              dragging
                ? "border-blue-500 bg-blue-50"
                : selectedFile
                ? "border-blue-400 bg-blue-50"
                : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
            }`}
          >
            <input
              ref={inputRef} type="file" accept=".csv,.xlsx,.xls" hidden
              onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
            />
            <UploadCloud className={`w-12 h-12 mx-auto mb-4 transition-colors ${
              dragging || selectedFile ? "text-blue-500" : "text-slate-400"
            }`} />

            {selectedFile ? (
              <div>
                <p className="text-blue-700 font-semibold">{selectedFile.name}</p>
                <p className="text-slate-400 text-sm mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Click to change file
                </p>
              </div>
            ) : (
              <div>
                <p className="text-slate-700 font-semibold">
                  Drop your file here, or <span className="text-blue-600">browse</span>
                </p>
                <p className="text-slate-400 text-sm mt-1">Supports CSV and Excel (.xlsx, .xls)</p>
              </div>
            )}

            <div className="flex justify-center gap-2 mt-4">
              {["CSV", "XLSX", "XLS"].map(t => (
                <span key={t} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Upload button ─────────────────────────────────────────────── */}
        {selectedFile && state !== "success" && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm transition-colors shadow-sm"
            >
              {uploading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Uploading & Importing…</>
              ) : (
                <><UploadCloud className="w-4 h-4" />Upload & Import</>
              )}
            </button>
            <button onClick={reset} className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
              Cancel
            </button>
          </div>
        )}

        {/* ── Error panel ───────────────────────────────────────────────── */}
        {state === "error" && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <h3 className="font-semibold text-red-700">
                {error.error === "missing_columns"   ? "Missing Required Columns"   :
                 error.error === "unsupported_file_type" ? "Unsupported File Type"  :
                 error.error === "parse_error"        ? "File Parse Error"          :
                 error.error === "network_error"      ? "Connection Error"          :
                 "Upload Failed"}
              </h3>
            </div>

            <p className="text-sm text-red-600 mb-3">{error.message}</p>

            {/* Missing columns detail */}
            {error.missing_columns && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-semibold text-red-700">Missing columns:</p>
                <div className="flex flex-wrap gap-2">
                  {error.missing_columns.map(c => (
                    <span key={c} className="px-2 py-1 bg-red-100 text-red-700 border border-red-300 rounded font-mono text-xs">{c}</span>
                  ))}
                </div>
                {error.found_columns && (
                  <p className="text-xs text-slate-500 mt-2">
                    Found columns: <span className="font-mono">{error.found_columns.join(", ")}</span>
                  </p>
                )}
              </div>
            )}

            <button onClick={reset}
              className="mt-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors">
              Try Again
            </button>
          </div>
        )}

        {/* ── Success panel ─────────────────────────────────────────────── */}
        {state === "success" && result && (
          <div className="space-y-5">
            {/* Summary card */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-10 h-10 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-emerald-800">Upload Successful!</h3>
                  <p className="text-sm text-emerald-600 mt-0.5 font-mono">{result.file_name}</p>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {[
                      { label: "Total Rows",    value: result.total_rows,       color: "text-slate-800"   },
                      { label: "Imported",      value: result.valid_rows,       color: "text-emerald-700" },
                      { label: "Skipped",       value: result.skipped_rows,     color: "text-slate-500"   },
                      { label: "Alerts Created",value: result.number_of_alerts, color: "text-orange-600"  },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-xl p-3 border border-emerald-200 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Alert warning */}
                  {result.number_of_alerts > 0 && (
                    <div className="flex items-center gap-2 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <p className="text-sm text-orange-700">
                        <span className="font-semibold">{result.number_of_alerts} alert(s)</span> were created for over-budget or unusual transactions.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 mt-5 ml-14">
                <Link href="/dashboard"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition-colors shadow-sm">
                  <LayoutDashboard className="w-4 h-4" />
                  Go to Dashboard
                </Link>
                <button onClick={reset}
                  className="px-5 py-2.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl text-sm font-medium transition-colors">
                  Upload Another File
                </button>
              </div>
            </div>

            {/* Preview table */}
            {result.preview_rows.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-semibold text-slate-700">Data Preview</p>
                    <p className="text-xs text-slate-400 mt-0.5">First {result.preview_rows.length} rows imported</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {["TXN ID","Date","Department","Category","Type","Budget","Actual","Variance","Status"].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.preview_rows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-3 font-mono text-xs text-blue-600 whitespace-nowrap">{r.transaction_id}</td>
                          <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{r.date}</td>
                          <td className="px-3 py-3 text-slate-700 text-xs">{r.department}</td>
                          <td className="px-3 py-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{r.category}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.transaction_type === "expense" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }`}>{r.transaction_type}</span>
                          </td>
                          <td className="px-3 py-3 text-slate-600 text-right">{r.budget_amount.toLocaleString()}</td>
                          <td className="px-3 py-3 font-medium text-slate-800 text-right">{r.actual_amount.toLocaleString()}</td>
                          <td className={`px-3 py-3 text-right text-xs font-semibold ${r.variance_percent > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {r.variance_percent > 0 ? "+" : ""}{r.variance_percent.toFixed(1)}%
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLE[r.row_status]}`}>
                              {STATUS_LABEL[r.row_status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
                  Showing {result.preview_rows.length} of {result.valid_rows} imported rows · File ID: #{result.file_id}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Required columns reference ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-slate-700 text-sm">Required Columns</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {REQUIRED_COLS.map(c => (
              <span key={c} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-mono text-xs">{c}</span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Column <code className="font-mono bg-slate-100 px-1 rounded">transaction_id</code> is optional – auto-generated if absent.
          </p>
        </div>
      </div>
    </div>
  );
}

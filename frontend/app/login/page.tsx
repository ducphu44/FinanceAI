"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Mail, Lock, Eye, EyeOff, ChevronRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEMO_ACCOUNTS = [
  { email:"admin@example.com",   role:"Admin",           color:"bg-purple-100 text-purple-700" },
  { email:"staff@example.com",   role:"Finance Staff",   color:"bg-blue-100 text-blue-700"    },
  { email:"manager@example.com", role:"Finance Manager", color:"bg-green-100 text-green-700"  },
  { email:"leader@example.com",  role:"Leader",          color:"bg-orange-100 text-orange-700"},
];

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("manager@example.com");
  const [password, setPassword] = useState("password123");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Email hoặc mật khẩu không đúng.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      // Lưu token và thông tin user vào localStorage (key chung cho toàn app)
      localStorage.setItem("financeai_token", data.access_token);
      localStorage.setItem("financeai_user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch {
      setError("Không thể kết nối đến server. Hãy kiểm tra backend đang chạy.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/40 mb-4">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">FinanceAI</h1>
          <p className="text-slate-400 mt-1 text-sm">Hệ thống Quản lý Tài chính Đại học</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Đăng nhập</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 mt-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <><span>Đăng nhập</span><ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="mt-6 bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Tài khoản Demo — mật khẩu: <span className="text-white font-mono">password123</span></p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.email}
                onClick={() => setEmail(a.email)}
                className="text-left p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
              >
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${a.color}`}>{a.role}</span>
                <p className="text-slate-400 text-xs group-hover:text-white transition-colors truncate">{a.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

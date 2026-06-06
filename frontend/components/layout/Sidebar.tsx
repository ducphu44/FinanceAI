"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Upload, Bot, FileText, Users,
  TrendingUp, ChevronRight, Bell,
} from "lucide-react";

const navItems = [
  { href:"/dashboard",    label:"Dashboard",       icon:LayoutDashboard },
  { href:"/upload",       label:"Upload Dữ liệu",  icon:Upload          },
  { href:"/alerts",       label:"Cảnh báo",        icon:Bell            },
  { href:"/ai-assistant", label:"Trợ lý AI",       icon:Bot             },
  { href:"/reports",      label:"Báo cáo",         icon:FileText        },
  { href:"/users",        label:"Người dùng",      icon:Users           },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">FinanceAI</p>
          <p className="text-slate-400 text-xs">Management System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-70" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
            NT
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">Nguyễn Thị Lan</p>
            <p className="text-slate-400 text-xs truncate">finance_staff</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

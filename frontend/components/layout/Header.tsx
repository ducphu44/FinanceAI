"use client";
import { Bell, Search, LogOut } from "lucide-react";
import Link from "next/link";

interface HeaderProps { title: string }

export default function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search…"
            className="pl-9 pr-4 py-1.5 text-sm bg-slate-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>

        {/* Notification */}
        <button className="relative w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
          <Bell className="w-4 h-4 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Logout */}
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Logout</span>
        </Link>
      </div>
    </header>
  );
}

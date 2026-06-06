import type { Metadata } from "next";
import Sidebar from "@/components/layout/Sidebar";
import Header  from "@/components/layout/Header";
import ChatbotWidget from "@/components/layout/ChatbotWidget";

export const metadata: Metadata = { title: "FinanceAI" };

const pageTitles: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/upload":       "Upload Financial Data",
  "/ai-assistant": "AI Assistant",
  "/reports":      "Reports",
  "/users":        "User Management",
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="pl-64">
        {/* Header uses client component – title passed from page */}
        <main className="min-h-screen">{children}</main>
      </div>
      <ChatbotWidget />
    </div>
  );
}

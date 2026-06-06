import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanceAI – University Financial Management",
  description: "AI-powered financial management system for universities",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}

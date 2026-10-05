import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BytePx StandupPulse | Google Chat Bot & Executive Workspace",
  description: "Real-time employee project tracking, daily standups, and Google Chat 1:1 Bot engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
          {children}
        </div>
      </body>
    </html>
  );
}

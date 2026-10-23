import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { SessionProvider } from "@/components/studio/session-context";
import { TopBar } from "@/components/studio/top-bar";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quick Gif",
  description: "Turn videos into GIFs — entirely in your browser",
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" className={`${montserrat.variable} h-full antialiased`}>
    <body className="min-h-full flex flex-col bg-background text-foreground">
      <SessionProvider>
        <TopBar />
        <main className="flex-1 px-6 py-4">{children}</main>
      </SessionProvider>
    </body>
  </html>
);

export default RootLayout;

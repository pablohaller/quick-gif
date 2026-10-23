import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import Link from "next/link";
import { BATCH, HOME, OUTPUTS, SETTINGS } from "@/lib/routes";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quick Gif",
  description: "Turn videos into GIFs",
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" className={`${montserrat.variable} h-full antialiased`}>
    <body className="min-h-full flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-current-line px-6 py-4">
        <Link href={HOME} className="text-xl font-bold text-purple">
          Quick Gif
        </Link>
        <nav className="flex items-center gap-4">
          <Link href={HOME} className="text-cyan hover:underline">
            Home
          </Link>
          <Link href={BATCH} className="text-cyan hover:underline">
            Batch
          </Link>
          <Link href={OUTPUTS} className="text-cyan hover:underline">
            Outputs
          </Link>
          <Link href={SETTINGS} className="text-cyan hover:underline">
            Settings
          </Link>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </body>
  </html>
);

export default RootLayout;

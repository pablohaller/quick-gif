"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { HOME, SETTINGS } from "@/lib/routes";
import { useSession } from "@/components/studio/session-context";

export const TopBar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { newGif, confirmLeave } = useSession();

  // On the Studio page, reset in place (with a warning); elsewhere, navigate
  // home where a fresh Studio mounts.
  const onNew = () => {
    if (pathname === HOME) newGif();
    else router.push(HOME);
  };

  return (
    <header className="flex items-center justify-between border-b border-current-line px-6 py-4">
      <Link href={HOME} className="text-xl font-bold text-purple">
        Quick Gif
      </Link>
      <nav className="flex items-center gap-4">
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded bg-purple px-3 py-1.5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Gif
        </button>
        <Link
          href={SETTINGS}
          onClick={(e) => {
            if (pathname === HOME && !confirmLeave()) e.preventDefault();
          }}
          className="text-cyan hover:underline"
        >
          Settings
        </Link>
      </nav>
    </header>
  );
};

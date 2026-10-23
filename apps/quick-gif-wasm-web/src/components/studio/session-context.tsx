"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

// Lets the top bar's "New Gif" button reset the Studio (which lives on the home
// page) and warn before discarding an in-progress edit. Refs keep the context
// value stable so consumers don't re-render on every studio state change.
type Session = {
  setHasVideo: (value: boolean) => void;
  setResetHandler: (fn: () => void) => void;
  newGif: () => void;
  // Returns false if there's a loaded video and the user declines to leave.
  confirmLeave: () => boolean;
};

const SessionContext = createContext<Session | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const hasVideo = useRef(false);
  const reset = useRef<() => void>(() => {});

  // Native warning for reload / tab close / external navigation.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasVideo.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const value = useMemo<Session>(
    () => ({
      setHasVideo: (v) => {
        hasVideo.current = v;
      },
      setResetHandler: (fn) => {
        reset.current = fn;
      },
      newGif: () => {
        if (
          hasVideo.current &&
          !window.confirm("Start a new Gif? Your current progress will be lost.")
        ) {
          return;
        }
        reset.current();
      },
      confirmLeave: () =>
        !hasVideo.current ||
        window.confirm("Leave the editor? Your current progress will be lost."),
    }),
    [],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = (): Session => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
};

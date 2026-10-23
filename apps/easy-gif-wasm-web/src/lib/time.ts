// Port of parse_time from generate_gif.py.
// Accepts MMSS ("0130"), MM:SS ("01:30"), or plain seconds ("90", "90.5").
export const parseTime = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && !trimmed.includes(":")) {
    // Plain integer/float seconds — but MMSS (4 digits, no dot) is handled below.
    if (!/^\d{4}$/.test(trimmed)) return asNumber;
  }

  if (trimmed.includes(":")) {
    const [m, s] = trimmed.split(":");
    const minutes = Number(m);
    const seconds = Number(s);
    if (Number.isInteger(minutes) && Number.isInteger(seconds)) {
      return minutes * 60 + seconds;
    }
  }

  if (/^\d{4}$/.test(trimmed)) {
    const minutes = Number(trimmed.slice(0, 2));
    const seconds = Number(trimmed.slice(2));
    if (seconds < 60) return minutes * 60 + seconds;
  }

  const fallback = Number(trimmed);
  return Number.isNaN(fallback) ? null : fallback;
};

// Format seconds as M:SS.s for timeline display.
export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

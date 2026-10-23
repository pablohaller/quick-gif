// Minimal client helper to POST and read a Server-Sent Events stream.
export const streamSSE = async (
  url: string,
  body: unknown,
  on: {
    progress?: (ratio: number) => void;
    done?: (data: unknown) => void;
    error?: (message: string) => void;
  },
): Promise<void> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new Error("No response stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const block of events) {
      const ev = /event: (.*)/.exec(block)?.[1];
      const data = /data: (.*)/.exec(block)?.[1];
      if (!ev || !data) continue;
      const parsed = JSON.parse(data);
      if (ev === "progress") on.progress?.(parsed.ratio);
      else if (ev === "done") on.done?.(parsed);
      else if (ev === "error") on.error?.(parsed.message ?? "Failed");
    }
  }
};

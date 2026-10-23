"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Editor } from "@/components/edit/editor";
import { fetchSettings, type Settings } from "@/lib/settings";
import type { SourceKind, VideoMeta } from "@/lib/types";

const Page = () => {
  const routeParams = useParams<{ name: string }>();
  const search = useSearchParams();
  const name = decodeURIComponent(routeParams.name);
  const source = (search.get("source") as SourceKind) ?? "watch";

  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings().then(setSettings).catch(() => setError("Could not load settings"));
    const url = `/api/probe?name=${encodeURIComponent(name)}&source=${source}`;
    fetch(url)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) setError(body.error ?? "Could not read video");
        else setMeta(body.data as VideoMeta);
      })
      .catch(() => setError("Could not read video"));
  }, [name, source]);

  if (error) return <p className="mx-auto max-w-6xl text-sm text-red">{error}</p>;
  if (!meta || !settings)
    return <p className="mx-auto max-w-6xl text-sm text-comment">Loading…</p>;
  return <Editor meta={meta} name={name} source={source} settings={settings} />;
};

export default Page;

"use client";

import { useEffect, useState } from "react";
import { Button } from "@quick-gif/ui/button";
import { Modal } from "@/components/ui/modal";
import { API_BROWSE } from "@/lib/routes";

type Entry = { name: string; path: string };
type Listing = { path: string; parent: string | null; entries: Entry[] };

type Props = {
  open: boolean;
  initialPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
};

export const DirectoryPicker = ({
  open,
  initialPath,
  onSelect,
  onClose,
}: Props) => {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (target?: string) => {
    setLoading(true);
    const url = target
      ? `${API_BROWSE}?path=${encodeURIComponent(target)}`
      : API_BROWSE;
    try {
      const res = await fetch(url);
      setListing(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load(initialPath);
    // Re-fetch only when the picker (re)opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Select a folder">
      <div className="flex flex-col gap-3">
        <p className="truncate rounded border border-comment bg-background px-3 py-2 text-sm text-cyan">
          {listing?.path ?? "…"}
        </p>
        <div className="h-64 overflow-y-auto rounded border border-current-line bg-background">
          {listing?.parent ? (
            <button
              className="block w-full px-3 py-2 text-left text-sm text-comment hover:bg-current-line"
              onClick={() => load(listing.parent ?? undefined)}
            >
              ../
            </button>
          ) : null}
          {listing?.entries.map((entry) => (
            <button
              key={entry.path}
              className="block w-full truncate px-3 py-2 text-left text-sm text-foreground hover:bg-current-line"
              onClick={() => load(entry.path)}
            >
              📁 {entry.name}
            </button>
          ))}
          {listing && !listing.parent && !listing.entries.length ? (
            <p className="px-3 py-2 text-sm text-comment">No subfolders.</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => listing && onSelect(listing.path)}
            disabled={!listing || loading}
          >
            Select this folder
          </Button>
        </div>
      </div>
    </Modal>
  );
};

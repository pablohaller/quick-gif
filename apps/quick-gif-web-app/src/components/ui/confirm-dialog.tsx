"use client";

import type { ReactNode } from "react";
import { Button } from "@quick-gif/ui/button";
import { Modal } from "@/components/ui/modal";

type Props = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  onConfirm,
  onCancel,
}: Props) => (
  <Modal open={open} onClose={busy ? () => {} : onCancel} title={title}>
    <div className="flex flex-col gap-4">
      <div className="text-sm text-foreground">{message}</div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Deleting…" : confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);

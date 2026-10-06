"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
export function ActionDialog({ title, children, confirm, onConfirm, onClose }: {
  title: string; children: ReactNode; confirm: string; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const target = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); if (target?.isConnected) target.focus(); };
  }, []);
  return <dialog className="editor action-dialog" ref={ref} aria-labelledby="action-title" onCancel={(event) => {
    if (busy) event.preventDefault(); else onClose();
  }}>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError("");
      try { await onConfirm(); onClose(); } catch (error) {
        setError(error instanceof Error ? error.message : "Please try again.");
      } finally { setBusy(false); }
    }}>
      <h2 id="action-title">{title}</h2>
      {children}
      {error && <p role="alert">{error}</p>}
      <div className="row"><button type="button" disabled={busy} onClick={onClose}>Cancel</button>
        <button className="primary" disabled={busy}>{busy ? "Saving…" : confirm}</button></div>
    </form>
  </dialog>;
}

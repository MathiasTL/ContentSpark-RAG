"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";

interface ChatListItemProps {
  id: string;
  title: string | null;
  updatedAt: string;
  isActive: boolean;
  collapsed: boolean;
  isStreaming: boolean;
  onDelete: (id: string) => Promise<void>;
  /** Se invoca al navegar a este chat (usado por el drawer mobile para autocerrarse). */
  onNavigate?: () => void;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute));
    return `hace ${mins}m`;
  }
  if (diffMs < day) {
    return `hace ${Math.floor(diffMs / hour)}h`;
  }
  if (diffMs < 2 * day) {
    return "ayer";
  }
  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

export default function ChatListItem({
  id,
  title,
  updatedAt,
  isActive,
  collapsed,
  isStreaming,
  onDelete,
  onNavigate,
}: ChatListItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const displayTitle = title?.trim() || "Sin titulo";

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(id);
    } catch {
      setIsDeleting(false);
      setConfirming(false);
    }
  }

  if (collapsed) {
    return (
      <Link
        href={`/chat/${id}`}
        title={displayTitle}
        onClick={onNavigate}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          isActive
            ? "bg-primary/15 text-primary"
            : "bg-surface-container-lowest/10 text-on-surface-variant hover:bg-surface-container-lowest/30 hover:text-primary"
        }`}
      >
        {displayTitle.charAt(0).toUpperCase()}
        {isStreaming && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-green-400 ring-2 ring-surface" />
        )}
      </Link>
    );
  }

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-2xl px-3 py-2 transition-colors ${
        isActive
          ? "bg-primary/10"
          : "hover:bg-surface-container-lowest/30"
      }`}
    >
      <Link href={`/chat/${id}`} className="flex-1 min-w-0" onClick={onNavigate}>
        <div className="flex items-start justify-between gap-2">
          <span
            className={`block truncate text-sm ${
              isActive ? "font-semibold text-primary" : "font-light text-on-surface"
            }`}
          >
            {displayTitle}
          </span>
          {isStreaming && (
            <span
              aria-label="Streameando"
              className="ml-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400"
            />
          )}
          <span className="shrink-0 text-[10px] text-on-surface-variant/70">
            {formatRelative(updatedAt)}
          </span>
        </div>
      </Link>

      {confirming ? (
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-500 hover:bg-red-500/30 disabled:opacity-50"
          >
            {isDeleting ? "..." : "Si"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isDeleting}
            className="rounded-full bg-surface-container-lowest/30 px-2 py-0.5 text-on-surface-variant hover:bg-surface-container-lowest/50"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Borrar chat"
          onClick={() => setConfirming(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2
            size={14}
            strokeWidth={1.5}
            className="text-on-surface-variant hover:text-red-500"
          />
        </button>
      )}
    </div>
  );
}

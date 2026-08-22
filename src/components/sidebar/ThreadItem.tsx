"use client";

import { useEffect, useRef, useState } from "react";
import type { Thread } from "@/db/schema";

interface Props {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (threadId: string) => void;
  onRename: (threadId: string, newTitle: string) => void;
}

export function ThreadItem({ thread, isActive, onSelect, onDelete, onRename }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [value, setValue] = useState(thread.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [isEditing]);

  const submitRename = () => {
    const title = value.trim();
    if (title && title !== thread.title) onRename(thread.id, title);
    else setValue(thread.title);
    setIsEditing(false);
  };

  return (
    <div className={`group mb-1 flex min-h-11 items-center rounded-xl px-1 transition ${isActive ? "bg-accent/10 text-accent-strong" : "text-muted hover:bg-surface-soft hover:text-foreground"}`}>
      {isEditing ? (
        <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} onBlur={submitRename} onKeyDown={(event) => { if (event.key === "Enter") submitRename(); if (event.key === "Escape") { setValue(thread.title); setIsEditing(false); } }} className="min-w-0 flex-1 rounded-lg border border-accent/40 bg-surface px-2 py-1.5 text-sm text-foreground outline-none" aria-label="نام گفتگو" />
      ) : (
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate px-2 py-2 text-right text-sm font-medium">{thread.title}</button>
      )}
      {!isEditing && (
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
          {confirmDelete ? <><button type="button" onClick={() => onDelete(thread.id)} className="rounded-md px-1.5 py-1 text-[11px] text-red-500 hover:bg-red-500/10">حذف</button><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-1.5 py-1 text-[11px] hover:bg-surface">لغو</button></> : <><button type="button" onClick={() => setIsEditing(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-xs hover:bg-surface" aria-label="تغییر نام">✎</button><button type="button" onClick={() => setConfirmDelete(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-xs hover:bg-red-500/10 hover:text-red-500" aria-label="حذف گفتگو">×</button></>}
        </div>
      )}
    </div>
  );
}

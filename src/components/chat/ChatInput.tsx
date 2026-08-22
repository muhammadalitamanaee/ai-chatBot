"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

interface Props { onSend: (message: string) => void; onStop: () => void; isLoading: boolean }

export function ChatInput({ onSend, onStop, isLoading }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const send = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="border-t border-border bg-background/95 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-[0_12px_40px_rgba(15,45,30,0.08)] focus-within:border-accent/60">
        <textarea ref={textareaRef} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKeyDown} placeholder="سؤالت دربارهٔ لیارا را بنویس…" rows={1} disabled={isLoading} aria-label="پیام" className="min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-60" />
        {isLoading ? (
          <button type="button" onClick={onStop} className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-foreground transition hover:bg-surface-soft active:scale-[.98]" aria-label="توقف پاسخ">توقف</button>
        ) : (
          <button type="button" onClick={send} disabled={!value.trim()} className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-white transition hover:bg-accent-strong active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40" aria-label="ارسال پیام">ارسال</button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">Enter برای ارسال، Shift + Enter برای خط جدید</p>
    </div>
  );
}

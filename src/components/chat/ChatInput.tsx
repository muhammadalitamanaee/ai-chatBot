"use client";

import { useState, useRef, type KeyboardEvent, useEffect } from "react";

interface Props {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, onStop, isLoading }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-32 border-t border-neutral-200 bg-white dark:bg-neutral-700 px-4 py-4">
      <div className="max-w-3xl mx-auto flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={isLoading}
          className="flex-1 text-black dark:text-white resize-none rounded-xl border border-neutral-300 dark:border-amber-700 px-4 py-3 text-sm outline-none focus:border-neutral-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: "48px", maxHeight: "280px" }}
        />

        {isLoading ? (
          <button
            onClick={onStop}
            className="px-4 py-3 rounded-xl border border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors flex-shrink-0"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            className="px-4 py-3 rounded-xl bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            Send
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-400 text-center mt-2">
        Shift+Enter for newline
      </p>
    </div>
  );
}

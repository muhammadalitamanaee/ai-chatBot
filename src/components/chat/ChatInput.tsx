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
    <div className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-4">
      <div className="max-w-3xl mx-auto flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          disabled={isLoading}
          className="
            flex-1 resize-none rounded-xl px-4 py-3 text-sm
            outline-none transition-all duration-200
            min-h-[48px]

            /* Light mode */
            bg-neutral-50
            text-neutral-900
            placeholder-neutral-400
            border border-neutral-200
            focus:border-neutral-400
            focus:bg-white

            /* Dark mode */
            dark:bg-neutral-700
            dark:text-neutral-100
            dark:placeholder-neutral-500
            dark:border-neutral-600
            dark:focus:border-neutral-400
            dark:focus:bg-neutral-600

            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{ maxHeight: "200px" }}
        />

        {isLoading ? (
          <button
            onClick={onStop}
            className="
              px-4 py-3 rounded-xl text-sm flex-shrink-0
              border border-neutral-200 dark:border-neutral-600
              text-neutral-600 dark:text-neutral-300
              hover:bg-neutral-100 dark:hover:bg-neutral-700
              transition-colors
            "
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            className="
              px-4 py-3 rounded-xl text-sm font-medium flex-shrink-0
              bg-neutral-800 dark:bg-neutral-200
              text-white dark:text-neutral-900
              hover:bg-neutral-700 dark:hover:bg-neutral-300
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors
            "
          >
            Send
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-2">
        Shift+Enter for newline
      </p>
    </div>
  );
}

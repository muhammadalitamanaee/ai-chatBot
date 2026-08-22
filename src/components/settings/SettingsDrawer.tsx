"use client";

import { useState, useEffect, useRef } from "react";
import { MODELS } from "@/lib/providers";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: Props) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("openai/gpt-oss-20b:free");
  const [answerDepth, setAnswerDepth] = useState<"beginner" | "professional">(
    "beginner",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Load settings when drawer opens
  useEffect(() => {
    if (!isOpen) return;

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSystemPrompt(data.systemPrompt ?? "");
        setSelectedModel(data.model ?? "openai/gpt-oss-20b:free");
        setAnswerDepth(
          data.answerDepth === "professional" ? "professional" : "beginner",
        );
      })
      .catch(console.error);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          model: selectedModel,
          answerDepth,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`
          fixed top-0 right-0 h-full w-full sm:w-96 z-50
          bg-white dark:bg-neutral-800
          border-l border-neutral-200 dark:border-neutral-700
          shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="font-semibold text-neutral-800 dark:text-neutral-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            {/* X icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Model selector */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
              Model
            </label>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
              Choose which AI model responds to your messages
            </p>

            <div className="space-y-2">
              {MODELS.map((group) => (
                <div key={group.group}>
                  {/* Group label */}
                  <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5 mt-3">
                    {group.group}
                  </p>

                  {group.models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`
                        w-full text-left px-4 py-3 rounded-xl border transition-all mb-1.5
                        ${
                          selectedModel === model.id
                            ? "border-neutral-800 dark:border-neutral-300 bg-neutral-50 dark:bg-neutral-700"
                            : "border-neutral-200 dark:border-neutral-600 hover:border-neutral-300 dark:hover:border-neutral-500"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                          {model.label}
                        </span>
                        {selectedModel === model.id && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            ✓ Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {model.description}
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Answer depth */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
              Answer depth
            </label>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
              How detailed should the assistant answers be?
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAnswerDepth("beginner")}
                className={`
                  px-4 py-3 rounded-xl border text-left transition-all
                  ${
                    answerDepth === "beginner"
                      ? "border-neutral-800 dark:border-neutral-300 bg-neutral-50 dark:bg-neutral-700"
                      : "border-neutral-200 dark:border-neutral-600 hover:border-neutral-300 dark:hover:border-neutral-500"
                  }
                `}
              >
                <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">
                  مبتدی
                </span>
                <span className="block text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                  گام‌به‌گام و ساده
                </span>
              </button>

              <button
                onClick={() => setAnswerDepth("professional")}
                className={`
                  px-4 py-3 rounded-xl border text-left transition-all
                  ${
                    answerDepth === "professional"
                      ? "border-neutral-800 dark:border-neutral-300 bg-neutral-50 dark:bg-neutral-700"
                      : "border-neutral-200 dark:border-neutral-600 hover:border-neutral-300 dark:hover:border-neutral-500"
                  }
                `}
              >
                <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">
                  حرفه‌ای
                </span>
                <span className="block text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                  فنی و دقیق
                </span>
              </button>
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
              System prompt
            </label>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
              Give the AI a personality or set of instructions. Leave empty for
              default behavior.
            </p>

            {/* Preset prompts */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                {
                  label: "Concise",
                  prompt:
                    "Be concise. Answer in as few words as possible without losing meaning.",
                },
                {
                  label: "Coding assistant",
                  prompt:
                    "You are an expert programming assistant. Focus on clean, well-commented code. Always explain your reasoning.",
                },
                {
                  label: "Persian",
                  prompt:
                    "Always respond in Persian (Farsi), no matter what language the user writes in.",
                },
                {
                  label: "Formal",
                  prompt:
                    "Respond in a formal, professional tone at all times.",
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setSystemPrompt(preset.prompt)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
              {systemPrompt && (
                <button
                  onClick={() => setSystemPrompt("")}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are a helpful assistant that always responds in Persian..."
              rows={5}
              className="
                w-full resize-none rounded-xl px-4 py-3 text-sm
                outline-none transition-all duration-200
                bg-neutral-50 dark:bg-neutral-700
                text-neutral-900 dark:text-neutral-100
                placeholder-neutral-400 dark:placeholder-neutral-500
                border border-neutral-200 dark:border-neutral-600
                focus:border-neutral-400 dark:focus:border-neutral-400
                focus:bg-white dark:focus:bg-neutral-600
              "
            />
          </div>
        </div>

        {/* Footer — save button */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="
              w-full py-3 rounded-xl text-sm font-medium transition-colors
              bg-neutral-800 dark:bg-neutral-100
              text-white dark:text-neutral-900
              hover:bg-neutral-700 dark:hover:bg-white
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isSaving ? "Saving..." : saved ? "✓ Saved" : "Save settings"}
          </button>
        </div>
      </div>
    </>
  );
}

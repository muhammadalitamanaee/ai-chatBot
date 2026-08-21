"use client";

// Vertical list of agent tool steps (searching / reading docs). Shown
// under an assistant reply so the agentic loop is not a black box.
const ICONS: Record<string, string> = {
  search_docs: "🔍",
  get_doc: "📖",
  list_docs: "🗂️",
  ask_user: "❓",
};

export function AgentSteps({ steps }: { steps?: string[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div dir="rtl" className="mt-3 mb-1 space-y-1">
      <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-1">
        مراحل انجام‌شده
      </p>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-2.5 space-y-1">
        {steps.map((step, i) => {
          const tool = step.split("(")[0];
          const icon = ICONS[tool] ?? "•";
          return (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300"
            >
              <span className="shrink-0">{icon}</span>
              <code
                dir="ltr"
                className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400"
              >
                {step}
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

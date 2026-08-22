"use client";

const LABELS: Record<string, string> = {
  search_docs: "جست‌وجو در مستندات",
  get_doc: "خواندن راهنمای مرتبط",
  list_docs: "بررسی بخش‌های مستندات",
  ask_user: "نیاز به توضیح بیشتر",
};

function stepLabel(step: string) {
  const match = /^(\w+)\((.*)\)$/.exec(step);
  const tool = match?.[1] ?? step;
  const detail = match?.[2]?.trim();
  const label = LABELS[tool] ?? "بررسی منبع";
  return detail ? `${label}: ${detail}` : label;
}

export function AgentSteps({ steps, live = false }: { steps?: string[]; live?: boolean }) {
  if (!steps?.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-soft/70 p-3" aria-live="polite">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
        <span className={live ? "h-1.5 w-1.5 animate-pulse rounded-full bg-accent" : "h-1.5 w-1.5 rounded-full bg-accent"} />
        {live ? "در حال بررسی" : "مراحل بررسی‌شده"}
      </div>
      <div className="space-y-1.5">
        {steps.map((step, index) => (
          <div key={`${step}-${index}`} className="flex items-start gap-2 text-xs text-foreground/75">
            <span className="mt-0.5 text-accent">✓</span>
            <span className="min-w-0 break-words">{stepLabel(step)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

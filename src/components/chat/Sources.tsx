"use client";

// Numbered source links (docs.liara.ir) cited by the assistant answer.
export interface Source {
  title: string;
  url: string;
}

export function Sources({ sources }: { sources?: Source[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div dir="rtl" className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-2.5">
      <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-1.5">
        منابع
      </p>
      <div className="space-y-1.5">
        {sources.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span className="shrink-0 rounded bg-blue-600/10 text-blue-700 dark:text-blue-400 px-1.5 font-mono text-[10px] leading-4">
              {i + 1}
            </span>
            <span className="break-all">{s.title || s.url}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

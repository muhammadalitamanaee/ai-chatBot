"use client";

export interface Source { title: string; url: string }
const fa = new Intl.NumberFormat("fa-IR");

export function Sources({ sources }: { sources?: Source[] }) {
  if (!sources?.length) return null;
  return (
    <details className="group mt-4 rounded-xl border border-border bg-surface-soft/70 p-3" open>
      <summary className="cursor-pointer list-none text-xs font-medium text-muted marker:hidden">منابع پاسخ <span className="mr-1 text-accent">{fa.format(sources.length)}</span></summary>
      <div className="mt-3 grid gap-2">
        {sources.map((source, index) => (
          <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-foreground/80 transition hover:bg-surface hover:text-accent-strong">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-accent/10 px-1 font-mono text-[10px] text-accent-strong">{fa.format(index + 1)}</span>
            <span className="min-w-0 flex-1 truncate">{source.title || source.url}</span>
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </details>
  );
}

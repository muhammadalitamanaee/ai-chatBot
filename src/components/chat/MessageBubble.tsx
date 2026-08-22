"use client";

import ReactMarkdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";
import type { Message } from "@/types/index";
import remarkGfm from "remark-gfm";
import { AgentSteps } from "./AgentSteps";
import { Sources } from "./Sources";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";

for (const [name, language] of Object.entries({ bash, sh: bash, shell: bash, javascript, js: javascript, typescript, ts: typescript, json, yaml, yml: yaml, python, sql })) {
  SyntaxHighlighter.registerLanguage(name, language);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }} className="rounded-md px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/10 hover:text-white" aria-label="کپی کد">
      {copied ? "کپی شد" : "کپی"}
    </button>
  );
}

function WorkingState({ message }: { message: Message }) {
  return (
    <div className="min-w-56 py-1" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="flex gap-1" aria-hidden="true">
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
        </span>
        {message.status ?? "در حال آماده‌کردن پاسخ…"}
      </div>
      <AgentSteps steps={message.metadata?.steps} live />
    </div>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const waiting = !isUser && message.isStreaming && !message.content;

  return (
    <article className={`mb-7 flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`} aria-busy={message.isStreaming}>
      {!isUser && <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white shadow-sm">ل</div>}
      <div className={`max-w-[88%] rounded-2xl px-4 py-3.5 text-sm leading-7 md:max-w-[78%] ${isUser ? "rounded-bl-md bg-foreground text-background" : "rounded-br-md border border-border bg-surface text-foreground shadow-[0_8px_30px_rgba(15,45,30,0.05)]"}`}>
        {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : waiting ? <WorkingState message={message} /> : (
          <>
            <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeString = String(children).replace(/\n$/, "");
                  if (!match || message.isStreaming) return <code dir="ltr" className={className} {...props}>{children}</code>;
                  return <div dir="ltr" className="my-4 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"><div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5"><span className="font-mono text-[11px] text-zinc-400">{match[1]}</span><CopyButton text={codeString} /></div><SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" customStyle={{ margin: 0, borderRadius: 0, fontSize: "13px", padding: "16px", background: "#09090b" }}>{codeString}</SyntaxHighlighter></div>;
                },
                a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-strong underline decoration-accent/40 underline-offset-4">{children}</a>; },
                table({ children }) { return <div dir="ltr" className="my-4 overflow-x-auto rounded-xl border border-border"><table className="min-w-full text-xs">{children}</table></div>; },
                th({ children }) { return <th className="border-b border-border bg-surface-soft px-3 py-2 text-left font-medium">{children}</th>; },
                td({ children }) { return <td className="border-b border-border px-3 py-2">{children}</td>; },
              }}>{message.content}</ReactMarkdown>
            </div>
            {message.isStreaming && <span className="mr-1 inline-block h-4 w-0.5 animate-pulse bg-accent" />}
            <AgentSteps steps={message.metadata?.steps} live={message.isStreaming} />
            {!message.isStreaming && <Sources sources={message.metadata?.sources} />}
          </>
        )}
      </div>
    </article>
  );
}

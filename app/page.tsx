"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThreadItem } from "@/components/sidebar/ThreadItem";
import { ThreadSkeleton } from "@/components/sidebar/ThreadSkeleton";
import { UserPanel } from "@/components/sidebar/UserPanel";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import type { Thread } from "@/db/schema";

const examples = [
  "چطور یک اپ Next.js روی لیارا مستقر کنم؟",
  "اتصال PostgreSQL به Node.js را توضیح بده",
  "خطای دامنه و DNS را چطور رفع کنم؟",
];
const fa = new Intl.NumberFormat("fa-IR");

export default function Home() {
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, isLoadingHistory, error, sendMessage, stopStreaming } = useChat(activeThread?.id ?? "");

  useEffect(() => {
    fetch("/api/threads").then((response) => response.json()).then((data) => setThreads(data)).catch(() => undefined).finally(() => setIsLoadingThreads(false));
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: isLoading ? "smooth" : "auto" }); }, [messages, isLoading]);

  const selectThread = (thread: Thread) => { setActiveThread(thread); setIsSidebarOpen(false); };
  const newChat = async () => {
    const response = await fetch("/api/threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "گفت‌وگوی جدید" }) });
    const thread: Thread = await response.json();
    setThreads((current) => [thread, ...current]);
    setActiveThread(thread);
    setIsSidebarOpen(false);
  };
  const deleteThread = async (threadId: string) => {
    await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    if (activeThread?.id === threadId) setActiveThread(null);
  };
  const renameThread = async (threadId: string, title: string) => {
    setThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, title } : thread));
    if (activeThread?.id === threadId) setActiveThread((current) => current ? { ...current, title } : null);
    await fetch(`/api/threads/${threadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
  };
  const send = async (content: string) => {
    const first = messages.length === 0;
    await sendMessage(content);
    if (first && activeThread) {
      const response = await fetch("/api/threads");
      const all: Thread[] = await response.json();
      const updated = all.find((thread) => thread.id === activeThread.id);
      if (updated) { setThreads((current) => current.map((thread) => thread.id === updated.id ? updated : thread)); setActiveThread(updated); }
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {isSidebarOpen && <button type="button" aria-label="بستن فهرست گفتگوها" className="fixed inset-0 z-30 bg-black/45 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside aria-label="گفتگوها" className={`fixed inset-y-0 right-0 z-40 flex w-[min(86vw,310px)] flex-col border-l border-border bg-surface transition-transform duration-200 md:relative md:w-72 md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="border-b border-border p-4">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="font-bold">کوپایلوت لیارا</p><p className="mt-0.5 text-xs text-muted">راهنمای هوشمند مستندات</p></div>
            <button type="button" onClick={() => setIsSidebarOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-soft md:hidden" aria-label="بستن">×</button>
          </div>
          <button type="button" onClick={newChat} className="flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-bold text-white transition hover:bg-accent-strong active:scale-[.98]">گفت‌وگوی جدید +</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingThreads ? <><ThreadSkeleton /><ThreadSkeleton /><ThreadSkeleton /></> : threads.length === 0 ? <p className="px-4 py-8 text-center text-xs text-muted">هنوز گفت‌وگویی نداری.</p> : threads.map((thread) => <ThreadItem key={thread.id} thread={thread} isActive={activeThread?.id === thread.id} onSelect={() => selectThread(thread)} onDelete={deleteThread} onRename={renameThread} />)}
        </div>
        <UserPanel />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-3 backdrop-blur md:px-6">
          <button type="button" onClick={() => setIsSidebarOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-muted hover:bg-surface-soft md:hidden" aria-label="بازکردن گفتگوها">☰</button>
          <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-bold">{activeThread?.title ?? "کوپایلوت مستندات لیارا"}</h1>{activeThread && <p className="mt-0.5 text-[11px] text-muted">{fa.format(messages.filter((message) => message.content).length)} پیام</p>}</div>
          <span className="hidden rounded-lg bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent-strong sm:block">پاسخ مستند و منبع‌دار</span>
          <button type="button" onClick={() => setIsSettingsOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-soft" aria-label="تنظیمات">⚙</button>
        </header>

        <main className="flex-1 overflow-y-auto px-3 py-6 md:px-6">
          <div className="mx-auto max-w-3xl">
            {!activeThread ? (
              <section className="mx-auto flex min-h-[68dvh] max-w-xl flex-col justify-center py-8 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-black text-white shadow-lg shadow-emerald-900/10">ل</div>
                <h2 className="text-2xl font-black tracking-tight md:text-3xl">وسط کار با لیارا گیر کردی؟</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">سؤالت را بپرس. پاسخ را از مستندات رسمی پیدا می‌کنم، مراحل را توضیح می‌دهم و منبع دقیق را نشان می‌دهم.</p>
                <button type="button" onClick={newChat} className="mx-auto mt-7 h-11 rounded-xl bg-accent px-6 text-sm font-bold text-white hover:bg-accent-strong">شروع گفتگو</button>
              </section>
            ) : isLoadingHistory ? (
              <div className="space-y-5 py-5" aria-label="در حال بارگذاری گفتگو"><div className="h-20 w-2/3 animate-pulse rounded-2xl bg-surface-soft" /><div className="mr-auto h-32 w-4/5 animate-pulse rounded-2xl bg-surface-soft" /></div>
            ) : messages.length === 0 ? (
              <section className="py-10 md:py-16"><p className="text-xs font-bold text-accent-strong">از مستندات رسمی لیارا</p><h2 className="mt-2 text-2xl font-black">چه کاری می‌خواهی انجام بدهی؟</h2><p className="mt-2 text-sm text-muted">یکی از نمونه‌ها را انتخاب کن یا سؤال خودت را بنویس.</p><div className="mt-6 grid gap-2 sm:grid-cols-2">{examples.map((example) => <button key={example} type="button" onClick={() => void send(example)} className="rounded-xl border border-border bg-surface p-3 text-right text-sm leading-6 transition hover:border-accent/50 hover:bg-surface-soft">{example}</button>)}</div></section>
            ) : messages.map((message) => <MessageBubble key={message.id} message={message} />)}
            {error && <div role="alert" className="my-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>}
            <div ref={bottomRef} />
          </div>
        </main>
        {activeThread && <ChatInput onSend={send} onStop={stopStreaming} isLoading={isLoading} />}
      </div>
      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

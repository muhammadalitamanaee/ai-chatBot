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

export default function Home() {
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    stopStreaming,
  } = useChat(activeThread?.id ?? "");

  useEffect(() => {
    fetch("/api/threads")
      .then((r) => r.json())
      .then((data) => {
        setThreads(data);
        setIsLoadingThreads(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close sidebar when route changes on mobile
  const handleThreadSelect = (thread: Thread) => {
    setActiveThread(thread);
    setIsSidebarOpen(false); // close sidebar after selecting on mobile
  };

  const handleNewChat = async () => {
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New conversation" }),
    });
    const thread: Thread = await res.json();
    setThreads((prev) => [thread, ...prev]);
    setActiveThread(thread);
    setIsSidebarOpen(false); // close sidebar after creating on mobile
  };

  const handleDelete = async (threadId: string) => {
    await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (activeThread?.id === threadId) setActiveThread(null);
  };

  const handleRename = async (threadId: string, newTitle: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t)),
    );
    if (activeThread?.id === threadId) {
      setActiveThread((prev) => (prev ? { ...prev, title: newTitle } : null));
    }
    await fetch(`/api/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
  };

  const refreshThreadTitle = async (threadId: string) => {
    const res = await fetch("/api/threads");
    const allThreads: Thread[] = await res.json();
    const updated = allThreads.find((t) => t.id === threadId);
    if (updated) {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)));
      setActiveThread(updated);
    }
  };

  const handleSendMessage = async (content: string) => {
    const isFirstMessage = messages.length === 0;
    await sendMessage(content);
    if (isFirstMessage && activeThread) {
      setTimeout(() => refreshThreadTitle(activeThread.id), 1000);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
      {/* Mobile backdrop — only visible when sidebar is open on mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed md:relative inset-y-0 left-0 z-40
        w-72 md:w-64
        bg-white dark:bg-neutral-800
        border-r border-neutral-200 dark:border-neutral-700
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-3">
          <button
            onClick={handleNewChat}
            className="flex-1 py-2 px-4 rounded-xl bg-neutral-800 dark:bg-neutral-600 text-white text-sm font-medium hover:bg-neutral-700 dark:hover:bg-neutral-500 transition-colors"
          >
            + New chat
          </button>

          {/* Close button — mobile only */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
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

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingThreads ? (
            <>
              <ThreadSkeleton />
              <ThreadSkeleton />
              <ThreadSkeleton />
            </>
          ) : threads.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center mt-4">
              No conversations yet
            </p>
          ) : (
            threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                isActive={activeThread?.id === thread.id}
                onSelect={() => handleThreadSelect(thread)}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))
          )}
        </div>

        <UserPanel />
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 w-full">
        {/* Header */}
        <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-4 md:px-6 py-4 flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
            aria-label="Open sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Thread title */}
          <h1 className="flex-1 font-semibold text-neutral-800 dark:text-neutral-100 text-sm truncate">
            {activeThread?.title ?? "Select or start a conversation"}
          </h1>

          <div className="flex items-center gap-2 flex-shrink-0">
            {activeThread && (
              <span className="text-xs text-neutral-400 hidden sm:block">
                {messages.length} messages
              </span>
            )}

            {/* Settings button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"
              title="Settings"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-3 md:px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {!activeThread && (
              <div className="text-center mt-24 px-4">
                <p className="text-4xl mb-4">✨</p>
                <h2 className="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
                  What can I help you with?
                </h2>
                <p className="text-neutral-400 text-sm">
                  Tap the menu to start a new conversation
                </p>
              </div>
            )}

            {isLoadingHistory && (
              <div className="space-y-4 mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {error && (
              <div className="text-center text-red-500 dark:text-red-400 text-sm py-2">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </main>

        {activeThread && (
          <ChatInput
            onSend={handleSendMessage}
            onStop={stopStreaming}
            isLoading={isLoading}
          />
        )}
      </div>

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThreadItem } from "@/components/sidebar/ThreadItem";
import { SignOutButton } from "@/components/SignOutButton";
import type { Thread } from "@/db/schema";

export default function Home() {
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
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
      .then(setThreads)
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = async () => {
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New conversation" }),
    });
    const thread: Thread = await res.json();
    setThreads((prev) => [thread, ...prev]);
    setActiveThread(thread);
  };

  // Delete thread — remove from sidebar, clear if active
  const handleDelete = async (threadId: string) => {
    await fetch(`/api/threads/${threadId}`, { method: "DELETE" });

    setThreads((prev) => prev.filter((t) => t.id !== threadId));

    if (activeThread?.id === threadId) {
      setActiveThread(null);
    }
  };

  // Rename thread — update in sidebar optimistically
  const handleRename = async (threadId: string, newTitle: string) => {
    // Update UI immediately without waiting for server
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t)),
    );

    if (activeThread?.id === threadId) {
      setActiveThread((prev) => (prev ? { ...prev, title: newTitle } : null));
    }

    // Then persist to DB
    await fetch(`/api/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
  };

  // Refresh thread title after first message is sent
  // The route auto-titles it — we need to pull the updated title
  const refreshThreadTitle = async (threadId: string) => {
    const res = await fetch("/api/threads");
    const allThreads: Thread[] = await res.json();
    const updated = allThreads.find((t) => t.id === threadId);
    if (updated) {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)));
      setActiveThread(updated);
    }
  };

  // Wrap sendMessage to refresh title after first message
  const handleSendMessage = async (content: string) => {
    const isFirstMessage = messages.length === 0;
    await sendMessage(content);
    if (isFirstMessage && activeThread) {
      // Small delay to let the server finish saving + titling
      setTimeout(() => refreshThreadTitle(activeThread.id), 1000);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        {/* New chat button */}
        <div className="p-4 border-b border-neutral-200">
          <button
            onClick={handleNewChat}
            className="w-full py-2 px-4 rounded-xl bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
          >
            + New chat
          </button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto p-2">
          {threads.length === 0 && (
            <p className="text-xs text-neutral-400 text-center mt-4">
              No conversations yet
            </p>
          )}
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={activeThread?.id === thread.id}
              onSelect={() => setActiveThread(thread)}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
        </div>

        {/* Sign out at the bottom of sidebar */}
        <div className="p-4 border-t border-neutral-200">
          <SignOutButton />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h1 className="font-semibold text-neutral-800 text-sm truncate">
            {activeThread?.title ?? "Select or start a conversation"}
          </h1>
          {activeThread && (
            <span className="text-xs text-neutral-400 flex-shrink-0 ml-4">
              {messages.length} messages
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {!activeThread && (
              <div className="text-center mt-24">
                <p className="text-2xl mb-2">💬</p>
                <p className="text-neutral-500 text-sm">
                  Click "+ New chat" to start a conversation
                </p>
              </div>
            )}

            {isLoadingHistory && (
              <div className="text-center mt-24 text-neutral-400 text-sm">
                Loading conversation...
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {error && (
              <div className="text-center text-red-500 text-sm py-2">
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
    </div>
  );
}

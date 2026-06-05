"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
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

  // Load all threads on mount for the sidebar
  useEffect(() => {
    fetch("/api/threads")
      .then((r) => r.json())
      .then(setThreads)
      .catch(console.error);
  }, []);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create a new thread and set it as active
  const handleNewChat = async () => {
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New conversation" }),
    });
    const thread: Thread = await res.json();

    // Add to top of sidebar instantly (optimistic)
    setThreads((prev) => [thread, ...prev]);
    setActiveThread(thread);
  };

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        <div className="p-4 border-b border-neutral-200">
          <button
            onClick={handleNewChat}
            className="w-full py-2 px-4 rounded-xl bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
          >
            + New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {threads.length === 0 && (
            <p className="text-xs text-neutral-400 text-center mt-4">
              No conversations yet
            </p>
          )}
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => setActiveThread(thread)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors truncate ${
                activeThread?.id === thread.id
                  ? "bg-neutral-100 text-neutral-900 font-medium"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {thread.title}
            </button>
          ))}
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
            onSend={sendMessage}
            onStop={stopStreaming}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

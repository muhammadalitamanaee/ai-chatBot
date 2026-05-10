"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";

export default function Home() {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <div>
            <h1 className="font-semibold text-neutral-800 text-sm">
              My Chatbot
            </h1>
            <p className="text-xs text-neutral-400">
              {isLoading ? "Thinking..." : "Claude Sonnet"}
            </p>
          </div>
        </div>
        <button
          onClick={clearMessages}
          className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          Clear chat
        </button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="text-center mt-24">
              <p className="text-2xl mb-2">👋</p>
              <p className="text-neutral-500 text-sm">
                Send a message to get started
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Error state */}
          {error && (
            <div className="text-center text-red-500 text-sm py-2">{error}</div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </main>

      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isLoading={isLoading}
      />
    </div>
  );
}

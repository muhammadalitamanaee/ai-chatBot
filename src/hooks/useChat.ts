import { useState, useCallback, useRef, useEffect } from "react";
import type { Message } from "@/types/index";

async function typeOutChunk(
  chunk: string,
  messageId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
) {
  const words = chunk.split(/(?<=\s)|(?=\s)/);
  for (const word of words) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, content: msg.content + word } : msg,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Hook is now tied to a specific threadId
export function useChat(threadId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load message history (with metadata) — reusable both on thread change
  // and to refresh sources/steps after a stream completes.
  const loadHistory = useCallback(async () => {
    if (!threadId) return;
    setMessages([]);
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`);
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setMessages(
        data.map(
          (m: {
            id: string;
            role: "user" | "assistant";
            content: string;
            metadata?: import("@/types/index").MessageMeta;
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            isStreaming: false,
            metadata: m.metadata ?? undefined,
          }),
        ),
      );
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [threadId]);

  // Load message history whenever threadId changes
  useEffect(() => {
    const t = setTimeout(() => void loadHistory(), 0);
    return () => clearTimeout(t);
  }, [loadHistory]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || !threadId) return;

      setError(null);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId, // ← send threadId so the route saves to correct thread
            messages: [...messages, userMessage].map(({ role, content }) => ({
              role,
              content,
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          await typeOutChunk(chunk, assistantMessage.id, setMessages);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[useChat] Stream error:", err);
        setError("Something went wrong. Please try again.");
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessage.id),
        );
      } finally {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, isStreaming: false }
              : msg,
          ),
        );
        setIsLoading(false);
        abortControllerRef.current = null;
      }

      // Refresh history so the reply's metadata (sources + agent steps) show.
      await loadHistory();
    },
    [messages, isLoading, threadId, loadHistory],
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}

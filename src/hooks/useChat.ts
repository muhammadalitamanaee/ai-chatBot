import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatStreamEvent, Message } from "@/types/index";

export function useChat(threadId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current?.abort();
    historyControllerRef.current?.abort();
    if (!threadId) return;

    const controller = new AbortController();
    historyControllerRef.current = controller;

    void Promise.resolve()
      .then(() => setIsLoadingHistory(true))
      .then(() => fetch(`/api/threads/${threadId}/messages`, { signal: controller.signal }))
      .then((res) => {
        if (!res.ok) throw new Error("بارگذاری گفتگو ناموفق بود.");
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setMessages(
          data.map((m: Message) => ({
            ...m,
            isStreaming: false,
            status: undefined,
          })),
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("بارگذاری گفتگو ناموفق بود.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingHistory(false);
      });

    return () => controller.abort();
  }, [threadId]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

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
        status: "در حال بررسی درخواست…",
        metadata: { steps: [] },
      };
      const requestMessages = [...messages, userMessage];
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      let receivedContent = false;
      let pendingText = "";
      let frame = 0;

      const flush = () => {
        frame = 0;
        if (!pendingText) return;
        const text = pendingText;
        pendingText = "";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: msg.content + text, status: undefined }
              : msg,
          ),
        );
      };
      const scheduleFlush = () => {
        if (!frame) frame = requestAnimationFrame(flush);
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            messages: requestMessages.map(({ role, content: text }) => ({
              role,
              content: text,
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Server error: ${response.status}`);
        }
        if (!response.body) throw new Error("پاسخی از سرور دریافت نشد.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (event: ChatStreamEvent) => {
          if (event.type === "status") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, status: event.message } : msg,
              ),
            );
          } else if (event.type === "step") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? {
                      ...msg,
                      status: "در حال بررسی منابع…",
                      metadata: {
                        ...msg.metadata,
                        steps: [...(msg.metadata?.steps ?? []), event.step],
                      },
                    }
                  : msg,
              ),
            );
          } else if (event.type === "delta") {
            receivedContent = true;
            pendingText += event.text;
            scheduleFlush();
          } else if (event.type === "done") {
            if (frame) cancelAnimationFrame(frame);
            flush();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? {
                      ...msg,
                      isStreaming: false,
                      status: undefined,
                      metadata: event.metadata,
                    }
                  : msg,
              ),
            );
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) handleEvent(JSON.parse(line) as ChatStreamEvent);
          }
          if (done) break;
        }
        if (buffer.trim()) handleEvent(JSON.parse(buffer) as ChatStreamEvent);
      } catch (err) {
        if (frame) cancelAnimationFrame(frame);
        flush();
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "پاسخ کامل نشد. دوباره تلاش کن.");
        if (!receivedContent) {
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessage.id));
        }
      } finally {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, isStreaming: false, status: undefined }
              : msg,
          ),
        );
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, threadId],
  );

  const stopStreaming = useCallback(() => abortControllerRef.current?.abort(), []);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    stopStreaming,
  };
}

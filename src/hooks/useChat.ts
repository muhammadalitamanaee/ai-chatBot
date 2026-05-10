// 'use client' is not needed here — hooks are imported by client
// components which already declare that. Hooks themselves don't need it.
import { useState, useCallback, useRef } from "react";
import type { Message } from "@/types/index";

export function useChat() {
  // The full conversation history — every user and assistant message
  // This is what gets rendered in MessageList and sent to the API
  const [messages, setMessages] = useState<Message[]>([]);

  // True while we're waiting for or receiving a stream from the API
  // Used by the UI to disable the input and show a Stop button
  const [isLoading, setIsLoading] = useState(false);

  // Holds an error string if the request fails, null if everything is fine
  const [error, setError] = useState<string | null>(null);

  // useRef stores a value that persists across renders but doesn't
  // trigger a re-render when it changes — perfect for the AbortController
  // because we don't want changing it to re-render the component
  const abortControllerRef = useRef<AbortController | null>(null);

  // useCallback memoizes this function — it won't be recreated on every
  // render, only when its dependencies (messages, isLoading) change.
  // Important because this function is passed as a prop to ChatInput
  const sendMessage = useCallback(
    async (content: string) => {
      // Guard: don't send empty messages or fire while already loading
      if (!content.trim() || isLoading) return;

      // Clear any previous error before starting a new request
      setError(null);

      // Build the user message object immediately — we don't wait
      // for the server to confirm before showing it in the UI
      const userMessage: Message = {
        id: crypto.randomUUID(), // browser-native unique ID generator
        role: "user",
        content,
      };

      // Create an empty assistant message right away too
      // This is what the streaming tokens will be appended into
      // isStreaming: true tells MessageBubble to show the blinking cursor
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "", // empty for now — tokens fill this in
        isStreaming: true,
      };

      // Add both messages to state in one update to avoid two re-renders
      // We use the functional form (prev =>) to always work from the
      // latest state — important inside async functions
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      // AbortController lets us cancel the fetch mid-stream
      // When the user clicks "Stop", we call controller.abort()
      // and the fetch throws an AbortError which we handle below
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },

          // Send the full history INCLUDING the new user message
          // The AI needs all previous context to reply coherently
          // We strip id and isStreaming — the API only needs role + content
          body: JSON.stringify({
            messages: [...messages, userMessage].map(({ role, content }) => ({
              role,
              content,
            })),
          }),

          // Attach the abort signal — if controller.abort() is called,
          // this fetch will immediately throw an AbortError
          signal: controller.signal,
        });

        // If the server returned a 4xx or 5xx, response.ok is false
        // We throw here so the catch block handles it uniformly
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        // response.body is the ReadableStream the server sent back
        // null check needed because TypeScript can't guarantee it exists
        if (!response.body) {
          throw new Error("No response body");
        }

        // getReader() locks the stream to this reader — only one reader
        // can consume a ReadableStream at a time
        const reader = response.body.getReader();

        // TextDecoder converts raw bytes back into a JavaScript string
        // { stream: true } means it handles multi-byte characters that
        // might be split across two chunks correctly
        const decoder = new TextDecoder();

        // Keep reading chunks until the stream signals it's done
        while (true) {
          // read() waits for the next chunk to arrive from the server
          // done = true means the stream has closed (no more data)
          // value = the raw bytes of this chunk (Uint8Array)
          const { done, value } = await reader.read();

          // Break out of the loop when the stream is finished
          if (done) break;

          // Decode bytes → string. One chunk might contain multiple
          // tokens or part of a token — we don't control the chunk size
          const chunk = decoder.decode(value, { stream: true });

          // Find the assistant message by its id and append the new chunk
          // We never mutate state directly — always return a new array
          // This is why we stored assistantMessage.id above — so we can
          // target exactly the right message even if more messages are added
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: msg.content + chunk }
                : msg,
            ),
          );
        }
      } catch (err) {
        // AbortError is thrown when the user clicks Stop — that's
        // intentional so we don't treat it as a real error
        if (err instanceof Error && err.name === "AbortError") return;

        console.error("[useChat] Stream error:", err);

        // Show a friendly error message in the UI
        setError("Something went wrong. Please try again.");

        // Remove the empty assistant bubble — better than showing
        // a message with no content and no cursor
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessage.id),
        );
      } finally {
        // finally runs whether we succeeded, errored, or were aborted
        // Always mark streaming as done so the cursor disappears
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, isStreaming: false }
              : msg,
          ),
        );

        // Re-enable the input and hide the Stop button
        setIsLoading(false);

        // Clear the ref — the controller is no longer needed
        abortControllerRef.current = null;
      }

      // These are the dependencies of useCallback — the function is
      // recreated only when messages or isLoading actually changes
    },
    [messages, isLoading],
  );

  // Calling this cancels the in-flight fetch immediately
  // The AbortError it throws is caught and silently ignored above
  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []); // no dependencies — abort() never changes

  // Wipes the conversation so the user can start fresh
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Return only what the UI needs — nothing internal leaks out
  // This is the public API of this hook
  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}

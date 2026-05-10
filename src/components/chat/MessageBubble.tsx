import type { Message } from "@/types";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex mb-6 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Avatar — only for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs font-medium mr-3 flex-shrink-0 mt-1">
          AI
        </div>
      )}

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-neutral-800 text-white rounded-br-sm"
            : "bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm"
        }`}
      >
        {/* Preserve line breaks in the message */}
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Blinking cursor while streaming */}
        {message.isStreaming && (
          <span className="inline-block w-[2px] h-4 bg-current ml-0.5 align-middle animate-pulse" />
        )}
      </div>
    </div>
  );
}

export type Role = "user" | "assistant" | "system";

export interface MessageMeta {
  sources?: { title: string; url: string }[];
  steps?: string[];
  agentic?: boolean;
  model?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  isStreaming?: boolean;
  status?: string;
  metadata?: MessageMeta;
}

export type ChatStreamEvent =
  | { type: "status"; message: string }
  | { type: "step"; step: string }
  | { type: "delta"; text: string }
  | { type: "done"; metadata: MessageMeta }
  | { type: "error"; message: string; retryable?: boolean };

export interface ChatRequest {
  messages: Pick<Message, "role" | "content">[];
  threadId: string; // ← new
}

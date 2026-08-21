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
  metadata?: MessageMeta;
}

export interface ChatRequest {
  messages: Pick<Message, "role" | "content">[];
  threadId: string; // ← new
}

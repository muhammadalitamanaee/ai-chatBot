export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  isStreaming?: boolean;
}

export interface ChatRequest {
  messages: Pick<Message, "role" | "content">[];
}

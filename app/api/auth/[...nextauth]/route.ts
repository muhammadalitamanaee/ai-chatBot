import { handlers } from "@/lib/auth";

// NextAuth handles all /api/auth/* routes automatically
// This single file covers: login, logout, callback, session
export const { GET, POST } = handlers;

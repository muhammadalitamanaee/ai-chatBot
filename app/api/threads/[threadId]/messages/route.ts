import { NextRequest } from "next/server";
import { getMessagesByThread } from "@/db/queries";

// GET /api/threads/:threadId/messages — load history for one thread
export async function GET(
  _req: NextRequest,
  { params }: { params: { threadId: string } },
) {
  try {
    const msgs = await getMessagesByThread(params.threadId);
    return Response.json(msgs);
  } catch (err) {
    console.error("[GET /api/threads/messages]", err);
    return new Response("Failed to fetch messages", { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getMessagesByThread } from "@/db/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }, // ← Promise now
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { threadId } = await params;
    const msgs = await getMessagesByThread(threadId, session.user.id);
    return Response.json(msgs);
  } catch (err) {
    console.error("[GET /api/threads/messages]", err);
    return new Response("Failed to fetch messages", { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { deleteThread, renameThread } from "@/db/queries";

// PATCH /api/threads/:threadId — rename a thread
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { threadId } = await params;
    const { title } = await req.json();

    if (!title?.trim()) {
      return new Response("Title is required", { status: 400 });
    }

    await renameThread(threadId, title.trim(), session.user.id);
    return Response.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/threads/:id]", err);
    return new Response("Failed to rename thread", { status: 500 });
  }
}

// DELETE /api/threads/:threadId — delete a thread and all its messages
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { threadId } = await params;
    await deleteThread(threadId, session.user.id);
    return Response.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/threads/:id]", err);
    return new Response("Failed to delete thread", { status: 500 });
  }
}

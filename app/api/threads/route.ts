import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createThread, getAllThreads } from "@/db/queries";

export async function GET() {
  // Get the current user's session
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Only return this user's threads
    const allThreads = await getAllThreads(session.user.id);
    return Response.json(allThreads);
  } catch (err) {
    console.error("[GET /api/threads]", err);
    return new Response("Failed to fetch threads", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { title } = await req.json();
    // Pass userId so the thread is owned by this user
    const thread = await createThread(
      title ?? "New conversation",
      session.user.id,
    );
    return Response.json(thread);
  } catch (err) {
    console.error("[POST /api/threads]", err);
    return new Response("Failed to create thread", { status: 500 });
  }
}

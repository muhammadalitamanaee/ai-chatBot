import { NextRequest } from "next/server";
import { createThread, getAllThreads } from "@/db/queries";

// GET /api/threads — returns all threads for the sidebar
export async function GET() {
  try {
    const allThreads = await getAllThreads();
    return Response.json(allThreads);
  } catch (err) {
    console.error("[GET /api/threads]", err);
    return new Response("Failed to fetch threads", { status: 500 });
  }
}

// POST /api/threads — creates a new thread, returns it
export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();
    const thread = await createThread(title ?? "New conversation");
    return Response.json(thread);
  } catch (err) {
    console.error("[POST /api/threads]", err);
    return new Response("Failed to create thread", { status: 500 });
  }
}

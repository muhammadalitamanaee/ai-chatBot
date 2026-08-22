import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getUserSettings, saveUserSettings } from "@/db/queries";
import { ALL_MODEL_IDS } from "@/lib/providers";

// GET /api/settings — load current user's settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const userSettings = await getUserSettings(session.user.id);
    return Response.json(
      userSettings ?? {
        systemPrompt: "",
        model: "openai/gpt-oss-20b:free",
        answerDepth: "beginner",
      },
    );
  } catch (err) {
    console.error("[GET /api/settings]", err);
    return new Response("Failed to load settings", { status: 500 });
  }
}

// POST /api/settings — save current user's settings
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { systemPrompt, model, answerDepth } = await req.json();

    // Validate model — reject unknown model IDs
    if (model && !ALL_MODEL_IDS.includes(model)) {
      return new Response("Invalid model", { status: 400 });
    }

    const depth =
      answerDepth === "professional" ? "professional" : "beginner";

    await saveUserSettings({
      userId: session.user.id,
      systemPrompt: systemPrompt ?? null,
      model: model ?? "openai/gpt-oss-20b:free",
      answerDepth: depth,
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("[POST /api/settings]", err);
    return new Response("Failed to save settings", { status: 500 });
  }
}

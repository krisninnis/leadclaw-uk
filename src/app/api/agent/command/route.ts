import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("x-agent-secret");
    const expected = process.env.AGENT_SECRET;

    if (!expected || auth !== expected) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { command, repo } = body;

    if (!command) {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Admin client unavailable" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("agent_commands")
      .insert({
        command,
        repo: repo || "leadclaw-uk",
        status: "received",
      })
      .select("id, command, repo, status, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save command", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Command saved",
      command: data,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 500 }
    );
  }
}

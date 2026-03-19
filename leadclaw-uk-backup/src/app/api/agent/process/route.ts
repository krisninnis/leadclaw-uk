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
    const { commandId } = body;

    if (!commandId) {
      return NextResponse.json(
        { error: "commandId is required" },
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

    const { data: command, error: fetchError } = await supabase
      .from("agent_commands")
      .select("*")
      .eq("id", commandId)
      .single();

    if (fetchError || !command) {
      return NextResponse.json(
        { error: "Command not found" },
        { status: 404 }
      );
    }

    const { error: updateStartError } = await supabase
      .from("agent_commands")
      .update({ status: "processing" })
      .eq("id", commandId);

    if (updateStartError) {
      return NextResponse.json(
        { error: "Failed to mark processing" },
        { status: 500 }
      );
    }

    const result = {
      message: "Processor stub ran successfully",
      command: command.command,
      repo: command.repo,
    };

    const { error: updateDoneError } = await supabase
      .from("agent_commands")
      .update({
        status: "done",
        result,
      })
      .eq("id", commandId);

    if (updateDoneError) {
      return NextResponse.json(
        { error: "Failed to mark done" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Command processed",
      result,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 500 }
    );
  }
}

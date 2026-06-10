import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentCommandRow = {
  id: string;
  command: unknown;
  repo: string | null;
};

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("x-agent-secret");
    const expected = process.env.AGENT_SECRET;

    if (!expected || auth !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { commandId } = body;

    if (!commandId) {
      return NextResponse.json(
        { error: "commandId is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Admin client unavailable" },
        { status: 500 },
      );
    }

    const { data: command, error: fetchError } = await (supabase as any)
      .from("agent_commands")
      .select("*")
      .eq("id", commandId)
      .single();

    const agentCommand = command as AgentCommandRow | null;

    if (fetchError || !agentCommand) {
      return NextResponse.json({ error: "Command not found" }, { status: 404 });
    }

    const { error: updateStartError } = await (supabase as any)
      .from("agent_commands")
      .update({ status: "running" })
      .eq("id", commandId);

    if (updateStartError) {
      return NextResponse.json(
        { error: "Failed to mark running" },
        { status: 500 },
      );
    }

    const result = {
      message: "Processor stub ran successfully",
      command: agentCommand.command,
      repo: agentCommand.repo,
    };

    const { error: updateDoneError } = await (supabase as any)
      .from("agent_commands")
      .update({
        status: "completed",
        result,
      })
      .eq("id", commandId);

    if (updateDoneError) {
      return NextResponse.json(
        { error: "Failed to mark completed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Command processed",
      result,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 500 });
  }
}

/**
 * API Route: Get agent session for a project
 *
 * GET /api/agents/session?projectId={projectId}
 *
 * Returns the most recent agent session for a project (if exists)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get project ID from query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId parameter" },
        { status: 400 }
      );
    }

    // Get Supabase user ID from Clerk ID
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userData.id;

    // Get most recent session for this project (using service role to bypass RLS)
    const { data: session, error } = await supabaseAdmin
      .from("agent_sessions")
      .select("session_id, created_at, status")
      .eq("project_id", projectId)
      .eq("user_id", userId) // Verify user owns this project's session
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !session) {
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("[API] Error fetching agent session:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch agent session",
      },
      { status: 500 }
    );
  }
}

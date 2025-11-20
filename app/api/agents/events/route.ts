/**
 * API Route: Get agent events for a session
 *
 * GET /api/agents/events?sessionId={sessionId}
 *
 * Returns all events for an agent session
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

    // Get session ID from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
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

    // Verify user owns this session (using service role)
    const { data: session } = await supabaseAdmin
      .from("agent_sessions")
      .select("user_id")
      .eq("session_id", sessionId)
      .single();

    if (!session || session.user_id !== userId) {
      return NextResponse.json(
        { error: "Session not found or access denied" },
        { status: 403 }
      );
    }

    // Get all events for this session (using service role to bypass RLS)
    const { data: events, error } = await supabaseAdmin
      .from("agent_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ events: events || [] });
  } catch (error) {
    console.error("[API] Error fetching agent events:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch agent events",
      },
      { status: 500 }
    );
  }
}

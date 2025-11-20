"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, Loader2 } from "lucide-react";
import { useSession } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { ChatMessage } from "./chat-message";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolUse?: string; // Name of tool being used
  toolContext?: string; // Additional context about tool use
}

interface ChatPanelProps {
  projectId: string;
  sandboxId?: string;
}

export function ChatPanel({ projectId, sandboxId }: ChatPanelProps) {
  const { isLoaded } = useSession();
  const supabase = useSupabaseClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Process a single agent event (used for both historical and real-time events)
  const processAgentEvent = (event: {
    event_type: string;
    event_data: any;
    created_at: string;
  }) => {
    // Handle project-level system messages (sent before session exists)
    if (event.event_type === "system" && event.event_data?.message) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: event.event_data.message,
          timestamp: new Date(event.created_at),
          toolUse: event.event_data.toolUse,
          toolContext: event.event_data.toolContext,
        },
      ]);
      return;
    }

    // Parse NDJSON event and add to messages
    if (event.event_type === "assistant") {
      const content = event.event_data.message?.content || [];
      for (const block of content) {
        if (block.type === "text") {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: block.text,
              timestamp: new Date(event.created_at),
            },
          ]);
        } else if (block.type === "tool_use") {
          // Extract meaningful context from tool input
          let toolContext = "";
          const input = block.input || {};

          if (block.name === "Read" && input.file_path) {
            const fileName = input.file_path.split("/").pop();
            toolContext = fileName;
          } else if (block.name === "Write" && input.file_path) {
            const fileName = input.file_path.split("/").pop();
            toolContext = fileName;
          } else if (block.name === "Edit" && input.file_path) {
            const fileName = input.file_path.split("/").pop();
            toolContext = fileName;
          } else if (block.name === "Bash" && input.command) {
            toolContext = input.command.substring(0, 30) + (input.command.length > 30 ? "..." : "");
          } else if (block.name === "Glob" && input.pattern) {
            toolContext = input.pattern;
          }

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "system",
              content: `Using ${block.name}...`,
              timestamp: new Date(event.created_at),
              toolUse: block.name,
              toolContext,
            },
          ]);
        }
      }
    } else if (event.event_type === "tool_result") {
      // Tool result events (BashOutput, etc.)
      const toolResult = event.event_data;

      // Extract Expo URL if present
      const expoUrlMatch = toolResult.content?.match(/exp:\/\/[\w\-\.]+:\d+/);
      if (expoUrlMatch) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `🎉 Expo ready: ${expoUrlMatch[0]}`,
            timestamp: new Date(event.created_at),
          },
        ]);
      }
      // Show important outputs: errors, warnings, key info
      // Skip verbose logs to avoid chat spam
      else if (
        toolResult.content?.trim() &&
        (toolResult.is_error ||
          toolResult.content.includes("error") ||
          toolResult.content.includes("Error") ||
          toolResult.content.includes("Metro") ||
          toolResult.content.includes("Tunnel ready") ||
          toolResult.content.includes("npm ERR"))
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: toolResult.content.trim().substring(0, 200),
            timestamp: new Date(event.created_at),
          },
        ]);
      }
    } else if (event.event_type === "result") {
      // Agent finished
      setIsLoading(false);
      if (event.event_data.subtype === "success") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: "✓ Task completed",
            timestamp: new Date(event.created_at),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `✗ Error: ${event.event_data.subtype}`,
            timestamp: new Date(event.created_at),
          },
        ]);
      }
    }
  };

  // Load latest session ID for sending messages (but we show ALL project events)
  useEffect(() => {
    // Wait for Clerk session to be fully loaded before querying
    if (!isLoaded) return;

    async function loadLatestSession() {
      console.log(`[ChatPanel] Loading latest session for project: ${projectId}`);

      const { data: session, error } = await supabase
        .from("agent_sessions")
        .select("session_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // Ignore PGRST116 (no rows) - this is normal for new projects without sessions yet
        if (error.code !== "PGRST116") {
          console.error("[ChatPanel] Error loading session:", error.message, error.code);
        } else {
          console.log("[ChatPanel] No existing session found (this is normal for new projects)");
        }
        return;
      }

      if (session) {
        console.log(`[ChatPanel] Found latest session: ${session.session_id}`);
        setSessionId(session.session_id);
      }
    }

    loadLatestSession();
  }, [projectId, isLoaded]);

  // Watch for new sessions (so we can send messages to the latest one)
  useEffect(() => {
    // Wait for Clerk session to be fully loaded before subscribing
    if (!isLoaded) return;

    console.log(`[ChatPanel] Watching for new sessions for project: ${projectId}`);

    const channel = supabase
      .channel(`project-sessions:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_sessions",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const session = payload.new as { session_id: string };
          console.log("[ChatPanel] New session detected:", session.session_id);
          setSessionId(session.session_id); // Update to latest session
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, isLoaded]);

  // Load ALL project events (historical) and subscribe to new ones
  // This is project-scoped, not session-scoped - user sees complete project history
  useEffect(() => {
    // Wait for Clerk session to be fully loaded before querying/subscribing
    if (!isLoaded) return;

    console.log(`[ChatPanel] Loading ALL events for project: ${projectId}`);

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setupSubscription() {
      // First, load ALL historical events for this project (from any session)
      const { data: events, error } = await supabase
        .from("agent_events")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[ChatPanel] Failed to load project events:", error);
        console.error("[ChatPanel] Error details:", error.message, error.code, error.details);
        return;
      }

      console.log(`[ChatPanel] Loaded ${events?.length || 0} total events for project`);

      // Process each historical event
      if (events) {
        for (const event of events) {
          processAgentEvent(event);
        }
      }

      // Subscribe to ALL new events for this project (any session)
      channel = supabase
        .channel(`project-all-events:${projectId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "agent_events",
            filter: `project_id=eq.${projectId}`,
          },
          (payload) => {
            const event = payload.new as {
              event_type: string;
              event_data: any;
              created_at: string;
              session_id: string | null;
            };

            // Clean logging - show event type and whether it's system or agent message
            const eventLabel = event.session_id ? "agent" : "system";
            let preview = event.event_type;

            // Extract preview based on event type
            if (event.event_type === "system" && typeof event.event_data?.message === "string") {
              preview = event.event_data.message.substring(0, 50);
            } else if (event.event_type === "assistant" && event.event_data?.message?.content) {
              // For agent events, extract first text content
              const textBlock = event.event_data.message.content.find((b: any) => b.type === "text");
              if (textBlock?.text) {
                preview = textBlock.text.substring(0, 50);
              }
            }

            console.log(`[ChatPanel] 📨 Received ${eventLabel} event: ${preview}`);

            processAgentEvent(event);
          }
        )
        .subscribe((status, err) => {
          console.log(`[ChatPanel] Subscription status change: ${status}`, err);
          if (status === "SUBSCRIBED") {
            console.log(`[ChatPanel] ✓ Subscribed to project events`);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.error(`[ChatPanel] ✗ Subscription failed: ${status}`, err);
            console.error(`[ChatPanel] Full subscription state:`, channel?.state);
          }
        });
    }

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [projectId, isLoaded]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Store user message in database if we have a session
      if (sessionId) {
        try {
          await supabase.from("agent_events").insert({
            session_id: sessionId,
            event_type: "user",
            event_data: {
              role: "user",
              content: userMessage.content,
            },
            created_at: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Failed to store user message:", error);
        }
      }

      // First message: create new session
      if (!sessionId) {
        const response = await fetch("/api/agents/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: userMessage.content,
            projectId,
            sandboxId,
            workingDirectory: "/home/user/project",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to start agent session");
        }

        const data = await response.json();
        // Session ID will come from agent_events table via realtime
        // For now, we'll extract it from the first system event
        console.log("Agent session started:", data);
      } else {
        // Follow-up message: resume session
        const response = await fetch("/api/agents/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            prompt: userMessage.content,
            sandboxId,
            workingDirectory: "/home/user/project",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const data = await response.json();
        console.log("Follow-up message sent:", data);
      }

      // Show thinking indicator
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: "Claude is thinking...",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 pt-6 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Chat with AI</p>
              <p className="text-xs text-muted-foreground mt-1">
                Describe your app and I'll help build it
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Describe your app..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

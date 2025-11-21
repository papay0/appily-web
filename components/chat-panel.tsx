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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenEventIds = useRef(new Set<string>()); // Track seen events to prevent duplicates

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Process a single agent event (used for both historical and real-time events)
  const processAgentEvent = (event: {
    id?: string;
    event_type: string;
    event_data: any;
    created_at: string;
  }) => {
    // Skip duplicates (event might be caught by both historical load AND realtime subscription)
    if (event.id && seenEventIds.current.has(event.id)) {
      return;
    }
    if (event.id) {
      seenEventIds.current.add(event.id);
    }
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
      console.log('[ChatPanel] 🏁 Result event received:', {
        subtype: event.event_data.subtype,
        timestamp: event.created_at,
        fullEvent: JSON.stringify(event, null, 2)
      });
      console.log('[ChatPanel] 🔄 Setting isLoading: true → false');
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

  // Load ALL project events (historical) and subscribe to new ones
  // This is project-scoped, not session-scoped - user sees complete project history
  useEffect(() => {
    // Wait for Clerk session to be fully loaded before querying/subscribing
    if (!isLoaded) return;

    console.log(`[ChatPanel] Loading ALL events for project: ${projectId}`);

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setupSubscription() {
      // CRITICAL FIX: Load historical events FIRST, then set up subscription
      // This prevents race condition and duplicate detection handles any overlap

      // STEP 1: Load ALL historical events for this project
      console.log(`[ChatPanel] Loading historical events...`);
      const { data: events, error } = await supabase
        .from("agent_events")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[ChatPanel] Failed to load historical events:", error);
        console.error("[ChatPanel] Error details:", error.message, error.code, error.details);
        // Continue anyway - subscription might still work
      } else {
        console.log(`[ChatPanel] Loaded ${events?.length || 0} historical events`);

        // Process each historical event
        if (events) {
          for (const event of events) {
            processAgentEvent(event);
          }
        }
      }

      // STEP 2: Set up realtime subscription for new events
      const subscriptionConfig = {
        channel: `project-all-events:${projectId}`,
        event: "INSERT",
        schema: "public",
        table: "agent_events",
        filter: `project_id=eq.${projectId}`,
        timestamp: new Date().toISOString()
      };
      console.log(`[ChatPanel] 🔌 Setting up realtime subscription:`, subscriptionConfig);

      channel = supabase
        .channel(subscriptionConfig.channel)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "agent_events",
            filter: subscriptionConfig.filter,
          },
          (payload) => {
            const event = payload.new as {
              id: string;
              event_type: string;
              event_data: any;
              created_at: string;
              session_id: string | null;
            };

            // Detailed logging for every event
            console.log(`[ChatPanel] 📨 Event received:`, {
              eventType: event.event_type,
              hasSessionId: !!event.session_id,
              timestamp: event.created_at,
              eventId: event.id
            });
            console.log(`[ChatPanel] 📨 Full event data:`, JSON.stringify(event, null, 2));

            // Process event (duplicate detection happens inside)
            processAgentEvent(event);
          }
        )
        .subscribe((status, err) => {
          console.log(`[ChatPanel] 🔄 Subscription status:`, {
            status,
            timestamp: new Date().toISOString(),
            error: err ? JSON.stringify(err, null, 2) : null
          });

          if (status === "SUBSCRIBED") {
            console.log(`[ChatPanel] ✅ Successfully subscribed to realtime events`);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.error(`[ChatPanel] ❌ Subscription failed:`, {
              status,
              error: err,
              errorMessage: err?.message,
              errorDetails: JSON.stringify(err, null, 2)
            });
            console.error(`[ChatPanel] ℹ️ Refresh the page to reconnect`);
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
    console.log('[ChatPanel] 🔄 Setting isLoading: false → true');
    console.log('[ChatPanel] 📤 Sending message to agent:', {
      projectId,
      sandboxId: sandboxId || 'none',
      messageLength: userMessage.content.length,
      timestamp: new Date().toISOString()
    });
    setIsLoading(true);

    try {
      // Send message to agent (backend will store user message in database)
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
        throw new Error("Failed to start agent");
      }

      const data = await response.json();
      console.log("Agent started:", data);

      // - If status is "starting": Setup script is running, system messages will appear via subscription
      // - If status is "processing": Agent is already running, show "Claude is thinking..."
      if (data.status === "processing") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: "Claude is thinking...",
            timestamp: new Date(),
          },
        ]);
      }
      // If status is "starting", don't show "thinking" - setup script messages will appear instead
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
      console.log('[ChatPanel] 🔄 Setting isLoading: true → false (error)');
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

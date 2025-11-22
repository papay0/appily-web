"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, Loader2 } from "lucide-react";
import { useSession, useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { ChatMessage } from "./chat-message";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolUse?: string;
  toolContext?: string;
  avatarUrl?: string;
}

interface AssistantContentBlock {
  type: string;
  text?: string;
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: Record<string, any>;
}

interface AgentEventRecord {
  id?: string;
  event_type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event_data: any;
  created_at: string;
}

interface ChatPanelProps {
  projectId: string;
  sandboxId?: string;
}

export function ChatPanel({ projectId, sandboxId }: ChatPanelProps) {
  const { isLoaded } = useSession();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenEventIds = useRef<{ order: string[]; set: Set<string> }>({
    order: [],
    set: new Set(),
  });
  const lastTimestampRef = useRef<string | null>(null);
  const MAX_EVENT_CACHE = 500;
  const didInitialFetchRef = useRef(false);
  const pendingUserMessageIds = useRef<Set<string>>(new Set());

  // Reset local caches when switching projects
  useEffect(() => {
    seenEventIds.current = { order: [], set: new Set() };
    lastTimestampRef.current = null;
    didInitialFetchRef.current = false;
    pendingUserMessageIds.current.clear();
    setMessages([]);
  }, [projectId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Process a single agent event
  const markEventProcessed = useCallback((event: AgentEventRecord) => {
    if (event.id) {
      const { order, set } = seenEventIds.current;
      set.add(event.id);
      order.push(event.id);
      if (order.length > MAX_EVENT_CACHE) {
        const oldest = order.shift();
        if (oldest) {
          set.delete(oldest);
        }
      }
    }
    if (!lastTimestampRef.current || event.created_at > lastTimestampRef.current) {
      lastTimestampRef.current = event.created_at;
    }
  }, []);

  const processAgentEvent = useCallback((event: AgentEventRecord) => {
    console.log(
      `[ChatPanel] 🔍 Event ${event.id ?? "(no-id)"}: ${event.event_type}`
    );

    if (event.id && seenEventIds.current.set.has(event.id)) {
      console.log("[ChatPanel] ⏭️ Duplicate skipped", event.id);
      return;
    }

    if (
      event.event_type === "system" &&
      typeof event.event_data?.message === "string"
    ) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "system",
        content: event.event_data.message,
        timestamp: new Date(event.created_at),
        toolUse: event.event_data.toolUse,
        toolContext: event.event_data.toolContext,
      }]);
      markEventProcessed(event);
      return;
    }

    if (event.event_type === "user") {
      const content = event.event_data?.content;
      if (typeof content === "string" && content.trim().length > 0) {
        const clientMessageId = event.event_data?.clientMessageId as string | undefined;
        if (clientMessageId && pendingUserMessageIds.current.has(clientMessageId)) {
          pendingUserMessageIds.current.delete(clientMessageId);
          markEventProcessed(event);
          return;
        }
        setMessages((prev) => [...prev, {
          id: event.id || crypto.randomUUID(),
          role: "user",
          content,
          timestamp: new Date(event.created_at),
          avatarUrl: user?.imageUrl,
        }]);
      }
      markEventProcessed(event);
      return;
    }

    if (event.event_type === "assistant") {
      const content =
        (event.event_data?.message?.content as AssistantContentBlock[] | undefined) || [];
      for (const block of content) {
        if (block.type === "text") {
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: block.text,
            timestamp: new Date(event.created_at),
          }]);
        } else if (block.type === "tool_use") {
          let toolContext = "";
          const input = block.input || {};

          if (block.name === "Read" && input.file_path) {
            toolContext = input.file_path.split("/").pop();
          } else if (block.name === "Write" && input.file_path) {
            toolContext = input.file_path.split("/").pop();
          } else if (block.name === "Edit" && input.file_path) {
            toolContext = input.file_path.split("/").pop();
          } else if (block.name === "Bash" && input.command) {
            toolContext = input.command.substring(0, 30) + (input.command.length > 30 ? "..." : "");
          } else if (block.name === "Glob" && input.pattern) {
            toolContext = input.pattern;
          }

          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            role: "system",
            content: `Using ${block.name}...`,
            timestamp: new Date(event.created_at),
            toolUse: block.name,
            toolContext,
          }]);
        }
      }
      markEventProcessed(event);
      return;
    }

    if (event.event_type === "result") {
      setIsLoading(false);
      if (event.event_data.subtype === "success") {
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: "system",
          content: "✓ Task completed",
          timestamp: new Date(event.created_at),
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: "system",
          content: `✗ Error: ${event.event_data.subtype}`,
          timestamp: new Date(event.created_at),
        }]);
      }
      markEventProcessed(event);
      return;
    }

    markEventProcessed(event);
  }, [markEventProcessed, user?.imageUrl]);

  // Fetch historical events
  const fetchHistoricalEvents = useCallback(async () => {
    if (!isLoaded) return;

    const lastTimestamp = lastTimestampRef.current;
    console.log(
      `[ChatPanel] 📥 Fetching history after ${lastTimestamp ?? "beginning"}`
    );
    let query = supabase
      .from("agent_events")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (lastTimestamp) {
      query = query.gt("created_at", lastTimestamp);
    }

    const { data: events, error } = await query.returns<AgentEventRecord[]>();

    if (error) {
      console.error("[ChatPanel] Failed to load historical events:", error);
    } else {
      console.log(`[ChatPanel] ✅ Loaded ${events?.length ?? 0} events`);
      if (events) {
        for (const event of events) {
          processAgentEvent(event);
        }
      }
    }
  }, [projectId, supabase, isLoaded, processAgentEvent]);

  const { status: channelStatus } = useRealtimeSubscription({
    channelKey: `agent_events:${projectId}`,
    table: "agent_events",
    event: "INSERT",
    filter: `project_id=eq.${projectId}`,
    onEvent: (payload) => processAgentEvent(payload.new as AgentEventRecord),
    enabled: isLoaded,
    onStatusChange: (status) => console.log(`[ChatPanel] 🔄 Channel status: ${status}`),
  });

  // Initial load (once per project mount)
  useEffect(() => {
    if (!isLoaded || didInitialFetchRef.current) return;
    didInitialFetchRef.current = true;
    fetchHistoricalEvents();
  }, [isLoaded, fetchHistoricalEvents]);

  // Re-fetch when realtime reconnects to capture anything missed
  useEffect(() => {
    if (!isLoaded) return;
    if (channelStatus === "connected") {
      fetchHistoricalEvents();
    }
  }, [channelStatus, fetchHistoricalEvents, isLoaded]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date(),
      avatarUrl: user?.imageUrl,
    };

    setMessages((prev) => [...prev, userMessage]);
    pendingUserMessageIds.current.add(userMessage.id);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage.content,
          projectId,
          sandboxId,
          workingDirectory: "/home/user/project",
          clientMessageId: userMessage.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start agent");
      }

      const data = await response.json();
      console.log("Agent started:", data);

      if (data.status === "processing") {
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: "system",
          content: "Claude is thinking...",
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      pendingUserMessageIds.current.delete(userMessage.id);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "system",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      }]);
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
                Describe your app and I&apos;ll help build it
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

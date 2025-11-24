"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useSession, useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { ChatMessage } from "./chat-message";
import { TodoList, type Todo } from "./todo-list";
import { ToolUseGroup } from "./tool-use-group";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolUse?: string;
  toolContext?: string;
  avatarUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInput?: any; // Stores the input data from tool use (e.g., todos for TodoWrite)
  eventData?: Record<string, unknown>; // Full event_data for operational logs
}

interface AssistantContentBlock {
  type: string;
  text?: string;
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: Record<string, any>;
}

const isTextBlock = (
  block: AssistantContentBlock
): block is AssistantContentBlock & { text: string } =>
  block.type === "text" && typeof block.text === "string";

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

// Helper type for grouped rendering
type MessageGroup =
  | { type: 'single'; message: Message; index: number }
  | { type: 'group'; toolType: string; messages: Message[]; startIndex: number };

// Group consecutive tool use messages
function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const message = messages[i];

    // Check if this is a tool use message (system role with toolUse property)
    if (message.role === 'system' && message.toolUse && message.toolUse !== 'TodoWrite') {
      // Look ahead to see if there are consecutive messages with the same toolUse
      const toolType = message.toolUse;
      const groupMessages: Message[] = [message];
      let j = i + 1;

      while (j < messages.length &&
             messages[j].role === 'system' &&
             messages[j].toolUse === toolType) {
        groupMessages.push(messages[j]);
        j++;
      }

      // Only create a group if there are 2 or more consecutive messages
      if (groupMessages.length >= 2) {
        groups.push({ type: 'group', toolType, messages: groupMessages, startIndex: i });
        i = j;
      } else {
        groups.push({ type: 'single', message, index: i });
        i++;
      }
    } else {
      groups.push({ type: 'single', message, index: i });
      i++;
    }
  }

  return groups;
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
  // const savedEvents = useRef<Set<string>>(new Set()); // No longer needed - saves are backend-triggered

  // Reset local caches when switching projects
  useEffect(() => {
    seenEventIds.current = { order: [], set: new Set() };
    // savedEvents.current = new Set(); // No longer needed - saves are backend-triggered
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
        eventData: event.event_data as Record<string, unknown>,
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
        if (isTextBlock(block)) {
          const text = block.text;
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: text,
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
            toolInput: input, // Store the full input data (includes todos for TodoWrite)
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

        // Auto-save is now handled by the backend (E2B script)
        // The stream-to-supabase.js script automatically triggers saves
        // after storing success result events via the internal save API.
        //
        // Frontend auto-save is disabled to prevent duplicates.
        // Kept here as reference/fallback:
        /*
        const eventId = event.id || `${event.created_at}-result-success`;
        if (sandboxId && !savedEvents.current.has(eventId)) {
          savedEvents.current.add(eventId);

          console.log("[ChatPanel] Task completed - Auto-saving project to R2...");
          fetch(`/api/projects/${projectId}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: "Auto-save after task completion",
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success) {
                console.log("[ChatPanel] ✓ Project saved to R2:", data.snapshot);
              } else {
                console.error("[ChatPanel] ✗ Failed to save project:", data.error);
                savedEvents.current.delete(eventId);
              }
            })
            .catch((error) => {
              console.error("[ChatPanel] ✗ Save request failed:", error);
              savedEvents.current.delete(eventId);
            });
        }
        */
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 pt-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in duration-500">
            <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm p-2.5">
              <Image
                src="/appily-logo.svg"
                alt="Appily AI"
                width={20}
                height={20}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Chat with Claude
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Describe your app and I&apos;ll help build it
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 w-full max-w-full overflow-hidden">
            {/* Messages with inline todos and grouped tool uses */}
            {(() => {
              const messageGroups = groupMessages(messages);
              const lastTodoWriteIndex = messages.map((m, i) => m.toolUse === "TodoWrite" ? i : -1).filter(i => i !== -1).pop() ?? -1;

              return messageGroups.map((group, groupIndex) => {
                if (group.type === 'group') {
                  // Render grouped tool uses
                  return (
                    <ToolUseGroup
                      key={`group-${group.startIndex}-${group.toolType}`}
                      messages={group.messages}
                      toolType={group.toolType}
                    />
                  );
                } else {
                  // Render single message
                  const message = group.message;
                  const index = group.index;
                  const isLatestTodoWrite = index === lastTodoWriteIndex;

                  return (
                    <div key={message.id} className="w-full max-w-full overflow-hidden">
                      <ChatMessage message={message} />
                      {/* Show todos after TodoWrite tool use */}
                      {message.toolUse === "TodoWrite" && message.toolInput?.todos && (
                        <div className="mt-1.5 pl-9">
                          <TodoList
                            todos={message.toolInput.todos as Todo[]}
                            isLatest={isLatestTodoWrite}
                          />
                        </div>
                      )}
                    </div>
                  );
                }
              });
            })()}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t bg-white dark:bg-gray-900 p-3">
        <div className="flex gap-2">
          <Input
            placeholder="Describe your app..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1 rounded-lg border shadow-sm focus:shadow-sm transition-shadow bg-white dark:bg-gray-800 text-sm h-9"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-9 w-9 rounded-lg bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Sparkles, Terminal, ChevronDown, DollarSign } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { useSession, useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { ChatMessage } from "./chat-message";
import type { FullError } from "./runtime-error-message";
import { TodoList, type Todo } from "./todo-list";
import { ToolUseGroup } from "./tool-use-group";
import { FeatureContextCard } from "./feature-context-card";
import { UnifiedInput } from "./unified-input";
import type { Feature } from "@/lib/types/features";
import { buildEnhancedPrompt } from "@/lib/types/features";
import type { DesignForBuild } from "@/lib/types/designs";
import { generateId } from "@/lib/uuid";
import type { AIProvider } from "@/lib/agent/flows";
import { calculateCost } from "@/lib/utils/cost-calculator";

// Module-level Set to track projects that have auto-started
// This persists across React Strict Mode's mount/unmount/remount cycle
const autoStartedProjects = new Set<string>();

interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolUse?: string;
  toolContext?: string;
  avatarUrl?: string;
  imageUrls?: string[]; // Preview URLs for attached images
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInput?: any; // Stores the input data from tool use (e.g., todos for TodoWrite)
  eventData?: Record<string, unknown>; // Full event_data for operational logs
  usage?: TokenUsage; // Token usage for cost tracking (assistant messages)
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

interface FeatureContext {
  appIdea: string;
  features: Feature[];
  imageKeys?: string[];
  designs?: DesignForBuild[];
}

interface ChatPanelProps {
  projectId: string;
  sandboxId?: string;
  featureContext?: FeatureContext;
  /** Initial AI provider loaded from the project */
  initialAiProvider?: AIProvider;
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
    // Exclude TodoWrite and RuntimeError from grouping - they need special rendering
    if (message.role === 'system' && message.toolUse && message.toolUse !== 'TodoWrite' && message.toolUse !== 'RuntimeError') {
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

// Helper to identify system log messages that can be filtered
function isSystemLogMessage(message: Message): boolean {
  if (message.role !== "system") return false;
  if (message.toolUse) return false; // Keep tool use messages (Read, Write, etc.)
  const content = message.content;
  return (
    content.startsWith("[Setup]") ||
    content.startsWith("[E2B-SDK]") ||
    content.startsWith("[E2B]") ||
    content.startsWith("[SDK]")
  );
}

// Queued message interface
interface QueuedMessage {
  id: string;
  text: string;
  imageKeys: string[];
  imagePreviewUrls: string[];
  timestamp: Date;
}

export function ChatPanel({ projectId, sandboxId, featureContext, initialAiProvider }: ChatPanelProps) {
  const { isLoaded } = useSession();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiProvider, setAIProvider] = useState<AIProvider>(initialAiProvider || "claude-sdk");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [openTodoId, setOpenTodoId] = useState<string | null>(null);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [isStopping, setIsStopping] = useState(false);
  const [showSystemLogs, setShowSystemLogs] = useState(false);
  const [showCostTracking, setShowCostTracking] = useState(false);
  const [costSummary, setCostSummary] = useState({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCost: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesCountRef = useRef(0);
  const seenEventIds = useRef<{ order: string[]; set: Set<string> }>({
    order: [],
    set: new Set(),
  });
  const lastTimestampRef = useRef<string | null>(null);
  const MAX_EVENT_CACHE = 500;
  const didInitialFetchRef = useRef(false);
  const pendingUserMessageIds = useRef<Set<string>>(new Set());
  const didAutoStartRef = useRef(false);
  const processedUsageIds = useRef<Set<string>>(new Set());
  // const savedEvents = useRef<Set<string>>(new Set()); // No longer needed - saves are backend-triggered

  // Reset local caches when switching projects
  useEffect(() => {
    seenEventIds.current = { order: [], set: new Set() };
    // savedEvents.current = new Set(); // No longer needed - saves are backend-triggered
    lastTimestampRef.current = null;
    didInitialFetchRef.current = false;
    didAutoStartRef.current = false;
    pendingUserMessageIds.current.clear();
    processedUsageIds.current.clear();
    prevMessagesCountRef.current = 0;
    setMessages([]);
    setInitialLoadComplete(false);
    setQueuedMessages([]);
    setIsStopping(false);
    setIsNearBottom(true);
    setUnreadCount(0);
    setCostSummary({ totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCost: 0 });
  }, [projectId]);

  // Handle scroll events to track if user is near bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const threshold = 100; // pixels from bottom to consider "near bottom"

    const nearBottom = distanceFromBottom <= threshold;
    setIsNearBottom(nearBottom);

    // Reset unread count when user scrolls to bottom
    if (nearBottom) {
      setUnreadCount(0);
    }
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnreadCount(0);
  }, []);

  // Smart auto-scroll: only scroll when user is at/near bottom
  // Only count visible messages (exclude system log messages when toggle is off)
  useEffect(() => {
    const visibleMessages = showSystemLogs
      ? messages
      : messages.filter(m => !isSystemLogMessage(m));
    const visibleCount = visibleMessages.length;
    const newMessageCount = visibleCount - prevMessagesCountRef.current;
    prevMessagesCountRef.current = visibleCount;

    if (newMessageCount > 0) {
      if (isNearBottom) {
        // User is at bottom, auto-scroll
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        // User scrolled up, increment unread count
        setUnreadCount(prev => prev + newMessageCount);
      }
    }
  }, [messages, isNearBottom, showSystemLogs]);

  // Auto-open the latest todo list when messages change
  useEffect(() => {
    const lastTodoWriteMessage = messages
      .filter((m) => m.toolUse === "TodoWrite")
      .pop();

    if (lastTodoWriteMessage) {
      setOpenTodoId(lastTodoWriteMessage.id);
    }
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
        id: generateId(),
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
        // Extract imageUrls from event_data if present
        const imageUrls = Array.isArray(event.event_data?.imageUrls)
          ? event.event_data.imageUrls as string[]
          : undefined;
        setMessages((prev) => [...prev, {
          id: event.id || generateId(),
          role: "user",
          content,
          timestamp: new Date(event.created_at),
          avatarUrl: user?.imageUrl,
          imageUrls,
        }]);
      }
      markEventProcessed(event);
      return;
    }

    if (event.event_type === "assistant") {
      const content =
        (event.event_data?.message?.content as AssistantContentBlock[] | undefined) || [];

      // Extract usage from message (SDK provides it at message.usage)
      const usage = event.event_data?.message?.usage as TokenUsage | undefined;
      const messageId = event.event_data?.message?.id as string | undefined;

      // Update cost summary (deduplicate by message ID for parallel tool uses)
      if (usage && messageId && !processedUsageIds.current.has(messageId)) {
        processedUsageIds.current.add(messageId);
        const cost = calculateCost(usage);
        // Total input includes non-cached + cache creation + cache read
        const totalIn = (usage.input_tokens || 0) +
                       (usage.cache_creation_input_tokens || 0) +
                       (usage.cache_read_input_tokens || 0);
        setCostSummary((prev) => ({
          totalInputTokens: prev.totalInputTokens + totalIn,
          totalOutputTokens: prev.totalOutputTokens + (usage.output_tokens || 0),
          totalCacheReadTokens: prev.totalCacheReadTokens + (usage.cache_read_input_tokens || 0),
          totalCost: prev.totalCost + cost,
        }));
      }

      for (const block of content) {
        if (isTextBlock(block)) {
          const text = block.text;
          setMessages((prev) => [...prev, {
            id: generateId(),
            role: "assistant",
            content: text,
            timestamp: new Date(event.created_at),
            usage, // Include usage for per-message display
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
            toolContext = input.command;  // Full command, no truncation
          } else if (block.name === "Glob" && input.pattern) {
            toolContext = input.pattern;
          }

          setMessages((prev) => [...prev, {
            id: generateId(),
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

    // Handle runtime errors from Expo Go
    if (event.event_type === "runtime_error") {
      const errorData = event.event_data;
      setMessages((prev) => [...prev, {
        id: event.id || generateId(),
        role: "system",
        content: errorData.message || "A runtime error occurred in the app",
        timestamp: new Date(event.created_at),
        toolUse: "RuntimeError",
        eventData: errorData as Record<string, unknown>,
      }]);
      markEventProcessed(event);
      return;
    }

    if (event.event_type === "result") {
      setIsLoading(false);
      setIsStopping(false);

      // Check for usage in result event (cumulative usage from SDK)
      const resultUsage = event.event_data?.usage as TokenUsage | undefined;
      const totalCostUsd = event.event_data?.total_cost_usd as number | undefined;

      if (resultUsage) {
        const cost = totalCostUsd ?? calculateCost(resultUsage);
        // Total input includes non-cached + cache creation + cache read
        const totalIn = (resultUsage.input_tokens || 0) +
                       (resultUsage.cache_creation_input_tokens || 0) +
                       (resultUsage.cache_read_input_tokens || 0);
        setCostSummary({
          totalInputTokens: totalIn,
          totalOutputTokens: resultUsage.output_tokens || 0,
          totalCacheReadTokens: resultUsage.cache_read_input_tokens || 0,
          totalCost: cost,
        });
      }

      if (event.event_data.subtype === "success") {
        setMessages((prev) => [...prev, {
          id: generateId(),
          role: "system",
          content: "✓ Task completed",
          timestamp: new Date(event.created_at),
        }]);
      } else if (event.event_data.subtype === "cancelled") {
        // User stopped the agent
        setMessages((prev) => [...prev, {
          id: generateId(),
          role: "system",
          content: "⏹ Task cancelled by user",
          timestamp: new Date(event.created_at),
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id: generateId(),
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
    // Mark initial load as complete (used by auto-start)
    setInitialLoadComplete(true);
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

  // Send message helper - used by both auto-start and manual send
  const sendMessageProgrammatically = useCallback(async (messageText: string, imageKeys: string[] = [], imagePreviewUrls: string[] = [], displayMessage?: string) => {
    if (!messageText.trim() || !user) return;

    // If agent is busy, queue the message instead of sending
    if (isLoading) {
      const queuedMessage: QueuedMessage = {
        id: generateId(),
        text: messageText,
        imageKeys,
        imagePreviewUrls,
        timestamp: new Date(),
      };
      setQueuedMessages(prev => [...prev, queuedMessage]);
      console.log("[ChatPanel] Message queued:", queuedMessage.id);
      return;
    }

    // Check if this is the first message and we have feature context
    const isFirstMessage = messages.filter(m => m.role === "user").length === 0;
    const shouldIncludeContext = isFirstMessage && featureContext && featureContext.features.length > 0;

    // Build the prompt - include feature context for first message
    let promptContent = messageText;
    if (shouldIncludeContext) {
      const includedFeatures = featureContext.features.filter(f => f.is_included);
      const excludedFeatures = featureContext.features.filter(f => !f.is_included);
      // Convert designs to the format expected by buildEnhancedPrompt
      const designs = featureContext.designs?.map(d => ({
        screenName: d.screenName,
        html: d.html,
      }));
      promptContent = buildEnhancedPrompt(messageText, {
        appIdea: featureContext.appIdea,
        includedFeatures,
        excludedFeatures,
        designs,
      });
    }

    // Use displayMessage if provided, otherwise use messageText
    const messageToDisplay = displayMessage || messageText;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: messageToDisplay,
      timestamp: new Date(),
      avatarUrl: user?.imageUrl,
      imageUrls: imagePreviewUrls.length > 0 ? imagePreviewUrls : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    pendingUserMessageIds.current.add(userMessage.id);
    setIsLoading(true);

    // Scroll to bottom and reset unread count when user sends a message
    setIsNearBottom(true);
    setUnreadCount(0);
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    try {
      const response = await fetch("/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptContent, // Enhanced prompt for the AI agent
          displayMessage: messageToDisplay, // Short message for database/display
          projectId,
          sandboxId,
          workingDirectory: "/home/user/project",
          clientMessageId: userMessage.id,
          imageKeys, // R2 keys of attached images
          imagePreviewUrls, // Signed URLs for displaying in chat UI
          aiProvider, // Selected AI provider (claude or gemini)
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start agent");
      }

      const data = await response.json();
      console.log("Agent started:", data);
      // Loading indicator is now shown via isLoading state, not as a message
    } catch (error) {
      console.error("Failed to send message:", error);
      pendingUserMessageIds.current.delete(userMessage.id);
      setMessages((prev) => [...prev, {
        id: generateId(),
        role: "system",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      }]);
      setIsLoading(false);
    }
  }, [isLoading, user, messages, featureContext, projectId, sandboxId, aiProvider]);

  // Handle "Fix this error" button click from RuntimeErrorMessage
  const handleFixError = useCallback((errorMessage: string, fullError?: FullError) => {
    // Extract just the error message without the location info for display
    const shortErrorMessage = fullError?.message || errorMessage.split('\n')[0];

    // Friendly message shown to user
    const displayMessage = `🔧 Fix this error: ${shortErrorMessage}`;

    // Full detailed prompt for Claude (hidden from user)
    let fixPrompt = `Please fix this runtime error that occurred in the app:\n\n${errorMessage}`;

    if (fullError) {
      const error = fullError;

      if (error.filename && error.lineNumber) {
        fixPrompt += `\n\nFile: ${error.filename}`;
        fixPrompt += `\nLine: ${error.lineNumber}`;
      }

      if (error.stack) {
        // Include first few lines of stack trace for context
        const stackLines = error.stack.split('\n').slice(0, 5).join('\n');
        fixPrompt += `\n\nStack trace:\n${stackLines}`;
      }

      if (error.componentStack) {
        const componentLines = error.componentStack.split('\n').slice(0, 3).join('\n');
        fixPrompt += `\n\nComponent stack:\n${componentLines}`;
      }
    }

    fixPrompt += "\n\nPlease identify the issue and fix the code.";

    // Send with friendly display message, but full error details to Claude
    sendMessageProgrammatically(fixPrompt, [], [], displayMessage);
  }, [sendMessageProgrammatically]);

  // Stop the running agent
  const handleStopAgent = useCallback(async () => {
    if (!isLoading || isStopping) return;

    setIsStopping(true);
    console.log("[ChatPanel] Stopping agent...");

    try {
      const response = await fetch("/api/agents/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("[ChatPanel] Failed to stop agent:", data.error);
        // Reset stopping state on error
        setIsStopping(false);
      } else {
        console.log("[ChatPanel] Stop request sent successfully");
        // The result event will set isLoading to false and reset isStopping
      }
    } catch (error) {
      console.error("[ChatPanel] Error stopping agent:", error);
      setIsStopping(false);
    }
  }, [isLoading, isStopping, projectId]);

  // Remove a message from the queue
  const removeFromQueue = useCallback((id: string) => {
    setQueuedMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  // Process queued messages when agent becomes idle
  useEffect(() => {
    if (isLoading || queuedMessages.length === 0) return;

    // Small delay before processing next message for better UX
    const timeoutId = setTimeout(() => {
      const [next, ...remaining] = queuedMessages;
      setQueuedMessages(remaining);
      console.log("[ChatPanel] Processing queued message:", next.id);
      // Use setTimeout to avoid state update conflicts
      sendMessageProgrammatically(next.text, next.imageKeys, next.imagePreviewUrls);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [isLoading, queuedMessages, sendMessageProgrammatically]);

  // Auto-start when coming from planning with feature context
  useEffect(() => {
    // Only auto-start if:
    // 1. We have an app idea (from planning or direct creation)
    // 2. Initial fetch has completed
    // 3. Realtime subscription is connected (ensures all logs are received)
    // 4. We haven't already auto-started THIS project (module-level Set survives Strict Mode)
    // 5. There are no existing messages (fresh start)
    // 6. Not already loading
    if (
      featureContext &&
      featureContext.appIdea &&
      initialLoadComplete &&
      channelStatus === "connected" &&
      !autoStartedProjects.has(projectId) &&
      !didAutoStartRef.current &&
      messages.length === 0 &&
      !isLoading &&
      user
    ) {
      // Mark as started in BOTH places to prevent any race condition
      autoStartedProjects.add(projectId);
      didAutoStartRef.current = true;

      // Use the user's actual app idea as the first message, including any attached images
      const imageKeys = featureContext.imageKeys || [];

      // If there are images, fetch signed preview URLs before sending
      if (imageKeys.length > 0) {
        (async () => {
          try {
            const response = await fetch("/api/images/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageKeys }),
            });

            if (response.ok) {
              const { previewUrls } = await response.json();
              sendMessageProgrammatically(featureContext.appIdea, imageKeys, previewUrls);
            } else {
              // Fallback: send without preview URLs (images won't display but agent still gets them)
              console.warn("[ChatPanel] Failed to fetch preview URLs, sending without them");
              sendMessageProgrammatically(featureContext.appIdea, imageKeys);
            }
          } catch (error) {
            console.error("[ChatPanel] Error fetching preview URLs:", error);
            sendMessageProgrammatically(featureContext.appIdea, imageKeys);
          }
        })();
      } else {
        sendMessageProgrammatically(featureContext.appIdea);
      }
    }
  }, [featureContext, initialLoadComplete, channelStatus, messages.length, isLoading, user, sendMessageProgrammatically, projectId]);

  // Handle manual message send from UnifiedInput
  const handleSendMessage = useCallback((text: string, imageKeys: string[], imagePreviewUrls: string[]) => {
    sendMessageProgrammatically(text, imageKeys, imagePreviewUrls);
  }, [sendMessageProgrammatically]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 pt-4 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-fade-in-up">
            {/* Magical logo container */}
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl glass-morphism flex items-center justify-center p-3 glow-primary">
                <Image
                  src="/appily-logo.svg"
                  alt="Appily AI"
                  width={32}
                  height={32}
                  className="animate-float-gentle"
                />
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-[var(--magic-gold)] animate-sparkle" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold font-display text-foreground">
                Chat with Claude
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Describe your app and watch the magic happen
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 w-full max-w-full overflow-hidden">
            {/* Debug Toggles: System Logs & Cost Tracking */}
            {(() => {
              const hiddenCount = messages.filter(isSystemLogMessage).length;
              const hasSystemLogs = hiddenCount > 0;
              const hasMessages = messages.length > 0;

              // Show toggle row if we have system logs or any messages (for cost toggle)
              if (!hasSystemLogs && !hasMessages) return null;

              return (
                <div className="flex items-center justify-end gap-4 pb-2 mb-2 border-b border-border/30">
                  {/* System Logs Toggle */}
                  {hasSystemLogs && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Terminal className="h-3 w-3" />
                        <span>System Logs</span>
                        {!showSystemLogs && hiddenCount > 0 && (
                          <span className="text-muted-foreground/60">
                            ({hiddenCount} hidden)
                          </span>
                        )}
                      </div>
                      <Toggle
                        variant="outline"
                        size="sm"
                        pressed={showSystemLogs}
                        onPressedChange={setShowSystemLogs}
                        className="h-6 w-10 data-[state=on]:bg-primary/20"
                        aria-label="Toggle system logs visibility"
                      >
                        <span className="text-[10px] font-medium">
                          {showSystemLogs ? "ON" : "OFF"}
                        </span>
                      </Toggle>
                    </div>
                  )}

                  {/* Cost Tracking Toggle - always show when there are messages */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      <span>Cost</span>
                      {showCostTracking && (
                        <span className="text-muted-foreground/60 font-mono">
                          (${costSummary.totalCost.toFixed(4)})
                        </span>
                      )}
                    </div>
                    <Toggle
                      variant="outline"
                      size="sm"
                      pressed={showCostTracking}
                      onPressedChange={setShowCostTracking}
                      className="h-6 w-10 data-[state=on]:bg-primary/20"
                      aria-label="Toggle cost tracking visibility"
                    >
                      <span className="text-[10px] font-medium">
                        {showCostTracking ? "ON" : "OFF"}
                      </span>
                    </Toggle>
                  </div>
                </div>
              );
            })()}
            {/* Messages with inline todos and grouped tool uses */}
            {(() => {
              const visibleMessages = showSystemLogs
                ? messages
                : messages.filter(m => !isSystemLogMessage(m));
              const messageGroups = groupMessages(visibleMessages);
              // Calculate indices based on visible messages for correct matching
              const lastTodoWriteIndex = visibleMessages.map((m, i) => m.toolUse === "TodoWrite" ? i : -1).filter(i => i !== -1).pop() ?? -1;
              const firstUserMessageIndex = visibleMessages.findIndex(m => m.role === "user");

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
                  const isFirstUserMessage = index === firstUserMessageIndex && message.role === "user";
                  const showFeatureContext = isFirstUserMessage && featureContext && featureContext.features.length > 0;

                  return (
                    <div key={message.id} className="w-full max-w-full overflow-hidden">
                      <ChatMessage message={message} onFixError={handleFixError} showCostTracking={showCostTracking} />
                      {/* Show feature context after first user message */}
                      {showFeatureContext && (
                        <div className="mt-1.5 ml-auto max-w-[85%]">
                          <FeatureContextCard
                            appIdea={featureContext.appIdea}
                            features={featureContext.features}
                            defaultOpen={false}
                          />
                        </div>
                      )}
                      {/* Show todos after TodoWrite tool use */}
                      {message.toolUse === "TodoWrite" && message.toolInput?.todos && (
                        <div className="mt-1.5 pl-9">
                          <TodoList
                            todos={message.toolInput.todos as Todo[]}
                            isLatest={isLatestTodoWrite}
                            isOpen={openTodoId === message.id}
                            onOpenChange={(open) => {
                              setOpenTodoId(open ? message.id : null);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                }
              });
            })()}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                </div>
                <span className="text-sm text-muted-foreground">
                  {isStopping ? "Stopping..." : `${aiProvider === "gemini" ? "Gemini" : "Claude"} is thinking`}
                </span>
              </div>
            )}

            {/* Queued Messages */}
            {queuedMessages.length > 0 && (
              <div className="space-y-2 mt-2 border-t border-dashed border-border/50 pt-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Queued ({queuedMessages.length})
                </div>
                {queuedMessages.map((qm) => (
                  <div
                    key={qm.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-dashed border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">
                        {qm.text}
                      </p>
                      {qm.imagePreviewUrls.length > 0 && (
                        <span className="text-xs text-muted-foreground/60">
                          +{qm.imagePreviewUrls.length} image(s)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromQueue(qm.id)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Remove from queue"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input - Using UnifiedInput */}
      <div className="relative">
        {/* New messages pill */}
        {unreadCount > 0 && !isNearBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:bg-primary/90 transition-all animate-fade-in-up flex items-center gap-1.5 z-10"
          >
            <ChevronDown className="w-4 h-4" />
            {unreadCount === 1 ? "1 new message" : `${unreadCount} new messages`}
          </button>
        )}

        {/* Cost Summary Bar */}
        {showCostTracking && (
          <div className="px-3 py-2 border-t border-border/50 bg-muted/30 text-xs text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>
                {costSummary.totalCost > 0 ? (
                  <>
                    Total: {costSummary.totalInputTokens.toLocaleString()} in
                    {costSummary.totalCacheReadTokens > 0 && (
                      <span className="text-green-600 dark:text-green-400">
                        {" "}({Math.round((costSummary.totalCacheReadTokens / costSummary.totalInputTokens) * 100)}% cached)
                      </span>
                    )}
                    {" / "}{costSummary.totalOutputTokens.toLocaleString()} out
                  </>
                ) : (
                  <span className="text-muted-foreground/50">Waiting for usage data from SDK...</span>
                )}
              </span>
              <span className="font-mono font-medium">${costSummary.totalCost.toFixed(4)}</span>
            </div>
          </div>
        )}

        <UnifiedInput
          variant="build"
          onSubmit={handleSendMessage}
          isLoading={isLoading}
          projectId={projectId}
          aiProvider={aiProvider}
          onStop={handleStopAgent}
          isStopping={isStopping}
          queuedCount={queuedMessages.length}
        />
      </div>
    </div>
  );
}

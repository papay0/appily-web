"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  User,
  Wrench,
  CheckCircle2,
  XCircle,
  Terminal,
  FileText,
  FilePlus,
  FileEdit,
  ListTodo,
  FolderSearch,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { OperationalEventDetails } from "./operational-event-details";
import { ImageLightbox } from "./image-lightbox";
import { RuntimeErrorMessage, FullError, DeviceInfo } from "./runtime-error-message";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolUse?: string;
  toolContext?: string; // Additional context about tool use
  avatarUrl?: string;
  imageUrls?: string[]; // Preview URLs for attached images
  eventData?: Record<string, unknown>; // Full event_data for operational logs
}

interface ChatMessageProps {
  message: Message;
  onFixError?: (errorMessage: string, fullError?: FullError) => void;
}

// Separate component for user messages to handle lightbox state
function UserMessageWithLightbox({ message, hasImages }: { message: Message; hasImages: boolean }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className="flex items-end gap-2 w-full justify-end animate-message-right">
        <div className="flex flex-col items-end gap-1.5 max-w-[80%] min-w-0">
          {/* Image thumbnails */}
          {hasImages && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {message.imageUrls!.map((url, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleImageClick(index)}
                  className="w-16 h-16 rounded-lg overflow-hidden ring-1 ring-white/20 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <Image
                    src={url}
                    alt={`Attached image ${index + 1}`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
          {/* Text bubble */}
          <div className="message-bubble-user px-4 py-2.5 w-full max-w-full overflow-hidden [word-break:break-all]">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          </div>
        </div>
        {message.avatarUrl ? (
          <Image
            src={message.avatarUrl}
            alt="User avatar"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/20"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-[var(--magic-violet)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
            <User className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Lightbox for image preview */}
      {hasImages && (
        <ImageLightbox
          images={message.imageUrls!}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          startIndex={lightboxIndex}
        />
      )}
    </>
  );
}

export function ChatMessage({ message, onFixError }: ChatMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to check if this is an expandable message (e.g., stderr with full content)
  const isExpandableMessage =
    message.eventData?.isExpandable === true &&
    typeof message.eventData?.fullMessage === "string";

  // Helper to check if this is an operational event with details
  const isOperationalEvent =
    message.eventData?.subtype === "operation" &&
    message.eventData?.details &&
    typeof message.eventData.details === "object";

  const getOperationalDetails = () => {
    if (!isOperationalEvent) return null;

    return {
      details: message.eventData?.details as Record<string, unknown>,
      status: (message.eventData?.status as string) || "unknown",
      operation: (message.eventData?.operation as string) || "unknown",
    };
  };

  // User messages - Messenger style gradient bubble
  if (message.role === "user") {
    const hasImages = !!(message.imageUrls && message.imageUrls.length > 0);

    return (
      <UserMessageWithLightbox message={message} hasImages={hasImages} />
    );
  }

  // Assistant messages - Glassmorphic bubble
  if (message.role === "assistant") {
    return (
      <div className="flex items-end gap-2 w-full animate-message-left">
        {/* AI Avatar */}
        <div className="h-7 w-7 rounded-full glass-morphism flex items-center justify-center flex-shrink-0 p-1">
          <Image
            src="/appily-logo.svg"
            alt="AI"
            width={16}
            height={16}
          />
        </div>
        <div className="message-bubble-ai px-4 py-2.5 max-w-[85%] overflow-hidden break-words">
          <div className="text-sm leading-relaxed text-foreground overflow-hidden break-words [overflow-wrap:anywhere]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Customize code blocks
                code({ node, inline, className, children, ...props }: {
                  node?: unknown;
                  inline?: boolean;
                  className?: string;
                  children?: React.ReactNode;
                }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg my-2"
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // Customize headings
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
                ),
                // Customize lists
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                ),
                // Customize links
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {children}
                  </a>
                ),
                // Customize paragraphs
                p: ({ children }) => <p className="my-2">{children}</p>,
                // Customize blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">
                    {children}
                  </blockquote>
                ),
                // Customize tables
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-xs border-t border-gray-200 dark:border-gray-700">
                    {children}
                  </td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // System messages (tool use, completion, errors)
  if (message.role === "system") {
    // Runtime error from Expo Go - show special error component
    if (message.toolUse === "RuntimeError" && message.eventData) {
      const errorData = message.eventData;
      const fullError = errorData.fullError as FullError | undefined;
      const deviceInfo = errorData.deviceInfo as DeviceInfo | undefined;

      return (
        <RuntimeErrorMessage
          message={message.content}
          fullError={fullError}
          deviceInfo={deviceInfo}
          onFixError={onFixError ? () => onFixError(message.content, fullError) : undefined}
        />
      );
    }

    // Tool use indicator with specific icons - glassmorphic style
    if (message.toolUse) {
      // Determine icon and color based on tool type
      let Icon = Wrench;
      let iconColorClass = "text-primary";
      let glowClass = "";

      if (message.toolUse === "Bash") {
        Icon = Terminal;
        iconColorClass = "text-gray-600 dark:text-gray-300";
      } else if (message.toolUse === "Read") {
        Icon = FileText;
        iconColorClass = "text-blue-500";
      } else if (message.toolUse === "Write") {
        Icon = FilePlus;
        iconColorClass = "text-[var(--magic-violet)]";
        glowClass = "shadow-[var(--magic-violet)]/10";
      } else if (message.toolUse === "Edit") {
        Icon = FileEdit;
        iconColorClass = "text-amber-500";
      } else if (message.toolUse === "TodoWrite") {
        Icon = ListTodo;
        iconColorClass = "text-[var(--magic-mint)]";
      } else if (message.toolUse === "Glob") {
        Icon = FolderSearch;
        iconColorClass = "text-indigo-500";
      }

      return (
        <div className="flex items-start gap-2 my-1.5 w-full animate-fade-in-up">
          <div
            className={cn(
              "inline-flex items-start gap-2 px-3 py-1.5 rounded-xl",
              "glass-morphism",
              "text-xs max-w-xl",
              glowClass && `shadow-lg ${glowClass}`
            )}
          >
            <Icon className={cn("h-3.5 w-3.5 flex-shrink-0 mt-0.5", iconColorClass)} />
            <span className="font-medium text-foreground/80 break-words whitespace-normal">{message.content}</span>
            {message.toolContext && (
              <span className="opacity-60 font-mono text-xs break-all whitespace-normal">• {message.toolContext}</span>
            )}
          </div>
        </div>
      );
    }

    // Expo URL ready indicator - celebration style
    if (message.content.startsWith("🎉 Expo ready:")) {
      return (
        <div className="flex items-start gap-2 my-2 w-full animate-bounce-in">
          <div className="inline-flex items-start gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--magic-mint)] to-green-500 text-white shadow-lg shadow-green-500/20">
            <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 animate-sparkle" />
            <span className="font-medium text-sm break-words whitespace-normal">{message.content}</span>
          </div>
        </div>
      );
    }

    // Success indicator - with glow
    if (message.content.startsWith("✓")) {
      const operationalDetails = getOperationalDetails();
      return (
        <div className="flex flex-col items-start gap-0 my-1.5 w-full animate-tool-complete">
          <div className="inline-flex items-start gap-2 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span className="font-medium text-xs break-words whitespace-normal">{message.content}</span>
          </div>
          {operationalDetails && (
            <OperationalEventDetails
              details={operationalDetails.details}
              status={operationalDetails.status}
              operation={operationalDetails.operation}
            />
          )}
        </div>
      );
    }

    // Error indicator - subtle red
    if (message.content.startsWith("✗") || message.content.startsWith("Error")) {
      const operationalDetails = getOperationalDetails();
      return (
        <div className="flex flex-col items-start gap-0 my-1.5 w-full animate-fade-in-up">
          <div className="inline-flex items-start gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span className="font-medium text-xs break-words whitespace-normal">{message.content}</span>
          </div>
          {operationalDetails && (
            <OperationalEventDetails
              details={operationalDetails.details}
              status={operationalDetails.status}
              operation={operationalDetails.operation}
            />
          )}
        </div>
      );
    }

    // Generic system message (thinking, etc.) - with typing dots for "thinking"
    const operationalDetails = getOperationalDetails();
    const isThinking = message.content.toLowerCase().includes("thinking");

    // Check if this is an expandable message (stderr with full content)
    if (isExpandableMessage) {
      const fullMessage = message.eventData?.fullMessage as string;
      return (
        <div className="flex flex-col items-start gap-0 my-1.5 w-full animate-fade-in-up">
          <div className="inline-flex flex-col gap-1.5 px-3 py-2 rounded-xl glass-morphism text-xs max-w-[90%]">
            <span className="font-medium text-muted-foreground break-words whitespace-pre-wrap font-mono">
              {isExpanded ? `[Gemini] stderr: ${fullMessage}` : message.content}
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="self-start text-primary hover:text-primary/80 text-[10px] font-medium transition-colors"
            >
              {isExpanded ? "Show less" : "Show more"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start gap-0 my-1.5 w-full animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-morphism text-xs">
          {isThinking ? (
            <>
              <span className="font-medium text-muted-foreground">Claude is thinking</span>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot animate-typing-dot-1" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot animate-typing-dot-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot animate-typing-dot-3" />
              </span>
            </>
          ) : (
            <span className="font-medium text-muted-foreground break-words whitespace-normal">{message.content}</span>
          )}
        </div>
        {operationalDetails && (
          <OperationalEventDetails
            details={operationalDetails.details}
            status={operationalDetails.status}
            operation={operationalDetails.operation}
          />
        )}
      </div>
    );
  }

  return null;
}

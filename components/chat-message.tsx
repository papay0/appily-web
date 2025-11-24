"use client";

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

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolUse?: string;
  toolContext?: string; // Additional context about tool use
  avatarUrl?: string;
  eventData?: Record<string, unknown>; // Full event_data for operational logs
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
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

  // User messages
  if (message.role === "user") {
    return (
      <div className="flex items-start gap-2.5 w-full justify-end animate-in slide-in-from-right-2 duration-300">
        <div className="bg-blue-600 text-white rounded-lg px-3 py-2 max-w-[80%] overflow-hidden shadow-sm">
          <p className="text-sm whitespace-pre-wrap break-all leading-normal">{message.content}</p>
        </div>
        {message.avatarUrl ? (
          <Image
            src={message.avatarUrl}
            alt="User avatar"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <User className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>
    );
  }

  // Assistant messages
  if (message.role === "assistant") {
    return (
      <div className="flex items-start gap-2.5 w-full animate-in slide-in-from-left-2 duration-300">
        <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 p-1.5">
          <Image
            src="/appily-logo.svg"
            alt="Appily AI"
            width={16}
            height={16}
            className="object-contain"
          />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 max-w-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-100">
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
    // Tool use indicator with specific icons
    if (message.toolUse) {
      // Determine icon and color based on tool type
      let Icon = Wrench;
      let badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800";

      if (message.toolUse === "Bash") {
        Icon = Terminal;
        badgeClass = "bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-100 border-gray-700 dark:border-gray-600";
      } else if (message.toolUse === "Read") {
        Icon = FileText;
        badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800";
      } else if (message.toolUse === "Write") {
        Icon = FilePlus;
        badgeClass = "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800";
      } else if (message.toolUse === "Edit") {
        Icon = FileEdit;
        badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800";
      } else if (message.toolUse === "TodoWrite") {
        Icon = ListTodo;
        badgeClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800";
      } else if (message.toolUse === "Glob") {
        Icon = FolderSearch;
        badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800";
      }

      return (
        <div className="flex items-start gap-2 my-1.5 w-full animate-in fade-in duration-300 pl-9">
          <Badge
            variant="secondary"
            className={cn(
              "gap-1.5 inline-flex items-start border shadow-sm px-2.5 py-1 rounded-md text-xs max-w-xl",
              badgeClass
            )}
          >
            <Icon className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="font-medium break-words whitespace-normal">{message.content}</span>
            {message.toolContext && (
              <span className="opacity-70 font-mono break-all whitespace-normal">• {message.toolContext}</span>
            )}
          </Badge>
        </div>
      );
    }

    // Expo URL ready indicator (special green badge with larger size)
    if (message.content.startsWith("🎉 Expo ready:")) {
      return (
        <div className="flex items-start gap-2 my-1.5 w-full animate-in zoom-in duration-500 pl-9">
          <Badge
            variant="default"
            className="gap-1.5 bg-green-500 hover:bg-green-600 text-white py-1.5 px-3 text-xs font-medium inline-flex items-start shadow-sm border border-green-400 rounded-md max-w-xl"
          >
            <Sparkles className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="break-words whitespace-normal">{message.content}</span>
          </Badge>
        </div>
      );
    }

    // Success indicator
    if (message.content.startsWith("✓")) {
      const operationalDetails = getOperationalDetails();
      return (
        <div className="flex flex-col items-start gap-0 my-1.5 w-full animate-in fade-in duration-300 pl-9">
          <Badge
            variant="default"
            className="gap-1.5 bg-green-500 hover:bg-green-600 text-white inline-flex items-start shadow-sm border border-green-400 px-2.5 py-1 rounded-md text-xs max-w-xl"
          >
            <CheckCircle2 className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="font-medium break-words whitespace-normal">{message.content}</span>
          </Badge>
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

    // Error indicator
    if (message.content.startsWith("✗") || message.content.startsWith("Error")) {
      const operationalDetails = getOperationalDetails();
      return (
        <div className="flex flex-col items-start gap-0 my-1.5 w-full animate-in fade-in duration-300 pl-9">
          <Badge variant="destructive" className="gap-1.5 inline-flex items-start shadow-sm border px-2.5 py-1 rounded-md text-xs max-w-xl">
            <XCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="font-medium break-words whitespace-normal">{message.content}</span>
          </Badge>
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

    // Generic system message (thinking, etc.)
    const operationalDetails = getOperationalDetails();
    return (
      <div className="flex flex-col items-start gap-0 my-1.5 w-full animate-in fade-in duration-300 pl-9">
        <Badge variant="outline" className="gap-1.5 inline-flex items-start bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border px-2.5 py-1 rounded-md text-xs max-w-xl">
          <span className="font-medium text-muted-foreground break-words whitespace-normal">{message.content}</span>
        </Badge>
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

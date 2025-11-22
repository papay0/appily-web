"use client";

import { cn } from "@/lib/utils";
import {
  Bot,
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
} from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolUse?: string;
  toolContext?: string; // Additional context about tool use
  avatarUrl?: string;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  // User messages
  if (message.role === "user") {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.avatarUrl ? (
          <Image
            src={message.avatarUrl}
            alt="User avatar"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </div>
    );
  }

  // Assistant messages
  if (message.role === "assistant") {
    return (
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="bg-muted rounded-lg px-4 py-2 max-w-[80%]">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
      let badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";

      if (message.toolUse === "Bash") {
        Icon = Terminal;
        badgeClass = "bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-100";
      } else if (message.toolUse === "Read") {
        Icon = FileText;
        badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      } else if (message.toolUse === "Write") {
        Icon = FilePlus;
        badgeClass = "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      } else if (message.toolUse === "Edit") {
        Icon = FileEdit;
        badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      } else if (message.toolUse === "TodoWrite") {
        Icon = ListTodo;
        badgeClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      } else if (message.toolUse === "Glob") {
        Icon = FolderSearch;
        badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
      }

      return (
        <div className="flex items-center justify-center gap-2 my-2">
          <Badge variant="secondary" className={cn("gap-2", badgeClass)}>
            <Icon className="h-3 w-3" />
            <span className="text-xs">{message.content}</span>
            {message.toolContext && (
              <span className="text-xs opacity-70">• {message.toolContext}</span>
            )}
          </Badge>
        </div>
      );
    }

    // Expo URL ready indicator (special green badge with larger size)
    if (message.content.startsWith("🎉 Expo ready:")) {
      return (
        <div className="flex items-center justify-center gap-2 my-3">
          <Badge
            variant="default"
            className="gap-2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 text-sm font-medium"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{message.content}</span>
          </Badge>
        </div>
      );
    }

    // Success indicator
    if (message.content.startsWith("✓")) {
      return (
        <div className="flex items-center justify-center gap-2 my-2">
          <Badge variant="default" className="gap-2 bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-xs">{message.content}</span>
          </Badge>
        </div>
      );
    }

    // Error indicator
    if (message.content.startsWith("✗") || message.content.startsWith("Error")) {
      return (
        <div className="flex items-center justify-center gap-2 my-2">
          <Badge variant="destructive" className="gap-2">
            <XCircle className="h-3 w-3" />
            <span className="text-xs">{message.content}</span>
          </Badge>
        </div>
      );
    }

    // Generic system message (thinking, etc.)
    return (
      <div className="flex items-center justify-center gap-2 my-2">
        <Badge variant="outline" className="gap-2">
          <span className="text-xs text-muted-foreground">{message.content}</span>
        </Badge>
      </div>
    );
  }

  return null;
}
